/**
 * Trend Engine Core — Advanced video trend application system.
 * Handles multi-step transformations: segmentation, compositing, color grading, and effects.
 *
 * Architecture:
 * 1. SegmentationEngine: MediaPipe-based person isolation
 * 2. CompositeEngine: Multi-layer compositing with backgrounds/scenes
 * 3. ColorGradeEngine: Advanced color science for trend aesthetics
 * 4. EffectEngine: Trend-specific overlays, framing, and mood
 * 5. ProcessingPipeline: Orchestrates all stages with progress tracking
 */

import { getSegmenter, getFaceDetector } from "@/lib/mediapipe";
import type { ImageSegmenterResult } from "@mediapipe/tasks-vision";

// ─────────────────────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────────────────────

export enum ProcessingStage {
  INIT = "init",
  SEGMENTATION = "segmentation",
  BACKGROUND_GEN = "background_gen",
  COMPOSITING = "compositing",
  COLOR_GRADING = "color_grading",
  EFFECTS = "effects",
  ENCODING = "encoding",
  COMPLETE = "complete",
}

export type ProcessingProgress = {
  stage: ProcessingStage;
  progress: number; // 0-100
  message: string;
};

export type SegmentationMask = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  threshold: number; // 0-255 confidence
};

export type CompositeLayer = {
  type: "background" | "person" | "overlay";
  source: CanvasImageSource;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  blendMode?: GlobalCompositeOperation;
};

export type ColorGradeParams = {
  brightness: number; // -100 to +100
  contrast: number; // -100 to +100
  saturation: number; // -100 to +100
  temperature: number; // -50 to +50 (warm/cool)
  highlights: number; // -100 to +100
  shadows: number; // -100 to +100
  vibrancy: number; // 0 to +200
  lut?: string; // LUT data URL for advanced grading
};

export type TrendEffectsConfig = {
  framing?: {
    type: "centered" | "rule-of-thirds" | "cinematic-sides";
    padding: number;
  };
  overlay?: {
    type: string;
    intensity: number;
    color?: string;
  };
  mood?: {
    vignette: number; // 0-1
    bloom: number; // 0-1
    chromaAberration: number; // 0-1
  };
  blur?: {
    radius: number;
    maskInvert: boolean;
  };
};

// ─────────────────────────────────────────────────────────────
// Segmentation Engine
// ─────────────────────────────────────────────────────────────

export class SegmentationEngine {
  /**
   * Extract person mask using MediaPipe Selfie Segmentation
   * Returns high-confidence mask for clean keying
   */
  async segmentPerson(
    source: HTMLVideoElement | HTMLImageElement,
    minConfidence: number = 0.5
  ): Promise<SegmentationMask> {
    const segmenter = await getSegmenter();

    // Create offscreen canvas for segmentation
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
    tempCanvas.height = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
    const ctx = tempCanvas.getContext("2d");
    if (!ctx) throw new Error("Failed to create 2D context");

    ctx.drawImage(source, 0, 0);
    const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);

    // Run segmentation
    const result = segmenter.segmentForVideo(source, performance.now());

    // Extract category mask (person = 1, background = 0)
    const maskData = new Uint8ClampedArray(result.categoryMask!.width * result.categoryMask!.height);
    const confidence = result.confidenceMasks ? result.confidenceMasks[0].data : null;

    for (let i = 0; i < maskData.length; i++) {
      const personConfidence = confidence ? confidence[i] : 1.0;
      // Map confidence to 0-255, apply threshold
      maskData[i] = personConfidence > minConfidence ? 255 : 0;
    }

