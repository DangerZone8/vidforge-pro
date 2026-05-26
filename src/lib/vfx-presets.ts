// Cinematic VFX preset library. Each preset applies a color grade plus an
// overlay (CSS/canvas effect) to a clip. Kept declarative so the AI assistant
// can pick a preset by id and override adjustments.

export type VfxOverlayKind =
  | "none"
  | "rain"
  | "snow"
  | "particles"
  | "embers"
  | "sparkles"
  | "lens-flare"
  | "fire-glow"
  | "neon-glow"
  | "lightning"
  | "vignette"
  | "film-burn"
  | "scanlines"
  | "glitch"
  | "smoke"
  | "explosion";

export type VfxCategory =
  | "color"
  | "vfx"
  | "cinematic"
  | "scifi"
  | "action"
  | "fantasy"
  | "transition";

export type ClipAdjustments = {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  hueRotate?: number; // degrees
  sepia?: number; // 0..1
  grayscale?: number; // 0..1
};

export type VfxPreset = {
  id: string;
  name: string;
  category: VfxCategory;
  emoji: string;
  description: string;
  adjustments: ClipAdjustments;
  overlay: VfxOverlayKind;
  overlayColor?: string;
  intensity?: number; // 0..1
};

export const DEFAULT_ADJ: ClipAdjustments = {
  brightness: 100, contrast: 100, saturation: 100, blur: 0,
  hueRotate: 0, sepia: 0, grayscale: 0,
};

