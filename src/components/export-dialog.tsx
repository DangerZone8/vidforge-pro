import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Loader2, CheckCircle2, AlertCircle, Youtube, Instagram, Music2, Film, Settings2, Twitter } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { exportVideo, type ExportClip, type ExportOverlay, type ExportAdjustments } from "@/lib/video-export";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectTitle: string;
  clips: ExportClip[];
  overlays: ExportOverlay[];
  adjustments: ExportAdjustments;
};

type PlatformPreset = {
  id: string;
  label: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  w: number;
  h: number;
  fps: number;
  crf: number;
  accent: string;
};

const PLATFORM_PRESETS: PlatformPreset[] = [
  { id: "yt-4k",      label: "YouTube 4K",      sub: "3840×2160 · 60fps · master",  icon: Youtube,   w: 3840, h: 2160, fps: 60, crf: 16, accent: "from-red-500/30 to-red-600/10 border-red-500/40" },
  { id: "yt-1080",    label: "YouTube 1080p",   sub: "1920×1080 · 30fps · standard",icon: Youtube,   w: 1920, h: 1080, fps: 30, crf: 20, accent: "from-red-500/20 to-red-600/5 border-red-500/30" },
  { id: "reels",      label: "Instagram Reels", sub: "1080×1920 · 30fps · vertical",icon: Instagram, w: 1080, h: 1920, fps: 30, crf: 21, accent: "from-pink-500/25 to-fuchsia-600/10 border-pink-500/40" },
  { id: "tiktok",     label: "TikTok",          sub: "1080×1920 · 30fps · vertical",icon: Music2,    w: 1080, h: 1920, fps: 30, crf: 21, accent: "from-cyan-500/20 to-pink-500/10 border-cyan-500/40" },
  { id: "shorts",     label: "YT Shorts",       sub: "1080×1920 · 30fps · vertical",icon: Youtube,   w: 1080, h: 1920, fps: 30, crf: 21, accent: "from-red-500/20 to-orange-500/10 border-orange-500/40" },
  { id: "x",          label: "X / Twitter",     sub: "1280×720 · 30fps · square-ish",icon: Twitter,  w: 1280, h: 720,  fps: 30, crf: 22, accent: "from-sky-500/20 to-blue-600/10 border-sky-500/40" },
  { id: "cinema",     label: "Cinematic Master",sub: "1920×1080 · 24fps · low CRF", icon: Film,      w: 1920, h: 1080, fps: 24, crf: 14, accent: "from-amber-500/25 to-orange-600/10 border-amber-500/40" },
  { id: "custom",     label: "Custom",          sub: "Choose your own settings",    icon: Settings2, w: 1920, h: 1080, fps: 30, crf: 23, accent: "from-studio-accent/20 to-studio-accent/5 border-studio-accent/40" },
];

const RES_PRESETS: Record<string, { w: number; h: number; label: string }> = {
  "480p":  { w: 854,  h: 480,  label: "480p SD" },
  "720p":  { w: 1280, h: 720,  label: "720p HD" },
  "1080p": { w: 1920, h: 1080, label: "1080p Full HD" },
  "1440p": { w: 2560, h: 1440, label: "1440p QHD" },
  "4k":    { w: 3840, h: 2160, label: "4K UHD" },
};

const QUALITY_PRESETS: Record<string, { crf: number; label: string }> = {
  master:  { crf: 14, label: "Master (huge file, archival)" },
  high:    { crf: 18, label: "High (larger file)" },
  medium:  { crf: 23, label: "Medium (recommended)" },
  low:     { crf: 28, label: "Low (smaller file)" },
};

