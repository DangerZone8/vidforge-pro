// Registry of AR face filters. Each filter receives a 2D context + face keypoints
// (normalized 0..1) and the destination box. Beauty/color filters operate on the
// frame; lens filters draw emoji/glyphs anchored to face landmarks.

export type FilterCategory = "face" | "beauty" | "lenses" | "overlays";

export type FaceFilterDef = {
  id: string;
  name: string;
  emoji: string;
  category: FilterCategory;
};

export const FACE_FILTERS: FaceFilterDef[] = [
  { id: "none", name: "None", emoji: "🚫", category: "face" },
  // Beauty
  { id: "beauty-smooth", name: "Smooth Skin", emoji: "✨", category: "beauty" },
  { id: "beauty-glow", name: "Glow", emoji: "🌟", category: "beauty" },
  { id: "beauty-warm", name: "Warm", emoji: "🌅", category: "beauty" },
  // Lenses (anchored to face)
  { id: "lens-glasses", name: "Sunglasses", emoji: "🕶️", category: "lenses" },
  { id: "lens-hat", name: "Party Hat", emoji: "🎩", category: "lenses" },
  { id: "lens-ears", name: "Cat Ears", emoji: "🐱", category: "lenses" },
  { id: "lens-dog", name: "Dog Face", emoji: "🐶", category: "lenses" },
  { id: "lens-crown", name: "Crown", emoji: "👑", category: "lenses" },
  { id: "lens-mustache", name: "Mustache", emoji: "👨", category: "lenses" },
  { id: "lens-heart", name: "Heart Eyes", emoji: "😍", category: "lenses" },
  // Color overlays
  { id: "color-noir", name: "Noir", emoji: "⚫", category: "overlays" },
  { id: "color-sepia", name: "Sepia", emoji: "🟫", category: "overlays" },
  { id: "color-vivid", name: "Vivid", emoji: "🎨", category: "overlays" },
  { id: "color-cool", name: "Cool", emoji: "❄️", category: "overlays" },
];

// CSS filter string for color/beauty filters that can be applied to the whole canvas.
export function cssFilterForFilter(id: string | null | undefined): string {
  switch (id) {
    case "beauty-smooth": return "blur(0.5px) brightness(1.05) contrast(0.98) saturate(1.05)";
    case "beauty-glow": return "brightness(1.15) saturate(1.1) contrast(0.95)";
    case "beauty-warm": return "sepia(0.2) saturate(1.2) hue-rotate(-10deg) brightness(1.05)";
    case "color-noir": return "grayscale(1) contrast(1.4)";
    case "color-sepia": return "sepia(0.9) contrast(1.05)";
    case "color-vivid": return "saturate(1.6) contrast(1.15)";
    case "color-cool": return "hue-rotate(180deg) saturate(1.2)";
    default: return "";
  }
}

// Draw lens-style overlays at face keypoint positions.
// keypoints are MediaPipe order: rightEye, leftEye, noseTip, mouth, rightEarTragion, leftEarTragion.
type Box = { x: number; y: number; w: number; h: number };
type KP = { x: number; y: number };

export function drawLensOverlay(
  ctx: CanvasRenderingContext2D,
  filterId: string,
  box: Box,
  keypoints: KP[],
) {
  if (!keypoints || keypoints.length < 4) return;
  const rightEye = keypoints[0];
  const leftEye = keypoints[1];
  const nose = keypoints[2];
  const mouth = keypoints[3];
  const faceW = box.w;
  const cx = box.x + box.w / 2;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  switch (filterId) {
    case "lens-glasses": {
      const size = faceW * 0.95;
      const eyeY = (leftEye.y + rightEye.y) / 2;
      const eyeX = (leftEye.x + rightEye.x) / 2;
      ctx.font = `${size}px serif`;
      ctx.fillText("🕶️", eyeX, eyeY);
      break;
    }
    case "lens-hat": {
      const size = faceW * 1.1;
      ctx.font = `${size}px serif`;
      ctx.fillText("🎩", cx, box.y - faceW * 0.15);
      break;
    }
    case "lens-ears": {
      const size = faceW * 0.55;
      ctx.font = `${size}px serif`;
      ctx.fillText("🐱", cx, box.y - faceW * 0.05);
      break;
    }
    case "lens-dog": {
      const size = faceW * 0.6;
      ctx.font = `${size}px serif`;
      ctx.fillText("🐶", cx, box.y - faceW * 0.05);
      // Tongue
      ctx.font = `${faceW * 0.3}px serif`;
      ctx.fillText("👅", mouth.x, mouth.y + faceW * 0.1);
      break;
    }
    case "lens-crown": {
      const size = faceW * 1.0;
      ctx.font = `${size}px serif`;
      ctx.fillText("👑", cx, box.y - faceW * 0.1);
      break;
    }
    case "lens-mustache": {
      const size = faceW * 0.5;
      ctx.font = `${size}px serif`;
      const mY = (nose.y + mouth.y) / 2;
      ctx.fillText("〰️", nose.x, mY);
      break;
    }
    case "lens-heart": {
      const size = faceW * 0.3;
      ctx.font = `${size}px serif`;
      ctx.fillText("❤️", rightEye.x, rightEye.y);
      ctx.fillText("❤️", leftEye.x, leftEye.y);
      break;
    }
  }
  ctx.restore();
}

export function isLensFilter(id: string | null | undefined) {
  return !!id && id.startsWith("lens-");
}
