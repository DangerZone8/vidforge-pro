import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Monitor, Layers, Mic, Square, Pause, Play, Loader2, Save, X, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase-safe";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { consumePendingTrend, getTrend, setPendingTrend, type Trend } from "@/lib/trends";
import { getPreset, adjustmentsToCss } from "@/lib/vfx-presets";

export const Route = createFileRoute("/_app/record")({
  component: RecordPage,
  head: () => ({ meta: [{ title: "Record — CreatorCut" }] }),
});

type Mode = "webcam" | "screen" | "both";
type Status = "idle" | "countdown" | "recording" | "paused" | "preview";

function RecordPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);

  const [mode, setMode] = useState<Mode>("webcam");
  const [withMic, setWithMic] = useState(true);
  const [status, setStatus] = useState<Status>("idle");
  const [countdown, setCountdown] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => () => cleanup(), []);
  useEffect(() => {
    let t: ReturnType<typeof setInterval> | undefined;
    if (status === "recording") t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => { if (t) clearInterval(t); };
  }, [status]);

  function cleanup() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    camStreamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    camStreamRef.current = null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }

  async function getStream(): Promise<MediaStream> {
    if (mode === "webcam") {
      return navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: withMic,
      });
    }
    if (mode === "screen") {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      if (withMic) {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        mic.getAudioTracks().forEach((t) => screen.addTrack(t));
      }
      return screen;
    }
    // both: screen + webcam PIP composited via canvas
    const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    const cam = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: withMic });
    camStreamRef.current = cam;

    const canvas = document.createElement("canvas");
    canvas.width = 1280; canvas.height = 720;
    const ctx = canvas.getContext("2d")!;
    const screenVideo = document.createElement("video");
    screenVideo.srcObject = screen;
    await screenVideo.play();
    const camVideo = document.createElement("video");
    camVideo.srcObject = cam;
    await camVideo.play();

    let raf = 0;
    const draw = () => {
      ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
      const pipW = 240, pipH = 180;
      ctx.drawImage(camVideo, canvas.width - pipW - 20, canvas.height - pipH - 20, pipW, pipH);
      raf = requestAnimationFrame(draw);
    };
    draw();
    const combined = canvas.captureStream(30);
    screen.getAudioTracks().forEach((t) => combined.addTrack(t));
    if (withMic) cam.getAudioTracks().forEach((t) => combined.addTrack(t));
    (combined as any)._stopExtras = () => { cancelAnimationFrame(raf); screen.getTracks().forEach((t) => t.stop()); cam.getTracks().forEach((t) => t.stop()); };
    return combined;
  }

  async function startCountdown() {
    setStatus("countdown");
    setCountdown(3);
    try {
      const stream = await getStream();
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not access devices");
      setStatus("idle");
      return;
    }
    for (let i = 3; i > 0; i--) {
      setCountdown(i);
      await new Promise((r) => setTimeout(r, 800));
    }
    startRecording();
  }

  function startRecording() {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";
    const rec = new MediaRecorder(streamRef.current, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const b = new Blob(chunksRef.current, { type: "video/webm" });
      setBlob(b);
      const url = URL.createObjectURL(b);
      setPreviewUrl(url);
      setStatus("preview");
    };
    recorderRef.current = rec;
    rec.start(250);
    setElapsed(0);
    setStatus("recording");
  }

  function togglePause() {
    if (!recorderRef.current) return;
    if (status === "recording") { recorderRef.current.pause(); setStatus("paused"); }
    else if (status === "paused") { recorderRef.current.resume(); setStatus("recording"); }
  }

  function stop() {
    recorderRef.current?.stop();
    const extra = (streamRef.current as any)?._stopExtras;
    if (extra) extra();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  function discard() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setBlob(null); setPreviewUrl(""); setStatus("idle"); setElapsed(0);
  }

  async function saveToProject() {
    if (!blob || !user) return;
    setSaving(true);
    try {
      // Create a new project for this recording
      const { data: project, error: pErr } = await supabase
        .from("projects")
        .insert({ user_id: user.id, title: `Recording ${new Date().toLocaleString()}` })
        .select()
        .single();
      if (pErr) throw pErr;

      const path = `${user.id}/${project.id}/recording-${Date.now()}.webm`;
      const { error: uErr } = await supabase.storage
        .from("media")
        .upload(path, blob, { contentType: "video/webm", upsert: false });
      if (uErr) throw uErr;

      const { error: mErr } = await supabase.from("media_files").insert({
        user_id: user.id,
        project_id: project.id,
        name: "Recording.webm",
        storage_path: path,
        mime_type: "video/webm",
        size_bytes: blob.size,
        duration_seconds: elapsed,
        kind: "video",
      });
      if (mErr) throw mErr;

      toast.success("Recording saved to project");
      navigate({ to: "/editor/$projectId", params: { projectId: project.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="h-14 border-b border-studio-border flex items-center justify-between px-6">
        <h1 className="font-medium">Record</h1>
        <div className="text-xs text-studio-muted">Webcam, screen, or both — saved to a new project</div>
      </header>

      <div className="flex-1 grid lg:grid-cols-[1fr_320px] gap-6 p-6 max-w-7xl w-full mx-auto">
        <div className="space-y-4">
          <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-studio-border">
            {status === "preview" ? (
              <video ref={previewRef} src={previewUrl} controls className="w-full h-full" />
            ) : (
              <video ref={videoRef} muted autoPlay playsInline className="w-full h-full object-cover" />
            )}
            {status === "countdown" && (
              <div className="absolute inset-0 grid place-items-center bg-black/60">
                <div className="text-9xl font-bold text-studio-accent">{countdown}</div>
              </div>
            )}
            {(status === "recording" || status === "paused") && (
              <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-black/70 backdrop-blur rounded-full">
                <div className={cn("size-2 rounded-full", status === "recording" ? "bg-red-500 animate-pulse" : "bg-amber-500")} />
                <span className="text-xs font-mono">{formatTime(elapsed)}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-3">
            {status === "idle" && (
              <Button onClick={startCountdown} size="lg" className="bg-studio-accent hover:bg-studio-accent/90 text-white">
                <Camera className="size-4" /> Start recording
              </Button>
            )}
            {(status === "recording" || status === "paused") && (
              <>
                <Button onClick={togglePause} variant="outline" size="lg">
                  {status === "recording" ? <Pause className="size-4" /> : <Play className="size-4" />}
                  {status === "recording" ? "Pause" : "Resume"}
                </Button>
                <Button onClick={stop} variant="destructive" size="lg">
                  <Square className="size-4" /> Stop
                </Button>
              </>
            )}
            {status === "preview" && (
              <>
                <Button onClick={discard} variant="outline" size="lg"><X className="size-4" /> Discard</Button>
                <Button onClick={saveToProject} disabled={saving} size="lg" className="bg-studio-accent hover:bg-studio-accent/90 text-white">
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save to project
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-[11px] uppercase tracking-widest text-studio-muted font-bold">Source</h3>
            <div className="grid grid-cols-3 gap-2">
              <ModeButton active={mode === "webcam"} onClick={() => setMode("webcam")} icon={<Camera className="size-4" />} label="Webcam" />
              <ModeButton active={mode === "screen"} onClick={() => setMode("screen")} icon={<Monitor className="size-4" />} label="Screen" />
              <ModeButton active={mode === "both"} onClick={() => setMode("both")} icon={<Layers className="size-4" />} label="Both" />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-[11px] uppercase tracking-widest text-studio-muted font-bold">Audio</h3>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={withMic} onChange={(e) => setWithMic(e.target.checked)} className="accent-studio-accent" />
              <Mic className="size-4 text-studio-muted" />
              <span className="text-sm">Include microphone</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModeButton({ active, onClick, icon, label }: any) {
  return (
    <button onClick={onClick} className={cn(
      "aspect-square rounded-lg border flex flex-col items-center justify-center gap-1 transition-colors",
      active ? "bg-studio-accent/10 border-studio-accent text-studio-accent" : "bg-studio-surface border-studio-border text-studio-muted hover:text-foreground"
    )}>
      {icon}
      <span className="text-[10px]">{label}</span>
    </button>
  );
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
