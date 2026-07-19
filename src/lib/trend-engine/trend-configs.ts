/**
 * Trend-specific configurations with deep aesthetic parameters
 * Each trend defines: backgrounds, color grades, effects, mood, and intensity mappings
 */

import type { ColorGradeParams, TrendEffectsConfig } from "./core";

export type TrendConfig = {
  id: string;
  name: string;
  description: string;
  defaultBgColor: string;
  bgType: "solid" | "gradient" | "procedural" | "pattern";
  colorGrade: (intensity: number) => ColorGradeParams;
  effects: (intensity: number) => TrendEffectsConfig;
  segmentationThreshold: number;
  maskRefinement: { dilate: number; erode: number; blur: number };
};

// ─────────────────────────────────────────────────────────────
// Kumar Method - Warm cinematic close-ups
// ─────────────────────────────────────────────────────────────

const kumarColorGrade = (intensity: number): ColorGradeParams => ({
  brightness: 8 * intensity,
  contrast: 20 * intensity,
  saturation: 25 * intensity,
  temperature: 45 * intensity,
  highlights: 15 * intensity,
  shadows: 8 * intensity,
  vibrancy: 100 + 35 * intensity,
});

const kumarEffects = (intensity: number): TrendEffectsConfig => ({
  framing: {
    type: "rule-of-thirds",
    padding: 30,
  },
  mood: {
    vignette: 0.45 * intensity,
    bloom: 0.35 * intensity,
    chromaAberration: 0.08 * intensity,
  },
  overlay: {
    type: "film-burn",
    intensity: 0.12 * intensity,
    color: "#d97706",
  },
});

export const KUMAR_CONFIG: TrendConfig = {
  id: "kumar",
  name: "Kumar Method",
  description: "Warm cinematic close-ups with shallow depth and golden bokeh",
  defaultBgColor: "#3d2817",
  bgType: "procedural",
  colorGrade: kumarColorGrade,
  effects: kumarEffects,
  segmentationThreshold: 0.65,
  maskRefinement: { dilate: 3, erode: 1, blur: 3 },
};

// ─────────────────────────────────────────────────────────────
// Nothing Style - Dot-matrix industrial minimal
// ─────────────────────────────────────────────────────────────

const nothingColorGrade = (intensity: number): ColorGradeParams => ({
  brightness: -5 * intensity,
  contrast: 65 * intensity,
  saturation: -100,
  temperature: 0,
  highlights: 5 * intensity,
  shadows: -10 * intensity,
  vibrancy: 0,
});

const nothingEffects = (intensity: number): TrendEffectsConfig => ({
  framing: {
    type: "centered",
    padding: 60,
  },
  overlay: {
    type: "grain",
    intensity: 0.3 * intensity,
  },
  mood: {
    vignette: 0.2 * intensity,
    bloom: 0,
    chromaAberration: 0,
  },
});

export const NOTHING_CONFIG: TrendConfig = {
  id: "nothing",
  name: "Nothing Style",
  description: "Dot-matrix mono, industrial minimal, clean grid aesthetic",
  defaultBgColor: "#f5f5f5",
  bgType: "pattern",
  colorGrade: nothingColorGrade,
  effects: nothingEffects,
  segmentationThreshold: 0.55,
  maskRefinement: { dilate: 2, erode: 2, blur: 2 },
};

// ─────────────────────────────────────────────────────────────
// Wes Anderson Blueprint - Symmetrical pastel cinematic
// ─────────────────────────────────────────────────────────────

const wesAndersonColorGrade = (intensity: number): ColorGradeParams => ({
  brightness: 10 * intensity,
  contrast: -8 * intensity,
  saturation: 40 * intensity,
  temperature: 20 * intensity,
  highlights: 8 * intensity,
  shadows: 12 * intensity,
  vibrancy: 100 + 60 * intensity,
});

const wesAndersonEffects = (intensity: number): TrendEffectsConfig => ({
  framing: {
    type: "centered",
    padding: 80,
  },
  mood: {
    vignette: 0.25 * intensity,
    bloom: 0.25 * intensity,
    chromaAberration: 0,
  },
});

