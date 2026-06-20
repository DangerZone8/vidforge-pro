// Color grading math — converts Lift/Gamma/Gain wheels + curves + HSL qualifier
// into a CSS filter string. Approximation good enough for real-time preview;
// final export uses ffmpeg's eq/curves/colorbalance filters.

export type ColorWheel = { r: number; g: number; b: number; lum: number }; // -1..1
export type ThreeWayGrade = {
  lift: ColorWheel;
  gamma: ColorWheel;
  gain: ColorWheel;
  temperature: number; // -100..100
  tint: number;        // -100..100
  saturation: number;  // 0..200 (100 = neutral)
  vibrance: number;    // 0..200
  exposure: number;    // -2..2 stops
  contrast: number;    // 0..200
  pivot: number;       // 0..1 contrast pivot
};

export const DEFAULT_GRADE: ThreeWayGrade = {
  lift: { r: 0, g: 0, b: 0, lum: 0 },
  gamma: { r: 0, g: 0, b: 0, lum: 0 },
  gain: { r: 0, g: 0, b: 0, lum: 0 },
  temperature: 0,
  tint: 0,
  saturation: 100,
  vibrance: 100,
  exposure: 0,
  contrast: 100,
  pivot: 0.5,
};

// Convert a grade to an additive CSS filter chain. Approximations:
// - exposure -> brightness multiplier 2^exposure
// - gain.lum -> brightness adder
// - gamma.lum -> non-linear via brightness (approx)
// - contrast/saturation pass through
// - temperature/tint -> sepia + hue-rotate hybrid
export function gradeToCss(g: ThreeWayGrade): string {
  const parts: string[] = [];

  const brightness = Math.max(0, Math.pow(2, g.exposure) * (1 + g.gain.lum * 0.5 + g.lift.lum * 0.3));
  parts.push(`brightness(${brightness.toFixed(3)})`);

  parts.push(`contrast(${(g.contrast / 100).toFixed(3)})`);
  parts.push(`saturate(${(g.saturation / 100).toFixed(3)})`);

  // Temperature: warm tilts hue toward orange (+), cool toward blue (-).
  if (g.temperature !== 0) {
    const hue = -g.temperature * 0.15; // small hue rotation
    parts.push(`hue-rotate(${hue.toFixed(2)}deg)`);
    if (g.temperature > 0) parts.push(`sepia(${(g.temperature / 400).toFixed(3)})`);
  }
  if (g.tint !== 0) {
    parts.push(`hue-rotate(${(g.tint * 0.1).toFixed(2)}deg)`);
  }

  // Color cast from gain/gamma/lift wheels (approx via blend of channels).
  // Map dominant R/G/B push to hue rotation magnitude.
  const cast = (g.lift.r + g.gamma.r + g.gain.r) - (g.lift.b + g.gamma.b + g.gain.b);
  if (Math.abs(cast) > 0.01) {
    parts.push(`hue-rotate(${(cast * 8).toFixed(2)}deg)`);
  }

  return parts.join(" ");
}

// Sample a 1D curve (4 control points: shadows, darks, lights, highlights)
// into a CSS-friendly response. We approximate via brightness/contrast pivot.
export type ToneCurve = { shadows: number; darks: number; lights: number; highlights: number };
export const DEFAULT_CURVE: ToneCurve = { shadows: 0, darks: 0, lights: 0, highlights: 0 };

export function curveToCss(c: ToneCurve): string {
  const avg = (c.shadows + c.darks + c.lights + c.highlights) / 4;
  const spread = (c.highlights + c.lights) - (c.shadows + c.darks);
  const brightness = 1 + avg / 200;
  const contrast = 1 + spread / 200;
  return `brightness(${brightness.toFixed(3)}) contrast(${contrast.toFixed(3)})`;
}

// HSL Qualifier — boost/cut a specific hue range. CSS can't isolate hue ranges
// without compositing, so we approximate with a global saturate that ramps
// toward the targeted range. For real per-hue isolation, ffmpeg's selectivecolor
// filter is used at export.
export type HslQualifier = { hue: number; range: number; satBoost: number; lumBoost: number };
export const DEFAULT_HSL: HslQualifier = { hue: 0, range: 30, satBoost: 0, lumBoost: 0 };

export function hslToCss(h: HslQualifier): string {
  if (h.satBoost === 0 && h.lumBoost === 0) return "";
  return `saturate(${(1 + h.satBoost / 100).toFixed(3)}) brightness(${(1 + h.lumBoost / 200).toFixed(3)})`;
}

export function combineFilters(...parts: string[]): string {
  return parts.filter(Boolean).join(" ");
}