    return {
      data: maskData,
      width: result.categoryMask!.width,
      height: result.categoryMask!.height,
      threshold: Math.floor(minConfidence * 255),
    };
  }

  /**
   * Refine mask edges using morphological operations
   * Improves keying quality by reducing halos
   */
  refineMaskEdges(mask: SegmentationMask, dilateAmount: number = 2): SegmentationMask {
    const { data, width, height } = mask;
    const refined = new Uint8ClampedArray(data);

    // Dilate (expand person region)
    for (let iter = 0; iter < dilateAmount; iter++) {
      const temp = new Uint8ClampedArray(refined);
      for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
          const idx = i * width + j;
          if (refined[idx] > 128) continue; // Already white
          // Check 8 neighbors
          for (let di = -1; di <= 1; di++) {
            for (let dj = -1; dj <= 1; dj++) {
              const ni = i + di;
              const nj = j + dj;
              if (ni >= 0 && ni < height && nj >= 0 && nj < width) {
                if (refined[ni * width + nj] > 128) {
                  temp[idx] = 255;
                }
              }
            }
          }
        }
      }
      refined.set(temp);
    }

    // Erode slightly (shrink slightly to remove halos)
    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        const idx = i * width + j;
        if (refined[idx] < 128) continue; // Already black
        let hasBlackNeighbor = false;
        for (let di = -1; di <= 1; di++) {
          for (let dj = -1; dj <= 1; dj++) {
            const ni = i + di;
            const nj = j + dj;
            if (ni >= 0 && ni < height && nj >= 0 && nj < width) {
              if (refined[ni * width + nj] < 128) {
                hasBlackNeighbor = true;
                break;
              }
            }
          }
          if (hasBlackNeighbor) break;
        }
        if (hasBlackNeighbor) refined[idx] = 0;
      }
    }

    return { ...mask, data: refined };
  }

  /**
   * Apply Gaussian blur to mask for soft edges
   */
  blurMask(mask: SegmentationMask, radius: number = 3): SegmentationMask {
    const { data, width, height } = mask;
    const blurred = new Uint8ClampedArray(data);
    const kernelSize = Math.ceil(radius * 2);

    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        let sum = 0;
        let count = 0;
        for (let di = -kernelSize; di <= kernelSize; di++) {
          for (let dj = -kernelSize; dj <= kernelSize; dj++) {
            const ni = i + di;
            const nj = j + dj;
            if (ni >= 0 && ni < height && nj >= 0 && nj < width) {
              const weight = Math.exp(-((di * di + dj * dj) / (2 * radius * radius)));
              sum += data[ni * width + nj] * weight;
              count += weight;
            }
          }
        }
        blurred[i * width + j] = Math.round(sum / count);
      }
    }

    return { ...mask, data: blurred };
  }
}

// ─────────────────────────────────────────────────────────────
// Composite Engine
// ─────────────────────────────────────────────────────────────

export class CompositeEngine {
  /**
   * Composite person mask onto background using alpha blending
   */
  compositeLayers(
    canvas: HTMLCanvasElement,
    source: HTMLVideoElement | HTMLImageElement,
    mask: SegmentationMask,
    background: CanvasImageSource | null,
    bgColor: string
  ): void {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // 1. Draw background
    if (background) {
      ctx.drawImage(background, 0, 0, w, h);
    } else {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);
    }

    // 2. Create temporary canvas for source
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

    tempCtx.drawImage(source, 0, 0, w, h);
    const sourceData = tempCtx.getImageData(0, 0, w, h);