export const WES_ANDERSON_CONFIG: TrendConfig = {
  id: "wes-anderson",
  name: "Wes Anderson Blueprint",
  description: "Symmetrical framing, pastel palette, deadpan whip-pans",
  defaultBgColor: "#fef3c7",
  bgType: "procedural",
  colorGrade: wesAndersonColorGrade,
  effects: wesAndersonEffects,
  segmentationThreshold: 0.58,
  maskRefinement: { dilate: 3, erode: 2, blur: 2 },
};

// ─────────────────────────────────────────────────────────────
// Neo-Noir Main Character Walk - Rainy neon night
// ─────────────────────────────────────────────────────────────

const neoNoirColorGrade = (intensity: number): ColorGradeParams => ({
  brightness: -15 * intensity,
  contrast: 45 * intensity,
  saturation: -30 * intensity,
  temperature: -55 * intensity,
  highlights: -5 * intensity,
  shadows: -20 * intensity,
  vibrancy: 100 - 40 * intensity,
});

const neoNoirEffects = (intensity: number): TrendEffectsConfig => ({
  framing: {
    type: "cinematic-sides",
    padding: 0,
  },
  overlay: {
    type: "scanlines",
    intensity: 0.2 * intensity,
    color: "#ec4899",
  },
  mood: {
    vignette: 0.9 * intensity,
    bloom: 0.05 * intensity,
    chromaAberration: 0.25 * intensity,
  },
});

export const NEO_NOIR_CONFIG: TrendConfig = {
  id: "neo-noir-walk",
  name: "Neo-Noir Main Character Walk",
  description: "Rainy neon night, slow stylish walk, synth-wave mood",
  defaultBgColor: "#0a0014",
  bgType: "procedural",
  colorGrade: neoNoirColorGrade,
  effects: neoNoirEffects,
  segmentationThreshold: 0.52,
  maskRefinement: { dilate: 2, erode: 1, blur: 4 },
};

// ─────────────────────────────────────────────────────────────
// Yes But Split Screen - Contrast of elegant vs chaotic
// ─────────────────────────────────────────────────────────────

const yesBoutColorGrade = (intensity: number): ColorGradeParams => ({
  brightness: 12 * intensity,
  contrast: 30 * intensity,
  saturation: 30 * intensity,
  temperature: 15 * intensity,
  highlights: 18 * intensity,
  shadows: 12 * intensity,
  vibrancy: 100 + 50 * intensity,
});

const yesBoutEffects = (intensity: number): TrendEffectsConfig => ({
  framing: {
    type: "rule-of-thirds",
    padding: 20,
  },
  mood: {
    vignette: 0.35 * intensity,
    bloom: 0.25 * intensity,
    chromaAberration: 0.12 * intensity,
  },
});

export const YES_BUT_CONFIG: TrendConfig = {
  id: "yes-but-split",
  name: "Yes But Split Screen",
  description: "Top: elegant aura. Bottom: chaotic funny version",
  defaultBgColor: "#111",
  bgType: "gradient",
  colorGrade: yesBoutColorGrade,
  effects: yesBoutEffects,
  segmentationThreshold: 0.60,
  maskRefinement: { dilate: 3, erode: 1, blur: 3 },
};

// ─────────────────────────────────────────────────────────────
// Slow-Mo Crew Lineup - Low-angle dramatic group shot
// ─────────────────────────────────────────────────────────────

const slowmoColorGrade = (intensity: number): ColorGradeParams => ({
  brightness: 5 * intensity,
  contrast: 25 * intensity,
  saturation: 20 * intensity,
  temperature: 10 * intensity,
  highlights: 12 * intensity,
  shadows: 8 * intensity,
  vibrancy: 100 + 25 * intensity,
});

const slowmoEffects = (intensity: number): TrendEffectsConfig => ({
  framing: {
    type: "cinematic-sides",
    padding: 0,
  },
  mood: {
    vignette: 0.5 * intensity,
    bloom: 0.15 * intensity,
    chromaAberration: 0.1 * intensity,
  },
});

export const SLOWMO_CONFIG: TrendConfig = {
  id: "slowmo-lineup",
  name: "Slow-Mo Crew Lineup",
  description: "Low-angle group walk, dramatic final pose",
  defaultBgColor: "#0a0a0a",
  bgType: "procedural",
  colorGrade: slowmoColorGrade,
  effects: slowmoEffects,
  segmentationThreshold: 0.60,
  maskRefinement: { dilate: 2, erode: 1, blur: 2 },
};