export function ExportDialog({ open, onOpenChange, projectTitle, clips, overlays, adjustments }: Props) {
  const [platform, setPlatform] = useState<string>("yt-1080");
  const [resolution, setResolution] = useState("1080p");
  const [quality, setQuality] = useState("medium");
  const [fps, setFps] = useState("30");

  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [outSize, setOutSize] = useState(0);

  const isCustom = platform === "custom";
  const active = PLATFORM_PRESETS.find((p) => p.id === platform)!;

  async function handleExport() {
    if (clips.length === 0) {
      toast.error("Add at least one clip to the timeline first");
      return;
    }
    setStatus("running");
    setProgress(0);
    setStage("Initializing engine");
    setError(null);
    setOutUrl(null);

    try {
      let w: number, h: number, f: number, crf: number;
      if (isCustom) {
        const res = RES_PRESETS[resolution];
        const q = QUALITY_PRESETS[quality];
        w = res.w; h = res.h; f = parseInt(fps, 10); crf = q.crf;
      } else {
        w = active.w; h = active.h; f = active.fps; crf = active.crf;
      }
      const blob = await exportVideo({
        width: w, height: h, fps: f, crf,
        clips, overlays, adjustments,
        onProgress: (pct, s) => { setProgress(pct); setStage(s); },
      });
      const url = URL.createObjectURL(blob);
      setOutUrl(url);
      setOutSize(blob.size);
      setStatus("done");
      toast.success("Export complete");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Export failed";
      setError(msg);
      setStatus("error");
      toast.error(msg);
    }
  }

  function handleDownload() {
    if (!outUrl) return;
    const a = document.createElement("a");
    a.href = outUrl;
    a.download = `${projectTitle.replace(/[^a-z0-9-_]+/gi, "_") || "creatorcut"}-${active.id}-${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function handleClose(v: boolean) {
    if (status === "running") return;
    if (!v && outUrl) {
      URL.revokeObjectURL(outUrl);
      setOutUrl(null);
    }
    if (!v) {
      setStatus("idle");
      setProgress(0);
      setError(null);
    }
    onOpenChange(v);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export video</DialogTitle>
          <DialogDescription>
            Pick a platform preset or roll your own. Renders locally with FFmpeg.wasm — your footage never leaves the browser.
          </DialogDescription>
        </DialogHeader>

        {status === "idle" && (
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <div>
              <Label className="text-xs text-studio-muted mb-2 block">Platform preset</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PLATFORM_PRESETS.map((p) => {
                  const Icon = p.icon;
                  const selected = platform === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPlatform(p.id)}
                      className={cn(
                        "group rounded-lg border bg-gradient-to-br p-2.5 text-left transition-all hover:scale-[1.02]",
                        p.accent,
                        selected ? "ring-2 ring-studio-accent ring-offset-2 ring-offset-studio-bg" : "opacity-80 hover:opacity-100"
                      )}
                    >
                      <Icon className="size-4 mb-1.5 text-foreground" />
                      <div className="text-[11px] font-semibold leading-tight">{p.label}</div>
                      <div className="text-[9px] text-studio-muted mt-0.5 leading-tight">{p.sub}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {isCustom && (
              <div className="space-y-3 pt-2 border-t border-studio-border">
                <Field label="Resolution">
                  <Select value={resolution} onValueChange={setResolution}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(RES_PRESETS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label} ({v.w}×{v.h})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Quality">
                  <Select value={quality} onValueChange={setQuality}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(QUALITY_PRESETS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Frame rate">
                  <Select value={fps} onValueChange={setFps}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24">24 fps (cinematic)</SelectItem>
                      <SelectItem value="30">30 fps (standard)</SelectItem>
                      <SelectItem value="60">60 fps (smooth)</SelectItem>
                      <SelectItem value="120">120 fps (slow-mo source)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            )}

            <div className="flex items-center justify-between rounded-md bg-studio-surface border border-studio-border px-3 py-2 text-[11px]">
              <span className="text-studio-muted">{clips.length} clip · {overlays.length} overlay</span>
              <span className="font-mono text-foreground">
                {isCustom ? `${RES_PRESETS[resolution].w}×${RES_PRESETS[resolution].h} · ${fps}fps · CRF ${QUALITY_PRESETS[quality].crf}` : `${active.w}×${active.h} · ${active.fps}fps · CRF ${active.crf}`}
              </span>
            </div>
          </div>
        )}

        {status === "running" && (
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin text-studio-accent" />
              <span>{stage}</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-studio-muted text-right tabular-nums">{progress.toFixed(0)}%</p>
            <p className="text-[11px] text-studio-muted">Keep this tab open — closing it cancels the export.</p>
          </div>
        )}

        {status === "done" && outUrl && (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <CheckCircle2 className="size-4" />
              <span>Export ready ({(outSize / 1024 / 1024).toFixed(1)} MB)</span>
            </div>
            <video src={outUrl} controls className="w-full rounded-lg border border-studio-border bg-black max-h-[40vh]" />
          </div>
        )}

        {status === "error" && (
          <div className="space-y-2 py-2">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="size-4" />
              <span>Export failed</span>
            </div>
            <p className="text-xs text-studio-muted break-words">{error}</p>
          </div>
        )}

        <DialogFooter>
          {status === "idle" && (
            <>
              <Button variant="ghost" onClick={() => handleClose(false)}>Cancel</Button>
              <Button onClick={handleExport} className="bg-studio-accent hover:bg-studio-accent/90 text-white">
                Render {active.label}
              </Button>
            </>
          )}
          {status === "running" && (
            <Button disabled className="bg-studio-accent text-white">
              <Loader2 className="size-4 animate-spin" /> Exporting…
            </Button>
          )}
          {status === "done" && (
            <>
              <Button variant="ghost" onClick={() => handleClose(false)}>Close</Button>
              <Button onClick={handleDownload} className="bg-studio-accent hover:bg-studio-accent/90 text-white">
                <Download className="size-4" /> Download MP4
              </Button>
            </>
          )}
          {status === "error" && (
            <>
              <Button variant="ghost" onClick={() => handleClose(false)}>Close</Button>
              <Button onClick={handleExport}>Retry</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-studio-muted">{label}</Label>
      {children}
    </div>
  );
}
