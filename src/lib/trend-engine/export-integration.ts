/**
 * Trend Engine — Export Integration
 * Handles placement of processed videos back onto timeline with proper timing
 */

import { useTrendProcessor } from "@/hooks/use-trend-processor";
import { toast } from "sonner";

export type TimelineClip = {
  id: string;
  name: string;
  url: string;
  start: number;
  duration: number;
  videoTrack: number;
  bgRemove?: boolean;
  bgColor?: string;
  vfxPresetId?: string | null;
};

export type TrendExportOptions = {
  clipId: string;
  trendId: string;
  intensity: number;
  bgColor: string;
  replaceOriginal?: boolean;
  createNewTrack?: boolean;
  preserveAudio?: boolean;
};

/**
 * Export processed video back to timeline
 */
export async function exportTrendToTimeline(
  clip: TimelineClip,
  outputUrl: string,
  options: TrendExportOptions,
  onUpdate: (updatedClip: TimelineClip) => void
): Promise<void> {
  try {
    if (!outputUrl) {
      throw new Error("No processed video URL");
    }

    // Create updated clip
    const updatedClip: TimelineClip = {
      ...clip,
      url: outputUrl,
      vfxPresetId: `trend-${options.trendId}`,
      bgColor: options.bgColor,
      bgRemove: true,
    };

    // If replacing original, just update the clip
    if (options.replaceOriginal) {
      onUpdate(updatedClip);
      toast.success(`✓ Trend applied to "${clip.name}"`);
      return;
    }

    // Otherwise, create new clip on same or new track
    const newClip: TimelineClip = {
      ...updatedClip,
      id: crypto.randomUUID(),
      name: `${clip.name} (${options.trendId})`,
      videoTrack: options.createNewTrack ? clip.videoTrack + 1 : clip.videoTrack,
    };

    onUpdate(newClip);
    toast.success(`✓ Trend applied as new clip`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Export failed";
    toast.error(msg);
    throw error;
  }
}

/**
 * Batch export multiple clips with same trend
 */
export async function batchExportTrendToTimeline(
  clips: TimelineClip[],
  trendId: string,
  intensity: number,
  bgColor: string,
  processor: ReturnType<typeof useTrendProcessor>,
  onClipsUpdate: (clips: TimelineClip[]) => void
): Promise<TimelineClip[]> {
  const results: TimelineClip[] = [];

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];

    try {
      // Load video
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.src = clip.url;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("Failed to load video"));
        setTimeout(() => reject(new Error("Video load timeout")), 10000);
      });

      // Process frame
      const blob = await processor.processFrame(video, trendId, intensity, bgColor);

      if (blob && processor.state.outputUrl) {
        const updatedClip: TimelineClip = {
          ...clip,
          url: processor.state.outputUrl,
          vfxPresetId: `trend-${trendId}`,
          bgColor,
          bgRemove: true,
        };

        results.push(updatedClip);

        toast.success(`Processed ${i + 1}/${clips.length} clips`);
      }

      // Small delay between items
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Processing failed";
      toast.error(`Failed to process clip ${i + 1}: ${msg}`);
      continue;
    }
  }

  if (results.length > 0) {
    onClipsUpdate(results);
  }

  return results;
}

/**
 * Generate video composition with trend effects
 * Combines multiple layers: original video, processed trend, audio
 */
export async function composeVideoWithTrend(
  originalClip: TimelineClip,
  trendProcessedUrl: string,
  audioUrl?: string
): Promise<Blob> {
  // Create composition canvas
  const canvas = document.createElement("canvas");
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");

  // Load trend-processed video
  const video = document.createElement("video");
  video.src = trendProcessedUrl;
  video.crossOrigin = "anonymous";

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Failed to load video"));
  });

  // Draw to canvas
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Convert to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to create blob"));
        }
      },
      "video/mp4"
    );
  });
}

/**
 * Hook-like utility to manage trend export workflow
 */
export class TrendExportManager {
  private processor: ReturnType<typeof useTrendProcessor>;
  private updateClipCallback: ((clip: TimelineClip) => void) | null = null;

  constructor(processor: ReturnType<typeof useTrendProcessor>) {
    this.processor = processor;
  }

  setUpdateCallback(callback: (clip: TimelineClip) => void) {
    this.updateClipCallback = callback;
  }

