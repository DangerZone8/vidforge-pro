import { useEffect, useRef, useState } from "react";
import { getSegmenter, getFaceDetector } from "@/lib/mediapipe";
import { cssFilterForFilter, drawLensOverlay, isLensFilter } from "@/lib/face-filters";

export type PreviewSettings = {
  src: string | null;
  localTime: number; // seconds within the clip
  playing: boolean;
  // CSS adjustment string (brightness/contrast/saturation/blur)
  adjustmentFilter: string;
  // Per-clip AI effects
  bgRemove: boolean;
  bgMode: "color" | "image";
  bgColor: string;
  bgImageUrl: string | null;
  faceFilter: string | null;
  // Lifecycle
  onEnded?: () => void;
};

// Canvas-based preview. Falls back to plain <video> when no AI effects active.
export function PreviewCanvas({
  src,
  localTime,
  playing,
  adjustmentFilter,
  bgRemove,
  bgMode,
  bgColor,
  bgImageUrl,
  faceFilter,
  onEnded,
}: PreviewSettings) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const rafRef = useRef<number>(0);
  const lastSegTsRef = useRef(0);
  const [loadingAi, setLoadingAi] = useState(false);

  const usesCanvas = bgRemove || isLensFilter(faceFilter);

  // Load bg image when provided
  useEffect(() => {
    if (bgMode === "image" && bgImageUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = bgImageUrl;
      img.onload = () => { bgImgRef.current = img; };
    } else {
      bgImgRef.current = null;
    }
  }, [bgMode, bgImageUrl]);

  // Sync src
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src) return;
    if (v.src !== src) v.src = src;
  }, [src]);

  // Sync time
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (Math.abs(v.currentTime - localTime) > 0.3) v.currentTime = localTime;
  }, [localTime]);

  // Play/pause
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) v.play().catch(() => {});
    else v.pause();
  }, [playing, src]);

  // Warm up models when AI effects enabled
  useEffect(() => {
    if (!usesCanvas) return;
    let cancelled = false;
    setLoadingAi(true);
    (async () => {
      try {
        if (bgRemove) await getSegmenter();
        if (isLensFilter(faceFilter)) await getFaceDetector();
      } finally {
        if (!cancelled) setLoadingAi(false);
      }
    })();
    return () => { cancelled = true; };
  }, [usesCanvas, bgRemove, faceFilter]);

  // Render loop for canvas mode
  useEffect(() => {
    if (!usesCanvas) return;
    const v = videoRef.current;
    const canvas = canvasRef.current;
    if (!v || !canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      if (v.readyState >= 2 && v.videoWidth > 0) {
        if (canvas.width !== v.videoWidth) canvas.width = v.videoWidth;
        if (canvas.height !== v.videoHeight) canvas.height = v.videoHeight;

        const w = canvas.width;
        const h = canvas.height;

        // 1) Background fill (when bg removal is on)
        if (bgRemove) {
          ctx.save();
          ctx.filter = "none";
          if (bgMode === "image" && bgImgRef.current) {
            ctx.drawImage(bgImgRef.current, 0, 0, w, h);
          } else {
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, w, h);
          }
          ctx.restore();
        } else {
          ctx.clearRect(0, 0, w, h);
        }

        // 2) Draw video (optionally masked) with adjustment + filter CSS
        const cssFilter = [adjustmentFilter, cssFilterForFilter(faceFilter)].filter(Boolean).join(" ");

        if (bgRemove) {
          try {
            const seg = await getSegmenter();
            const ts = performance.now();
            const tsInt = Math.max(Math.floor(ts), lastSegTsRef.current + 1);
            lastSegTsRef.current = tsInt;
            const result = seg.segmentForVideo(v, tsInt);
            const mask = result.categoryMask;
            if (mask) {
              // Composite: draw video to offscreen, apply mask alpha, draw onto canvas.
              const off = document.createElement("canvas");
              off.width = w;
              off.height = h;
              const offCtx = off.getContext("2d")!;
              offCtx.filter = cssFilter || "none";
              offCtx.drawImage(v, 0, 0, w, h);
              offCtx.filter = "none";
              const frame = offCtx.getImageData(0, 0, w, h);
              const maskData = mask.getAsUint8Array();
              // selfie_segmenter: 0 = person (foreground), 255 = background
              for (let i = 0; i < maskData.length; i++) {
                if (maskData[i] !== 0) frame.data[i * 4 + 3] = 0;
              }
              offCtx.putImageData(frame, 0, 0);
              ctx.drawImage(off, 0, 0);
              mask.close();
            } else {
              ctx.filter = cssFilter || "none";
              ctx.drawImage(v, 0, 0, w, h);
              ctx.filter = "none";
            }
          } catch {
            ctx.filter = cssFilter || "none";
            ctx.drawImage(v, 0, 0, w, h);
            ctx.filter = "none";
          }
        } else {
          ctx.filter = cssFilter || "none";
          ctx.drawImage(v, 0, 0, w, h);
          ctx.filter = "none";
        }

        // 3) Face filter overlays (emoji on landmarks)
        if (isLensFilter(faceFilter)) {
          try {
            const det = await getFaceDetector();
            const tsInt = Math.max(Math.floor(performance.now()), lastSegTsRef.current + 1);
            lastSegTsRef.current = tsInt;
            const res = det.detectForVideo(v, tsInt);
            for (const d of res.detections) {
              const bb = d.boundingBox!;
              const box = { x: bb.originX, y: bb.originY, w: bb.width, h: bb.height };
              const kps = (d.keypoints ?? []).map((k) => ({ x: k.x * w, y: k.y * h }));
              drawLensOverlay(ctx, faceFilter!, box, kps);
            }
          } catch {}
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [usesCanvas, bgRemove, bgMode, bgColor, faceFilter, adjustmentFilter]);

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        crossOrigin="anonymous"
        muted={usesCanvas}
        playsInline
        onEnded={onEnded}
        className={usesCanvas ? "absolute opacity-0 pointer-events-none w-1 h-1" : "w-full h-full object-contain"}
        style={!usesCanvas ? { filter: [adjustmentFilter, cssFilterForFilter(faceFilter)].filter(Boolean).join(" ") } : undefined}
      />
      {usesCanvas && (
        <canvas ref={canvasRef} className="w-full h-full object-contain" />
      )}
      {loadingAi && (
        <div className="absolute top-3 left-3 text-[10px] px-2 py-1 rounded bg-black/60 backdrop-blur text-white/80">
          Loading AI…
        </div>
      )}
    </div>
  );
}
