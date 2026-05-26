import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft, Upload, Play, Pause, Type, Sparkles, Download, Loader2,
  Film, Music, Image as ImageIcon, Scissors, Trash2, Wand2, Volume2, VolumeX, Plus, Library
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ExportDialog } from "@/components/export-dialog";
import { PreviewCanvas } from "@/components/preview-canvas";
import { Waveform } from "@/components/waveform";
import { FACE_FILTERS, type FilterCategory } from "@/lib/face-filters";
import { SOUND_LIBRARY } from "@/lib/sound-library";
import { decodeAudio, getAudioContext } from "@/lib/audio-utils";

export const Route = createFileRoute("/_app/editor/$projectId")({
  component: EditorPage,
  head: () => ({ meta: [{ title: "Editor — CreatorCut" }] }),
});

const AUDIO_TRACKS = 3; // A1, A2, A3
const PX_PER_SEC = 60;

type Clip = {
  id: string;
  mediaId: string;
  name: string;
  kind: "video" | "image";
  start: number;
  duration: number;
  url?: string;
  // AI effects (per clip)
  bgRemove?: boolean;
  bgMode?: "color" | "image";
  bgColor?: string;
  bgImageUrl?: string | null;
  faceFilter?: string | null;
};

type AudioClip = {
  id: string;
  name: string;
  url: string;
  start: number;
  duration: number;
  track: number; // 0..AUDIO_TRACKS-1
  volume: number; // 0..1
  muted: boolean;
  fadeIn: number;
  fadeOut: number;
};

