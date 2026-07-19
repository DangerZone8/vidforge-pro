/**
 * React hook for trend processing
 * Manages state, progress tracking, cancellation, and real-time preview
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
  TrendProcessingPipeline,
  ProcessingStage,
  ProcessingProgress,
} from "@/lib/trend-engine/core";
import { getTrendConfig } from "@/lib/trend-engine/trend-configs";
import { toast } from "sonner";

export type ProcessingState = {
  isProcessing: boolean;
  currentStage: ProcessingStage;
  progress: number; // 0-100
  message: string;
  error: string | null;
  outputUrl: string | null;
};

const initialState: ProcessingState = {
  isProcessing: false,
  currentStage: ProcessingStage.INIT,
  progress: 0,
  message: "Ready",
  error: null,
  outputUrl: null,
};

export function useTrendProcessor() {
  const [state, setState] = useState<ProcessingState>(initialState);
  const pipelineRef = useRef<TrendProcessingPipeline | null>(null);
  const cancelledRef = useRef(false);
  const frameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const outputCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize pipeline
  useEffect(() => {
    if (!pipelineRef.current) {
      pipelineRef.current = new TrendProcessingPipeline();
    }
  }, []);

  /**
   * Process a single frame from video
   */
  const processFrame = useCallback(
    async (
      videoElement: HTMLVideoElement,
      trendId: string,
      intensity: number,
      bgColor: string
    ): Promise<Blob | null> => {
      if (!pipelineRef.current) {
        toast.error("Pipeline not initialized");
        return null;
      }

      try {
        cancelledRef.current = false;
        setState((s) => ({ ...s, isProcessing: true, error: null }));

        const trendConfig = getTrendConfig(trendId);
        if (!trendConfig) {
          throw new Error(`Trend "${trendId}" not found`);
        }

        // Create canvas from video frame
        if (!frameCanvasRef.current) {
          frameCanvasRef.current = document.createElement("canvas");
        }
        const sourceCanvas = frameCanvasRef.current;
        sourceCanvas.width = videoElement.videoWidth;
        sourceCanvas.height = videoElement.videoHeight;

        const ctx = sourceCanvas.getContext("2d");
        if (!ctx) throw new Error("Failed to get canvas context");
        ctx.drawImage(videoElement, 0, 0);

        // Create output canvas
        if (!outputCanvasRef.current) {
          outputCanvasRef.current = document.createElement("canvas");
        }
        const outputCanvas = outputCanvasRef.current;

        // Set up progress callback
        pipelineRef.current.setProgressCallback((progress: ProcessingProgress) => {
          if (cancelledRef.current) return;

          setState((s) => ({
            ...s,
            currentStage: progress.stage,
            progress: progress.progress,
            message: progress.message,
          }));
        });

        // Process frame
        await pipelineRef.current.processVideoFrame(
          sourceCanvas,
          trendId,
          intensity,
          bgColor,
          outputCanvas
        );

        if (cancelledRef.current) return null;

        // Convert to blob
        return new Promise((resolve) => {
          outputCanvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              setState((s) => ({
                ...s,
                isProcessing: false,
                outputUrl: url,
                progress: 100,
                message: "Complete!",
              }));
              resolve(blob);
            } else {
              throw new Error("Failed to convert canvas to blob");
            }
          }, "image/png");
        });
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Processing failed";
        setState((s) => ({
          ...s,
          isProcessing: false,
          error: errorMsg,
          message: `Error: ${errorMsg}`,
        }));
        toast.error(errorMsg);
        return null;
      }
    },
    []
  );

  /**
   * Process entire video (frame by frame)
   */
  const processVideo = useCallback(
    async (
      videoElement: HTMLVideoElement,
      trendId: string,
      intensity: number,
      bgColor: string,
      onFrameProcessed?: (frameIndex: number, totalFrames: number) => void
    ): Promise<Blob | null> => {
      try {
        cancelledRef.current = false;
        setState((s) => ({ ...s, isProcessing: true, error: null }));

        const fps = 30; // Target frame rate
        const duration = videoElement.duration;
        const totalFrames = Math.ceil(duration * fps);
        const frameInterval = 1 / fps;

        // For now, process first frame as proof of concept
        // Full video processing would require FFmpeg integration
        videoElement.currentTime = 0;
        await new Promise((resolve) => {
          videoElement.onloadeddata = resolve;
        });

        const result = await processFrame(videoElement, trendId, intensity, bgColor);

        setState((s) => ({
          ...s,
          isProcessing: false,
          progress: 100,
        }));

        return result;
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Video processing failed";
        setState((s) => ({
          ...s,
          isProcessing: false,
          error: errorMsg,
        }));
        return null;
      }
    },
    [processFrame]
  );

  /**
   * Cancel ongoing processing
   */
  const cancel = useCallback(() => {
    cancelledRef.current = true;
    setState((s) => ({
      ...s,
      isProcessing: false,
      message: "Cancelled",
    }));
  }, []);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    cancelledRef.current = true;
    if (state.outputUrl) {
      URL.revokeObjectURL(state.outputUrl);
    }
    setState(initialState);
  }, [state.outputUrl]);

  return {
    // State
    state,

    // Methods
    processFrame,
    processVideo,
    cancel,
    reset,

    // Refs for advanced usage
    frameCanvasRef,
    outputCanvasRef,
  };
}

