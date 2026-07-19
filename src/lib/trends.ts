// Trend catalog — modern visual "looks" that combine a VFX preset,
// a background treatment, and (optionally) a color/gradient BG.
// Applied via existing per-clip fields: vfxPresetId + bgRemove + bgColor + bgMode.

export type Trend = {
  id: string;
  name: string;
  tagline: string;
  emoji: string;
  presetId: string;         // maps into VFX_PRESETS
  bgRemove: boolean;
  bgColor: string;          // when bgRemove active
  gradient: string;         // CSS gradient used in the gallery card
  accent: string;           // hex for badge
};

export const TRENDS: Trend[] = [
  {
    id: "nothing",
    name: "Nothing Style",
    tagline: "Dot-matrix mono, industrial minimal",
    emoji: "⚪",
    presetId: "color-noir",
    bgRemove: true,
    bgColor: "#0a0a0a",
    gradient: "linear-gradient(135deg,#0a0a0a 0%,#1a1a1a 100%)",
    accent: "#ffffff",
  },
  {
    id: "matrix",
    name: "The Matrix",
    tagline: "Green rain digital reality",
    emoji: "💚",
    presetId: "scifi-matrix",
    bgRemove: true,
    bgColor: "#000700",
    gradient: "linear-gradient(180deg,#001a00 0%,#000 100%)",
    accent: "#22c55e",
  },
  {
    id: "cyberpunk",
    name: "Cyberpunk",
    tagline: "Neon-soaked night city",
    emoji: "🌃",
    presetId: "scifi-cyberpunk",
    bgRemove: true,
    bgColor: "#1a0033",
    gradient: "linear-gradient(135deg,#ec4899 0%,#8b5cf6 50%,#06b6d4 100%)",
    accent: "#ec4899",
  },
  {
    id: "hologram",
    name: "Hologram",
    tagline: "Flickering cyan projection",
    emoji: "🛸",
    presetId: "scifi-hologram",
    bgRemove: true,
    bgColor: "#001a1a",
    gradient: "linear-gradient(135deg,#0891b2 0%,#22d3ee 100%)",
    accent: "#22d3ee",
  },
  {
    id: "tron",
    name: "Tron Grid",
    tagline: "Electric blue arena",
    emoji: "🟦",
    presetId: "scifi-tron",
    bgRemove: true,
    bgColor: "#000814",
    gradient: "linear-gradient(180deg,#000814 0%,#00238a 100%)",
    accent: "#22d3ee",
  },
  {
    id: "blockbuster",
    name: "Blockbuster",
    tagline: "Marvel-style teal & orange",
    emoji: "🍿",
    presetId: "cine-blockbuster",
    bgRemove: false,
    bgColor: "#0a0a14",
    gradient: "linear-gradient(135deg,#0f766e 0%,#f97316 100%)",
    accent: "#f97316",
  },
  {
    id: "dreamscape",
    name: "Dreamscape",
    tagline: "Soft ethereal glow",
    emoji: "💭",
    presetId: "cine-dream",
    bgRemove: true,
    bgColor: "#1a0f2e",
    gradient: "linear-gradient(135deg,#fbcfe8 0%,#c4b5fd 100%)",
    accent: "#fde68a",
  },
  {
    id: "inferno",
    name: "Inferno",
    tagline: "Raging fire glow",
    emoji: "🔥",
    presetId: "action-fire",
    bgRemove: true,
    bgColor: "#1a0500",
    gradient: "linear-gradient(180deg,#7f1d1d 0%,#f97316 100%)",
    accent: "#f97316",
  },
  {
    id: "thunderstorm",
    name: "Thunderstorm",
    tagline: "Lightning + rain drama",
    emoji: "⚡",
    presetId: "action-lightning",
    bgRemove: true,
    bgColor: "#020617",
    gradient: "linear-gradient(180deg,#020617 0%,#1e3a8a 100%)",
    accent: "#60a5fa",
  },
  {
    id: "portal",
    name: "Portal",
    tagline: "Energy swirl behind you",
    emoji: "🌀",
    presetId: "scifi-portal",
    bgRemove: true,
    bgColor: "#1a0033",
    gradient: "linear-gradient(135deg,#a855f7 0%,#ec4899 100%)",
    accent: "#a855f7",
  },
  {
    id: "vintage",
    name: "Vintage Film",
    tagline: "Faded 70's warmth",
    emoji: "📽️",
    presetId: "color-vintage",
    bgRemove: false,
    bgColor: "#1a1208",
    gradient: "linear-gradient(135deg,#78350f 0%,#fbbf24 100%)",
    accent: "#fbbf24",
  },
  {
    id: "magic",
    name: "Magic Sparkles",
    tagline: "Glowing enchanted dust",
    emoji: "✨",
    presetId: "fantasy-magic",
    bgRemove: true,
    bgColor: "#1a0f2e",
    gradient: "linear-gradient(135deg,#7c3aed 0%,#fde047 100%)",
    accent: "#fde047",
  },
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
