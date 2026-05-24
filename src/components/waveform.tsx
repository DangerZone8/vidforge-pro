import { useEffect, useRef } from "react";
import { getPeaks } from "@/lib/audio-utils";

export function Waveform({
  url,
  width,
  height,
  color = "#a78bfa",
}: { url: string; width: number; height: number; color?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    c.width = Math.max(1, Math.floor(width));
    c.height = Math.max(1, Math.floor(height));

    // Placeholder bars while loading
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = color + "44";
    for (let x = 0; x < c.width; x += 3) {
      const h = (Math.sin(x * 0.3) * 0.3 + 0.5) * c.height * 0.4;
      ctx.fillRect(x, (c.height - h) / 2, 2, h);
    }

    getPeaks(url, c.width).then((peaks) => {
      if (cancelled || !canvasRef.current) return;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.fillStyle = color;
      const mid = c.height / 2;
      for (let x = 0; x < peaks.length; x++) {
        const amp = peaks[x] * (c.height * 0.9);
        ctx.fillRect(x, mid - amp / 2, 1, Math.max(1, amp));
      }
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [url, width, height, color]);

  return <canvas ref={canvasRef} style={{ width, height }} className="block" />;
}