    // 3. Draw background again on main canvas (foundation)
    ctx.clearRect(0, 0, w, h);
    if (background) {
      ctx.drawImage(background, 0, 0, w, h);
    } else {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);
    }

    // 4. Apply mask and composite person
    const scaledMask = this.scaleMaskToCanvas(mask, w, h);
    ctx.drawImage(source, 0, 0, w, h);

    // Use mask to selectively show source over background
    ctx.globalCompositeOperation = "destination-out";
    const maskCanvas = this.maskToCanvas(scaledMask);
    ctx.drawImage(maskCanvas, 0, 0);

    ctx.globalCompositeOperation = "source-over";
  }

  /**
   * Scale mask to match canvas dimensions
   */
  private scaleMaskToCanvas(mask: SegmentationMask, targetW: number, targetH: number): Uint8ClampedArray {
    const { data, width, height } = mask;
    const scaled = new Uint8ClampedArray(targetW * targetH);

    const scaleX = width / targetW;
    const scaleY = height / targetH;

    for (let y = 0; y < targetH; y++) {
      for (let x = 0; x < targetW; x++) {
        const srcX = Math.floor(x * scaleX);
        const srcY = Math.floor(y * scaleY);
        const srcIdx = srcY * width + srcX;
        const dstIdx = y * targetW + x;
        scaled[dstIdx] = data[srcIdx];
      }
    }

    return scaled;
  }

  /**
   * Convert mask data to canvas for compositing operations
   */
  private maskToCanvas(maskData: Uint8ClampedArray): HTMLCanvasElement {
    const size = Math.sqrt(maskData.length);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;

    const imageData = ctx.createImageData(size, size);
    for (let i = 0; i < maskData.length; i++) {
      const val = maskData[i];
      imageData.data[i * 4] = val; // R
      imageData.data[i * 4 + 1] = val; // G
      imageData.data[i * 4 + 2] = val; // B
      imageData.data[i * 4 + 3] = 255; // A
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  /**
   * Generate scene background appropriate for trend
   * Uses canvas patterns, gradients, or procedural generation
   */
  generateTrendBackground(
    canvas: HTMLCanvasElement,
    trendId: string,
    intensity: number
  ): void {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    switch (trendId) {
      case "kumar":
        // Warm bokeh with golden/warm lighting
        this.drawBokehBackground(ctx, w, h, "#d97706", "#92400e", 15);
        break;

      case "neo-noir-walk":
        // Rainy neon night street
        this.drawNeonRainStreet(ctx, w, h);
        break;

      case "wes-anderson":
        // Symmetrical pastel composition
        this.drawWesAndersonBackground(ctx, w, h);
        break;

      case "nothing":
        // Dot-matrix/grid minimal
        this.drawDotMatrixBackground(ctx, w, h);
        break;

      default:
        // Gradient fallback
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, "#1f2937");
        grad.addColorStop(1, "#111827");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
    }
  }

  private drawBokehBackground(ctx: CanvasRenderingContext2D, w: number, h: number, color1: string, color2: string, bokehCount: number) {
    // Gradient base
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h));
    grad.addColorStop(0, color1);
    grad.addColorStop(1, color2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Add bokeh lights
    ctx.fillStyle = "rgba(255, 200, 100, 0.3)";
    for (let i = 0; i < bokehCount; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = Math.random() * 80 + 20;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawNeonRainStreet(ctx: CanvasRenderingContext2D, w: number, h: number) {
    // Dark street background
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, w, h);

    // Neon lights
    const neonColors = ["#ec4899", "#06b6d4", "#a855f7"];
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = neonColors[i % neonColors.length];
      ctx.globalAlpha = 0.4;
      const x = (w / 5) * (i + 0.5);
      ctx.fillRect(x - 20, 0, 40, h);
    }
    ctx.globalAlpha = 1.0;

    // Rain streaks
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 100; i++) {
      ctx.beginPath();
      const x = Math.random() * w;
      const y = Math.random() * h;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 2, y + 20);
      ctx.stroke();
    }
  }

  private drawWesAndersonBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
    // Symmetrical pastel zones
    const pastels = ["#fca5a5", "#fde68a", "#a7f3d0", "#c4b5fd", "#fbcfe8"];
    const zoneH = h / pastels.length;

    for (let i = 0; i < pastels.length; i++) {
      ctx.fillStyle = pastels[i];
      ctx.fillRect(0, i * zoneH, w, zoneH);
    }

    // Symmetrical lines
    ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
  }

  private drawDotMatrixBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(0, 0, w, h);

    // Grid dots
    ctx.fillStyle = "#000000";
    const spacing = 8;
    for (let y = 0; y < h; y += spacing) {
      for (let x = 0; x < w; x += spacing) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Color Grade Engine
// ─────────────────────────────────────────────────────────────

export class ColorGradeEngine {
  /**
   * Apply color grading to canvas
   */
  applyColorGrade(canvas: HTMLCanvasElement, params: ColorGradeParams): void {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // Convert to HSL for better color manipulation
      const [h, s, l] = this.rgbToHsl(r, g, b);

      // Apply adjustments
      const newL = this.clamp(l + params.brightness / 100, 0, 1);
      const newS = this.clamp(s + params.saturation / 100, 0, 1);

      // Temperature adjustment (warm/cool)
      let adjH = h + params.temperature / 50;

      const [newR, newG, newB] = this.hslToRgb(adjH, newS, newL);

      // Apply contrast
      const contrast = 1 + params.contrast / 100;
      let r2 = Math.round((newR - 128) * contrast + 128);
      let g2 = Math.round((newG - 128) * contrast + 128);
      let b2 = Math.round((newB - 128) * contrast + 128);

      data[i] = this.clamp(r2, 0, 255);
      data[i + 1] = this.clamp(g2, 0, 255);
      data[i + 2] = this.clamp(b2, 0, 255);
    }

    ctx.putImageData(imageData, 0, 0);
  }

  private rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0,
      s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }

    return [h, s, l];
  }

  private hslToRgb(h: number, s: number, l: number): [number, number, number] {
    h = ((h % 1) + 1) % 1; // Normalize to 0-1

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
    const m = l - c / 2;

    let r = 0,
      g = 0,
      b = 0;

    if (h < 1 / 6) [r, g, b] = [c, x, 0];
    else if (h < 2 / 6) [r, g, b] = [x, c, 0];
    else if (h < 3 / 6) [r, g, b] = [0, c, x];
    else if (h < 4 / 6) [r, g, b] = [0, x, c];
    else if (h < 5 / 6) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];

    return [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255),
    ];
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Get color grade parameters for specific trend
   */
  getTrendColorGrade(trendId: string, intensity: number): ColorGradeParams {
    const baseIntensity = intensity / 100;

    const grades: Record<string, ColorGradeParams> = {
      kumar: {
        brightness: 5,
        contrast: 15,
        saturation: 20,
        temperature: 30,
        highlights: 10,
        shadows: 5,
        vibrancy: 120,
      },
      "neo-noir-walk": {
        brightness: -10,
        contrast: 35,
        saturation: -20,
        temperature: -40,
        highlights: 0,
        shadows: -15,
        vibrancy: 0,
      },
      "wes-anderson": {
        brightness: 8,
        contrast: -5,
        saturation: 30,
        temperature: 15,
        highlights: 5,
        shadows: 8,
        vibrancy: 150,
      },
      nothing: {
        brightness: 0,
        contrast: 50,
        saturation: -100,
        temperature: 0,
        highlights: 0,
        shadows: 0,
        vibrancy: 0,
      },
      "yes-but-split": {
        brightness: 10,
        contrast: 25,
        saturation: 25,
        temperature: 10,
        highlights: 15,
        shadows: 10,
        vibrancy: 130,
      },
    };

    const defaultGrade: ColorGradeParams = {
      brightness: 0,
      contrast: 5,
      saturation: 10,
      temperature: 5,
      highlights: 5,
      shadows: 5,
      vibrancy: 100,
    };

    const grade = grades[trendId] || defaultGrade;

    // Scale by intensity
    return {
      brightness: grade.brightness * baseIntensity,
      contrast: grade.contrast * baseIntensity,
      saturation: grade.saturation * baseIntensity,
      temperature: grade.temperature * baseIntensity,
      highlights: grade.highlights * baseIntensity,
      shadows: grade.shadows * baseIntensity,
      vibrancy: 100 + (grade.vibrancy - 100) * baseIntensity,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Effect Engine
// ─────────────────────────────────────────────────────────────

export class EffectEngine {
  /**
   * Apply trend-specific effects (framing, overlays, mood)
   */
  applyEffects(canvas: HTMLCanvasElement, trendId: string, config: TrendEffectsConfig): void {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Vignette
    if (config.mood?.vignette) {
      this.drawVignette(ctx, canvas.width, canvas.height, config.mood.vignette);
    }

    // Bloom effect
    if (config.mood?.bloom) {
      this.drawBloom(ctx, canvas.width, canvas.height, config.mood.bloom);
    }

    // Chroma aberration
    if (config.mood?.chromaAberration) {
      this.drawChromaAberration(ctx, canvas.width, canvas.height, config.mood.chromaAberration);
    }

    // Trend-specific overlays
    if (config.overlay) {
      this.drawOverlay(ctx, canvas.width, canvas.height, config.overlay);
    }

    // Framing
    if (config.framing) {
      this.applyFraming(ctx, canvas.width, canvas.height, config.framing);
    }
  }

  private drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number, intensity: number) {
    const radialGradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) / 2);
    radialGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    radialGradient.addColorStop(1, `rgba(0, 0, 0, ${intensity})`);

    ctx.fillStyle = radialGradient;
    ctx.fillRect(0, 0, w, h);
  }

  private drawBloom(ctx: CanvasRenderingContext2D, w: number, h: number, intensity: number) {
    // Soft glow overlay
    ctx.fillStyle = `rgba(255, 255, 255, ${intensity * 0.1})`;
    ctx.fillRect(0, 0, w, h);

    // Add soft light spots
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = `rgba(255, 200, 100, ${intensity * 0.15})`;
    const spotCount = Math.floor(5 * intensity);
    for (let i = 0; i < spotCount; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * w, Math.random() * h, Math.random() * 100 + 50, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  private drawChromaAberration(ctx: CanvasRenderingContext2D, w: number, h: number, intensity: number) {
    // Simulated chroma aberration by shifting color channels
    const offset = intensity * 3;
    ctx.fillStyle = `rgba(255, 0, 0, ${intensity * 0.1})`;
    ctx.fillRect(offset, offset, w - offset * 2, h - offset * 2);
    ctx.fillStyle = `rgba(0, 0, 255, ${intensity * 0.1})`;
    ctx.fillRect(-offset, -offset, w + offset * 2, h + offset * 2);
  }

  private drawOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, overlay: { type: string; intensity: number; color?: string }) {
    ctx.globalAlpha = overlay.intensity;

    switch (overlay.type) {
      case "film-burn":
        this.drawFilmBurnOverlay(ctx, w, h, overlay.color || "#f97316");
        break;
      case "scanlines":
        this.drawScanlinesOverlay(ctx, w, h, overlay.color || "#00ff00");
        break;
      case "grain":
        this.drawGrainOverlay(ctx, w, h);
        break;
    }

    ctx.globalAlpha = 1.0;
  }

  private drawFilmBurnOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, color: string) {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.2;
    for (let i = 0; i < 5; i++) {
      const y = Math.random() * h * 0.2;
      ctx.fillRect(0, y, w, Math.random() * 20 + 10);
    }
  }

  private drawScanlinesOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, color: string) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 2) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  private drawGrainOverlay(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const imageData = ctx.createImageData(w, h);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const grain = (Math.random() - 0.5) * 30;
      data[i] = data[i] + grain;
      data[i + 1] = data[i + 1] + grain;
      data[i + 2] = data[i + 2] + grain;
      data[i + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
  }

  private applyFraming(ctx: CanvasRenderingContext2D, w: number, h: number, framing: { type: string; padding: number }) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 2;

    const p = framing.padding;

    switch (framing.type) {
      case "centered":
        ctx.strokeRect(p, p, w - p * 2, h - p * 2);
        break;
      case "rule-of-thirds":
        const w3 = w / 3;
        const h3 = h / 3;
        ctx.beginPath();
        ctx.moveTo(w3, 0);
        ctx.lineTo(w3, h);
        ctx.moveTo(w3 * 2, 0);
        ctx.lineTo(w3 * 2, h);
        ctx.moveTo(0, h3);
        ctx.lineTo(w, h3);
        ctx.moveTo(0, h3 * 2);
        ctx.lineTo(w, h3 * 2);
        ctx.stroke();
        break;
      case "cinematic-sides":
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        const sideHeight = h * 0.15;
        ctx.fillRect(0, 0, w, sideHeight);
        ctx.fillRect(0, h - sideHeight, w, sideHeight);
        break;
    }
  }

  /**
   * Get effects config for trend
   */
  getTrendEffects(trendId: string, intensity: number): TrendEffectsConfig {
    const baseIntensity = intensity / 100;

    const effectsMap: Record<string, TrendEffectsConfig> = {
      kumar: {
        framing: { type: "rule-of-thirds", padding: 20 },
        mood: {
          vignette: 0.4 * baseIntensity,
          bloom: 0.3 * baseIntensity,
          chromaAberration: 0.1 * baseIntensity,
        },
      },
      "neo-noir-walk": {
        framing: { type: "cinematic-sides", padding: 0 },
        overlay: { type: "scanlines", intensity: 0.15 * baseIntensity, color: "#ec4899" },
        mood: {
          vignette: 0.8 * baseIntensity,
          bloom: 0,
          chromaAberration: 0.2 * baseIntensity,
        },
      },
      "wes-anderson": {
        framing: { type: "centered", padding: 50 },
        mood: {
          vignette: 0.2 * baseIntensity,
          bloom: 0.2 * baseIntensity,
          chromaAberration: 0,
        },
      },
      nothing: {
        framing: { type: "centered", padding: 40 },
        overlay: { type: "grain", intensity: 0.2 * baseIntensity },
        mood: {
          vignette: 0.3 * baseIntensity,
          bloom: 0,
          chromaAberration: 0,
        },
      },
    };

    return effectsMap[trendId] || { mood: {} };
  }
}