// ─────────────────────────────────────────────────────────────
// Micro-Drama Cliffhanger - Intense close-up, high stakes
// ─────────────────────────────────────────────────────────────

const microDramaColorGrade = (intensity: number): ColorGradeParams => ({
  brightness: -8 * intensity,
  contrast: 50 * intensity,
  saturation: 15 * intensity,
  temperature: -20 * intensity,
  highlights: 10 * intensity,
  shadows: -15 * intensity,
  vibrancy: 100 + 20 * intensity,
});

const microDramaEffects = (intensity: number): TrendEffectsConfig => ({
  framing: {
    type: "centered",
    padding: 15,
  },
  mood: {
    vignette: 0.75 * intensity,
    bloom: 0.1 * intensity,
    chromaAberration: 0.15 * intensity,
  },
});

export const MICRO_DRAMA_CONFIG: TrendConfig = {
  id: "micro-drama",
  name: "Micro-Drama Cliffhanger",
  description: "Cinematic tension, starts mid-scene, high stakes",
  defaultBgColor: "#0a0f14",
  bgType: "procedural",
  colorGrade: microDramaColorGrade,
  effects: microDramaEffects,
  segmentationThreshold: 0.65,
  maskRefinement: { dilate: 3, erode: 2, blur: 3 },
};

// ─────────────────────────────────────────────────────────────
// Unpopular Opinion Fake-Out - Intense close-up, bold lighting
// ─────────────────────────────────────────────────────────────

const unpopularOpinionColorGrade = (intensity: number): ColorGradeParams => ({
  brightness: -10 * intensity,
  contrast: 55 * intensity,
  saturation: -15 * intensity,
  temperature: -30 * intensity,
  highlights: 0,
  shadows: -20 * intensity,
  vibrancy: 100 - 30 * intensity,
});

const unpopularOpinionEffects = (intensity: number): TrendEffectsConfig => ({
  framing: {
    type: "centered",
    padding: 10,
  },
  mood: {
    vignette: 0.85 * intensity,
    bloom: 0,
    chromaAberration: 0.2 * intensity,
  },
  overlay: {
    type: "grain",
    intensity: 0.25 * intensity,
  },
});

export const UNPOPULAR_OPINION_CONFIG: TrendConfig = {
  id: "unpopular-opinion",
  name: "Unpopular Opinion Fake-Out",
  description: "Intense close-up, bold text, dramatic lighting",
  defaultBgColor: "#0a0a0a",
  bgType: "procedural",
  colorGrade: unpopularOpinionColorGrade,
  effects: unpopularOpinionEffects,
  segmentationThreshold: 0.68,
  maskRefinement: { dilate: 3, erode: 1, blur: 2 },
};

// ─────────────────────────────────────────────────────────────
// Trend Config Registry
// ─────────────────────────────────────────────────────────────

export const TREND_CONFIGS: Record<string, TrendConfig> = {
  kumar: KUMAR_CONFIG,
  nothing: NOTHING_CONFIG,
  "wes-anderson": WES_ANDERSON_CONFIG,
  "neo-noir-walk": NEO_NOIR_CONFIG,
  "yes-but-split": YES_BUT_CONFIG,
  "slowmo-lineup": SLOWMO_CONFIG,
  "micro-drama": MICRO_DRAMA_CONFIG,
  "unpopular-opinion": UNPOPULAR_OPINION_CONFIG,
};

/**
 * Get trend configuration by ID
 */
export function getTrendConfig(trendId: string): TrendConfig | null {
  return TREND_CONFIGS[trendId] || null;
}

/**
 * Generate advanced bokeh background with multiple layers
 */
