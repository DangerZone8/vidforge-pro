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
import { Download, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { exportVideo, type ExportClip, type ExportOverlay, type ExportAdjustments } from "@/lib/video-export";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectTitle: string;
  clips: ExportClip[];
  overlays: ExportOverlay[];
  adjustments: ExportAdjustments;
};

const RES_PRESETS: Record<string, { w: number; h: number; label: string }> = {
  "720p": { w: 1280, h: 720, label: "720p HD" },
  "1080p": { w: 1920, h: 1080, label: "1080p Full HD" },
  "480p": { w: 854, h: 480, label: "480p SD" },
};

const QUALITY_PRESETS: Record<string, { crf: number; label: string }> = {
  high: { crf: 18, label: "High (larger file)" },
  medium: { crf: 23, label: "Medium (recommended)" },
  low: { crf: 28, label: "Low (smaller file)" },
};

export function ExportDialog({ open, onOpenChange, projectTitle, clips, overlays, adjustments }: Props) {
  const [resolution, setResolution] = useState("1080p");
  const [quality, setQuality] = useState("medium");
  const [fps, setFps] = useState("30");

  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [outSize, setOutSize] = useState(0);

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
      const preset = RES_PRESETS[resolution];
      const q = QUALITY_PRESETS[quality];
      const blob = await exportVideo({
        width: preset.w,
        height: preset.h,
        fps: parseInt(fps, 10),
        crf: q.crf,
        clips,
        overlays,
        adjustments,
        onProgress: (pct, s) => {
          setProgress(pct);
          setStage(s);
        },
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
    a.download = `${projectTitle.replace(/[^a-z0-9-_]+/gi, "_") || "creatorcut"}-${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function handleClose(v: boolean) {
    if (status === "running") return; // block close during export
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export video</DialogTitle>
          <DialogDescription>
            Render your timeline as an MP4. Processing happens locally in your browser.
          </DialogDescription>
        </DialogHeader>

        {status === "idle" && (
          <div className="space-y-4 py-2">
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
                </SelectContent>
              </Select>
            </Field>
            <p className="text-[11px] text-studio-muted">
              {clips.length} clip(s) · {overlays.length} overlay(s) — first export downloads the encoder (~25 MB).
            </p>
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
            <video src={outUrl} controls className="w-full rounded-lg border border-studio-border bg-black" />
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
                Start export
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
