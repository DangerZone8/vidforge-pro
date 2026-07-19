/**
 * Trend Processor UI Component
 * Real-time preview, progress visualization, and settings panel
 */

import { useState, useRef, useEffect } from "react";
import { useTrendProcessor, useTrendPreview } from "@/hooks/use-trend-processor";
import { getTrendConfig } from "@/lib/trend-engine/trend-configs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  Play,
  Pause,
  X,
  Sparkles,
  Download,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type TrendProcessorUIProps = {
  videoUrl: string;
  trendId: string;
  intensity?: number;
  bgColor?: string;
  onComplete?: (outputUrl: string) => void;
  onCancel?: () => void;
};

export function TrendProcessorUI({
  videoUrl,
  trendId,
  intensity = 80,
  bgColor = "#0a0a0a",
  onComplete,
  onCancel,
}: TrendProcessorUIProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [currentIntensity, setCurrentIntensity] = useState(intensity);
  const [previewMode, setPreviewMode] = useState<"original" | "processed">(
    "original"
  );
  const [autoPlay, setAutoPlay] = useState(true);

  const processor = useTrendProcessor();
  const preview = useTrendPreview();
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  const trendConfig = getTrendConfig(trendId);

  // Load video
  useEffect(() => {
    if (videoRef.current && videoUrl) {
      videoRef.current.src = videoUrl;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current!.currentTime = 0;
      };
    }
  }, [videoUrl]);

  // Auto-process on mount if requested
  useEffect(() => {
    if (autoPlay && videoRef.current && !processor.state.isProcessing) {
      handleProcess();
    }
  }, []);

  const handleProcess = async () => {
    if (!videoRef.current) {
      toast.error("Video not loaded");
      return;
    }

    const blob = await processor.processFrame(
      videoRef.current,
      trendId,
      currentIntensity,
      bgColor
    );

    if (blob && processor.state.outputUrl) {
      preview.updatePreview(processor.outputCanvasRef.current!);
      if (onComplete) {
        onComplete(processor.state.outputUrl);
      }
    }
  };

  const handleDownload = () => {
    if (processor.state.outputUrl) {
      const a = document.createElement("a");
      a.href = processor.state.outputUrl;
      a.download = `trend-${trendId}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Downloaded!");
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    preview.clearPreview();
    if (onCancel) onCancel();
  };

  const progressPercent = Math.round(processor.state.progress);
  const isComplete = processor.state.progress === 100;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-studio-accent" />
            Trend Processor — {trendConfig?.name || trendId}
          </DialogTitle>
          <DialogDescription>
            Real-time video transformation with {trendConfig?.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Preview Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Preview</h3>
              <div className="flex gap-2">
                <Button
                  variant={previewMode === "original" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPreviewMode("original")}
                  className="text-xs"
                >
                  Original
                </Button>
                <Button
                  variant={previewMode === "processed" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPreviewMode("processed")}
                  className="text-xs"
                >
                  Processed
                </Button>
              </div>
            </div>

            {/* Preview Canvas */}
            <div className="relative aspect-video bg-studio-bg rounded-lg overflow-hidden border border-studio-border">
              {previewMode === "original" ? (
                <video
                  ref={videoRef}
                  className="w-full h-full object-contain"
                  controls
                />
              ) : processor.state.outputUrl ? (
                <img
                  src={processor.state.outputUrl}
                  alt="Processed output"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-studio-surface/50">
                  <div className="text-center">
                    <Eye className="size-8 text-studio-muted mx-auto mb-2 opacity-50" />
                    <p className="text-xs text-studio-muted">
                      {processor.state.isProcessing
                        ? "Processing..."
                        : "Click Process to preview"}
                    </p>
                  </div>
                </div>
              )}

              {/* Loading Overlay */}
              {processor.state.isProcessing && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="bg-studio-surface px-6 py-4 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Loader2 className="size-5 animate-spin text-studio-accent" />
                      <div className="text-sm">
                        {processor.state.message}
                        <span className="text-xs text-studio-muted ml-2">
                          {progressPercent}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {processor.state.isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-studio-muted">
                  {processor.state.currentStage}
                </span>
                <span className="font-mono">{progressPercent}%</span>
              </div>
              <Progress
                value={progressPercent}
                className="h-2"
              />
            </div>
          )}

          {/* Settings Panel */}
          <div className="space-y-4 bg-studio-surface/50 p-4 rounded-lg border border-studio-border">
            <div>
              <label className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-studio-muted">
                  Intensity
                </span>
                <span className="text-sm font-mono text-studio-accent">
                  {currentIntensity}%
                </span>
              </label>
              <Slider
                value={[currentIntensity]}
                onValueChange={(v) => setCurrentIntensity(v[0])}
                min={0}
                max={100}
                step={5}
                disabled={processor.state.isProcessing}
                className="w-full"
              />
              <p className="text-[10px] text-studio-muted mt-1">
                Adjust how strongly the trend is applied
              </p>
            </div>

            {/* Trend Config Info */}
            {trendConfig && (
              <div className="space-y-2 text-xs">
                <div>
                  <p className="text-studio-muted font-semibold mb-1">
                    Segmentation Threshold
                  </p>
                  <p className="text-studio-muted">
                    {(trendConfig.segmentationThreshold * 100).toFixed(0)}% — Higher
                    = stricter person detection
                  </p>
                </div>
                <div>
                  <p className="text-studio-muted font-semibold mb-1">
                    Mask Refinement
                  </p>
                  <p className="text-studio-muted">
                    Dilate: {trendConfig.maskRefinement.dilate}px, Erode:{" "}
                    {trendConfig.maskRefinement.erode}px, Blur:{" "}
                    {trendConfig.maskRefinement.blur}px
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Error Display */}
          {processor.state.error && (
            <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-3">
              <p className="text-xs text-destructive">
                <span className="font-semibold">Error:</span> {processor.state.error}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleProcess}
              disabled={processor.state.isProcessing}
              className="flex-1 bg-studio-accent hover:bg-studio-accent/90"
            >
              {processor.state.isProcessing ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="size-4 mr-2" />
                  Process Frame
                </>
              )}
            </Button>

            {isComplete && processor.state.outputUrl && (
              <Button
                onClick={handleDownload}
                variant="outline"
                className="flex-1"
              >
                <Download className="size-4 mr-2" />
                Download
              </Button>
            )}

            <Button
              onClick={handleClose}
              variant="outline"
              className={cn(
                processor.state.isProcessing && "opacity-50 cursor-not-allowed"
              )}
              disabled={processor.state.isProcessing}
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Processing Complete Message */}
          {isComplete && (
            <div className="bg-studio-accent/10 border border-studio-accent/50 rounded-lg p-3">
              <p className="text-xs text-studio-accent font-semibold">
                ✓ Processing complete! Your trend has been applied.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Mini processor widget for inline use
 */
export function TrendProcessorWidget({
  videoElement,
  trendId,
  onProcessed,
}: {
  videoElement: HTMLVideoElement | null;
  trendId: string;
  onProcessed?: (outputUrl: string) => void;
}) {
  const processor = useTrendProcessor();
  const [intensity, setIntensity] = useState(80);

  const handleQuickProcess = async () => {
    if (!videoElement) {
      toast.error("Video not available");
      return;
    }

    await processor.processFrame(videoElement, trendId, intensity, "#0a0a0a");

    if (processor.state.outputUrl && onProcessed) {
      onProcessed(processor.state.outputUrl);
    }
  };

  return (
    <div className="bg-studio-surface border border-studio-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Quick Apply</h4>
        <span className="text-xs text-studio-muted">{intensity}%</span>
      </div>

      <Slider
        value={[intensity]}
        onValueChange={(v) => setIntensity(v[0])}
        min={0}
        max={100}
        step={10}
        disabled={processor.state.isProcessing}
      />

      <div className="flex gap-2">
        <Button
          onClick={handleQuickProcess}
          disabled={processor.state.isProcessing}
          size="sm"
          className="flex-1"
        >
          {processor.state.isProcessing ? (
            <>
              <Loader2 className="size-3 animate-spin mr-1" />
              Processing
            </>
          ) : (
            <>
              <Sparkles className="size-3 mr-1" />
              Apply Trend
            </>
          )}
        </Button>

        {processor.state.outputUrl && (
          <Button
            onClick={() => {
              const a = document.createElement("a");
              a.href = processor.state.outputUrl!;
              a.download = `trend-${trendId}.png`;
              a.click();
            }}
            variant="outline"
            size="sm"
          >
            <Download className="size-3" />
          </Button>
        )}
      </div>

      {processor.state.isProcessing && (
        <div className="space-y-1">
          <Progress value={processor.state.progress} className="h-1" />
          <p className="text-[10px] text-studio-muted">
            {processor.state.message}
          </p>
        </div>
      )}
    </div>
  );
}