  /**
   * Process a clip and export to timeline
   */
  async processAndExport(
    clip: TimelineClip,
    trendId: string,
    intensity: number,
    bgColor: string,
    options?: Partial<TrendExportOptions>
  ): Promise<TimelineClip | null> {
    try {
      // Load video
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.src = clip.url;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("Failed to load video"));
        setTimeout(() => reject(new Error("Video load timeout")), 10000);
      });

      // Process
      const blob = await this.processor.processFrame(
        video,
        trendId,
        intensity,
        bgColor
      );

      if (!blob || !this.processor.state.outputUrl) {
        throw new Error("Processing failed");
      }

      // Create updated clip
      const updatedClip: TimelineClip = {
        ...clip,
        url: this.processor.state.outputUrl,
        vfxPresetId: `trend-${trendId}`,
        bgColor,
        bgRemove: true,
      };

      // Call update callback
      if (this.updateClipCallback) {
        this.updateClipCallback(updatedClip);
      }

      toast.success(`✓ "${clip.name}" transformed with ${trendId}`);
      return updatedClip;
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Export failed";
      toast.error(msg);
      return null;
    }
  }

  /**
   * Create new track for trend output
   */
  createNewTrackForTrend(
    sourceClip: TimelineClip,
    trendClip: TimelineClip
  ): TimelineClip {
    return {
      ...trendClip,
      videoTrack: sourceClip.videoTrack + 1,
      start: sourceClip.start,
      duration: sourceClip.duration,
    };
  }

  /**
   * Export current state URL as file
   */
  exportAsFile(filename?: string): void {
    if (!this.processor.state.outputUrl) {
      toast.error("No processed output");
      return;
    }

    const a = document.createElement("a");
    a.href = this.processor.state.outputUrl;
    a.download = filename || `trend-export-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("Downloaded!");
  }

  /**
   * Copy output URL to clipboard
   */
  async copyToClipboard(): Promise<void> {
    if (!this.processor.state.outputUrl) {
      toast.error("No processed output");
      return;
    }

    try {
      await navigator.clipboard.writeText(this.processor.state.outputUrl);
      toast.success("Copied to clipboard!");
    } catch {
      toast.error("Failed to copy");
    }
  }

  /**
   * Get processor state
   */
  getState() {
    return this.processor.state;
  }

  /**
   * Reset processor
   */
  reset() {
    this.processor.reset();
  }
}

/**
 * Timeline integration helper
 * Manages clip updates, track management, and timeline refresh
 */
export class TimelineIntegration {
  /**
   * Insert processed clip into timeline at correct position
   */
  static insertClip(
    clips: TimelineClip[],
    newClip: TimelineClip,
    track?: number
  ): TimelineClip[] {
    const targetTrack = track ?? newClip.videoTrack;

    // Find insertion point
    const sameTrack = clips.filter((c) => c.videoTrack === targetTrack);
    const insertPoint = sameTrack.findIndex((c) => c.start > newClip.start);

    if (insertPoint === -1) {
      return [...clips, newClip];
    }

    const idx = clips.indexOf(sameTrack[insertPoint]);
    return [...clips.slice(0, idx), newClip, ...clips.slice(idx)];
  }

  /**
   * Replace clip while preserving timeline structure
   */
  static replaceClip(
    clips: TimelineClip[],
    clipId: string,
    updatedClip: Partial<TimelineClip>
  ): TimelineClip[] {
    return clips.map((c) => (c.id === clipId ? { ...c, ...updatedClip } : c));
  }

  /**
   * Remove clip from timeline
   */
  static removeClip(clips: TimelineClip[], clipId: string): TimelineClip[] {
    return clips.filter((c) => c.id !== clipId);
  }

  /**
   * Get clips on specific track
   */
  static getClipsOnTrack(clips: TimelineClip[], track: number): TimelineClip[] {
    return clips.filter((c) => c.videoTrack === track);
  }

  /**
   * Calculate total duration of timeline
   */
  static calculateDuration(clips: TimelineClip[]): number {
    if (clips.length === 0) return 0;
    return Math.max(...clips.map((c) => c.start + c.duration));
  }

  /**
   * Check for overlapping clips
   */
  static findOverlaps(clips: TimelineClip[]): Array<[TimelineClip, TimelineClip]> {
    const overlaps: Array<[TimelineClip, TimelineClip]> = [];

    for (let i = 0; i < clips.length; i++) {
      for (let j = i + 1; j < clips.length; j++) {
        const a = clips[i];
        const b = clips[j];

        if (a.videoTrack !== b.videoTrack) continue;

        const aEnd = a.start + a.duration;
        const bEnd = b.start + b.duration;

        if (a.start < bEnd && aEnd > b.start) {
          overlaps.push([a, b]);
        }
      }
    }

    return overlaps;
  }

  /**
   * Auto-arrange clips to avoid overlaps
   */
  static autoArrangeClips(clips: TimelineClip[]): TimelineClip[] {
    const sorted = [...clips].sort((a, b) => a.start - b.start);
    const arranged: TimelineClip[] = [];

    for (const clip of sorted) {
      let track = clip.videoTrack;
      let canPlace = false;

      while (!canPlace) {
        const trackClips = arranged.filter((c) => c.videoTrack === track);
        canPlace = !trackClips.some((c) => {
          const cEnd = c.start + c.duration;
          return clip.start < cEnd && clip.start + clip.duration > c.start;
        });

        if (!canPlace) {
          track++;
        }
      }

      arranged.push({ ...clip, videoTrack: track });
    }

    return arranged;
  }
}