export function generateAdvancedBokeh(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  primaryColor: string,
  accentColor: string
): void {
  // Multi-layer radial gradient
  const grad1 = ctx.createRadialGradient(w * 0.3, h * 0.3, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
  grad1.addColorStop(0, primaryColor);
  grad1.addColorStop(0.5, accentColor);
  grad1.addColorStop(1, "#1a0f05");

  ctx.fillStyle = grad1;
  ctx.fillRect(0, 0, w, h);

  // Bokeh lights with varying sizes and opacities
  const bokehLayers = [
    { count: 8, minSize: 60, maxSize: 150, opacity: 0.15 },
    { count: 12, minSize: 30, maxSize: 80, opacity: 0.1 },
    { count: 15, minSize: 10, maxSize: 40, opacity: 0.08 },
  ];

  for (const layer of bokehLayers) {
    ctx.fillStyle = `rgba(255, 200, 100, ${layer.opacity})`;
    for (let i = 0; i < layer.count; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = Math.random() * (layer.maxSize - layer.minSize) + layer.minSize;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Subtle light rays
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const startX = w / 2 + Math.cos((i / 5) * Math.PI * 2) * w * 0.3;
    const startY = h / 2 + Math.sin((i / 5) * Math.PI * 2) * h * 0.3;
    ctx.beginPath();
    ctx.moveTo(w / 2, h / 2);
    ctx.lineTo(startX, startY);
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;
}

/**
 * Generate premium neon rain street background
 */
export function generateNeonRainStreet(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  // Wet street reflection
  const streetGrad = ctx.createLinearGradient(0, 0, 0, h);
  streetGrad.addColorStop(0, "#0a0a0a");
  streetGrad.addColorStop(0.5, "#1a1a2e");
  streetGrad.addColorStop(1, "#16213e");
  ctx.fillStyle = streetGrad;
  ctx.fillRect(0, 0, w, h);

  // Neon signs - multiple color channels
  const neonColors = [
    { color: "#ec4899", x: 0.1, width: 0.12 },
    { color: "#06b6d4", x: 0.35, width: 0.1 },
    { color: "#a855f7", x: 0.6, width: 0.15 },
    { color: "#f97316", x: 0.85, width: 0.08 },
  ];

  for (const neon of neonColors) {
    // Main glow
    ctx.fillStyle = neon.color;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(w * neon.x, 0, w * neon.width, h);

    // Reflection on wet street
    ctx.globalAlpha = 0.2;
    ctx.fillRect(w * neon.x, h * 0.5, w * neon.width, h * 0.5);
  }

  ctx.globalAlpha = 1.0;

  // Rain streaks - heavy and dramatic
  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";

  for (let i = 0; i < 200; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const length = Math.random() * 40 + 20;
    const angle = Math.random() * 0.3 + 0.1;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - Math.sin(angle) * length, y + length);
    ctx.stroke();
  }

  // Atmospheric haze
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.fillRect(0, 0, w, h);
}

/**
 * Generate Wes Anderson symmetrical zones
 */
export function generateWesAndersonZones(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const pastels = ["#fca5a5", "#fde68a", "#a7f3d0", "#c4b5fd", "#fbcfe8"];
  const zoneH = h / pastels.length;

  // Gradient within each zone
  for (let i = 0; i < pastels.length; i++) {
    const grad = ctx.createLinearGradient(0, i * zoneH, w, (i + 1) * zoneH);
    grad.addColorStop(0, pastels[i]);
    grad.addColorStop(1, pastels[(i + 1) % pastels.length]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, i * zoneH, w, zoneH);
  }

  // Symmetrical dividing lines with varying weights
  ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w / 2, 0);
  ctx.lineTo(w / 2, h);
  ctx.stroke();

  // Horizontal dividers
  for (let i = 1; i < pastels.length; i++) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
    ctx.beginPath();
    ctx.moveTo(0, (i * zoneH) | 0);
    ctx.lineTo(w, (i * zoneH) | 0);
    ctx.stroke();
  }

  // Add subtle corner dots (symmetrical)
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  const dotSize = 6;
  const positions = [
    { x: dotSize * 2, y: dotSize * 2 },
    { x: w - dotSize * 2, y: dotSize * 2 },
    { x: dotSize * 2, y: h - dotSize * 2 },
    { x: w - dotSize * 2, y: h - dotSize * 2 },
  ];
  for (const pos of positions) {
    ctx.fillRect(pos.x - dotSize / 2, pos.y - dotSize / 2, dotSize, dotSize);
  }
}

/**
 * Generate dot-matrix grid pattern
 */
export function generateDotMatrix(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = "#f5f5f5";
  ctx.fillRect(0, 0, w, h);

  // Professional dot matrix grid
  ctx.fillStyle = "#000000";
  const spacing = 6;
  const dotRadius = 0.8;

  for (let y = spacing / 2; y < h; y += spacing) {
    for (let x = spacing / 2; x < w; x += spacing) {
      ctx.beginPath();
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Subtle border
  ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, w, h);
}