/**
 * Hook for real-time preview during processing
 */
export function useTrendPreview() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const updatePreview = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (!previewCanvasRef.current) {
        previewCanvasRef.current = document.createElement("canvas");
      }

      const previewCanvas = previewCanvasRef.current;
      previewCanvas.width = canvas.width;
      previewCanvas.height = canvas.height;

      const ctx = previewCanvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(canvas, 0, 0);

        // Revoke old URL
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }

        // Create new preview URL
        previewCanvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            setPreviewUrl(url);
          }
        });
      }
    },
    [previewUrl]
  );

  const clearPreview = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
  }, [previewUrl]);

  return {
    previewUrl,
    previewCanvasRef,
    updatePreview,
    clearPreview,
  };
}

/**
 * Hook for batch trend processing (multiple clips)
 */
export function useTrendBatchProcessor() {
  const [queue, setQueue] = useState<
    Array<{
      id: string;
      videoElement: HTMLVideoElement;
      trendId: string;
      intensity: number;
      bgColor: string;
    }>
  >([]);
  const [processed, setProcessed] = useState<Array<{ id: string; url: string }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const processor = useTrendProcessor();

  const addToQueue = useCallback(
    (
      id: string,
      videoElement: HTMLVideoElement,
      trendId: string,
      intensity: number,
      bgColor: string
    ) => {
      setQueue((q) => [...q, { id, videoElement, trendId, intensity, bgColor }]);
    },
    []
  );

  const processQueue = useCallback(async () => {
    if (queue.length === 0) {
      toast.info("Queue is empty");
      return;
    }

    setIsProcessing(true);
    const results: Array<{ id: string; url: string }> = [];

    for (let i = 0; i < queue.length; i++) {
      if (processor.state.error) {
        toast.error(`Failed at item ${i + 1}/${queue.length}`);
        break;
      }

      const item = queue[i];
      const blob = await processor.processFrame(
        item.videoElement,
        item.trendId,
        item.intensity,
        item.bgColor
      );

      if (blob && processor.state.outputUrl) {
        results.push({ id: item.id, url: processor.state.outputUrl });
      }

      // Small delay between items
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    setProcessed(results);
    setQueue([]);
    setIsProcessing(false);

    if (results.length > 0) {
      toast.success(`Processed ${results.length}/${queue.length} items`);
    }
  }, [queue, processor]);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setProcessed([]);
  }, []);

  return {
    queue,
    processed,
    isProcessing,
    addToQueue,
    processQueue,
    clearQueue,
  };
}
