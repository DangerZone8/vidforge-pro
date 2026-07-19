// Trend catalog — modern visual "looks" that combine a VFX preset,
// a background treatment, and (optionally) a color/gradient BG.
// Applied via existing per-clip fields: vfxPresetId + bgRemove + bgColor + bgMode.

export type TrendCategory = "general" | "format";

export type Trend = {
  id: string;
  name: string;
  tagline: string;
  emoji: string;
  category: TrendCategory;
  presetId: string;         // maps into VFX_PRESETS
  bgRemove: boolean;
  bgColor: string;          // when bgRemove active
  gradient: string;         // CSS gradient used in the gallery card
  accent: string;           // hex for badge
};

export const TRENDS: Trend[] = [
  // ────────── General Trends ──────────
  {
    id: "nothing", name: "Nothing Style", tagline: "Dot-matrix mono, industrial minimal",
    emoji: "⚪", category: "general", presetId: "color-noir", bgRemove: true,
    bgColor: "#0a0a0a", gradient: "linear-gradient(135deg,#0a0a0a 0%,#1a1a1a 100%)", accent: "#ffffff",
  },
  {
    id: "kumar", name: "Kumar Method", tagline: "Warm cinematic close-ups, shallow depth",
    emoji: "🎥", category: "general", presetId: "cine-blockbuster", bgRemove: false,
    bgColor: "#100a05", gradient: "linear-gradient(135deg,#78350f 0%,#dc2626 100%)", accent: "#f97316",
  },
  {
    id: "matrix", name: "Matrix", tagline: "Green rain digital reality",
    emoji: "💚", category: "general", presetId: "scifi-matrix", bgRemove: true,
    bgColor: "#000700", gradient: "linear-gradient(180deg,#001a00 0%,#000 100%)", accent: "#22c55e",
  },
  {
    id: "cyberpunk", name: "Cyberpunk", tagline: "Neon-soaked night city",
    emoji: "🌃", category: "general", presetId: "scifi-cyberpunk", bgRemove: true,
    bgColor: "#1a0033", gradient: "linear-gradient(135deg,#ec4899 0%,#8b5cf6 50%,#06b6d4 100%)", accent: "#ec4899",
  },
  {
    id: "hologram", name: "Hologram", tagline: "Flickering cyan projection",
    emoji: "🛸", category: "general", presetId: "scifi-hologram", bgRemove: true,
    bgColor: "#001a1a", gradient: "linear-gradient(135deg,#0891b2 0%,#22d3ee 100%)", accent: "#22d3ee",
  },
  {
    id: "tron", name: "Tron Grid", tagline: "Electric blue arena",
    emoji: "🟦", category: "general", presetId: "scifi-tron", bgRemove: true,
    bgColor: "#000814", gradient: "linear-gradient(180deg,#000814 0%,#00238a 100%)", accent: "#22d3ee",
  },
  {
    id: "cinematic", name: "Cinematic", tagline: "Hollywood teal & orange grade",
    emoji: "🎬", category: "general", presetId: "color-cinematic", bgRemove: false,
    bgColor: "#0a0f14", gradient: "linear-gradient(135deg,#0f766e 0%,#f97316 100%)", accent: "#f97316",
  },
  {
    id: "vintage", name: "Vintage Film", tagline: "Faded 70's warmth & grain",
    emoji: "📽️", category: "general", presetId: "color-vintage", bgRemove: false,
    bgColor: "#1a1208", gradient: "linear-gradient(135deg,#78350f 0%,#fbbf24 100%)", accent: "#fbbf24",
  },
  {
    id: "soft-aesthetic", name: "Soft Aesthetic", tagline: "Pastel dreamy glow",
    emoji: "🌸", category: "general", presetId: "cine-dream", bgRemove: true,
    bgColor: "#fce7f3", gradient: "linear-gradient(135deg,#fbcfe8 0%,#c4b5fd 100%)", accent: "#f9a8d4",
  },
  {
    id: "dark-moody", name: "Dark Moody", tagline: "Deep shadows, low-key tension",
    emoji: "🌑", category: "general", presetId: "cine-thriller", bgRemove: false,
    bgColor: "#050505", gradient: "linear-gradient(180deg,#0a0a0a 0%,#1e293b 100%)", accent: "#64748b",
  },
  {
    id: "neon-glow", name: "Neon Glow", tagline: "Radiant hot-pink glow",
    emoji: "💗", category: "general", presetId: "vfx-lens-flare", bgRemove: true,
    bgColor: "#160013", gradient: "linear-gradient(135deg,#ec4899 0%,#f43f5e 100%)", accent: "#ec4899",
  },
  {
    id: "clean-minimal", name: "Clean Minimal", tagline: "Bright, crisp, editorial white",
    emoji: "◻️", category: "general", presetId: "color-original", bgRemove: true,
    bgColor: "#f5f5f5", gradient: "linear-gradient(135deg,#ffffff 0%,#e5e5e5 100%)", accent: "#111111",
  },
  {
    id: "street-style", name: "Street Style", tagline: "Punchy urban documentary",
    emoji: "🏙️", category: "general", presetId: "color-bleach", bgRemove: false,
    bgColor: "#111", gradient: "linear-gradient(135deg,#374151 0%,#f59e0b 100%)", accent: "#f59e0b",
  },
  {
    id: "dreamy", name: "Dreamy", tagline: "Hazy soft-focus reverie",
    emoji: "💭", category: "general", presetId: "cine-dream", bgRemove: true,
    bgColor: "#1a0f2e", gradient: "linear-gradient(135deg,#a5b4fc 0%,#fbcfe8 100%)", accent: "#fde68a",
  },
  {
    id: "retro-90s", name: "Retro 90s", tagline: "VHS chroma & scanlines",
    emoji: "📼", category: "general", presetId: "vfx-scanlines", bgRemove: false,
    bgColor: "#120014", gradient: "linear-gradient(135deg,#f472b6 0%,#22d3ee 100%)", accent: "#f472b6",
  },
  {
    id: "futuristic", name: "Futuristic", tagline: "Chrome, glass, cool blue",
    emoji: "🤖", category: "general", presetId: "scifi-tron", bgRemove: true,
    bgColor: "#020617", gradient: "linear-gradient(135deg,#1e40af 0%,#a5f3fc 100%)", accent: "#38bdf8",
  },
  {
    id: "natural-light", name: "Natural Light", tagline: "Warm daylight, soft skin",
    emoji: "☀️", category: "general", presetId: "cine-romance", bgRemove: false,
    bgColor: "#fef3c7", gradient: "linear-gradient(135deg,#fed7aa 0%,#fde68a 100%)", accent: "#f59e0b",
  },
  {
    id: "high-contrast", name: "High Contrast", tagline: "Crushed blacks, bright highlights",
    emoji: "◐", category: "general", presetId: "color-noir", bgRemove: false,
    bgColor: "#000", gradient: "linear-gradient(135deg,#000 0%,#fff 100%)", accent: "#ffffff",
  },
  {
    id: "soft-blur", name: "Soft Blur", tagline: "Bokeh-heavy shallow focus",
    emoji: "🫧", category: "general", presetId: "cine-dream", bgRemove: false,
    bgColor: "#1e1b4b", gradient: "linear-gradient(135deg,#e0e7ff 0%,#c7d2fe 100%)", accent: "#a5b4fc",
  },
  {
    id: "glitch", name: "Glitch", tagline: "Corrupted digital artifacts",
    emoji: "📡", category: "general", presetId: "vfx-glitch", bgRemove: false,
    bgColor: "#0a0014", gradient: "linear-gradient(135deg,#ef4444 0%,#22d3ee 100%)", accent: "#ef4444",
  },

  // ────────── Specific Format Trends ──────────
  {
    id: "wes-anderson", name: "Wes Anderson Blueprint",
    tagline: "Symmetrical framing, pastel palette, deadpan whip-pans",
    emoji: "🎞️", category: "format", presetId: "color-vintage", bgRemove: false,
    bgColor: "#fef3c7", gradient: "linear-gradient(135deg,#fca5a5 0%,#fde68a 50%,#a7f3d0 100%)", accent: "#fbbf24",
  },
  {
    id: "neo-noir-walk", name: "Neo-Noir Main Character Walk",
    tagline: "Rainy neon night, slow stylish walk, synth-wave mood",
    emoji: "🌧️", category: "format", presetId: "action-rain", bgRemove: true,
    bgColor: "#0a0014", gradient: "linear-gradient(180deg,#1e1b4b 0%,#ec4899 100%)", accent: "#ec4899",
  },
  {
    id: "yes-but-split", name: "Yes But Split Screen",
    tagline: "Top: elegant aura. Bottom: chaotic funny version",
    emoji: "⚡", category: "format", presetId: "cine-blockbuster", bgRemove: false,
    bgColor: "#111", gradient: "linear-gradient(180deg,#0f766e 0%,#f97316 100%)", accent: "#facc15",
  },
  {
    id: "slowmo-lineup", name: "Slow-Mo Crew Lineup",
    tagline: "Low-angle group walk, dramatic final pose",
    emoji: "🕶️", category: "format", presetId: "cine-thriller", bgRemove: false,
    bgColor: "#0a0a0a", gradient: "linear-gradient(135deg,#111827 0%,#f97316 100%)", accent: "#f97316",
  },
  {
    id: "unpopular-opinion", name: "Unpopular Opinion Fake-Out",
    tagline: "Intense close-up, bold text, dramatic lighting",
    emoji: "🎤", category: "format", presetId: "cine-thriller", bgRemove: false,
    bgColor: "#0a0a0a", gradient: "linear-gradient(135deg,#7f1d1d 0%,#000 100%)", accent: "#ef4444",
  },
  {
    id: "micro-drama", name: "Micro-Drama Cliffhanger",
    tagline: "Cinematic tension, starts mid-scene, high stakes",
    emoji: "🎭", category: "format", presetId: "cine-blockbuster", bgRemove: false,
    bgColor: "#0a0f14", gradient: "linear-gradient(135deg,#0f172a 0%,#7c2d12 100%)", accent: "#f97316",
  },
  {
    id: "of-course-stereotype", name: "Of Course We Stereotype Loop",
    tagline: "Clean pacing, comedic timing, clear text overlays",
    emoji: "😏", category: "format", presetId: "color-original", bgRemove: true,
    bgColor: "#fef9c3", gradient: "linear-gradient(135deg,#fde68a 0%,#fca5a5 100%)", accent: "#f59e0b",
  },
];

export const TREND_CATEGORIES: { id: TrendCategory; label: string; description: string }[] = [
  { id: "general", label: "General Trends", description: "Signature looks & aesthetics" },
  { id: "format", label: "Specific Format Trends", description: "Structured shot recipes" },
];

export function getTrend(id: string | null | undefined): Trend | null {
  if (!id) return null;
  return TRENDS.find((t) => t.id === id) ?? null;
}

const KEY = "creatorcut.pendingTrend";
export type PendingTrend = { trendId: string; intensity: number };

export function setPendingTrend(t: PendingTrend | null) {
  if (typeof window === "undefined") return;
  if (!t) sessionStorage.removeItem(KEY);
  else sessionStorage.setItem(KEY, JSON.stringify(t));
}

export function consumePendingTrend(): PendingTrend | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  sessionStorage.removeItem(KEY);
  try { return JSON.parse(raw) as PendingTrend; } catch { return null; }
}