type TextOverlay = { id: string; text: string; start: number; duration: number; color: string };
type Adjustments = { brightness: number; contrast: number; saturation: number; blur: number };

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
  const [activePanel, setActivePanel] = useState<"media" | "sounds" | "text" | "effects">("media");
  const [filterCategory, setFilterCategory] = useState<FilterCategory>("face");
  const [exportOpen, setExportOpen] = useState(false);

  const selectedClip = clips.find((c) => c.id === selectedClipId) ?? null;

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
      if (ts?.clips) setClips(ts.clips);
      if (ts?.audioClips) setAudioClips(ts.audioClips);
      if (ts?.overlays) setOverlays(ts.overlays);
      if (ts?.adjustments) setAdj(ts.adjustments);
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
        timeline_state: { clips, audioClips, overlays, adjustments: adj } as any,
      }).eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Project saved"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  // ---- Media upload ----
  function sanitizeName(name: string) {
    const dot = name.lastIndexOf(".");
    const base = (dot > 0 ? name.slice(0, dot) : name).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 60);
    const ext = (dot > 0 ? name.slice(dot + 1) : "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 8);
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
    if (ok > 0) toast.success(`${ok} file(s) uploaded`);
  }

  async function addClipFromMedia(m: any) {
    if (m.kind === "video") {
      const start = clips.reduce((acc, c) => Math.max(acc, c.start + c.duration), 0);
      const probe = document.createElement("video");
      probe.preload = "metadata";
      probe.src = m.url;
      probe.onloadedmetadata = () => {
        const newClip: Clip = {
          id: crypto.randomUUID(), mediaId: m.id, name: m.name, kind: "video",
          start, duration: probe.duration || 5, url: m.url,
          bgRemove: false, bgMode: "color", bgColor: "#0a0a14", bgImageUrl: null, faceFilter: null,
        };
        setClips((c) => [...c, newClip]);
        setSelectedClipId(newClip.id);
      };
    } else if (m.kind === "audio") {
      addAudioFromUrl(m.url, m.name);
    } else if (m.kind === "image") {
      const start = clips.reduce((acc, c) => Math.max(acc, c.start + c.duration), 0);
      const newClip: Clip = {
        id: crypto.randomUUID(), mediaId: m.id, name: m.name, kind: "image",
        start, duration: 5, url: m.url,
        bgRemove: false, bgMode: "color", bgColor: "#0a0a14", bgImageUrl: null, faceFilter: null,
      };
      setClips((c) => [...c, newClip]);
      setSelectedClipId(newClip.id);
      toast.success(`Added image "${m.name}" — adjust duration in the inspector`);
    }
  }

  async function addAudioFromUrl(url: string, name: string, track = 0) {
    try {
      const buf = await decodeAudio(url);
      const start = audioClips.filter((a) => a.track === track).reduce((acc, c) => Math.max(acc, c.start + c.duration), 0);
      const newClip: AudioClip = {
        id: crypto.randomUUID(), name, url, start, duration: buf.duration,
        track, volume: 1, muted: false, fadeIn: 0, fadeOut: 0,
      };
      setAudioClips((a) => [...a, newClip]);
      setSelectedAudioId(newClip.id);
      toast.success(`Added "${name}" to A${track + 1}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load audio");
    }
  }

  function splitClip() {
    if (!selectedClipId) return;
    const c = clips.find((x) => x.id === selectedClipId);
    if (!c) return;
    const splitAt = currentTime - c.start;
    if (splitAt <= 0 || splitAt >= c.duration) { toast.info("Move playhead inside the clip to split"); return; }
    const a = { ...c, duration: splitAt };
    const b = { ...c, id: crypto.randomUUID(), start: c.start + splitAt, duration: c.duration - splitAt };
    setClips((all) => all.flatMap((x) => x.id === c.id ? [a, b] : [x]));
  }

  function deleteClip() {
    if (selectedClipId) {
      setClips((c) => c.filter((x) => x.id !== selectedClipId));
      setSelectedClipId(null);
    } else if (selectedAudioId) {
      setAudioClips((a) => a.filter((x) => x.id !== selectedAudioId));
      setSelectedAudioId(null);
    }
  }

  function addText() {
    setOverlays((o) => [...o, { id: crypto.randomUUID(), text: "New text", start: currentTime, duration: 3, color: "#ffffff" }]);
    setActivePanel("text");
  }

  function updateClip(patch: Partial<Clip>) {
    if (!selectedClipId) return;
    setClips((all) => all.map((c) => c.id === selectedClipId ? { ...c, ...patch } : c));
  }

  function updateAudio(id: string, patch: Partial<AudioClip>) {
    setAudioClips((all) => all.map((c) => c.id === id ? { ...c, ...patch } : c));
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
  const totalDuration = Math.max(
    clips.reduce((acc, c) => Math.max(acc, c.start + c.duration), 0),
    audioClips.reduce((acc, c) => Math.max(acc, c.start + c.duration), 0),
    10,
  );
  const activeClip = clips.find((c) => currentTime >= c.start && currentTime < c.start + c.duration) ?? null;
  const activeOverlay = overlays.find((o) => currentTime >= o.start && currentTime < o.start + o.duration);

  // Playback ticker
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      if (playing) {
        const dt = (now - last) / 1000;
        setCurrentTime((t) => {
          const nt = t + dt;
          if (nt >= totalDuration) { setPlaying(false); return totalDuration; }
          return nt;
        });
      }
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, totalDuration]);

  // ---- Audio playback engine ----
  const audioNodesRef = useRef<Map<string, { src: AudioBufferSourceNode; gain: GainNode }>>(new Map());

  useEffect(() => {
    const ac = getAudioContext();
    const nodes = audioNodesRef.current;

    // Stop everything when paused
    if (!playing) {
      nodes.forEach(({ src }) => { try { src.stop(); } catch {} });
      nodes.clear();
      return;
    }

    // Start any audio clip overlapping currentTime
    (async () => {
      for (const ac2 of audioClips) {
        if (ac2.muted) continue;
        if (currentTime >= ac2.start && currentTime < ac2.start + ac2.duration) {
          if (nodes.has(ac2.id)) continue;
          try {
            const buf = await decodeAudio(ac2.url);
            const src = ac.createBufferSource();
            src.buffer = buf;
            const gain = ac.createGain();
            const offset = Math.max(0, currentTime - ac2.start);
            // Apply fade in/out via linearRampToValueAtTime
            const startGain = offset < ac2.fadeIn ? (offset / Math.max(0.01, ac2.fadeIn)) * ac2.volume : ac2.volume;
            gain.gain.setValueAtTime(startGain, ac.currentTime);
            if (ac2.fadeIn > 0 && offset < ac2.fadeIn) {
              gain.gain.linearRampToValueAtTime(ac2.volume, ac.currentTime + (ac2.fadeIn - offset));
            }
            if (ac2.fadeOut > 0) {
              const fadeStart = ac2.duration - ac2.fadeOut;
              if (offset < fadeStart) {
                gain.gain.setValueAtTime(ac2.volume, ac.currentTime + (fadeStart - offset));
                gain.gain.linearRampToValueAtTime(0, ac.currentTime + (ac2.duration - offset));
              }
            }
            src.connect(gain).connect(ac.destination);
            src.start(0, offset);
            nodes.set(ac2.id, { src, gain });
            src.onended = () => nodes.delete(ac2.id);
          } catch {}
        }
      }
    })();

    return () => {
      nodes.forEach(({ src }) => { try { src.stop(); } catch {} });
      nodes.clear();
    };
    // Intentionally only react to play/pause changes; seek/edit pauses first.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const filterStyle = `brightness(${adj.brightness}%) contrast(${adj.contrast}%) saturate(${adj.saturation}%) blur(${adj.blur}px)`;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-studio-border flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/dashboard" className="text-studio-muted hover:text-foreground"><ArrowLeft className="size-4" /></Link>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => saveProject.mutate()}
            className="h-8 border-none bg-transparent hover:bg-studio-surface focus-visible:bg-studio-surface w-64 font-medium" />
          <span className="text-[10px] px-2 py-0.5 bg-studio-accent/20 text-studio-accent rounded uppercase tracking-wider">Draft</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => saveProject.mutate()} disabled={saveProject.isPending}>
            {saveProject.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Save
          </Button>
          <Button size="sm" className="bg-studio-accent hover:bg-studio-accent/90 text-white" onClick={() => setExportOpen(true)}>
            <Download className="size-4" /> Export
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel */}
        <aside className="w-72 border-r border-studio-border flex flex-col shrink-0">
          <div className="p-3 border-b border-studio-border">
            <div className="grid grid-cols-4 gap-1 p-1 bg-studio-surface rounded-lg">
              {(["media", "sounds", "text", "effects"] as const).map((p) => (
                <button key={p} onClick={() => setActivePanel(p)}
                  className={cn("py-1.5 text-[11px] font-medium rounded-md capitalize transition-colors",
                    activePanel === p ? "bg-zinc-800 text-foreground" : "text-studio-muted")}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {activePanel === "media" && (
              <div className="space-y-3">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-studio-accent"); }}
                  onDragLeave={(e) => e.currentTarget.classList.remove("border-studio-accent")}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove("border-studio-accent");
                    handleFiles(e.dataTransfer.files);
                  }}
                  className="w-full cursor-pointer border-2 border-dashed border-studio-border rounded-lg p-4 text-center hover:border-studio-accent/60 transition-colors"
                >
                  <Upload className="size-5 mx-auto mb-1 text-studio-muted" />
                  <p className="text-xs font-medium">Drop or click to upload</p>
                  <p className="text-[10px] text-studio-muted">Video, image or audio</p>
                </div>
                <input ref={fileInputRef} type="file" hidden multiple accept="video/*,audio/*,image/*" onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
                <div className="grid grid-cols-2 gap-2">
                  {media.map((m) => (
                    <button key={m.id} onClick={() => addClipFromMedia(m)}
                      className="group aspect-square bg-zinc-900 rounded-lg outline outline-1 -outline-offset-1 outline-white/5 hover:outline-studio-accent transition-all relative overflow-hidden">
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
                        m.kind === "video" && "bg-studio-accent/80 text-white",
                        m.kind === "image" && "bg-emerald-500/80 text-white",
                        m.kind === "audio" && "bg-amber-500/80 text-black",
                      )}>
                        {m.kind}
                      </span>
                      <div className="absolute inset-x-0 bottom-0 px-1.5 py-1 bg-black/70 text-[9px] truncate text-left">{m.name}</div>
                    </button>
                  ))}
                </div>
                {media.length === 0 && (
                  <p className="text-xs text-studio-muted text-center py-8">No media yet. Upload to get started.</p>
                )}
              </div>
            )}



            {activePanel === "sounds" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[11px] text-studio-muted">
                  <Library className="size-3.5" /> Free sound library
                </div>
                <div className="space-y-1.5">
                  {SOUND_LIBRARY.map((s) => (
                    <div key={s.id} className="group flex items-center gap-2 p-2 bg-studio-surface rounded-lg">
                      <div className="size-8 grid place-items-center bg-studio-accent/15 text-studio-accent rounded">
                        <Music className="size-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{s.name}</div>
                        <div className="text-[10px] text-studio-muted capitalize">{s.category} · {formatTime(s.duration)}</div>
                      </div>
                      <button onClick={() => addAudioFromUrl(s.url, s.name, 0)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded bg-studio-accent text-white hover:scale-105">
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-studio-muted text-center pt-2">
                  Tip: upload your own audio in the Media tab. Drop on a clip to add to any audio track.
                </p>
              </div>
            )}

            {activePanel === "text" && (
              <div className="space-y-3">
                <Button variant="outline" onClick={addText} className="w-full"><Type className="size-4" /> Add text overlay</Button>
                {overlays.map((o) => (
                  <div key={o.id} className="p-2 bg-studio-surface rounded-lg space-y-2">
                    <Input value={o.text} onChange={(e) => setOverlays((all) => all.map((x) => x.id === o.id ? { ...x, text: e.target.value } : x))} className="h-7 text-xs" />
                    <div className="flex gap-2 items-center">
                      <input type="color" value={o.color} onChange={(e) => setOverlays((all) => all.map((x) => x.id === o.id ? { ...x, color: e.target.value } : x))} className="size-7 rounded" />
                      <button onClick={() => setOverlays((all) => all.filter((x) => x.id !== o.id))} className="ml-auto text-studio-muted hover:text-destructive">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activePanel === "effects" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-studio-muted">Color presets</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { name: "Original", adj: { brightness: 100, contrast: 100, saturation: 100, blur: 0 } },
                      { name: "Vivid", adj: { brightness: 105, contrast: 115, saturation: 140, blur: 0 } },
                      { name: "Mono", adj: { brightness: 100, contrast: 110, saturation: 0, blur: 0 } },
                      { name: "Retro", adj: { brightness: 95, contrast: 90, saturation: 80, blur: 0 } },
                      { name: "Dream", adj: { brightness: 110, contrast: 95, saturation: 110, blur: 1 } },
                      { name: "Noir", adj: { brightness: 90, contrast: 140, saturation: 0, blur: 0 } },
                    ].map((p) => (
                      <button key={p.name} onClick={() => setAdj(p.adj)} className="aspect-square bg-studio-surface border border-studio-border rounded-lg hover:border-studio-accent transition-colors text-[10px] grid place-items-center">
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-studio-muted">Face filters</p>
                  {!selectedClip && (
                    <p className="text-[10px] text-studio-muted">Select a clip in the timeline to apply.</p>
                  )}
                  <div className="grid grid-cols-4 gap-1 p-1 bg-studio-surface rounded-lg">
                    {(["face", "beauty", "lenses", "overlays"] as const).map((c) => (
                      <button key={c} onClick={() => setFilterCategory(c)}
                        className={cn("py-1 text-[10px] rounded capitalize transition-colors",
                          filterCategory === c ? "bg-zinc-800 text-foreground" : "text-studio-muted")}>{c}</button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {FACE_FILTERS.filter((f) => f.category === filterCategory || f.id === "none").map((f) => (
                      <button key={f.id}
                        disabled={!selectedClip}
                        onClick={() => updateClip({ faceFilter: f.id === "none" ? null : f.id })}
                        className={cn(
                          "aspect-square bg-studio-surface border rounded-lg text-[10px] flex flex-col items-center justify-center gap-1 transition-all",
                          selectedClip?.faceFilter === f.id || (f.id === "none" && !selectedClip?.faceFilter)
                            ? "border-studio-accent ring-1 ring-studio-accent" : "border-studio-border hover:border-studio-accent/60",
                          !selectedClip && "opacity-50 cursor-not-allowed",
                        )}>
                        <span className="text-xl">{f.emoji}</span>
                        <span className="text-[9px] leading-tight">{f.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Center preview */}
        <div className="flex-1 bg-black flex flex-col min-w-0">
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="relative w-full max-w-5xl aspect-video bg-zinc-900 rounded-xl overflow-hidden shadow-2xl">
              {activeClip && (activeClip.bgMode === "image" && activeClip.bgImageUrl ? (
                <img src={activeClip.bgImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : activeClip.bgColor && activeClip.kind === "image" ? (
                <div className="absolute inset-0" style={{ background: activeClip.bgColor }} />
              ) : null)}
              {activeClip?.kind === "image" ? (
                <img
                  src={activeClip.url}
                  alt={activeClip.name}
                  className="relative w-full h-full object-contain"
                  style={{ filter: filterStyle }}
                />
              ) : (
                <PreviewCanvas
                  src={activeClip?.url ?? null}
                  localTime={activeClip ? currentTime - activeClip.start : 0}
                  playing={playing && !!activeClip}
                  adjustmentFilter={filterStyle}
                  bgRemove={!!activeClip?.bgRemove}
                  bgMode={activeClip?.bgMode ?? "color"}
                  bgColor={activeClip?.bgColor ?? "#0a0a14"}
                  bgImageUrl={activeClip?.bgImageUrl ?? null}
                  faceFilter={activeClip?.faceFilter ?? null}
                  onEnded={() => setPlaying(false)}
                />
              )}
              {activeOverlay && (
                <div className="absolute inset-x-0 bottom-12 text-center pointer-events-none">
                  <span className="inline-block px-6 py-2 text-3xl font-bold drop-shadow-lg" style={{ color: activeOverlay.color }}>
                    {activeOverlay.text}
                  </span>
                </div>
              )}
              {clips.length === 0 && (
                <div className="absolute inset-0 grid place-items-center text-center text-studio-muted pointer-events-none">
                  <div>
                    <Film className="size-12 mx-auto opacity-30 mb-2" />
                    <p className="text-sm">Upload media and click a clip to add it to the timeline</p>
                  </div>
                </div>
              )}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 glass rounded-full px-5 py-2.5 flex items-center gap-5">
                <span className="text-[11px] font-mono text-white/70">{formatTime(currentTime)}</span>
                <button onClick={() => setPlaying((p) => !p)} className="size-9 bg-white rounded-full grid place-items-center text-black hover:scale-105 transition-transform">
                  {playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current ml-0.5" />}
                </button>
                <span className="text-[11px] font-mono text-white">{formatTime(totalDuration)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel — Inspector */}
        <aside className="w-80 border-l border-studio-border flex flex-col shrink-0">
          <div className="p-4 border-b border-studio-border">
            <h2 className="text-sm font-semibold">Inspector</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Color adjustments */}
            <Section title="Color adjustments">
              <AdjustSlider label="Brightness" value={adj.brightness} min={0} max={200} onChange={(v) => setAdj({ ...adj, brightness: v })} />
              <AdjustSlider label="Contrast" value={adj.contrast} min={0} max={200} onChange={(v) => setAdj({ ...adj, contrast: v })} />
              <AdjustSlider label="Saturation" value={adj.saturation} min={0} max={200} onChange={(v) => setAdj({ ...adj, saturation: v })} />
              <AdjustSlider label="Blur" value={adj.blur} min={0} max={10} onChange={(v) => setAdj({ ...adj, blur: v })} />
            </Section>

            {/* Clip properties (image clips) */}
            {selectedClip?.kind === "image" && (
              <Section title="Image clip" icon={<ImageIcon className="size-3.5 text-studio-accent" />}>
                <AdjustSlider
                  label="Duration (s)"
                  value={Math.round(selectedClip.duration)}
                  min={1}
                  max={60}
                  onChange={(v) => updateClip({ duration: v })}
                />
              </Section>
            )}

            {/* Background */}
            <Section title="Background" icon={<Wand2 className="size-3.5 text-studio-accent" />}>
              {!selectedClip ? (
                <p className="text-[10px] text-studio-muted">Select a clip in the timeline to change its background.</p>
              ) : (
                <div className="space-y-3">
                  {selectedClip.kind === "video" && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Remove person background (AI)</span>
                      <Switch checked={!!selectedClip.bgRemove} onCheckedChange={(v) => updateClip({ bgRemove: v })} />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-1 p-1 bg-studio-surface rounded-lg">
                    {(["color", "image"] as const).map((m) => (
                      <button key={m} onClick={() => updateClip({ bgMode: m })}
                        className={cn("py-1.5 text-[10px] rounded capitalize transition-colors",
                          (selectedClip.bgMode ?? "color") === m ? "bg-zinc-800 text-foreground" : "text-studio-muted")}>{m}</button>
                    ))}
                  </div>
                  {(selectedClip.bgMode ?? "color") === "color" && (
                    <>
                      <div className="flex items-center gap-2">
                        <input type="color" value={selectedClip.bgColor ?? "#0a0a14"}
                          onChange={(e) => updateClip({ bgColor: e.target.value })}
                          className="size-9 rounded cursor-pointer" />
                        <span className="text-[10px] text-studio-muted font-mono">{selectedClip.bgColor}</span>
                      </div>
                      <div className="grid grid-cols-6 gap-1.5">
                        {["#000000", "#ffffff", "#0a0a14", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899", "#14b8a6", "#84cc16", "#f97316"].map((col) => (
                          <button key={col} onClick={() => updateClip({ bgColor: col })}
                            className="aspect-square rounded border border-studio-border hover:scale-110 transition-transform"
                            style={{ background: col }} aria-label={col} />
                        ))}
                      </div>
                    </>
                  )}
                  {(selectedClip.bgMode ?? "color") === "image" && (
                    <>
                      <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => bgFileInputRef.current?.click()}>
                        <Upload className="size-3.5" /> Upload image
                      </Button>
                      <input ref={bgFileInputRef} type="file" hidden accept="image/*" onChange={(e) => { handleBgImageUpload(e.target.files); e.target.value = ""; }} />
                      {media.filter((m: any) => m.kind === "image").length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] text-studio-muted">From media library</p>
                          <div className="grid grid-cols-3 gap-1.5">
                            {media.filter((m: any) => m.kind === "image").map((m: any) => (
                              <button key={m.id} onClick={() => updateClip({ bgImageUrl: m.url, bgMode: "image" })}
                                className={cn(
                                  "aspect-square rounded overflow-hidden border-2 transition-colors",
                                  selectedClip.bgImageUrl === m.url ? "border-studio-accent" : "border-transparent hover:border-studio-accent/60"
                                )}>
                                <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedClip.bgImageUrl && (
                        <img src={selectedClip.bgImageUrl} alt="bg" className="w-full h-20 object-cover rounded" />
                      )}
                    </>
                  )}
                </div>
              )}
            </Section>


            {/* Audio inspector */}
            {selectedAudioId && (() => {
              const ac = audioClips.find((a) => a.id === selectedAudioId);
              if (!ac) return null;
              return (
                <Section title={`Audio: ${ac.name}`} icon={<Music className="size-3.5 text-studio-accent" />}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Mute</span>
                    <Switch checked={ac.muted} onCheckedChange={(v) => updateAudio(ac.id, { muted: v })} />
                  </div>
                  <AdjustSlider label="Volume" value={Math.round(ac.volume * 100)} min={0} max={100}
                    onChange={(v) => updateAudio(ac.id, { volume: v / 100 })} />
                  <AdjustSlider label="Fade in (s)" value={ac.fadeIn} min={0} max={Math.floor(ac.duration)}
                    onChange={(v) => updateAudio(ac.id, { fadeIn: v })} />
                  <AdjustSlider label="Fade out (s)" value={ac.fadeOut} min={0} max={Math.floor(ac.duration)}
                    onChange={(v) => updateAudio(ac.id, { fadeOut: v })} />
                </Section>
              );
            })()}

            <div className="p-3 bg-studio-accent/5 rounded-xl border border-studio-accent/20">
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className="size-3.5 text-studio-accent" />
                <span className="text-xs font-semibold">Heads up</span>
              </div>
              <p className="text-[10px] text-studio-muted leading-relaxed">
                AI effects (bg removal, face filters) and audio tracks render in the preview. Export currently encodes the V1 track with color/text overlays.
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* Timeline */}
      <section className="h-72 border-t border-studio-border bg-studio-surface flex flex-col shrink-0">
        <div className="h-10 border-b border-studio-border flex items-center px-4 justify-between">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={splitClip} disabled={!selectedClipId}><Scissors className="size-3.5" /> Split</Button>
            <Button size="sm" variant="ghost" onClick={deleteClip} disabled={!selectedClipId && !selectedAudioId}><Trash2 className="size-3.5" /> Delete</Button>
          </div>
          <div className="text-[11px] font-mono text-studio-muted">
            {formatTime(currentTime)} / {formatTime(totalDuration)}
          </div>
        </div>
        <div
          className="flex-1 overflow-x-auto bg-studio-bg/50 p-3 space-y-1.5 relative"
          onClick={(e) => {
            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            const x = e.clientX - rect.left + (e.currentTarget as HTMLDivElement).scrollLeft - 80;
            const t = Math.max(0, Math.min(totalDuration, x / PX_PER_SEC));
            setCurrentTime(t);
          }}
        >
          {/* Video track */}
          <TimelineRow label="V1">
            {clips.map((c) => (
              <div
                key={c.id}
                onClick={(e) => { e.stopPropagation(); setSelectedClipId(c.id); setSelectedAudioId(null); setCurrentTime(c.start); }}
                className={cn(
                  "h-full absolute rounded flex items-center px-3 gap-2 cursor-pointer transition-colors overflow-hidden",
                  selectedClipId === c.id
                    ? "bg-studio-accent/40 border-2 border-studio-accent"
                    : "bg-studio-accent/15 border border-studio-accent/40 hover:bg-studio-accent/25"
                )}
                style={{ width: `${c.duration * PX_PER_SEC}px`, left: `${c.start * PX_PER_SEC}px` }}
              >
                <div className="size-6 bg-black/40 rounded-sm shrink-0 grid place-items-center text-[9px]">
                  {c.bgRemove ? "🪄" : c.faceFilter ? "✨" : "▶"}
                </div>
                <span className="text-[10px] font-medium truncate">{c.name}</span>
              </div>
            ))}
            {clips.length === 0 && <div className="text-xs text-studio-muted px-3 self-center">Add clips from the media panel</div>}
          </TimelineRow>

          {/* Text track */}
          <TimelineRow label="T1" height="h-7">
            {overlays.map((o) => (
              <div key={o.id} className="h-full absolute bg-amber-500/20 border border-amber-500/40 rounded flex items-center px-2"
                style={{ width: `${o.duration * PX_PER_SEC}px`, left: `${o.start * PX_PER_SEC}px` }}>
                <span className="text-[9px] font-medium truncate">{o.text}</span>
              </div>
            ))}
          </TimelineRow>

          {/* Audio tracks */}
          {Array.from({ length: AUDIO_TRACKS }).map((_, ti) => (
            <TimelineRow key={`a${ti}`} label={`A${ti + 1}`} height="h-12">
              {audioClips.filter((a) => a.track === ti).map((a) => (
                <div
                  key={a.id}
                  onClick={(e) => { e.stopPropagation(); setSelectedAudioId(a.id); setSelectedClipId(null); }}
                  className={cn(
                    "h-full absolute rounded flex items-center gap-2 cursor-pointer transition-colors overflow-hidden",
                    selectedAudioId === a.id
                      ? "bg-emerald-500/30 border-2 border-emerald-400"
                      : "bg-emerald-500/15 border border-emerald-500/40 hover:bg-emerald-500/25"
                  )}
                  style={{ width: `${a.duration * PX_PER_SEC}px`, left: `${a.start * PX_PER_SEC}px` }}
                >
                  <button onClick={(e) => { e.stopPropagation(); updateAudio(a.id, { muted: !a.muted }); }}
                    className="size-6 shrink-0 grid place-items-center text-emerald-300 ml-1.5">
                    {a.muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
                  </button>
                  <div className="flex-1 min-w-0 h-full relative">
                    <Waveform url={a.url} width={Math.max(20, a.duration * PX_PER_SEC - 32)} height={40} color="#10b981" />
                    <span className="absolute top-0.5 left-1 text-[9px] font-medium truncate text-emerald-100/90 pointer-events-none">
                      {a.name}
                    </span>
                  </div>
                </div>
              ))}
            </TimelineRow>
          ))}

          {/* Playhead */}
          <div className="absolute top-0 bottom-0 w-px bg-studio-accent z-10 shadow-[0_0_8px_rgba(139,92,246,0.8)] pointer-events-none"
            style={{ left: `${80 + currentTime * PX_PER_SEC}px` }}>
            <div className="absolute -top-1 -left-[3px] w-2 h-2 bg-studio-accent rotate-45" />
          </div>
        </div>
      </section>

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        projectTitle={title}
        clips={clips.filter((c) => !!c.url).map((c) => ({
          id: c.id, url: c.url!, name: c.name, start: c.start, duration: c.duration,
        }))}
        overlays={overlays}
        adjustments={adj}
      />
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

function TimelineRow({ label, children, height = "h-12" }: { label: string; children: React.ReactNode; height?: string }) {
  return (
    <div className={cn("flex items-stretch gap-0", height)}>
      <div className="w-20 h-full flex items-center justify-center border-r border-studio-border bg-studio-surface shrink-0 text-[10px] text-studio-muted">
        {label}
      </div>
      <div className="flex-1 relative">{children}</div>
    </div>
  );
}

function AdjustSlider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs">
        <span className="text-studio-muted">{label}</span>
        <span>{value}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={1} onValueChange={(v) => onChange(v[0])} />
    </div>
  );
}

function formatTime(sec: number) {
  if (!isFinite(sec)) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
