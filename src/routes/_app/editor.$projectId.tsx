import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase-safe";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, Upload, Play, Pause, Type, Download, Loader as Loader2, Film, Music, Image as ImageIcon, Scissors, Trash2, Wand as Wand2, Volume2, VolumeX, Plus, Library, LayoutGrid, Clock, Split, Video, Headphones, Undo2, Redo2, Brush, Layers, Diamond, Eye, EyeOff, Lock, Unlock, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ExportDialog } from "@/components/export-dialog";
import { Waveform } from "@/components/waveform";
import { VfxOverlay } from "@/components/vfx-overlay";
import { AiVfxAssistant } from "@/components/ai-vfx-assistant";
import { BrushBlurOverlay, DEFAULT_BRUSH_BLUR, type BrushBlurState } from "@/components/brush-blur-overlay";
import { VFX_PRESETS, getPreset, adjustmentsToCss, type VfxCategory, DEFAULT_ADJ } from "@/lib/vfx-presets";
import { SOUND_LIBRARY } from "@/lib/sound-library";
import { decodeAudio, getAudioContext } from "@/lib/audio-utils";
import { processVfxJob, type VfxJob, presetToJob, matchVfxPreset } from "@/lib/ai-vfx-engine";

export const Route = createFileRoute("/_app/editor/$projectId")({
  component: EditorPage,
  head: () => ({ meta: [{ title: "Editor — CreatorCut" }] }),
});

const MAX_AUDIO_TRACKS = 8;
const PX_PER_SEC = 60;

type Keyframe = {
  time: number;      // seconds relative to clip start
  opacity?: number;  // 0..1
  x?: number;
  y?: number;
  scale?: number;    // 1 = 100%
};

type Clip = {
  id: string;
  mediaId: string;
  name: string;
  kind: "video" | "image";
  start: number;
  duration: number;
  originalDuration?: number;
  playbackRate?: number;
  url?: string;
  vfxUrl?: string | null;
  vfxPresetApplied?: string | null;
  bgRemove?: boolean;
  bgMode?: "color" | "image";
  bgColor?: string;
  bgImageUrl?: string | null;
  faceFilter?: string | null;
  vfxPresetId?: string | null;
  storyboardFrames?: { time: number; thumbnail?: string }[];
  muteOriginal?: boolean;
  videoTrack: number;
  brushBlur?: BrushBlurState;
  // Layer properties
  opacity?: number;
  blendMode?: string;
  hidden?: boolean;
  locked?: boolean;
  keyframes?: Keyframe[];
};

type AudioClip = {
  id: string;
  name: string;
  url: string;
  start: number;
  duration: number;
  originalDuration: number;
  playbackRate: number;
  track: number;
  volume: number;
  muted: boolean;
  fadeIn: number;
  fadeOut: number;
  // Mark clips that came from a video file so we can offer "Convert to Video"
  fromVideo: boolean;
};

type TextOverlay = { id: string; text: string; start: number; duration: number; color: string };
type Marker = { id: string; time: number; label: string; color: string };
type Adjustments = { brightness: number; contrast: number; saturation: number; blur: number };
type ViewMode = "timeline" | "storyboard";
type ImportMode = "video" | "audio";
type ActivePanel = "media" | "sounds" | "text" | "effects" | "layers" | "ai";
type KfProp = "opacity" | "x" | "y" | "scale";

// Linear interpolation between keyframes
function interpolateKf(kfs: Keyframe[], time: number, prop: KfProp): number | null {
  const vals = kfs.filter((k) => k[prop] !== undefined).sort((a, b) => a.time - b.time);
  if (vals.length === 0) return null;
  if (time <= vals[0].time) return vals[0][prop] as number;
  if (time >= vals[vals.length - 1].time) return vals[vals.length - 1][prop] as number;
  for (let i = 0; i < vals.length - 1; i++) {
    const a = vals[i], b = vals[i + 1];
    if (time >= a.time && time <= b.time) {
      const t = (time - a.time) / (b.time - a.time);
      return (a[prop] as number) + t * ((b[prop] as number) - (a[prop] as number));
    }
  }
  return null;
}

function getKfProps(clip: Clip, currentTime: number) {
  const localTime = Math.max(0, currentTime - clip.start);
  const kfs = clip.keyframes ?? [];
  return {
    opacity: interpolateKf(kfs, localTime, "opacity") ?? clip.opacity ?? 1,
    x: interpolateKf(kfs, localTime, "x") ?? 0,
    y: interpolateKf(kfs, localTime, "y") ?? 0,
    scale: interpolateKf(kfs, localTime, "scale") ?? 1,
  };
}