export const VFX_PRESETS: VfxPreset[] = [
  // Color grades
  { id: "color-original", name: "Original", category: "color", emoji: "🎬", description: "Reset to original look",
    adjustments: { ...DEFAULT_ADJ }, overlay: "none" },
  { id: "color-cinematic", name: "Cinematic Teal", category: "color", emoji: "🎞️", description: "Hollywood teal & orange",
    adjustments: { brightness: 102, contrast: 118, saturation: 120, blur: 0, hueRotate: -8 }, overlay: "vignette", intensity: 0.6 },
  { id: "color-noir", name: "Film Noir", category: "color", emoji: "⚫", description: "High contrast black & white",
    adjustments: { brightness: 95, contrast: 150, saturation: 0, blur: 0 }, overlay: "vignette", intensity: 0.8 },
  { id: "color-vintage", name: "Vintage", category: "color", emoji: "📽️", description: "Faded vintage film",
    adjustments: { brightness: 100, contrast: 90, saturation: 70, blur: 0, sepia: 0.4 }, overlay: "film-burn", intensity: 0.4 },
  { id: "color-bleach", name: "Bleach Bypass", category: "color", emoji: "🥶", description: "Desaturated war-film look",
    adjustments: { brightness: 105, contrast: 135, saturation: 40, blur: 0 }, overlay: "vignette", intensity: 0.5 },

  // Cinematic
  { id: "cine-blockbuster", name: "Blockbuster", category: "cinematic", emoji: "🍿", description: "Big Marvel-style epic grade",
    adjustments: { brightness: 105, contrast: 120, saturation: 125, blur: 0, hueRotate: -6 }, overlay: "lens-flare", intensity: 0.6 },
  { id: "cine-dream", name: "Dreamscape", category: "cinematic", emoji: "💭", description: "Soft, ethereal dream",
    adjustments: { brightness: 112, contrast: 95, saturation: 110, blur: 1 }, overlay: "sparkles", overlayColor: "#fde68a", intensity: 0.7 },
  { id: "cine-thriller", name: "Thriller", category: "cinematic", emoji: "🕵️", description: "Cold, tense, desaturated",
    adjustments: { brightness: 90, contrast: 130, saturation: 60, blur: 0, hueRotate: 200 }, overlay: "vignette", intensity: 0.75 },
  { id: "cine-romance", name: "Romance", category: "cinematic", emoji: "💖", description: "Warm, glowing, soft",
    adjustments: { brightness: 110, contrast: 100, saturation: 115, blur: 0.5, sepia: 0.15 }, overlay: "sparkles", overlayColor: "#fbcfe8", intensity: 0.5 },

  // Sci-Fi
  { id: "scifi-cyberpunk", name: "Cyberpunk", category: "scifi", emoji: "🌃", description: "Neon-soaked night city",
    adjustments: { brightness: 95, contrast: 130, saturation: 160, blur: 0, hueRotate: 280 }, overlay: "neon-glow", overlayColor: "#ec4899", intensity: 0.8 },
  { id: "scifi-matrix", name: "The Matrix", category: "scifi", emoji: "💚", description: "Green-tinted digital reality",
    adjustments: { brightness: 90, contrast: 120, saturation: 80, blur: 0, hueRotate: 90 }, overlay: "scanlines", overlayColor: "#22c55e", intensity: 0.6 },
  { id: "scifi-tron", name: "Tron Grid", category: "scifi", emoji: "🟦", description: "Electric blue glow",
    adjustments: { brightness: 100, contrast: 125, saturation: 130, blur: 0, hueRotate: 180 }, overlay: "neon-glow", overlayColor: "#22d3ee", intensity: 0.7 },
  { id: "scifi-hologram", name: "Hologram", category: "scifi", emoji: "🛸", description: "Flickering hologram look",
    adjustments: { brightness: 110, contrast: 110, saturation: 140, blur: 0, hueRotate: 160 }, overlay: "glitch", overlayColor: "#22d3ee", intensity: 0.6 },
  { id: "scifi-portal", name: "Portal", category: "scifi", emoji: "🌀", description: "Energy portal swirl",
    adjustments: { brightness: 105, contrast: 115, saturation: 140, blur: 0, hueRotate: 260 }, overlay: "particles", overlayColor: "#a855f7", intensity: 0.8 },

  // Action
  { id: "action-explosion", name: "Explosion", category: "action", emoji: "💥", description: "Fire, smoke and shake",
    adjustments: { brightness: 115, contrast: 130, saturation: 130, blur: 0 }, overlay: "explosion", overlayColor: "#f97316", intensity: 0.9 },
  { id: "action-fire", name: "Inferno", category: "action", emoji: "🔥", description: "Raging fire glow",
    adjustments: { brightness: 105, contrast: 120, saturation: 135, blur: 0, hueRotate: -10 }, overlay: "fire-glow", overlayColor: "#f97316", intensity: 0.85 },
  { id: "action-smoke", name: "Smoke", category: "action", emoji: "💨", description: "Drifting smoke veil",
    adjustments: { brightness: 95, contrast: 105, saturation: 80, blur: 1 }, overlay: "smoke", intensity: 0.7 },
  { id: "action-lightning", name: "Thunderstorm", category: "action", emoji: "⚡", description: "Lightning flashes + rain",
    adjustments: { brightness: 85, contrast: 140, saturation: 70, blur: 0, hueRotate: 210 }, overlay: "lightning", intensity: 0.9 },
  { id: "action-rain", name: "Rainstorm", category: "action", emoji: "🌧️", description: "Heavy cinematic rain",
    adjustments: { brightness: 88, contrast: 115, saturation: 85, blur: 0, hueRotate: 200 }, overlay: "rain", intensity: 0.8 },

  // Fantasy
  { id: "fantasy-magic", name: "Magic Sparkles", category: "fantasy", emoji: "✨", description: "Glowing magic dust",
    adjustments: { brightness: 110, contrast: 105, saturation: 130, blur: 0 }, overlay: "sparkles", overlayColor: "#fde047", intensity: 0.85 },
  { id: "fantasy-embers", name: "Floating Embers", category: "fantasy", emoji: "🔥", description: "Rising fire embers",
    adjustments: { brightness: 100, contrast: 115, saturation: 125, blur: 0 }, overlay: "embers", overlayColor: "#f97316", intensity: 0.8 },
  { id: "fantasy-snow", name: "Snowfall", category: "fantasy", emoji: "❄️", description: "Gentle snow particles",
    adjustments: { brightness: 105, contrast: 105, saturation: 90, blur: 0, hueRotate: 200 }, overlay: "snow", intensity: 0.7 },
  { id: "fantasy-stars", name: "Stardust", category: "fantasy", emoji: "🌟", description: "Twinkling cosmic particles",
    adjustments: { brightness: 100, contrast: 115, saturation: 120, blur: 0, hueRotate: 240 }, overlay: "particles", overlayColor: "#c4b5fd", intensity: 0.75 },

  // VFX overlays (focused on the overlay, mild grade)
  { id: "vfx-lens-flare", name: "Lens Flare", category: "vfx", emoji: "🌟", description: "Anamorphic lens flare",
    adjustments: { ...DEFAULT_ADJ, contrast: 105 }, overlay: "lens-flare", overlayColor: "#fbbf24", intensity: 0.7 },
  { id: "vfx-vignette", name: "Vignette", category: "vfx", emoji: "⚫", description: "Dark edges vignette",
    adjustments: { ...DEFAULT_ADJ }, overlay: "vignette", intensity: 0.8 },
  { id: "vfx-scanlines", name: "CRT Scanlines", category: "vfx", emoji: "📺", description: "Retro CRT scanlines",
    adjustments: { ...DEFAULT_ADJ, contrast: 110 }, overlay: "scanlines", intensity: 0.5 },
  { id: "vfx-glitch", name: "Glitch", category: "vfx", emoji: "📡", description: "Digital glitch artifacts",
    adjustments: { ...DEFAULT_ADJ, contrast: 115 }, overlay: "glitch", intensity: 0.6 },
  { id: "vfx-film-burn", name: "Film Burn", category: "vfx", emoji: "🎞️", description: "Burnt film flicker",
    adjustments: { ...DEFAULT_ADJ, contrast: 105 }, overlay: "film-burn", intensity: 0.7 },
];

export function getPreset(id: string | null | undefined): VfxPreset | null {
  if (!id) return null;
  return VFX_PRESETS.find((p) => p.id === id) ?? null;
}

export function adjustmentsToCss(a: ClipAdjustments): string {
  const parts = [
    `brightness(${a.brightness}%)`,
    `contrast(${a.contrast}%)`,
    `saturate(${a.saturation}%)`,
  ];
  if (a.blur) parts.push(`blur(${a.blur}px)`);
  if (a.hueRotate) parts.push(`hue-rotate(${a.hueRotate}deg)`);
  if (a.sepia) parts.push(`sepia(${a.sepia})`);
  if (a.grayscale) parts.push(`grayscale(${a.grayscale})`);
  return parts.join(" ");
}