// ─────────────────────────────────────────────────────────────
// Processing Pipeline
// ─────────────────────────────────────────────────────────────

export class TrendProcessingPipeline {
  private segmentation = new SegmentationEngine();
  private composite = new CompositeEngine();
  private colorGrade = new ColorGradeEngine();
  private effects = new EffectEngine();

  private progressCallback: ((progress: ProcessingProgress) => void) | null = null;

  setProgressCallback(callback: (progress: ProcessingProgress) => void) {
    this.progressCallback = callback;
  }

  private emitProgress(stage: ProcessingStage, progress: number, message: string) {
    if (this.progressCallback) {
      this.progressCallback({ stage, progress, message });
    }
  }

  /**
   * Main processing function
   * Orchestrates all steps: segmentation → compositing → color grading → effects
   */
  async processVideoFrame(
    sourceCanvas: HTMLCanvasElement,
    trendId: string,
    intensity: number,
    bgColor: string,
    outputCanvas: HTMLCanvasElement
  ): Promise<void> {
    try {
      // Step 1: Segmentation
      this.emitProgress(ProcessingStage.SEGMENTATION, 10, "Extracting person mask...");
      const video = document.createElement("video");
      const ctx = sourceCanvas.getContext("2d");
      if (!ctx) throw new Error("Source canvas context failed");
      
      const imageData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = sourceCanvas.width;
      tempCanvas.height = sourceCanvas.height;
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) throw new Error("Temp canvas context failed");
      tempCtx.putImageData(imageData, 0, 0);

      let mask = await this.segmentation.segmentPerson(sourceCanvas, 0.5);
      this.emitProgress(ProcessingStage.SEGMENTATION, 30, "Refining mask edges...");
      mask = this.segmentation.refineMaskEdges(mask, 2);
      mask = this.segmentation.blurMask(mask, 2);

      // Step 2: Background generation
      this.emitProgress(ProcessingStage.BACKGROUND_GEN, 50, "Generating trend background...");
      outputCanvas.width = sourceCanvas.width;
      outputCanvas.height = sourceCanvas.height;
      this.composite.generateTrendBackground(outputCanvas, trendId, intensity);

      // Step 3: Compositing
      this.emitProgress(ProcessingStage.COMPOSITING, 60, "Compositing person onto background...");
      this.composite.compositeLayers(outputCanvas, sourceCanvas, mask, null, bgColor);

      // Step 4: Color grading
      this.emitProgress(ProcessingStage.COLOR_GRADING, 75, "Applying color grade...");
      const colorGrade = this.colorGrade.getTrendColorGrade(trendId, intensity);
      this.colorGrade.applyColorGrade(outputCanvas, colorGrade);

      // Step 5: Effects
      this.emitProgress(ProcessingStage.EFFECTS, 90, "Adding trend effects...");
      const effectsConfig = this.effects.getTrendEffects(trendId, intensity);
      this.effects.applyEffects(outputCanvas, trendId, effectsConfig);

      this.emitProgress(ProcessingStage.COMPLETE, 100, "Processing complete!");
    } catch (error) {
      throw new Error(`Trend processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