function EditorPage() {
  const { projectId } = Route.useParams();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgFileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("Untitled project");
  const [clips, setClips] = useState<Clip[]>([]);
  const [audioClips, setAudioClips] = useState<AudioClip[]>([]);
  const [overlays, setOverlays] = useState<TextOverlay[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null);
  const [adj, setAdj] = useState<Adjustments>({ brightness: 100, contrast: 100, saturation: 100, blur: 0 });
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activePanel, setActivePanel] = useState<ActivePanel>("media");
  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [vfxCategory, setVfxCategory] = useState<VfxCategory>("cinematic");
  const [exportOpen, setExportOpen] = useState(false);
  const [isProcessingVfx, setIsProcessingVfx] = useState(false);
  const [brushEditing, setBrushEditing] = useState(false);
  const [kfProp, setKfProp] = useState<KfProp>("opacity");
  const [markers, setMarkers] = useState<Marker[]>([]);
  const shuttleSpeedRef = useRef(1); // 1 = normal forward, -1 = reverse, 2/4/8/16 = JKL shuttle
  const primaryVideoRef = useRef<HTMLVideoElement | null>(null);
  const splitClipRef = useRef<(() => void) | null>(null);
  const deleteClipRef = useRef<(() => void) | null>(null);

  // Undo/redo history (snapshots of clips + audioClips + overlays)
  type Snapshot = { clips: Clip[]; audioClips: AudioClip[]; overlays: TextOverlay[] };
  const historyRef = useRef<{ past: Snapshot[]; future: Snapshot[]; suspend: boolean }>({ past: [], future: [], suspend: false });
  const snapshot = useCallback((): Snapshot => ({ clips, audioClips, overlays }), [clips, audioClips, overlays]);
  const pushHistory = useCallback(() => {
    const h = historyRef.current;
    if (h.suspend) return;
    h.past.push(snapshot());
    if (h.past.length > 50) h.past.shift();
    h.future = [];
  }, [snapshot]);
  const applySnapshot = useCallback((s: Snapshot) => {
    historyRef.current.suspend = true;
    setClips(s.clips);
    setAudioClips(s.audioClips);
    setOverlays(s.overlays);
    setTimeout(() => { historyRef.current.suspend = false; }, 0);
  }, []);
  const undo = useCallback(() => {
    const h = historyRef.current;
    const prev = h.past.pop();
    if (!prev) { toast.info("Nothing to undo"); return; }
    h.future.push(snapshot());
    applySnapshot(prev);
  }, [snapshot, applySnapshot]);
  const redo = useCallback(() => {
    const h = historyRef.current;
    const next = h.future.pop();
    if (!next) { toast.info("Nothing to redo"); return; }
    h.past.push(snapshot());
    applySnapshot(next);
  }, [snapshot, applySnapshot]);

  // Import mode dialog — ALWAYS shown for video files
  const [importDialog, setImportDialog] = useState<{
    open: boolean;
    media: any | null;
    resolve: null | ((mode: ImportMode) => void);
  }>({ open: false, media: null, resolve: null });

  // Dragging state
  const [dragState, setDragState] = useState<{
    type: "audio-start" | "audio-end" | "clip-start" | "clip-end" | "clip-move" | "audio-move" | null;
    id: string;
    startX: number;
    startTime: number;
    startDuration: number;
    startOriginalDuration: number;
  } | null>(null);

  // Snap guide — time position of current snap target (shown as a vertical line)
  const [snapGuide, setSnapGuide] = useState<number | null>(null);

  const selectedClip = clips.find((c) => c.id === selectedClipId) ?? null;
  const selectedAudio = audioClips.find((a) => a.id === selectedAudioId) ?? null;

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", projectId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: media = [], refetch: refetchMedia } = useQuery({
    queryKey: ["media", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("media_files").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
      if (error) throw error;
      return await Promise.all((data ?? []).map(async (m) => {
        const { data: signed } = await supabase.storage.from("media").createSignedUrl(m.storage_path, 3600);
        return { ...m, url: signed?.signedUrl };
      }));
    },
  });

  useEffect(() => {
    if (project) {
      setTitle(project.title);
      const ts = project.timeline_state as any;
      if (ts?.clips) setClips(ts.clips.map((c: any) => ({ videoTrack: 0, ...c })));
      if (ts?.audioClips) setAudioClips(ts.audioClips.map((a: any) => ({ fromVideo: false, ...a })));
      if (ts?.overlays) setOverlays(ts.overlays);
      if (ts?.adjustments) setAdj(ts.adjustments);
      if (ts?.viewMode) setViewMode(ts.viewMode);
      if (ts?.markers) setMarkers(ts.markers);
    }
  }, [project]);

  const saveProject = useMutation({
    mutationFn: async () => {
      const totalDuration = Math.max(
        clips.reduce((acc, c) => Math.max(acc, c.start + c.duration), 0),
        audioClips.reduce((acc, c) => Math.max(acc, c.start + c.duration), 0),
      );
      const { error } = await supabase.from("projects").update({
        title, duration_seconds: totalDuration,
        timeline_state: { clips, audioClips, overlays, adjustments: adj, viewMode, markers } as any,
      }).eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Project saved"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  // --- Track helpers ---
  const audioTrackCount = Math.max(1, audioClips.reduce((max, a) => Math.max(max, a.track + 1), 0));
  const videoTrackCount = Math.max(1, clips.reduce((max, c) => Math.max(max, c.videoTrack + 1), 0));

  function nextAvailableStartOnVideoTrack(track: number, duration: number): number {
    const trackClips = clips.filter((c) => c.videoTrack === track).sort((a, b) => a.start - b.start);
    for (let t = 0; ; t += 0.1) {
      const overlaps = trackClips.some((c) => t < c.start + c.duration && t + duration > c.start);
      if (!overlaps) return Math.round(t * 10) / 10;
    }
  }

  function nextAvailableStartOnAudioTrack(track: number, duration: number): number {
    const trackClips = audioClips.filter((a) => a.track === track).sort((a, b) => a.start - b.start);
    for (let t = 0; ; t += 0.1) {
      const overlaps = trackClips.some((c) => t < c.start + c.duration && t + duration > c.start);
      if (!overlaps) return Math.round(t * 10) / 10;
    }
  }

  function findAvailableAudioTrack(_duration: number): number {
    // Each new audio clip lands on its OWN lane. Find the lowest-index lane
    // that currently has no clips. Only fall back to packing into an existing
    // lane once every lane up to MAX_AUDIO_TRACKS is in use.
    for (let t = 0; t < MAX_AUDIO_TRACKS; t++) {
      const trackClips = audioClips.filter((a) => a.track === t);
      if (trackClips.length === 0) return t;
    }
    // All lanes used — fall back to the lane with the earliest free slot
    let best = 0;
    let bestStart = Infinity;
    for (let t = 0; t < MAX_AUDIO_TRACKS; t++) {
      const start = nextAvailableStartOnAudioTrack(t, _duration);
      if (start < bestStart) { bestStart = start; best = t; }
    }
    return best;
  }

  // ---- Media upload ----
  function sanitizeName(name: string) {
    const dot = name.lastIndexOf(".");
    const base = (dot > 0 ? name.slice(0, dot) : name).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 60);
    const ext = (dot > 0 ? name.slice(dot + 1) : "")
      .replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 8);
    return ext ? `${base}.${ext}` : base || "file";
  }

  async function handleFiles(files: FileList | null | File[]) {
    if (!files || !user) return;
    const arr = Array.from(files as ArrayLike<File>);
    if (arr.length === 0) return;
    let ok = 0;
    for (const file of arr) {
      const kind: "video" | "audio" | "image" =
        file.type.startsWith("video") ? "video" :
        file.type.startsWith("audio") ? "audio" :
        file.type.startsWith("image") ? "image" : "video";
      const path = `${user.id}/${projectId}/${Date.now()}-${sanitizeName(file.name)}`;
      const { error: uErr } = await supabase.storage.from("media").upload(path, file, {
        contentType: file.type || (kind === "image" ? "image/jpeg" : kind === "audio" ? "audio/mpeg" : "video/mp4"),
        upsert: false,
      });
      if (uErr) { toast.error(`${file.name}: ${uErr.message}`); continue; }
      const { error: mErr } = await supabase.from("media_files").insert({
        user_id: user.id, project_id: projectId, name: file.name,
        storage_path: path, mime_type: file.type || null, size_bytes: file.size, kind,
      });
      if (mErr) { toast.error(`${file.name}: ${mErr.message}`); continue; }
      ok++;
    }
    refetchMedia();
    if (ok > 0) toast.success(`${ok} file(s) uploaded — click to add to timeline`);
  }

  // Always ask user for video files: "Add as Video" or "Audio Only"
  function askImportMode(m: any): Promise<ImportMode> {
    if (m.kind === "audio") return Promise.resolve("audio");
    if (m.kind === "image") return Promise.resolve("video");
    // Video files: ALWAYS ask the user
    return new Promise((resolve) => {
      setImportDialog({ open: true, media: m, resolve });
    });
  }

  function handleImportChoice(mode: ImportMode) {
    if (importDialog.resolve) {
      importDialog.resolve(mode);
    }
    setImportDialog({ open: false, media: null, resolve: null });
  }

  async function addClipFromMedia(m: any) {
    const mode = await askImportMode(m);

    if (mode === "audio") {
      // Add as audio-only on an audio track
      // This works for both .audio and .video files — decodeAudio extracts audio track
      addAudioFromUrl(m.url, m.name, undefined, m.kind === "video");
      return;
    }

    // Add as video on V1
    if (m.kind === "video") {
      const probe = document.createElement("video");
      probe.preload = "metadata";
      probe.src = m.url;
      probe.onloadedmetadata = () => {
        const rawDur = probe.duration;
        const originalDuration = Number.isFinite(rawDur) && rawDur > 0 ? rawDur : 5;
        const start = nextAvailableStartOnVideoTrack(0, originalDuration);
        const newClip: Clip = {
          id: crypto.randomUUID(),
          mediaId: m.id,
          name: m.name,
          kind: "video",
          start,
          duration: originalDuration,
          originalDuration,
          playbackRate: 1.0,
          url: m.url,
          videoTrack: 0,
          bgRemove: false, bgMode: "color", bgColor: "#0a0a14", bgImageUrl: null, faceFilter: null,
          storyboardFrames: [],
        };
        setClips((c) => [...c, newClip]);
        setSelectedClipId(newClip.id);
        generateStoryboardFrames(newClip);
        toast.success(`"${m.name}" added to V1 — plays video with original audio`);
      };
    } else if (m.kind === "image") {
      const start = nextAvailableStartOnVideoTrack(0, 5);
      const newClip: Clip = {
        id: crypto.randomUUID(),
        mediaId: m.id,
        name: m.name,
        kind: "image",
        start,
        duration: 5,
        url: m.url,
        videoTrack: 0,
        bgRemove: false, bgMode: "color", bgColor: "#0a0a14", bgImageUrl: null, faceFilter: null,
      };
      setClips((c) => [...c, newClip]);
      setSelectedClipId(newClip.id);
      toast.success(`Added image "${m.name}"`);
    }
  }

  function generateStoryboardFrames(clip: Clip) {
    if (clip.kind !== "video" || !clip.url) return;
    const video = document.createElement("video");
    video.src = clip.url;
    video.preload = "metadata";
    video.muted = true;

    video.onloadedmetadata = () => {
      const frames: { time: number; thumbnail?: string }[] = [];
      const dur = video.duration;
      if (!Number.isFinite(dur) || dur <= 0) {
        // Some webm/mp4 files report Infinity duration — skip storyboard generation.
        return;
      }
      const numFrames = Math.max(12, Math.floor(dur / 2));
      const interval = dur / numFrames;
      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 90;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      let currentFrame = 0;
      const captureFrame = () => {
        if (currentFrame >= numFrames) {
          setClips((all) => all.map((c) => c.id === clip.id ? { ...c, storyboardFrames: frames } : c));
          return;
        }
        const t = currentFrame * interval;
        if (!Number.isFinite(t)) return;
        try { video.currentTime = t; } catch {}
      };

      video.onseeked = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const thumbnail = canvas.toDataURL("image/jpeg", 0.6);
        frames.push({ time: currentFrame * interval, thumbnail });
        currentFrame++;
        if (currentFrame < numFrames) {
          setTimeout(captureFrame, 10);
        } else {
          setClips((all) => all.map((c) => c.id === clip.id ? { ...c, storyboardFrames: frames } : c));
        }
      };
      captureFrame();
    };
  }

  async function addAudioFromUrl(url: string, name: string, preferredTrack?: number, fromVideo = false) {
    try {
      // decodeAudio works with both audio files AND video files — it extracts the audio track
      const buf = await decodeAudio(url);
      const duration = buf.duration;
      const track = preferredTrack !== undefined ? preferredTrack : findAvailableAudioTrack(duration);
      const start = nextAvailableStartOnAudioTrack(track, duration);
      const newClip: AudioClip = {
        id: crypto.randomUUID(),
        name,
        url,
        start,
        duration,
        originalDuration: duration,
        playbackRate: 1,
        track,
        volume: 1,
        muted: false,
        fadeIn: 0,
        fadeOut: 0,
        fromVideo,
      };
      setAudioClips((a) => [...a, newClip]);
      setSelectedAudioId(newClip.id);
      toast.success(`"${name}" added to A${track + 1}${fromVideo ? " (audio extracted from video)" : ""}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load audio");
    }
  }

  // Split clip at playhead
  function splitClip() {
    if (!selectedClipId) return;
    const c = clips.find((x) => x.id === selectedClipId);
    if (!c) return;
    const splitAt = currentTime - c.start;
    if (splitAt <= 0 || splitAt >= c.duration) {
      toast.info("Move playhead inside the clip to split");
      return;
    }
    pushHistory();
    const originalSplitTime = c.playbackRate ? splitAt * c.playbackRate : splitAt;
    const a: Clip = { ...c, duration: splitAt };
    const b: Clip = {
      ...c,
      id: crypto.randomUUID(),
      start: c.start + splitAt,
      duration: c.duration - splitAt,
      storyboardFrames: c.storyboardFrames?.filter(f => f.time >= originalSplitTime),
    };
    setClips((all) => all.flatMap((x) => (x.id === c.id ? [a, b] : [x])));
    toast.success(`Split "${c.name}" at ${formatTime(splitAt)}`);
  }
  splitClipRef.current = splitClip;

  // Convert selected video clip to audio-only
  function convertToAudioOnly(clipId: string) {
    const c = clips.find((x) => x.id === clipId);
    if (!c || !c.url) return;
    setClips((all) => all.filter((x) => x.id !== clipId));
    if (selectedClipId === clipId) setSelectedClipId(null);
    addAudioFromUrl(c.url, c.name, undefined, true);
    toast.success(`"${c.name}" moved to audio track`);
  }

  // Convert audio clip back to video (if it came from a video file)
  function convertAudioToVideo(audioId: string) {
    const a = audioClips.find((x) => x.id === audioId);
    if (!a) return;

    setAudioClips((all) => all.filter((x) => x.id !== audioId));
    if (selectedAudioId === audioId) setSelectedAudioId(null);

    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.src = a.url;
    probe.onloadedmetadata = () => {
      const start = nextAvailableStartOnVideoTrack(0, a.duration);
      const newClip: Clip = {
        id: crypto.randomUUID(),
        mediaId: "",
        name: a.name,
        kind: "video",
        start,
        duration: a.duration,
        originalDuration: a.originalDuration,
        playbackRate: a.playbackRate,
        url: a.url,
        videoTrack: 0,
        storyboardFrames: [],
      };
      setClips((c) => [...c, newClip]);
      setSelectedClipId(newClip.id);
      toast.success(`"${a.name}" moved to V1 — video with audio`);
    };
    probe.onerror = () => {
      toast.error("This audio clip cannot be converted to video");
      setAudioClips((all) => [...all, a]);
    };
  }

  function deleteClip() {
    if (selectedClipId) {
      pushHistory();
      setClips((c) => c.filter((x) => x.id !== selectedClipId));
      setSelectedClipId(null);
    } else if (selectedAudioId) {
      pushHistory();
      setAudioClips((a) => a.filter((x) => x.id !== selectedAudioId));
      setSelectedAudioId(null);
    }
  }
  deleteClipRef.current = deleteClip;

  function addText() {
    setOverlays((o) => [...o, { id: crypto.randomUUID(), text: "New text", start: currentTime, duration: 3, color: "#ffffff" }]);
    setActivePanel("text");
  }

  function updateClip(patch: Partial<Clip>) {
    if (!selectedClipId) return;
    setClips((all) => all.map((c) => (c.id === selectedClipId ? { ...c, ...patch } : c)));
  }

  function updateAudio(id: string, patch: Partial<AudioClip>) {
    setAudioClips((all) => all.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  async function handleBgImageUpload(files: FileList | null) {
    if (!files?.[0] || !user || !selectedClipId) return;
    const file = files[0];
    const path = `${user.id}/${projectId}/bg-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("media").upload(path, file, { contentType: file.type });
    if (error) { toast.error(error.message); return; }
    const { data: signed } = await supabase.storage.from("media").createSignedUrl(path, 3600);
    updateClip({ bgImageUrl: signed?.signedUrl ?? null, bgMode: "image" });
    toast.success("Background image set");
  }

  // Timing
  const totalDurationRef = useRef(0);

  const totalDuration = Math.max(
    clips.reduce((acc, c) => Math.max(acc, c.start + c.duration), 0),
    audioClips.reduce((acc, c) => Math.max(acc, c.start + c.duration), 0),
    10,
  );
  totalDurationRef.current = totalDuration;

  const timelineScrollRef = useRef<HTMLDivElement | null>(null);

  const activeClips = clips.filter((c) => currentTime >= c.start && currentTime < c.start + c.duration);
  const activeClip = activeClips[0] ?? null;
  const activeOverlay = overlays.find((o) => currentTime >= o.start && currentTime < o.start + o.duration);


  // ---- PLAYBACK ENGINE ----
  // totalDurationRef is hoisted above so the RAF loop can read the latest
  // total without restarting on every clip edit.
  const playbackRef = useRef<{ lastTime: number; animationId: number }>({ lastTime: 0, animationId: 0 });


  useEffect(() => {
    const tick = (timestamp: number) => {
      if (playing) {
        const dt = (timestamp - playbackRef.current.lastTime) / 1000;
        playbackRef.current.lastTime = timestamp;
        const speed = shuttleSpeedRef.current || 1;
        setCurrentTime((t) => {
          const nt = t + dt * speed;
          const td = totalDurationRef.current;
          if (nt >= td) { setPlaying(false); shuttleSpeedRef.current = 1; return td; }
          if (nt <= 0) { setPlaying(false); shuttleSpeedRef.current = 1; return 0; }
          return nt;
        });
      } else {
        playbackRef.current.lastTime = timestamp;
      }
      playbackRef.current.animationId = requestAnimationFrame(tick);
    };
    playbackRef.current.lastTime = performance.now();
    playbackRef.current.animationId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(playbackRef.current.animationId);
  }, [playing]);


  // ---- MULTI-TRACK AUDIO PLAYBACK ENGINE ----
  const audioEngineRef = useRef<{
    context: AudioContext | null;
    nodes: Map<string, { source: AudioBufferSourceNode; gain: GainNode; started: boolean }>;
    masterGain: GainNode | null;
    analyser: AnalyserNode | null;
    inFlight: Set<string>;
  }>({ context: null, nodes: new Map(), masterGain: null, analyser: null, inFlight: new Set() });

  useEffect(() => {
    return () => {
      const engine = audioEngineRef.current;
      if (engine.context) {
        engine.nodes.forEach(({ source }) => { try { source.stop(); } catch {} });
        engine.context.close();
      }
    };
  }, []);

  // Audio playback synced with video playhead — ALL audio tracks play together
  useEffect(() => {
    const engine = audioEngineRef.current;

    if (!playing) {
      engine.nodes.forEach(({ source }) => { try { source.stop(); } catch {} });
      engine.nodes.clear();
      engine.inFlight.clear();
      return;
    }

    if (!engine.context) {
      engine.context = getAudioContext();
      engine.masterGain = engine.context.createGain();
      engine.analyser = engine.context.createAnalyser();
      engine.analyser.fftSize = 1024;
      engine.analyser.smoothingTimeConstant = 0.6;
      engine.masterGain.connect(engine.analyser);
      engine.analyser.connect(engine.context.destination);
    }
    if (engine.context.state === "suspended") engine.context.resume().catch(() => {});

    const ctx = engine.context;

    audioClips.forEach(async (audioClip) => {
      if (audioClip.muted) return;
      const clipEnd = audioClip.start + audioClip.duration;
      const isInRange = currentTime >= audioClip.start && currentTime < clipEnd;
      if (!isInRange) {
        const node = engine.nodes.get(audioClip.id);
        if (node) { try { node.source.stop(); } catch {} engine.nodes.delete(audioClip.id); }
        return;
      }
      // Guard against duplicate scheduling — `decodeAudio` is async and this
      // effect re-fires every RAF tick. Without inFlight tracking we'd start
      // dozens of overlapping sources per clip (audio echo / chorus bug).
      if (engine.nodes.has(audioClip.id) || engine.inFlight.has(audioClip.id)) return;
      engine.inFlight.add(audioClip.id);

      try {
        const buffer = await decodeAudio(audioClip.url);
        // While we were awaiting, playback may have stopped or seeked away.
        if (!playing || !audioEngineRef.current.context) { engine.inFlight.delete(audioClip.id); return; }
        const stillInRange = currentTime >= audioClip.start && currentTime < audioClip.start + audioClip.duration;
        if (!stillInRange || audioClip.muted) { engine.inFlight.delete(audioClip.id); return; }
        if (engine.nodes.has(audioClip.id)) { engine.inFlight.delete(audioClip.id); return; }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = audioClip.playbackRate || 1;
        const gain = ctx.createGain();
        const offsetInClip = Math.max(0, currentTime - audioClip.start);
        gain.gain.value = audioClip.volume;

        if (audioClip.fadeIn > 0 && offsetInClip < audioClip.fadeIn) {
          const fadeProgress = offsetInClip / audioClip.fadeIn;
          gain.gain.setValueAtTime(fadeProgress * audioClip.volume, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(audioClip.volume, ctx.currentTime + (audioClip.fadeIn - offsetInClip));
        }
        if (audioClip.fadeOut > 0) {
          const fadeOutStart = audioClip.duration - audioClip.fadeOut;
          if (offsetInClip < fadeOutStart) {
            const timeUntilFadeOut = fadeOutStart - offsetInClip;
            gain.gain.setValueAtTime(audioClip.volume, ctx.currentTime + timeUntilFadeOut);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + audioClip.duration - offsetInClip);
          } else {
            const fadeProgress = 1 - (audioClip.duration - offsetInClip) / audioClip.fadeOut;
            gain.gain.value = audioClip.volume * (1 - fadeProgress);
          }
        }

        source.connect(gain);
        gain.connect(engine.masterGain!);
        source.start(0, offsetInClip * (audioClip.playbackRate || 1));
        engine.nodes.set(audioClip.id, { source, gain, started: true });
        source.onended = () => { engine.nodes.delete(audioClip.id); };
      } catch (error) {
        console.error("Audio playback error:", error);
      } finally {
        engine.inFlight.delete(audioClip.id);
      }
    });

    // Clean up audio clips that have ended, been deleted, or muted.
    engine.nodes.forEach((node, id) => {
      const clip = audioClips.find((a) => a.id === id);
      if (!clip || clip.muted || currentTime < clip.start || currentTime >= clip.start + clip.duration) {
        try { node.source.stop(); } catch {}
        engine.nodes.delete(id);
      }
    });
  }, [playing, currentTime, audioClips]);

  const handleSeek = useCallback((newTime: number) => {
    setPlaying(false);
    setCurrentTime(newTime);
    audioEngineRef.current.nodes.forEach(({ source }) => { try { source.stop(); } catch {} });
    audioEngineRef.current.nodes.clear();
    audioEngineRef.current.inFlight.clear();
  }, []);

  // Auto-scroll the timeline horizontally so the playhead stays visible
  // during playback. Triggered every time currentTime advances.
  useEffect(() => {
    const el = timelineScrollRef.current;
    if (!el) return;
    const playheadX = 80 + currentTime * PX_PER_SEC;
    const viewLeft = el.scrollLeft;
    const viewRight = viewLeft + el.clientWidth;
    const margin = 80;
    if (playheadX > viewRight - margin) {
      el.scrollLeft = playheadX - el.clientWidth + margin * 2;
    } else if (playheadX < viewLeft + margin) {
      el.scrollLeft = Math.max(0, playheadX - margin);
    }
  }, [currentTime]);


  const activePreset = getPreset(activeClip?.vfxPresetId);
  const effectiveAdj = activePreset ? { ...DEFAULT_ADJ, ...activePreset.adjustments } : adj;
  const filterStyle = activePreset
    ? adjustmentsToCss(effectiveAdj)
    : `brightness(${adj.brightness}%) contrast(${adj.contrast}%) saturate(${adj.saturation}%) blur(${adj.blur}px)`;

  async function handleApplyVfx(job: VfxJob, presetName: string) {
    if (!selectedClip || !selectedClip.url) { toast.error("Select a video clip first"); return; }
    setIsProcessingVfx(true);
    try {
      const result = await processVfxJob({ ...job, inputUrl: selectedClip.url, onProgress: () => {} });
      setClips((all) => all.map((c) => c.id === selectedClip.id ? { ...c, vfxUrl: result.outputUrl, vfxPresetApplied: presetName, duration: result.duration, playbackRate: 1 } : c));
      toast.success("VFX applied successfully!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "VFX processing failed");
    } finally {
      setIsProcessingVfx(false);
    }
  }

  function handleApplyPreset(clipId: string, presetId: string) {
    setClips((all) => all.map((c) => c.id === clipId ? { ...c, vfxPresetId: presetId } : c));
  }

  function addKeyframe(prop: KfProp, value: number) {
    if (!selectedClipId) return;
    const clip = clips.find((c) => c.id === selectedClipId);
    if (!clip) return;
    const localTime = Math.max(0, Math.min(clip.duration, currentTime - clip.start));
    const existing = (clip.keyframes ?? []).filter((k) => !(Math.abs(k.time - localTime) < 0.05));
    const updated: Keyframe[] = [...existing, { ...Object.fromEntries((clip.keyframes ?? []).filter((k) => Math.abs(k.time - localTime) < 0.05).flatMap((k) => Object.entries(k).filter(([key]) => key !== prop && key !== "time"))), time: localTime, [prop]: value }].sort((a, b) => a.time - b.time);
    setClips((all) => all.map((c) => c.id === selectedClipId ? { ...c, keyframes: updated } : c));
    toast.success(`Keyframe added at ${localTime.toFixed(2)}s`);
  }

  function removeKeyframe(kfTime: number) {
    if (!selectedClipId) return;
    setClips((all) => all.map((c) => {
      if (c.id !== selectedClipId) return c;
      return { ...c, keyframes: (c.keyframes ?? []).filter((k) => Math.abs(k.time - kfTime) >= 0.05) };
    }));
  }

  // Drag handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, type: "audio-start" | "audio-end" | "clip-start" | "clip-end" | "clip-move" | "audio-move", id: string) => {
      e.preventDefault();
      e.stopPropagation();
      let item: AudioClip | Clip | null = null;
      if (type.startsWith("audio")) {
        item = audioClips.find((a) => a.id === id) ?? null;
      } else {
        item = clips.find((c) => c.id === id) ?? null;
      }
      if (!item) return;
      pushHistory();
      setDragState({
        type, id, startX: e.clientX, startTime: item.start,
        startDuration: item.duration,
        startOriginalDuration: type.startsWith("audio") ? (item as AudioClip).originalDuration : item.duration,
      });
    },
    [audioClips, clips, pushHistory]
  );

  // Snap a candidate time to the playhead or to any clip/audio edge within ~8px.
  // Returns { time, snapped } so callers can show a guide line.
  const snapTime = useCallback(
    (t: number, ignoreId: string): { time: number; snapped: boolean } => {
      const tol = 8 / PX_PER_SEC;
      const candidates: number[] = [currentTime, 0];
      for (const c of clips) {
        if (c.id === ignoreId) continue;
        candidates.push(c.start, c.start + c.duration);
      }
      for (const a of audioClips) {
        if (a.id === ignoreId) continue;
        candidates.push(a.start, a.start + a.duration);
      }
      let best = t;
      let bestD = tol;
      for (const cand of candidates) {
        const d = Math.abs(cand - t);
        if (d < bestD) { bestD = d; best = cand; }
      }
      return { time: best, snapped: best !== t };
    },
    [clips, audioClips, currentTime]
  );

  useEffect(() => {
    if (!dragState) return;
    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragState.startX;
      const dt = dx / PX_PER_SEC;

      if (dragState.type === "clip-move") {
        const rawStart = Math.max(0, dragState.startTime + dt);
        const { time: newStart, snapped } = snapTime(rawStart, dragState.id);
        setSnapGuide(snapped ? newStart : null);
        setClips((all) => all.map((c) => c.id === dragState.id ? { ...c, start: newStart } : c));
      } else if (dragState.type === "audio-move") {
        const rawStart = Math.max(0, dragState.startTime + dt);
        const { time: newStart, snapped } = snapTime(rawStart, dragState.id);
        setSnapGuide(snapped ? newStart : null);
        setAudioClips((all) => all.map((a) => a.id === dragState.id ? { ...a, start: newStart } : a));
      } else if (dragState.type === "audio-start") {
        const rawStart = Math.max(0, dragState.startTime + dt);
        const { time: newStart, snapped } = snapTime(rawStart, dragState.id);
        setSnapGuide(snapped ? newStart : null);
        const newDuration = dragState.startDuration - (newStart - dragState.startTime);
        if (newDuration < 0.5) return;
        setAudioClips((all) => all.map((a) => a.id === dragState.id ? { ...a, start: newStart, duration: newDuration, playbackRate: a.originalDuration / newDuration } : a));
      } else if (dragState.type === "audio-end") {
        const rawDur = Math.max(0.5, dragState.startDuration + dt);
        const rawEnd = dragState.startTime + rawDur;
        const { time: snappedEnd, snapped } = snapTime(rawEnd, dragState.id);
        setSnapGuide(snapped ? snappedEnd : null);
        const newDuration = Math.max(0.5, snappedEnd - dragState.startTime);
        const clip = audioClips.find((a) => a.id === dragState.id);
        const originalDuration = clip?.originalDuration ?? dragState.startOriginalDuration;
        setAudioClips((all) => all.map((a) => a.id === dragState.id ? { ...a, duration: newDuration, playbackRate: originalDuration / newDuration } : a));
      } else if (dragState.type === "clip-start") {
        const rawStart = Math.max(0, dragState.startTime + dt);
        const { time: newStart, snapped } = snapTime(rawStart, dragState.id);
        setSnapGuide(snapped ? newStart : null);
        const newDuration = dragState.startDuration - (newStart - dragState.startTime);
        if (newDuration < 0.5) return;
        setClips((all) => all.map((c) => c.id === dragState.id ? { ...c, start: newStart, duration: newDuration } : c));
      } else if (dragState.type === "clip-end") {
        const rawDur = Math.max(0.5, dragState.startDuration + dt);
        const rawEnd = dragState.startTime + rawDur;
        const { time: snappedEnd, snapped } = snapTime(rawEnd, dragState.id);
        setSnapGuide(snapped ? snappedEnd : null);
        const newDuration = Math.max(0.5, snappedEnd - dragState.startTime);
        setClips((all) => all.map((c) => c.id === dragState.id ? { ...c, duration: newDuration } : c));
      }
    };
    const handleMouseUp = () => { setDragState(null); setSnapGuide(null); };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); };
  }, [dragState, audioClips, clips, snapTime]);

  // Drop a marker at the current playhead position
  const dropMarker = useCallback(() => {
    setMarkers((m) => {
      // Don't duplicate a marker that's within 0.1s of an existing one
      if (m.some((x) => Math.abs(x.time - currentTime) < 0.1)) return m;
      const next = [...m, { id: crypto.randomUUID(), time: currentTime, label: `M${m.length + 1}`, color: "#fbbf24" }];
      next.sort((a, b) => a.time - b.time);
      return next;
    });
    toast.success(`Marker dropped at ${formatTime(currentTime)}`);
  }, [currentTime]);

  // Pro keyboard shortcuts — Premiere/Resolve style
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if (mod && (e.key === "y" || e.key === "Y")) { e.preventDefault(); redo(); return; }
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        shuttleSpeedRef.current = 1;
        setPlaying((p) => !p);
        return;
      }
      // J / K / L shuttle
      if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        shuttleSpeedRef.current = 1;
        setPlaying(false);
        return;
      }
      if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        const cur = shuttleSpeedRef.current;
        const next = cur > 0 ? Math.min(cur * 2, 16) : 1;
        shuttleSpeedRef.current = next;
        setPlaying(true);
        if (next > 1) toast.message(`Shuttle ${next}x`, { duration: 600 });
        return;
      }
      if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        const cur = shuttleSpeedRef.current;
        const next = cur < 0 ? Math.max(cur * 2, -16) : -1;
        shuttleSpeedRef.current = next;
        setPlaying(true);
        toast.message(`Shuttle ${next}x`, { duration: 600 });
        return;
      }
      // Marker
      if (e.key === "m" || e.key === "M") { e.preventDefault(); dropMarker(); return; }
      // Frame-by-frame nudge
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 1 / 30;
        setPlaying(false);
        setCurrentTime((t) => Math.max(0, t - step));
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 1 / 30;
        setPlaying(false);
        setCurrentTime((t) => Math.min(totalDurationRef.current, t + step));
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        setPlaying(false);
        setCurrentTime(0);
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        setPlaying(false);
        setCurrentTime(totalDurationRef.current);
        return;
      }
      if (e.key === "s" || e.key === "S") { e.preventDefault(); splitClipRef.current?.(); return; }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteClipRef.current?.(); return; }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, dropMarker]);


  function addAudioTrack() {
    if (audioTrackCount >= MAX_AUDIO_TRACKS) { toast.error(`Maximum ${MAX_AUDIO_TRACKS} audio tracks`); return; }
    toast.success(`Audio track A${audioTrackCount + 1} added`);
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-studio-bg">
      {/* Import Mode Dialog — ALWAYS shown for video files */}
      <Dialog open={importDialog.open} onOpenChange={(open) => { if (!open) handleImportChoice("video"); }}>
        <DialogContent className="bg-studio-surface border-studio-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Add to Timeline</DialogTitle>
            <DialogDescription className="text-sm">
              How do you want to use <strong className="text-foreground">{importDialog.media?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 pt-2">
            <button
              onClick={() => handleImportChoice("video")}
              className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-studio-border hover:border-orange-500 transition-colors bg-studio-bg group"
            >
              <div className="size-14 rounded-xl bg-orange-500/20 grid place-items-center group-hover:bg-orange-500/30 transition-colors">
                <Video className="size-7 text-orange-400" />
              </div>
              <div className="text-sm font-semibold">Add as Video</div>
              <div className="text-[10px] text-studio-muted text-center leading-relaxed">
                Show visuals on V1 track. Original audio plays alongside audio tracks.
              </div>
            </button>
            <button
              onClick={() => handleImportChoice("audio")}
              className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-studio-border hover:border-blue-500 transition-colors bg-studio-bg group"
            >
              <div className="size-14 rounded-xl bg-blue-500/20 grid place-items-center group-hover:bg-blue-500/30 transition-colors">
                <Headphones className="size-7 text-blue-400" />
              </div>
              <div className="text-sm font-semibold">Audio Only</div>
              <div className="text-[10px] text-studio-muted text-center leading-relaxed">
                Extract audio and place on A1 track. No video shown — perfect for background music.
              </div>
            </button>
          </div>
          <p className="text-[10px] text-studio-muted text-center pt-2">
            Both play together in sync — video on top, audio tracks below.
          </p>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <header className="h-14 border-b border-studio-border flex items-center justify-between px-4 shrink-0 bg-studio-surface/80 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/dashboard" className="text-studio-muted hover:text-foreground">
            <ArrowLeft className="size-4" />
          </Link>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => saveProject.mutate()}
            className="h-8 border-none bg-transparent hover:bg-studio-bg focus-visible:bg-studio-bg w-64 font-medium text-sm"
          />
          <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded uppercase tracking-wider">Auto-save</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => saveProject.mutate()} disabled={saveProject.isPending}>
            {saveProject.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Save
          </Button>
          <Button size="sm" className="bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-600 hover:to-pink-700 text-white" onClick={() => setExportOpen(true)}>
            <Download className="size-4" /> Export
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel */}
        <aside className="w-80 border-r border-studio-border flex flex-col shrink-0 bg-studio-surface/50">
          <div className="p-3 border-b border-studio-border">
            <div className="grid grid-cols-6 gap-0.5 p-1 bg-studio-bg rounded-lg">
              {(["media", "sounds", "text", "effects", "layers", "ai"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setActivePanel(p)}
                  className={cn(
                    "py-1.5 text-[9px] font-medium rounded capitalize transition-colors",
                    activePanel === p ? "bg-gradient-to-r from-orange-500/20 to-pink-500/20 text-foreground border border-orange-500/30" : "text-studio-muted hover:text-foreground",
                    p === "ai" && activePanel !== p && "text-orange-400"
                  )}
                >
                  {p === "ai" ? "AI" : p === "layers" ? "Layers" : p}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {activePanel === "media" && (
              <div className="p-3 space-y-3">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-orange-500"); }}
                  onDragLeave={(e) => e.currentTarget.classList.remove("border-orange-500")}
                  onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("border-orange-500"); handleFiles(e.dataTransfer.files); }}
                  className="w-full cursor-pointer border-2 border-dashed border-studio-border rounded-lg p-6 text-center hover:border-orange-500/60 transition-colors"
                >
                  <Upload className="size-8 mx-auto mb-2 text-studio-muted" />
                  <p className="text-sm font-medium">Drop or click to upload</p>
                  <p className="text-xs text-studio-muted mt-1">Video, image or audio files</p>
                </div>
                <input ref={fileInputRef} type="file" hidden multiple accept="video/*,audio/*,image/*" onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
                <div className="grid grid-cols-2 gap-2">
                  {media.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => addClipFromMedia(m)}
                      className="group aspect-square bg-zinc-900 rounded-lg outline outline-1 -outline-offset-1 outline-white/5 hover:outline-orange-500/50 transition-all relative overflow-hidden"
                    >
                      {m.kind === "video" && m.url ? (
                        <video src={m.url} className="w-full h-full object-cover" muted preload="metadata" />
                      ) : m.kind === "image" && m.url ? (
                        <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-studio-muted">
                          <Music className="size-6" />
                        </div>
                      )}
                      <span className={cn(
                        "absolute top-1 left-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider",
                        m.kind === "video" && "bg-orange-500/80 text-white",
                        m.kind === "image" && "bg-emerald-500/80 text-white",
                        m.kind === "audio" && "bg-blue-500/80 text-white"
                      )}>
                        {m.kind}
                      </span>
                      {m.kind === "video" && (
                        <span className="absolute top-1 right-1 px-1 py-0.5 rounded text-[7px] bg-white/20 text-white">
                          Click to choose
                        </span>
                      )}
                      <div className="absolute inset-x-0 bottom-0 px-1.5 py-1 bg-black/80 backdrop-blur text-[9px] truncate text-left">{m.name}</div>
                    </button>
                  ))}
                </div>
                {media.length === 0 && <p className="text-xs text-studio-muted text-center py-8">No media yet. Upload to get started.</p>}
              </div>
            )}

            {activePanel === "sounds" && (
              <div className="p-3 space-y-3">
                <div className="flex items-center gap-2 text-xs text-studio-muted">
                  <Library className="size-3.5" /> Free sound library — adds to audio tracks
                </div>
                <div className="space-y-1.5">
                  {SOUND_LIBRARY.map((s) => (
                    <div key={s.id} className="group flex items-center gap-2 p-2 bg-studio-bg rounded-lg border border-studio-border">
                      <div className="size-8 grid place-items-center bg-blue-500/20 text-blue-400 rounded"><Music className="size-3.5" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{s.name}</div>
                        <div className="text-[10px] text-studio-muted capitalize">{s.category} &middot; {formatTime(s.duration)}</div>
                      </div>
                      <button onClick={() => addAudioFromUrl(s.url, s.name)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded bg-blue-500 text-white hover:scale-105">
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activePanel === "text" && (
              <div className="p-3 space-y-3">
                <Button variant="outline" onClick={addText} className="w-full"><Type className="size-4" /> Add text overlay</Button>
                {overlays.map((o) => (
                  <div key={o.id} className="p-2 bg-studio-bg rounded-lg space-y-2 border border-studio-border">
                    <Input value={o.text} onChange={(e) => setOverlays((all) => all.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)))} className="h-7 text-xs" />
                    <div className="flex gap-2 items-center">
                      <input type="color" value={o.color} onChange={(e) => setOverlays((all) => all.map((x) => (x.id === o.id ? { ...x, color: e.target.value } : x)))} className="size-7 rounded cursor-pointer" />
                      <button onClick={() => setOverlays((all) => all.filter((x) => x.id !== o.id))} className="ml-auto text-studio-muted hover:text-destructive"><Trash2 className="size-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activePanel === "effects" && (
              <div className="p-3 space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-studio-muted">Cinematic VFX Presets</p>
                  {!selectedClip && <p className="text-[10px] text-studio-muted">Select a clip to apply a preset.</p>}
                  <div className="grid grid-cols-3 gap-1 p-1 bg-studio-bg rounded-lg">
                    {(["cinematic", "scifi", "action", "fantasy", "vfx", "color"] as const).map((c) => (
                      <button key={c} onClick={() => setVfxCategory(c)} className={cn("py-1 text-[10px] rounded capitalize transition-colors", vfxCategory === c ? "bg-orange-500/20 text-orange-400" : "text-studio-muted hover:text-foreground")}>{c}</button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {VFX_PRESETS.filter((p) => p.category === vfxCategory).map((p) => (
                      <button
                        key={p.id}
                        disabled={!selectedClip}
                        onClick={() => updateClip({ vfxPresetId: p.id === "color-original" ? null : p.id })}
                        className={cn(
                          "p-2 bg-studio-bg border rounded-lg flex flex-col items-start gap-1 text-left transition-all",
                          selectedClip?.vfxPresetId === p.id ? "border-orange-500 ring-1 ring-orange-500" : "border-studio-border hover:border-orange-500/60",
                          !selectedClip && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <span className="text-lg">{p.emoji}</span>
                        <span className="text-[10px] font-medium leading-tight">{p.name}</span>
                        <span className="text-[9px] text-studio-muted leading-tight line-clamp-2">{p.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activePanel === "ai" && (
              <div className="h-full">
                <AiVfxAssistant
                  selectedClip={selectedClip && selectedClip.url ? { id: selectedClip.id, url: selectedClip.vfxUrl || selectedClip.url, name: selectedClip.name, start: selectedClip.start, duration: selectedClip.duration } : null}
                  disabled={!selectedClip}
                  onApplyPreset={handleApplyPreset}
                  onApplyVfxJob={handleApplyVfx}
                  isProcessing={isProcessingVfx}
                />
              </div>
            )}

            {activePanel === "layers" && (
              <LayersPanel
                clips={clips}
                audioClips={audioClips}
                selectedClipId={selectedClipId}
                selectedAudioId={selectedAudioId}
                onSelectClip={(id) => { setSelectedClipId(id); setSelectedAudioId(null); }}
                onSelectAudio={(id) => { setSelectedAudioId(id); setSelectedClipId(null); }}
                onUpdateClip={(id, patch) => setClips((all) => all.map((c) => c.id === id ? { ...c, ...patch } : c))}
                onUpdateAudio={(id, patch) => setAudioClips((all) => all.map((a) => a.id === id ? { ...a, ...patch } : a))}
                onReorderClips={(reordered) => setClips(reordered)}
              />
            )}
          </div>
        </aside>

        {/* Center preview */}
        <div className="flex-1 bg-black flex flex-col min-w-0">
          <div className="h-10 border-b border-studio-border flex items-center px-4 gap-2 bg-studio-surface/50">
            <Button variant={viewMode === "timeline" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("timeline")} className={cn("h-7 text-xs", viewMode === "timeline" && "bg-orange-500/20 text-orange-400")}>
              <Clock className="size-3" /> Timeline
            </Button>
            <Button variant={viewMode === "storyboard" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("storyboard")} className={cn("h-7 text-xs", viewMode === "storyboard" && "bg-orange-500/20 text-orange-400")}>
              <LayoutGrid className="size-3" /> Storyboard
            </Button>
          </div>

          <div className="flex-1 flex items-center justify-center p-6">
            <div className="relative w-full max-w-5xl aspect-video bg-zinc-900 rounded-xl overflow-hidden shadow-2xl border border-studio-border">
              {/* Video/image preview — all active clips render together */}
              {activeClips.filter((c) => !c.hidden).map((clip, idx) => {
                const kf = getKfProps(clip, currentTime);
                return (
                  <div
                    key={clip.id}
                    className={cn("absolute inset-0", idx > 0 && "pointer-events-none")}
                    style={{
                      zIndex: activeClips.length - idx,
                      opacity: kf.opacity,
                      mixBlendMode: (clip.blendMode as any) || "normal",
                      transform: `translate(${kf.x}px, ${kf.y}px) scale(${kf.scale})`,
                    }}
                  >
                    {clip.kind === "image" ? (
                      <ClipImagePlayer clip={clip} filterStyle={filterStyle} />
                    ) : (
                      <ClipVideoPlayer clip={clip} currentTime={currentTime} playing={playing} muted={idx > 0 || !!clip.muteOriginal} filterStyle={filterStyle} videoElRef={idx === 0 ? primaryVideoRef : undefined} />
                    )}
                    {activePreset && activePreset.overlay !== "none" && (
                      <VfxOverlay kind={activePreset.overlay} color={activePreset.overlayColor} intensity={activePreset.intensity} playing={playing} />
                    )}
                  </div>
                );
              })}
              {selectedClip?.brushBlur?.enabled && selectedClipId === activeClips[0]?.id && (
                <BrushBlurOverlay
                  state={selectedClip.brushBlur}
                  editing={brushEditing}
                  sourceRef={primaryVideoRef}
                  onMaskChange={(mask) => updateClip({ brushBlur: { ...(selectedClip.brushBlur || DEFAULT_BRUSH_BLUR), mask } })}
                />
              )}
              {activeOverlay && (
                <div className="absolute inset-x-0 bottom-12 text-center pointer-events-none z-20">
                  <span className="inline-block px-6 py-2 text-3xl font-bold drop-shadow-lg" style={{ color: activeOverlay.color }}>{activeOverlay.text}</span>
                </div>
              )}
              {clips.length === 0 && audioClips.length === 0 && (
                <div className="absolute inset-0 grid place-items-center text-center text-studio-muted pointer-events-none">
                  <div>
                    <Film className="size-12 mx-auto opacity-30 mb-2" />
                    <p className="text-sm">Upload media and click to add to timeline</p>
                    <p className="text-xs text-studio-muted mt-1">Videos go to V1, audio to A1-A8 — all play in sync</p>
                  </div>
                </div>
              )}
              {/* Playback indicator showing synced audio */}
              {playing && audioClips.filter(a => !a.muted && currentTime >= a.start && currentTime < a.start + a.duration).length > 0 && (
                <div className="absolute top-3 right-3 glass rounded-lg px-3 py-1.5 flex items-center gap-2 z-30">
                  <Volume2 className="size-3.5 text-blue-400" />
                  <span className="text-[10px] text-blue-300 font-medium">
                    {audioClips.filter(a => !a.muted && currentTime >= a.start && currentTime < a.start + a.duration).length} audio track{audioClips.filter(a => !a.muted && currentTime >= a.start && currentTime < a.start + a.duration).length !== 1 && "s"} playing
                  </span>
                </div>
              )}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 glass rounded-full px-5 py-2.5 flex items-center gap-4 z-30">
                <span className="text-[11px] font-mono text-white/70">{formatTime(currentTime)}</span>
                <button
                  onClick={() => setPlaying((p) => !p)}
                  className="size-10 bg-gradient-to-r from-orange-500 to-pink-600 rounded-full grid place-items-center text-white hover:scale-105 transition-transform shadow-lg"
                >
                  {playing ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current ml-0.5" />}
                </button>
                <span className="text-[11px] font-mono text-white">{formatTime(totalDuration)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel - Inspector */}
        <aside className="w-80 border-l border-studio-border flex flex-col shrink-0 bg-studio-surface/50">
          <div className="p-4 border-b border-studio-border">
            <h2 className="text-sm font-semibold">Inspector</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            <Section title="Global Adjustments">
              <AdjustSlider label="Brightness" value={adj.brightness} min={0} max={200} onChange={(v) => setAdj({ ...adj, brightness: v })} />
              <AdjustSlider label="Contrast" value={adj.contrast} min={0} max={200} onChange={(v) => setAdj({ ...adj, contrast: v })} />
              <AdjustSlider label="Saturation" value={adj.saturation} min={0} max={200} onChange={(v) => setAdj({ ...adj, saturation: v })} />
              <AdjustSlider label="Blur" value={adj.blur} min={0} max={10} onChange={(v) => setAdj({ ...adj, blur: v })} />
            </Section>

            {selectedClip && (
              <Section title={`Clip: ${selectedClip.name}`} icon={<Film className="size-3.5 text-orange-400" />}>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-studio-muted">Track</span>
                  <span className="text-xs font-semibold text-orange-400">V{selectedClip.videoTrack + 1}</span>
                </div>
                <AdjustSlider label="Duration (s)" value={Math.round(selectedClip.duration)} min={0.5} max={600} onChange={(v) => updateClip({ duration: v })} />
                <AdjustSlider label="Playback Speed" value={Math.round((selectedClip.playbackRate || 1) * 100)} min={10} max={400} onChange={(v) => updateClip({ playbackRate: v / 100 })} suffix="%" />
                <AdjustSlider label="Opacity" value={Math.round((selectedClip.opacity ?? 1) * 100)} min={0} max={100} suffix="%" onChange={(v) => updateClip({ opacity: v / 100 })} />
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-studio-muted">Blend Mode</span>
                    <span className="font-medium">{selectedClip.blendMode || "normal"}</span>
                  </div>
                  <select
                    value={selectedClip.blendMode || "normal"}
                    onChange={(e) => updateClip({ blendMode: e.target.value })}
                    className="w-full h-7 text-xs bg-studio-bg border border-studio-border rounded px-2 text-foreground"
                  >
                    {["normal","multiply","screen","overlay","darken","lighten","color-dodge","color-burn","hard-light","soft-light","difference","exclusion","hue","saturation","color","luminosity"].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                {selectedClip.kind === "video" && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Mute original audio</span>
                      <Switch checked={!!selectedClip.muteOriginal} onCheckedChange={(v) => updateClip({ muteOriginal: v })} />
                    </div>
                    <button
                      onClick={() => convertToAudioOnly(selectedClip.id)}
                      className="w-full text-xs px-3 py-2.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-colors flex items-center justify-center gap-2"
                    >
                      <Headphones className="size-3.5" /> Convert to Audio Only
                    </button>
                  </>
                )}
                {(selectedClip.vfxPresetId || selectedClip.vfxPresetApplied) && (
                  <div className="flex items-center justify-between p-2 bg-orange-500/10 rounded-lg border border-orange-500/30">
                    <div className="text-xs font-medium text-orange-400">
                      VFX: {selectedClip.vfxPresetApplied || VFX_PRESETS.find((p) => p.id === selectedClip.vfxPresetId)?.name}
                    </div>
                    <button onClick={() => updateClip({ vfxPresetId: null, vfxPresetApplied: null })} className="text-studio-muted hover:text-destructive transition-colors ml-2">
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                )}
              </Section>
            )}

            {selectedClip && (
              <Section title="Keyframes" icon={<Diamond className="size-3.5 text-yellow-400" fill="currentColor" />}>
                <div className="text-[10px] text-studio-muted">
                  Move the playhead to the desired time, then click a property to add a keyframe there.
                </div>
                {/* Property selector */}
                <div className="flex gap-1">
                  {(["opacity", "x", "y", "scale"] as const).map((prop) => (
                    <button
                      key={prop}
                      onClick={() => setKfProp(prop)}
                      className={cn(
                        "flex-1 py-1 rounded text-[9px] font-medium border transition-colors",
                        kfProp === prop
                          ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-400"
                          : "bg-studio-bg border-studio-border text-studio-muted hover:text-foreground"
                      )}
                    >
                      {prop}
                    </button>
                  ))}
                </div>
                {/* Live value slider */}
                {kfProp === "opacity" && (
                  <AdjustSlider label="Opacity at playhead" value={Math.round(getKfProps(selectedClip, currentTime).opacity * 100)} min={0} max={100} suffix="%" onChange={(v) => addKeyframe("opacity", v / 100)} />
                )}
                {kfProp === "x" && (
                  <AdjustSlider label="X offset (px)" value={Math.round(getKfProps(selectedClip, currentTime).x)} min={-500} max={500} onChange={(v) => addKeyframe("x", v)} />
                )}
                {kfProp === "y" && (
                  <AdjustSlider label="Y offset (px)" value={Math.round(getKfProps(selectedClip, currentTime).y)} min={-500} max={500} onChange={(v) => addKeyframe("y", v)} />
                )}
                {kfProp === "scale" && (
                  <AdjustSlider label="Scale" value={Math.round(getKfProps(selectedClip, currentTime).scale * 100)} min={10} max={400} suffix="%" onChange={(v) => addKeyframe("scale", v / 100)} />
                )}
                <button
                  onClick={() => {
                    const kf = getKfProps(selectedClip, currentTime);
                    const val = kfProp === "opacity" ? kf.opacity : kfProp === "x" ? kf.x : kfProp === "y" ? kf.y : kf.scale;
                    addKeyframe(kfProp, val);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 transition-colors text-xs font-medium"
                >
                  <Diamond className="size-3" fill="currentColor" /> Add keyframe at {formatTime(Math.max(0, currentTime - selectedClip.start))}
                </button>
                {/* Keyframe list */}
                {(selectedClip.keyframes ?? []).length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[9px] text-studio-muted uppercase tracking-wider">All keyframes</div>
                    {[...(selectedClip.keyframes ?? [])].sort((a, b) => a.time - b.time).map((k, i) => (
                      <div key={i} className="flex items-center gap-2 px-2 py-1 rounded bg-studio-bg border border-studio-border text-[9px]">
                        <Diamond className="size-2 text-yellow-400 shrink-0" fill="currentColor" />
                        <span className="font-mono">{formatTime(k.time)}</span>
                        <span className="text-studio-muted ml-auto">
                          {k.opacity !== undefined && `op:${Math.round(k.opacity * 100)}% `}
                          {k.x !== undefined && `x:${Math.round(k.x)} `}
                          {k.y !== undefined && `y:${Math.round(k.y)} `}
                          {k.scale !== undefined && `sc:${Math.round(k.scale * 100)}%`}
                        </span>
                        <button onClick={() => removeKeyframe(k.time)} className="text-studio-muted hover:text-destructive">
                          <Trash2 className="size-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            )}

            {selectedClip && selectedClip.kind === "video" && (
              <Section title="Brush Blur" icon={<Brush className="size-3.5 text-purple-400" />}>
                <div className="flex items-center justify-between">
                  <span className="text-xs">Enabled</span>
                  <Switch
                    checked={!!selectedClip.brushBlur?.enabled}
                    onCheckedChange={(v) => updateClip({ brushBlur: { ...(selectedClip.brushBlur || DEFAULT_BRUSH_BLUR), enabled: v } })}
                  />
                </div>
                {selectedClip.brushBlur?.enabled && (
                  <>
                    <AdjustSlider
                      label="Brush size"
                      value={selectedClip.brushBlur.radius}
                      min={5} max={150}
                      onChange={(v) => updateClip({ brushBlur: { ...selectedClip.brushBlur!, radius: v } })}
                    />
                    <AdjustSlider
                      label="Blur strength"
                      value={selectedClip.brushBlur.strength}
                      min={2} max={40}
                      onChange={(v) => updateClip({ brushBlur: { ...selectedClip.brushBlur!, strength: v } })}
                    />
                    <Button
                      size="sm"
                      variant={brushEditing ? "default" : "outline"}
                      onClick={() => setBrushEditing((v) => !v)}
                      className={cn("w-full", brushEditing && "bg-purple-500 hover:bg-purple-600 text-white")}
                    >
                      <Brush className="size-3.5" /> {brushEditing ? "Done painting" : "Paint blur area"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateClip({ brushBlur: { ...selectedClip.brushBlur!, mask: null } })}
                      className="w-full text-xs text-studio-muted"
                    >
                      <Trash2 className="size-3" /> Clear painted mask
                    </Button>
                    <p className="text-[10px] text-studio-muted leading-relaxed">Paint to hide faces, license plates, or anything else. The blur follows the painted shape — toggle erase mode in the overlay toolbar.</p>
                  </>
                )}
              </Section>
            )}

            {selectedAudio && (
              <Section title={`Audio: ${selectedAudio.name}`} icon={<Music className="size-3.5 text-blue-400" />}>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-studio-muted">Track</span>
                  <span className="text-xs font-semibold text-blue-400">A{selectedAudio.track + 1}</span>
                </div>
                {selectedAudio.fromVideo && (
                  <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <div className="text-[10px] text-blue-300 flex items-center gap-1.5">
                      <Video className="size-3" /> Audio extracted from video file
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs">Mute</span>
                  <Switch checked={selectedAudio.muted} onCheckedChange={(v) => updateAudio(selectedAudio.id, { muted: v })} />
                </div>
                <AdjustSlider label="Volume" value={Math.round(selectedAudio.volume * 100)} min={0} max={100} onChange={(v) => updateAudio(selectedAudio.id, { volume: v / 100 })} />
                <AdjustSlider label="Fade in (s)" value={selectedAudio.fadeIn} min={0} max={Math.floor(selectedAudio.duration)} onChange={(v) => updateAudio(selectedAudio.id, { fadeIn: v })} />
                <AdjustSlider label="Fade out (s)" value={selectedAudio.fadeOut} min={0} max={Math.floor(selectedAudio.duration)} onChange={(v) => updateAudio(selectedAudio.id, { fadeOut: v })} />
                <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/30">
                  <div className="text-xs text-studio-muted mb-1">Time Stretch</div>
                  <div className="text-sm font-medium text-blue-400">{((selectedAudio.originalDuration / selectedAudio.duration) * 100).toFixed(0)}%</div>
                </div>
                {selectedAudio.fromVideo && (
                  <button
                    onClick={() => convertAudioToVideo(selectedAudio.id)}
                    className="w-full text-xs px-3 py-2.5 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20 transition-colors flex items-center justify-center gap-2"
                  >
                    <Video className="size-3.5" /> Convert back to Video
                  </button>
                )}
              </Section>
            )}

            <div className="p-3 bg-gradient-to-r from-orange-500/10 to-pink-500/10 rounded-xl border border-orange-500/20">
              <div className="flex items-center gap-2 mb-1.5">
                <Wand2 className="size-3.5 text-orange-400" />
                <span className="text-xs font-semibold">How It Works</span>
              </div>
              <p className="text-[10px] text-studio-muted leading-relaxed">
                Click a video file to choose Video or Audio Only. Videos go to V1 with visuals, audio goes to A1-A8 tracks. All tracks play together in sync — add a dancing video to V1 and a song to A1, and they play simultaneously.
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* Timeline / Storyboard */}
      <section className="h-80 border-t border-studio-border bg-studio-surface flex flex-col shrink-0">
        <div className="h-11 border-b border-studio-border flex items-center px-4 justify-between bg-studio-bg/50">
          {viewMode === "timeline" ? (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={undo} title="Undo (Cmd/Ctrl+Z)">
                <Undo2 className="size-3.5" /> Undo
              </Button>
              <Button size="sm" variant="ghost" onClick={redo} title="Redo (Cmd/Ctrl+Shift+Z)">
                <Redo2 className="size-3.5" /> Redo
              </Button>
              <Button size="sm" variant="ghost" onClick={splitClip} disabled={!selectedClipId} title="Split (S)">
                <Split className="size-3.5" /> Split
              </Button>
              <Button size="sm" variant="ghost" onClick={deleteClip} disabled={!selectedClipId && !selectedAudioId} title="Delete (Del)">
                <Trash2 className="size-3.5" /> Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={addAudioTrack}>
                <Plus className="size-3.5" /> Add Audio Track
              </Button>
              <span className="text-[10px] text-studio-muted ml-2">Space play · S split · Del remove · ⌘Z undo</span>
            </div>
          ) : (
            <div className="text-xs text-studio-muted">Click a frame to jump to that time</div>
          )}
          <div className="text-[11px] font-mono text-studio-muted">{formatTime(currentTime)} / {formatTime(totalDuration)}</div>
        </div>

        {viewMode === "timeline" ? (
          <div
            ref={timelineScrollRef}
            className="flex-1 overflow-x-auto overflow-y-auto bg-studio-bg/30 p-3 relative"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left + e.currentTarget.scrollLeft - 80;
                const t = Math.max(0, Math.min(totalDuration, x / PX_PER_SEC));
                handleSeek(t);
              }
            }}
          >
            {/* Time ruler */}
            <TimelineRuler totalDuration={totalDuration} onSeek={handleSeek} />

            {/* Video tracks (top) */}
            {Array.from({ length: videoTrackCount }).map((_, ti) => (
              <TimelineRow key={`v${ti}`} label={`V${ti + 1}`} height="h-16" labelColor="text-orange-400" bgColor="bg-orange-500/5">
                {/* Drop zone hint when no clips */}
                {clips.filter((c) => c.videoTrack === ti).length === 0 && ti === 0 && (
                  <div className="absolute inset-0 flex items-center px-4 pointer-events-none">
                    <span className="text-xs text-studio-muted">Click a video or image in the media panel to add here</span>
                  </div>
                )}
                {clips
                  .filter((c) => c.videoTrack === ti)
                  .map((c) => (
                    <div
                      key={c.id}
                      onClick={(e) => { e.stopPropagation(); setSelectedClipId(c.id); setSelectedAudioId(null); handleSeek(c.start); }}
                      onMouseDown={(e) => {
                        // Body drag = move clip (only if not clicking trim handles)
                        const target = e.target as HTMLElement;
                        if (target.dataset.handle) return;
                        handleMouseDown(e, "clip-move", c.id);
                      }}
                      className={cn(
                        "h-full absolute rounded overflow-hidden group cursor-grab active:cursor-grabbing transition-colors",
                        selectedClipId === c.id
                          ? c.kind === "image"
                            ? "border-2 border-emerald-500 ring-1 ring-emerald-500/50"
                            : "border-2 border-orange-500 ring-1 ring-orange-500/50"
                          : c.kind === "image"
                            ? "border border-emerald-500/40 hover:border-emerald-500"
                            : "border border-orange-500/40 hover:border-orange-500"
                      )}
                      style={{ width: `${c.duration * PX_PER_SEC}px`, left: `${c.start * PX_PER_SEC}px` }}
                    >
                      {/* Background: image thumbnail or video gradient */}
                      {c.kind === "image" && c.url ? (
                        <img src={c.url} alt={c.name} className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none" draggable={false} />
                      ) : (
                        <div className={cn("absolute inset-0", selectedClipId === c.id ? "bg-gradient-to-r from-orange-500/30 to-pink-500/30" : "bg-gradient-to-r from-orange-500/15 to-pink-500/15")} />
                      )}
                      {/* Left trim handle */}
                      <div data-handle="start" className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-white/20 z-10 flex items-center justify-center" onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, "clip-start", c.id); }}>
                        <div className="w-0.5 h-4 bg-white/50 rounded" />
                      </div>
                      {/* Right trim handle */}
                      <div data-handle="end" className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-white/20 z-10 flex items-center justify-center" onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, "clip-end", c.id); }}>
                        <div className="w-0.5 h-4 bg-white/50 rounded" />
                      </div>
                      {/* Label */}
                      <div className="absolute inset-x-3 inset-y-0 flex items-center gap-2 pointer-events-none">
                        <span className={cn("text-[8px] font-bold uppercase px-1 py-0.5 rounded shrink-0",
                          c.kind === "image" ? "bg-emerald-500/80 text-white" : "bg-black/40 text-white/80",
                          c.hidden && "opacity-40"
                        )}>
                          {c.kind === "image" ? "IMG" : (c.vfxPresetApplied || c.vfxPresetId) ? "VFX" : "VID"}
                        </span>
                        <span className={cn("text-[10px] font-medium truncate text-white drop-shadow", c.hidden && "opacity-50")}>{c.name}</span>
                        {c.hidden && <EyeOff className="size-3 text-white/50 ml-auto shrink-0" />}
                        {c.locked && <Lock className="size-3 text-yellow-300/70 ml-auto shrink-0" />}
                        {!c.hidden && !c.locked && c.muteOriginal && <VolumeX className="size-3 text-white/60 ml-auto shrink-0" />}
                      </div>
                      {/* Keyframe diamonds */}
                      {c.keyframes && c.keyframes.length > 0 && (
                        <div className="absolute bottom-0.5 left-0 right-0 pointer-events-none">
                          {c.keyframes.map((kf, ki) => (
                            <div key={ki} className="absolute" style={{ left: `${Math.max(0, kf.time * PX_PER_SEC - 4)}px`, bottom: 0 }}>
                              <Diamond className="size-2.5 text-yellow-400 drop-shadow" fill="currentColor" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </TimelineRow>
            ))}

            {/* Divider between video and audio tracks */}
            <div className="h-px bg-studio-border/50 my-1" />

            {/* Text track */}
            <TimelineRow label="T1" height="h-8" labelColor="text-amber-400" bgColor="bg-amber-500/5">
              {overlays.map((o) => (
                <div key={o.id} className="h-full absolute bg-amber-500/20 border border-amber-500/40 rounded flex items-center px-2" style={{ width: `${o.duration * PX_PER_SEC}px`, left: `${o.start * PX_PER_SEC}px` }}>
                  <span className="text-[9px] font-medium truncate">{o.text}</span>
                </div>
              ))}
            </TimelineRow>

            {/* Audio tracks (below video) */}
            {Array.from({ length: audioTrackCount }).map((_, ti) => (
              <TimelineRow key={`a${ti}`} label={`Audio ${ti + 1}`} height="h-10" labelColor="text-blue-400" bgColor="bg-blue-500/5">

                {audioClips
                  .filter((a) => a.track === ti)
                  .map((a) => (
                    <div
                      key={a.id}
                      onClick={(e) => { e.stopPropagation(); setSelectedAudioId(a.id); setSelectedClipId(null); }}
                      onMouseDown={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.dataset.handle) return;
                        handleMouseDown(e, "audio-move", a.id);
                      }}
                      className={cn(
                        "h-full absolute rounded flex items-center gap-1 cursor-grab active:cursor-grabbing transition-colors overflow-hidden group",
                        selectedAudioId === a.id
                          ? "bg-blue-500/30 border-2 border-blue-400"
                          : a.fromVideo
                            ? "bg-gradient-to-r from-blue-500/15 to-purple-500/15 border border-blue-500/40 hover:border-blue-500"
                            : "bg-blue-500/15 border border-blue-500/40 hover:border-blue-500"
                      )}
                      style={{ width: `${a.duration * PX_PER_SEC}px`, left: `${a.start * PX_PER_SEC}px` }}
                    >
                      <div data-handle="start" className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-blue-500/30 z-10 flex items-center justify-center" onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, "audio-start", a.id); }}>
                        <div className="w-0.5 h-4 bg-white/40 rounded" />
                      </div>
                      <div data-handle="end" className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-blue-500/30 z-10 flex items-center justify-center" onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, "audio-end", a.id); }}>
                        <div className="w-0.5 h-4 bg-white/40 rounded" />
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); updateAudio(a.id, { muted: !a.muted }); }}
                        className="size-6 shrink-0 grid place-items-center text-blue-300 ml-1 z-10"
                      >
                        {a.muted ? <VolumeX className="size-3" /> : <Volume2 className="size-3" />}
                      </button>
                      <div className="flex-1 min-w-0 h-full relative pointer-events-none">
                        <Waveform url={a.url} width={Math.max(20, a.duration * PX_PER_SEC - 40)} height={32} color="#3b82f6" />
                        <span className="absolute top-0.5 left-1 text-[9px] font-medium truncate text-blue-100/90">
                          {a.name}
                        </span>
                        {a.fromVideo && (
                          <span className="absolute top-0.5 right-1 text-[7px] text-purple-300/80">from video</span>
                        )}
                        {a.playbackRate !== 1 && (
                          <span className="absolute bottom-0.5 right-1 text-[8px] text-blue-300/70">{((1 / a.playbackRate) * 100).toFixed(0)}%</span>
                        )}
                      </div>
                    </div>
                  ))}
                {audioClips.filter((a) => a.track === ti).length === 0 && ti === 0 && (
                  <div className="absolute inset-0 flex items-center px-4 pointer-events-none">
                    <span className="text-xs text-studio-muted">Audio tracks play together with video</span>
                  </div>
                )}
              </TimelineRow>
            ))}

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-orange-500 z-20 pointer-events-none"
              style={{ left: `${80 + currentTime * PX_PER_SEC}px` }}
            >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-orange-500 rounded-full shadow-lg shadow-orange-500/50" />
            </div>

            {/* Snap guide — yellow vertical line that appears when a drag snaps to an edge */}
            {snapGuide !== null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 z-30 pointer-events-none"
                style={{ left: `${80 + snapGuide * PX_PER_SEC}px` }}
              >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-yellow-400 rounded-full" />
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4">
            {selectedClip?.storyboardFrames && selectedClip.storyboardFrames.length > 0 ? (
              <div className="grid grid-cols-6 gap-2">
                {selectedClip.storyboardFrames.map((frame, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSeek(selectedClip.start + frame.time)}
                    className={cn(
                      "aspect-video bg-studio-surface rounded-lg overflow-hidden border-2 transition-all hover:scale-105 relative",
                      Math.abs(currentTime - (selectedClip.start + frame.time)) < 0.5 ? "border-orange-500 ring-2 ring-orange-500/50" : "border-studio-border"
                    )}
                  >
                    {frame.thumbnail ? (
                      <img src={frame.thumbnail} alt={`Frame at ${formatTime(frame.time)}`} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-studio-muted"><Film className="size-6" /></div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] text-center py-0.5">{formatTime(frame.time)}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-studio-muted">
                <div className="text-center">
                  <Film className="size-12 mx-auto opacity-30 mb-2" />
                  <p className="text-sm">Select a video clip to see storyboard</p>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        projectTitle={title}
        clips={clips.filter((c) => !!c.url).map((c) => ({ id: c.id, url: c.vfxUrl || c.url!, name: c.name, start: c.start, duration: c.duration }))}
        overlays={overlays}
        adjustments={adj}
      />
    </div>
  );
}

function LayersPanel({
  clips, audioClips, selectedClipId, selectedAudioId,
  onSelectClip, onSelectAudio, onUpdateClip, onUpdateAudio, onReorderClips,
}: {
  clips: Clip[];
  audioClips: AudioClip[];
  selectedClipId: string | null;
  selectedAudioId: string | null;
  onSelectClip: (id: string) => void;
  onSelectAudio: (id: string) => void;
  onUpdateClip: (id: string, patch: Partial<Clip>) => void;
  onUpdateAudio: (id: string, patch: Partial<AudioClip>) => void;
  onReorderClips: (reordered: Clip[]) => void;
}) {
  const dragId = useRef<string | null>(null);
  const BLEND_MODES = ["normal","multiply","screen","overlay","darken","lighten","color-dodge","color-burn","soft-light","difference","exclusion"];

  function moveClip(fromId: string, toId: string) {
    const from = clips.findIndex((c) => c.id === fromId);
    const to = clips.findIndex((c) => c.id === toId);
    if (from === -1 || to === -1 || from === to) return;
    const next = [...clips];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onReorderClips(next);
  }

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] text-studio-muted mb-2">
        <Layers className="size-3" /> Drag to reorder · click to select
      </div>

      {[...clips].sort((a, b) => b.videoTrack - a.videoTrack || a.start - b.start).map((c) => (
        <div
          key={c.id}
          draggable
          onDragStart={() => { dragId.current = c.id; }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => { if (dragId.current && dragId.current !== c.id) moveClip(dragId.current, c.id); dragId.current = null; }}
          onClick={() => onSelectClip(c.id)}
          className={cn(
            "rounded-lg border cursor-pointer select-none transition-all",
            selectedClipId === c.id ? "border-orange-500 bg-orange-500/10" : "border-studio-border bg-studio-bg hover:border-orange-500/40",
            c.hidden && "opacity-50"
          )}
        >
          <div className="flex items-center gap-2 px-2 py-1.5">
            <GripVertical className="size-3 text-studio-muted cursor-grab shrink-0" />
            <div className="size-8 rounded bg-black/40 shrink-0 overflow-hidden">
              {c.kind === "image" && c.url
                ? <img src={c.url} alt="" className="w-full h-full object-cover" />
                : c.storyboardFrames?.[0]?.thumbnail
                  ? <img src={c.storyboardFrames[0].thumbnail} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full grid place-items-center"><Film className="size-3 text-studio-muted" /></div>
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-medium truncate">{c.name}</div>
              <div className="text-[9px] text-studio-muted">V{c.videoTrack + 1} · {c.kind === "image" ? "IMG" : "VID"}{c.vfxPresetId ? " · VFX" : ""}</div>
            </div>
            <div className="flex items-center gap-0.5">
              <button onClick={(e) => { e.stopPropagation(); onUpdateClip(c.id, { hidden: !c.hidden }); }} className="p-1 rounded hover:bg-white/10 text-studio-muted hover:text-foreground transition-colors">
                {c.hidden ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
              </button>
              <button onClick={(e) => { e.stopPropagation(); onUpdateClip(c.id, { locked: !c.locked }); }} className={cn("p-1 rounded hover:bg-white/10 transition-colors", c.locked ? "text-yellow-400" : "text-studio-muted hover:text-foreground")}>
                {c.locked ? <Lock className="size-3" /> : <Unlock className="size-3" />}
              </button>
            </div>
          </div>
          {selectedClipId === c.id && (
            <div className="px-3 pb-2 space-y-1.5 border-t border-studio-border/50 pt-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-studio-muted w-12 shrink-0">Opacity</span>
                <input type="range" min={0} max={100} value={Math.round((c.opacity ?? 1) * 100)}
                  onChange={(e) => onUpdateClip(c.id, { opacity: parseInt(e.target.value) / 100 })}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 h-1 accent-orange-500" />
                <span className="text-[9px] font-mono w-8 text-right">{Math.round((c.opacity ?? 1) * 100)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-studio-muted w-12 shrink-0">Blend</span>
                <select value={c.blendMode || "normal"} onChange={(e) => { e.stopPropagation(); onUpdateClip(c.id, { blendMode: e.target.value }); }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 h-6 text-[9px] bg-studio-surface border border-studio-border rounded px-1 text-foreground">
                  {BLEND_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
      ))}

      {audioClips.map((a) => (
        <div key={a.id} onClick={() => onSelectAudio(a.id)}
          className={cn("rounded-lg border cursor-pointer transition-all", selectedAudioId === a.id ? "border-blue-500 bg-blue-500/10" : "border-studio-border bg-studio-bg hover:border-blue-500/40")}>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="size-8 rounded bg-blue-500/20 shrink-0 grid place-items-center"><Music className="size-3 text-blue-400" /></div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-medium truncate">{a.name}</div>
              <div className="text-[9px] text-studio-muted">A{a.track + 1} · Audio</div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onUpdateAudio(a.id, { muted: !a.muted }); }} className="p-1 rounded hover:bg-white/10 text-studio-muted hover:text-foreground transition-colors">
              {a.muted ? <VolumeX className="size-3" /> : <Volume2 className="size-3" />}
            </button>
          </div>
          {selectedAudioId === a.id && (
            <div className="px-3 pb-2 border-t border-studio-border/50 pt-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-studio-muted w-12 shrink-0">Volume</span>
                <input type="range" min={0} max={100} value={Math.round(a.volume * 100)}
                  onChange={(e) => onUpdateAudio(a.id, { volume: parseInt(e.target.value) / 100 })}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 h-1 accent-blue-500" />
                <span className="text-[9px] font-mono w-8 text-right">{Math.round(a.volume * 100)}%</span>
              </div>
            </div>
          )}
        </div>
      ))}

      {clips.length === 0 && audioClips.length === 0 && (
        <div className="text-xs text-studio-muted text-center py-8">No clips yet.</div>
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-studio-muted">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function TimelineRow({ label, children, height = "h-12", labelColor, bgColor }: { label: string; children: React.ReactNode; height?: string; labelColor?: string; bgColor?: string }) {
  return (
    <div className={cn("flex items-stretch gap-0", height, bgColor)}>
      <div className={cn("w-20 h-full flex items-center justify-center border-r border-studio-border bg-studio-surface shrink-0 text-[10px] font-medium", labelColor || "text-studio-muted")}>
        {label}
      </div>
      <div className="flex-1 relative">{children}</div>
    </div>
  );
}

function TimelineRuler({ totalDuration, onSeek }: { totalDuration: number; onSeek: (t: number) => void }) {
  // Pick a tick interval that gives ~80px between major ticks.
  const target = 80 / PX_PER_SEC;
  const steps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
  const major = steps.find((s) => s >= target) ?? 60;
  const minor = major / 5;
  const totalWithPad = Math.ceil(totalDuration + 5);
  const ticks: number[] = [];
  for (let t = 0; t <= totalWithPad; t += minor) ticks.push(Math.round(t * 100) / 100);

  return (
    <div className="flex items-stretch h-6 mb-1 select-none">
      <div className="w-20 h-full border-r border-studio-border bg-studio-surface shrink-0" />
      <div
        className="flex-1 relative cursor-pointer"
        style={{ minWidth: `${totalWithPad * PX_PER_SEC}px` }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          onSeek(Math.max(0, Math.min(totalDuration, x / PX_PER_SEC)));
        }}
      >
        {ticks.map((t, i) => {
          const isMajor = Math.abs((t / major) - Math.round(t / major)) < 0.001;
          return (
            <div
              key={i}
              className="absolute top-0 bottom-0"
              style={{ left: `${t * PX_PER_SEC}px` }}
            >
              <div className={cn("absolute top-0 w-px", isMajor ? "h-full bg-studio-muted/50" : "h-1/2 bg-studio-muted/20")} />
              {isMajor && (
                <span className="absolute top-0 left-1 text-[9px] font-mono text-studio-muted leading-none">
                  {formatRuler(t)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatRuler(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  if (m === 0) return `${s}s`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function AdjustSlider({ label, value, min, max, onChange, suffix = "" }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-studio-muted">{label}</span>
        <span className="font-medium">{value}{suffix}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={1} onValueChange={(v) => onChange(v[0])} />
    </div>
  );
}

function formatTime(sec: number) {
  if (!isFinite(sec)) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const f = Math.floor((sec % 1) * 100);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(f).padStart(2, "0")}`;
}

function ClipImagePlayer({ clip, filterStyle }: { clip: Clip; filterStyle: string }) {
  if (!clip.url) return null;
  return (
    <img
      src={clip.url}
      alt={clip.name}
      className="w-full h-full object-contain"
      style={{ filter: filterStyle }}
      draggable={false}
    />
  );
}

function ClipVideoPlayer({ clip, currentTime, playing, muted, filterStyle, videoElRef }: { clip: Clip; currentTime: number; playing: boolean; muted: boolean; filterStyle: string; videoElRef?: React.MutableRefObject<HTMLVideoElement | null> }) {
  const ref = useRef<HTMLVideoElement>(null);
  const src = clip.vfxUrl || clip.url || "";

  useEffect(() => { const el = ref.current; if (!el) return; if (el.src !== src) el.src = src; }, [src]);
  useEffect(() => { const el = ref.current; if (!el) return; el.playbackRate = clip.playbackRate || 1; }, [clip.playbackRate]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const localTime = Math.max(0, currentTime - clip.start);
    if (Math.abs(el.currentTime - localTime) > 0.25) { try { el.currentTime = localTime; } catch {} }
  }, [currentTime, clip.start]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (playing) { el.play().catch(() => {}); } else { el.pause(); }
  }, [playing, src]);

  return <video ref={(el) => { (ref as React.MutableRefObject<HTMLVideoElement | null>).current = el; if (videoElRef) videoElRef.current = el; }} crossOrigin="anonymous" muted={muted} playsInline preload="auto" className="w-full h-full object-contain" style={{ filter: filterStyle }} />;
}
