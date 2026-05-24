import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Upload, Play, Pause, Type, Sparkles, Download, Loader2, Film, Music, Image as ImageIcon, Scissors, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ExportDialog } from "@/components/export-dialog";

export const Route = createFileRoute("/_app/editor/$projectId")({
  component: EditorPage,
  head: () => ({ meta: [{ title: "Editor — CreatorCut" }] }),
});

type Clip = {
  id: string;
  mediaId: string;
  name: string;
  start: number; // timeline position seconds
  duration: number;
  url?: string;
};

type TextOverlay = { id: string; text: string; start: number; duration: number; color: string };

type Adjustments = { brightness: number; contrast: number; saturation: number; blur: number };

function EditorPage() {
  const { projectId } = Route.useParams();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("Untitled project");
  const [clips, setClips] = useState<Clip[]>([]);
  const [overlays, setOverlays] = useState<TextOverlay[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [adj, setAdj] = useState<Adjustments>({ brightness: 100, contrast: 100, saturation: 100, blur: 0 });
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activePanel, setActivePanel] = useState<"media" | "text" | "effects">("media");

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
      const { data, error } = await supabase
        .from("media_files")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Generate signed URLs
      const withUrls = await Promise.all((data ?? []).map(async (m) => {
        const { data: signed } = await supabase.storage.from("media").createSignedUrl(m.storage_path, 3600);
        return { ...m, url: signed?.signedUrl };
      }));
      return withUrls;
    },
  });

  useEffect(() => {
    if (project) {
      setTitle(project.title);
      const ts = project.timeline_state as any;
      if (ts?.clips) setClips(ts.clips);
      if (ts?.overlays) setOverlays(ts.overlays);
      if (ts?.adjustments) setAdj(ts.adjustments);
    }
  }, [project]);

  const saveProject = useMutation({
    mutationFn: async () => {
      const totalDuration = clips.reduce((acc, c) => Math.max(acc, c.start + c.duration), 0);
      const { error } = await supabase.from("projects").update({
        title,
        duration_seconds: totalDuration,
        timeline_state: { clips, overlays, adjustments: adj } as any,
      }).eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Project saved"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  async function handleFiles(files: FileList | null) {
    if (!files || !user) return;
    for (const file of Array.from(files)) {
      const kind = file.type.startsWith("video") ? "video" : file.type.startsWith("audio") ? "audio" : "image";
      const path = `${user.id}/${projectId}/${Date.now()}-${file.name}`;
      const { error: uErr } = await supabase.storage.from("media").upload(path, file, { contentType: file.type });
      if (uErr) { toast.error(uErr.message); continue; }
      await supabase.from("media_files").insert({
        user_id: user.id,
        project_id: projectId,
        name: file.name,
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
        kind,
      });
    }
    refetchMedia();
    toast.success(`${files.length} file(s) uploaded`);
  }

  function addClipFromMedia(m: any) {
    if (m.kind !== "video") { toast.info("Only video clips can be added to the timeline in v1"); return; }
    const start = clips.reduce((acc, c) => Math.max(acc, c.start + c.duration), 0);
    // Probe duration via temp video element
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.src = m.url;
    probe.onloadedmetadata = () => {
      const newClip: Clip = {
        id: crypto.randomUUID(),
        mediaId: m.id,
        name: m.name,
        start,
        duration: probe.duration || 5,
        url: m.url,
      };
      setClips((c) => [...c, newClip]);
      setSelectedClipId(newClip.id);
    };
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
    if (!selectedClipId) return;
    setClips((c) => c.filter((x) => x.id !== selectedClipId));
    setSelectedClipId(null);
  }

  function addText() {
    setOverlays((o) => [...o, { id: crypto.randomUUID(), text: "New text", start: currentTime, duration: 3, color: "#ffffff" }]);
    setActivePanel("text");
  }

  const totalDuration = clips.reduce((acc, c) => Math.max(acc, c.start + c.duration), 0);
  const activeClip = clips.find((c) => currentTime >= c.start && currentTime < c.start + c.duration);
  const activeOverlay = overlays.find((o) => currentTime >= o.start && currentTime < o.start + o.duration);

  useEffect(() => {
    if (!videoRef.current || !activeClip?.url) return;
    if (videoRef.current.src !== activeClip.url) {
      videoRef.current.src = activeClip.url;
    }
    const localTime = currentTime - activeClip.start;
    if (Math.abs(videoRef.current.currentTime - localTime) > 0.3) {
      videoRef.current.currentTime = localTime;
    }
  }, [activeClip, currentTime]);

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

  useEffect(() => {
    if (!videoRef.current) return;
    if (playing) videoRef.current.play().catch(() => {});
    else videoRef.current.pause();
  }, [playing, activeClip?.id]);

  const filterStyle = `brightness(${adj.brightness}%) contrast(${adj.contrast}%) saturate(${adj.saturation}%) blur(${adj.blur}px)`;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-studio-border flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/dashboard" className="text-studio-muted hover:text-foreground"><ArrowLeft className="size-4" /></Link>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => saveProject.mutate()}
            className="h-8 border-none bg-transparent hover:bg-studio-surface focus-visible:bg-studio-surface w-64 font-medium"
          />
          <span className="text-[10px] px-2 py-0.5 bg-studio-accent/20 text-studio-accent rounded uppercase tracking-wider">Draft</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => saveProject.mutate()} disabled={saveProject.isPending}>
            {saveProject.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Save
          </Button>
          <Button size="sm" className="bg-studio-accent hover:bg-studio-accent/90 text-white" onClick={() => toast.info("Export coming soon — will use FFmpeg.wasm to render to MP4")}>
            <Download className="size-4" /> Export
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel */}
        <aside className="w-72 border-r border-studio-border flex flex-col shrink-0">
          <div className="p-3 border-b border-studio-border">
            <div className="flex gap-1 p-1 bg-studio-surface rounded-lg">
              {(["media", "text", "effects"] as const).map((p) => (
                <button key={p} onClick={() => setActivePanel(p)}
                  className={cn("flex-1 py-1.5 text-xs font-medium rounded-md capitalize transition-colors",
                    activePanel === p ? "bg-zinc-800 text-foreground" : "text-studio-muted")}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {activePanel === "media" && (
              <div className="space-y-3">
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full">
                  <Upload className="size-4" /> Upload media
                </Button>
                <input ref={fileInputRef} type="file" hidden multiple accept="video/*,audio/*,image/*" onChange={(e) => handleFiles(e.target.files)} />
                <div className="grid grid-cols-2 gap-2">
                  {media.map((m) => (
                    <button key={m.id} onClick={() => addClipFromMedia(m)}
                      className="group aspect-square bg-zinc-900 rounded-lg outline outline-1 -outline-offset-1 outline-white/5 hover:outline-studio-accent transition-all relative overflow-hidden">
                      {m.kind === "video" && m.url ? (
                        <video src={m.url} className="w-full h-full object-cover" muted />
                      ) : m.kind === "image" && m.url ? (
                        <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-studio-muted">
                          {m.kind === "audio" ? <Music className="size-6" /> : <ImageIcon className="size-6" />}
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 px-1.5 py-1 bg-black/70 text-[9px] truncate text-left">{m.name}</div>
                    </button>
                  ))}
                </div>
                {media.length === 0 && (
                  <p className="text-xs text-studio-muted text-center py-8">No media yet. Upload to get started.</p>
                )}
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
              <div className="space-y-3">
                <p className="text-xs text-studio-muted">Click a preset to apply to the entire timeline.</p>
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
            )}
          </div>
        </aside>

        {/* Center preview */}
        <div className="flex-1 bg-black flex flex-col min-w-0">
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="relative w-full max-w-5xl aspect-video bg-zinc-900 rounded-xl overflow-hidden shadow-2xl">
              <video
                ref={videoRef}
                className="w-full h-full object-contain"
                style={{ filter: filterStyle }}
                onLoadedMetadata={() => { if (playing) videoRef.current?.play().catch(() => {}); }}
                onEnded={() => setPlaying(false)}
              />
              {activeOverlay && (
                <div className="absolute inset-x-0 bottom-12 text-center pointer-events-none">
                  <span className="inline-block px-6 py-2 text-3xl font-bold drop-shadow-lg" style={{ color: activeOverlay.color }}>
                    {activeOverlay.text}
                  </span>
                </div>
              )}
              {clips.length === 0 && (
                <div className="absolute inset-0 grid place-items-center text-center text-studio-muted">
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

        {/* Right panel */}
        <aside className="w-80 border-l border-studio-border flex flex-col shrink-0">
          <div className="p-4 border-b border-studio-border">
            <h2 className="text-sm font-semibold">Adjustments</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            <AdjustSlider label="Brightness" value={adj.brightness} min={0} max={200} onChange={(v) => setAdj({ ...adj, brightness: v })} />
            <AdjustSlider label="Contrast" value={adj.contrast} min={0} max={200} onChange={(v) => setAdj({ ...adj, contrast: v })} />
            <AdjustSlider label="Saturation" value={adj.saturation} min={0} max={200} onChange={(v) => setAdj({ ...adj, saturation: v })} />
            <AdjustSlider label="Blur" value={adj.blur} min={0} max={10} onChange={(v) => setAdj({ ...adj, blur: v })} />

            <div className="p-4 bg-studio-accent/5 rounded-xl border border-studio-accent/20 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-3.5 text-studio-accent" />
                <span className="text-xs font-semibold">AI Magic Tool</span>
              </div>
              <p className="text-[10px] text-studio-muted leading-relaxed">
                Background removal and AR filters arrive in the next release.
              </p>
              <Button variant="outline" disabled className="w-full h-8 text-xs">Coming soon</Button>
            </div>
          </div>
        </aside>
      </div>

      {/* Timeline */}
      <section className="h-60 border-t border-studio-border bg-studio-surface flex flex-col shrink-0">
        <div className="h-10 border-b border-studio-border flex items-center px-4 justify-between">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={splitClip} disabled={!selectedClipId}><Scissors className="size-3.5" /> Split</Button>
            <Button size="sm" variant="ghost" onClick={deleteClip} disabled={!selectedClipId}><Trash2 className="size-3.5" /> Delete</Button>
          </div>
          <div className="text-[11px] font-mono text-studio-muted">
            {formatTime(currentTime)} / {formatTime(totalDuration)}
          </div>
        </div>
        <div
          className="flex-1 overflow-x-auto bg-studio-bg/50 p-4 space-y-2 relative"
          onClick={(e) => {
            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            const x = e.clientX - rect.left - 64;
            const pxPerSec = 60;
            const t = Math.max(0, Math.min(totalDuration, x / pxPerSec));
            setCurrentTime(t);
          }}
        >
          <TimelineRow label="V1">
            {clips.map((c) => (
              <div
                key={c.id}
                onClick={(e) => { e.stopPropagation(); setSelectedClipId(c.id); setCurrentTime(c.start); }}
                className={cn(
                  "h-full rounded flex items-center px-3 gap-2 cursor-pointer shrink-0 transition-colors",
                  selectedClipId === c.id
                    ? "bg-studio-accent/40 border-2 border-studio-accent"
                    : "bg-studio-accent/15 border border-studio-accent/40 hover:bg-studio-accent/25"
                )}
                style={{ width: `${c.duration * 60}px`, marginLeft: `${c.start * 60 - clips.filter(x => x.start < c.start).reduce((a, x) => a + x.duration * 60, 0)}px` }}
              >
                <div className="size-7 bg-black/40 rounded-sm shrink-0" />
                <span className="text-[10px] font-medium truncate">{c.name}</span>
              </div>
            ))}
            {clips.length === 0 && <div className="text-xs text-studio-muted px-3">Add clips from the media panel</div>}
          </TimelineRow>

          <TimelineRow label="T1" height="h-8">
            {overlays.map((o) => (
              <div
                key={o.id}
                className="h-full bg-amber-500/20 border border-amber-500/40 rounded flex items-center px-2 shrink-0"
                style={{ width: `${o.duration * 60}px`, marginLeft: `${o.start * 60}px` }}
              >
                <span className="text-[9px] font-medium truncate">{o.text}</span>
              </div>
            ))}
          </TimelineRow>

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-px bg-studio-accent z-10 shadow-[0_0_8px_rgba(139,92,246,0.8)] pointer-events-none"
            style={{ left: `${80 + currentTime * 60}px` }}
          >
            <div className="absolute -top-1 -left-[3px] w-2 h-2 bg-studio-accent rotate-45" />
          </div>
        </div>
      </section>
    </div>
  );
}

function TimelineRow({ label, children, height = "h-12" }: { label: string; children: React.ReactNode; height?: string }) {
  return (
    <div className={cn("flex items-center gap-0.5", height)}>
      <div className="w-16 h-full flex items-center justify-center border-r border-studio-border bg-studio-surface shrink-0 text-[10px] text-studio-muted">
        {label}
      </div>
      <div className="flex-1 flex h-full relative">{children}</div>
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
