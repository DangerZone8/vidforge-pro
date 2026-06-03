import { useEffect, useRef, useState } from "react";

// Paint-mask brush blur. The user paints a mask over the preview; the
// component composites a blurred copy of the underlying preview only inside
// the painted pixels. The video itself is unaffected outside the mask.
//
// The mask is stored as a base64 PNG so it persists with the clip and
// survives reloads. Painting is mouse + touch friendly.

export type BrushBlurState = {
  enabled: boolean;
  radius: number; // brush radius in CSS px
  strength: number; // blur strength in CSS px (0..40)
  mask: string | null; // base64 dataURL of the alpha mask
};

export const DEFAULT_BRUSH_BLUR: BrushBlurState = {
  enabled: false,
  radius: 40,
  strength: 18,
  mask: null,
};

export function BrushBlurOverlay({
  state,
  editing,
  sourceRef,
  onMaskChange,
}: {
  state: BrushBlurState;
  editing: boolean;
  // The element to sample (the preview video). We draw it into the canvas,
  // blur via ctx.filter, then alpha-mask using the painted mask.
  sourceRef: React.RefObject<HTMLVideoElement | HTMLCanvasElement | HTMLImageElement | null>;
  onMaskChange: (mask: string | null) => void;
}) {
  const maskRef = useRef<HTMLCanvasElement>(null);
  const blurRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const drawingRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);
  const [erase, setErase] = useState(false);

  // Init mask canvas size on mount + load saved mask
  useEffect(() => {
    const mask = maskRef.current;
    if (!mask) return;
    const rect = mask.getBoundingClientRect();
    mask.width = Math.max(1, Math.floor(rect.width));
    mask.height = Math.max(1, Math.floor(rect.height));
    const ctx = mask.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, mask.width, mask.height);
    if (state.mask) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, mask.width, mask.height);
      img.src = state.mask;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resize observer keeps both canvases at preview size
  useEffect(() => {
    const mask = maskRef.current;
    const blur = blurRef.current;
    if (!mask || !blur) return;
    const ro = new ResizeObserver(() => {
      const r = mask.getBoundingClientRect();
      const w = Math.max(1, Math.floor(r.width));
      const h = Math.max(1, Math.floor(r.height));
      // Preserve current mask while resizing
      const snap = document.createElement("canvas");
      snap.width = mask.width;
      snap.height = mask.height;
      snap.getContext("2d")?.drawImage(mask, 0, 0);
      mask.width = w;
      mask.height = h;
      blur.width = w;
      blur.height = h;
      const mctx = mask.getContext("2d");
      if (mctx && snap.width && snap.height) mctx.drawImage(snap, 0, 0, w, h);
    });
    ro.observe(mask);
    return () => ro.disconnect();
  }, []);

  // Composite loop — draws blurred source, masked by the painted mask
  useEffect(() => {
    if (!state.enabled) return;
    const blur = blurRef.current;
    const mask = maskRef.current;
    if (!blur || !mask) return;
    const ctx = blur.getContext("2d");
    if (!ctx) return;

    const tick = () => {
      const src = sourceRef.current;
      const w = blur.width;
      const h = blur.height;
      ctx.clearRect(0, 0, w, h);
      if (src && (src as HTMLVideoElement).readyState !== undefined ? (src as HTMLVideoElement).readyState >= 2 : true) {
        try {
          ctx.save();
          ctx.filter = `blur(${state.strength}px) saturate(110%)`;
          ctx.drawImage(src as CanvasImageSource, 0, 0, w, h);
          ctx.filter = "none";
          // Use the painted mask as the alpha channel for the blurred layer
          ctx.globalCompositeOperation = "destination-in";
          ctx.drawImage(mask, 0, 0, w, h);
          ctx.restore();
        } catch {
          // ignore (CORS / not ready)
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [state.enabled, state.strength, sourceRef]);

  function paintAt(x: number, y: number) {
    const mask = maskRef.current;
    if (!mask) return;
    const ctx = mask.getContext("2d");
    if (!ctx) return;
    ctx.globalCompositeOperation = erase ? "destination-out" : "source-over";
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    const last = lastPtRef.current;
    if (last) {
      // interpolate between points for a smooth stroke
      const dx = x - last.x;
      const dy = y - last.y;
      const dist = Math.hypot(dx, dy);
      const steps = Math.max(1, Math.floor(dist / (state.radius * 0.35)));
      for (let i = 1; i <= steps; i++) {
        const ix = last.x + (dx * i) / steps;
        const iy = last.y + (dy * i) / steps;
        ctx.beginPath();
        ctx.arc(ix, iy, state.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.beginPath();
      ctx.arc(x, y, state.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    lastPtRef.current = { x, y };
  }

  function ptFromEvent(e: React.PointerEvent) {
    const mask = maskRef.current!;
    const r = mask.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * mask.width, y: ((e.clientY - r.top) / r.height) * mask.height };
  }

  function commit() {
    const mask = maskRef.current;
    if (!mask) return;
    try {
      onMaskChange(mask.toDataURL("image/png"));
    } catch {
      // ignore
    }
  }

  function clearMask() {
    const mask = maskRef.current;
    if (!mask) return;
    mask.getContext("2d")?.clearRect(0, 0, mask.width, mask.height);
    onMaskChange(null);
  }

  if (!state.enabled) return null;

  return (
    <>
      {/* Blurred composite layer (under any toolbar) */}
      <canvas ref={blurRef} className="absolute inset-0 w-full h-full pointer-events-none z-20" />
      {/* The mask canvas — receives paint events when editing */}
      <canvas
        ref={maskRef}
        className={"absolute inset-0 w-full h-full z-30 " + (editing ? "cursor-crosshair" : "pointer-events-none")}
        style={editing ? { background: "rgba(255,255,255,0.04)" } : undefined}
        onPointerDown={(e) => {
          if (!editing) return;
          (e.target as Element).setPointerCapture(e.pointerId);
          drawingRef.current = true;
          lastPtRef.current = null;
          const p = ptFromEvent(e);
          paintAt(p.x, p.y);
        }}
        onPointerMove={(e) => {
          if (!editing || !drawingRef.current) return;
          const p = ptFromEvent(e);
          paintAt(p.x, p.y);
        }}
        onPointerUp={() => {
          if (!editing) return;
          drawingRef.current = false;
          lastPtRef.current = null;
          commit();
        }}
      />
      {editing && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur border border-white/10 text-[11px]">
          <span className="text-white/70">Brush blur</span>
          <button
            onClick={() => setErase((v) => !v)}
            className={"px-2 py-0.5 rounded " + (erase ? "bg-orange-500 text-white" : "bg-white/10 text-white/80")}
          >
            {erase ? "Erasing" : "Painting"}
          </button>
          <button onClick={clearMask} className="px-2 py-0.5 rounded bg-white/10 text-white/80 hover:bg-white/20">
            Clear
          </button>
        </div>
      )}
    </>
  );
}
