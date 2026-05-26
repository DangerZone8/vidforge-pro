import { useEffect, useRef } from "react";
import type { VfxOverlayKind } from "@/lib/vfx-presets";

// Canvas-based animated overlay layer. Renders particle systems and dramatic
// effects on top of the preview at full size, with pointer-events disabled.

type Particle = { x: number; y: number; vx: number; vy: number; life: number; size: number };

export function VfxOverlay({
  kind,
  color = "#ffffff",
  intensity = 0.7,
  playing,
}: {
  kind: VfxOverlayKind;
  color?: string;
  intensity?: number;
  playing: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const partsRef = useRef<Particle[]>([]);
  const tRef = useRef(0);
  const flashRef = useRef(0);

  useEffect(() => {
    partsRef.current = [];
    tRef.current = 0;
    flashRef.current = 0;
  }, [kind]);

  useEffect(() => {
    if (kind === "none") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let last = performance.now();

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(r.width));
      canvas.height = Math.max(1, Math.floor(r.height));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (playing) tRef.current += dt;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      switch (kind) {
        case "rain": drawRain(ctx, w, h, intensity, dt, playing, partsRef.current); break;
        case "snow": drawSnow(ctx, w, h, intensity, dt, playing, partsRef.current); break;
        case "particles": drawParticles(ctx, w, h, color, intensity, dt, playing, partsRef.current); break;
        case "embers": drawEmbers(ctx, w, h, color, intensity, dt, playing, partsRef.current); break;
        case "sparkles": drawSparkles(ctx, w, h, color, intensity, dt, playing, partsRef.current); break;
        case "smoke": drawSmoke(ctx, w, h, intensity, tRef.current); break;
        case "fire-glow": drawFireGlow(ctx, w, h, color, intensity, tRef.current); break;
        case "neon-glow": drawNeonGlow(ctx, w, h, color, intensity); break;
        case "lens-flare": drawLensFlare(ctx, w, h, color, intensity, tRef.current); break;
        case "lightning": drawLightning(ctx, w, h, intensity, dt, playing, flashRef); break;
        case "vignette": drawVignette(ctx, w, h, intensity); break;
        case "film-burn": drawFilmBurn(ctx, w, h, intensity, tRef.current); break;
        case "scanlines": drawScanlines(ctx, w, h, color, intensity); break;
        case "glitch": drawGlitch(ctx, w, h, color, intensity, tRef.current, playing); break;
        case "explosion": drawExplosion(ctx, w, h, color, intensity, tRef.current, partsRef.current, playing); break;
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [kind, color, intensity, playing]);

  if (kind === "none") return null;
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}

function spawn(parts: Particle[], n: number, factory: () => Particle, cap = 600) {
  for (let i = 0; i < n; i++) parts.push(factory());
  if (parts.length > cap) parts.splice(0, parts.length - cap);
}

function drawRain(ctx: CanvasRenderingContext2D, w: number, h: number, intensity: number, dt: number, playing: boolean, parts: Particle[]) {
  if (playing) spawn(parts, Math.floor(40 * intensity), () => ({
    x: Math.random() * w, y: -10, vx: -120, vy: 900 + Math.random() * 400,
    life: 1, size: 1 + Math.random() * 1.5,
  }), 800);
  ctx.strokeStyle = "rgba(180,210,255,0.55)";
  ctx.lineWidth = 1;
  for (const p of parts) {
    if (playing) { p.x += p.vx * dt; p.y += p.vy * dt; }
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - 6, p.y - 18);
    ctx.stroke();
  }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].y > h + 20) parts.splice(i, 1);
}

function drawSnow(ctx: CanvasRenderingContext2D, w: number, h: number, intensity: number, dt: number, playing: boolean, parts: Particle[]) {
  if (playing) spawn(parts, Math.floor(8 * intensity), () => ({
    x: Math.random() * w, y: -10, vx: (Math.random() - 0.5) * 30, vy: 40 + Math.random() * 60,
    life: 1, size: 1 + Math.random() * 3,
  }), 400);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  for (const p of parts) {
    if (playing) {
      p.x += p.vx * dt + Math.sin((p.y + p.x) * 0.01) * 0.5;
      p.y += p.vy * dt;
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].y > h + 10) parts.splice(i, 1);
}

function drawParticles(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, intensity: number, dt: number, playing: boolean, parts: Particle[]) {
  if (playing) spawn(parts, Math.floor(6 * intensity), () => ({
    x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 20, vy: -20 - Math.random() * 30,
    life: 1, size: 1 + Math.random() * 2.5,
  }), 350);
  for (const p of parts) {
    if (playing) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 0.4; }
    if (p.life <= 0) continue;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = color;
    ctx.shadowBlur = 8;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
}

function drawEmbers(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, intensity: number, dt: number, playing: boolean, parts: Particle[]) {
  if (playing) spawn(parts, Math.floor(10 * intensity), () => ({
    x: Math.random() * w, y: h + 10, vx: (Math.random() - 0.5) * 30, vy: -50 - Math.random() * 100,
    life: 1, size: 1 + Math.random() * 2,
  }), 500);
  for (const p of parts) {
    if (playing) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 0.3; }
    if (p.life <= 0) continue;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = color;
    ctx.shadowBlur = 10; ctx.shadowColor = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0 || parts[i].y < -20) parts.splice(i, 1);
}

function drawSparkles(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, intensity: number, dt: number, playing: boolean, parts: Particle[]) {
  if (playing) spawn(parts, Math.floor(5 * intensity), () => ({
    x: Math.random() * w, y: Math.random() * h, vx: 0, vy: -10 - Math.random() * 10,
    life: 1, size: 1.5 + Math.random() * 2.5,
  }), 300);
  for (const p of parts) {
    if (playing) { p.y += p.vy * dt; p.life -= dt * 0.5; }
    if (p.life <= 0) continue;
    const a = Math.abs(Math.sin(p.life * 8)) * p.life;
    ctx.globalAlpha = a;
    ctx.fillStyle = color;
    ctx.shadowBlur = 14; ctx.shadowColor = color;
    // 4-point star
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const ang = (Math.PI / 2) * i;
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(ang) * p.size * 3, p.y + Math.sin(ang) * p.size * 3);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
}

function drawSmoke(ctx: CanvasRenderingContext2D, w: number, h: number, intensity: number, t: number) {
  const g = ctx.createRadialGradient(w / 2, h * 0.8, h * 0.1, w / 2, h * 0.8, h * 0.9);
  g.addColorStop(0, `rgba(180,180,180,${0.3 * intensity})`);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // moving plumes
  for (let i = 0; i < 3; i++) {
    const x = (w / 4) * (i + 1) + Math.sin(t * 0.3 + i) * 40;
    const r = h * 0.35;
    const rg = ctx.createRadialGradient(x, h * 0.7, 10, x, h * 0.7, r);
    rg.addColorStop(0, `rgba(200,200,200,${0.25 * intensity})`);
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
  }
}

function drawFireGlow(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, intensity: number, t: number) {
  const flicker = 0.85 + Math.sin(t * 12) * 0.1 + Math.random() * 0.05;
  const g = ctx.createRadialGradient(w / 2, h, h * 0.1, w / 2, h, h * 1.1);
  g.addColorStop(0, hexToRgba(color, 0.55 * intensity * flicker));
  g.addColorStop(0.5, hexToRgba(color, 0.2 * intensity));
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawNeonGlow(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, intensity: number) {
  // edge neon glow
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, hexToRgba(color, 0.5 * intensity));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawLensFlare(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, intensity: number, t: number) {
  const cx = w * (0.7 + Math.sin(t * 0.2) * 0.1);
  const cy = h * 0.3;
  // main glow
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, h * 0.5);
  g.addColorStop(0, hexToRgba(color, 0.9 * intensity));
  g.addColorStop(0.3, hexToRgba(color, 0.4 * intensity));
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // streak
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.2);
  const sg = ctx.createLinearGradient(-w, 0, w, 0);
  sg.addColorStop(0, "rgba(0,0,0,0)");
  sg.addColorStop(0.5, hexToRgba(color, 0.5 * intensity));
  sg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sg;
  ctx.fillRect(-w, -4, w * 2, 8);
  ctx.restore();
  // ghosts
  for (let i = 1; i <= 4; i++) {
    const gx = cx + (w / 2 - cx) * (i / 4) * 1.5;
    const gy = cy + (h / 2 - cy) * (i / 4) * 1.5;
    const r = 20 + i * 8;
    const ring = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
    ring.addColorStop(0, hexToRgba(color, 0.3 * intensity));
    ring.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = ring;
    ctx.fillRect(gx - r, gy - r, r * 2, r * 2);
  }
}

function drawLightning(ctx: CanvasRenderingContext2D, w: number, h: number, intensity: number, dt: number, playing: boolean, flashRef: React.MutableRefObject<number>) {
  if (playing && Math.random() < 0.01 * intensity) flashRef.current = 0.9 * intensity;
  if (flashRef.current > 0) {
    ctx.fillStyle = `rgba(220,235,255,${flashRef.current})`;
    ctx.fillRect(0, 0, w, h);
    // bolt
    if (flashRef.current > 0.5) {
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 2;
      ctx.shadowBlur = 12;
      ctx.shadowColor = "#bfdbfe";
      ctx.beginPath();
      let x = w * (0.3 + Math.random() * 0.4);
      let y = 0;
      ctx.moveTo(x, y);
      while (y < h) {
        x += (Math.random() - 0.5) * 40;
        y += 20 + Math.random() * 30;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    if (playing) flashRef.current = Math.max(0, flashRef.current - dt * 3);
  }
}

function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number, intensity: number) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${0.85 * intensity})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawFilmBurn(ctx: CanvasRenderingContext2D, w: number, h: number, intensity: number, t: number) {
  // grain
  ctx.globalAlpha = 0.06 * intensity;
  for (let i = 0; i < 250; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? "#fff" : "#000";
    ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
  }
  ctx.globalAlpha = 1;
  // burn flicker
  if (Math.sin(t * 3) > 0.85) {
    const g = ctx.createRadialGradient(w * Math.random(), h * Math.random(), 0, w / 2, h / 2, w * 0.6);
    g.addColorStop(0, `rgba(255,180,80,${0.4 * intensity})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
}

function drawScanlines(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, intensity: number) {
  ctx.fillStyle = hexToRgba(color, 0.08 * intensity);
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
  // edge tint
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, hexToRgba(color, 0.15 * intensity));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawGlitch(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, intensity: number, t: number, playing: boolean) {
  if (!playing) return;
  // colored offset bars
  const bars = Math.floor(3 + 6 * intensity);
  for (let i = 0; i < bars; i++) {
    if (Math.random() > 0.3) continue;
    const y = Math.random() * h;
    const bh = 2 + Math.random() * 14;
    ctx.fillStyle = hexToRgba(color, 0.35);
    ctx.fillRect(0, y, w, bh);
    ctx.fillStyle = "rgba(239,68,68,0.25)";
    ctx.fillRect(Math.random() * 20 - 10, y, w, bh);
  }
  // rgb split block
  if (Math.sin(t * 7) > 0.5) {
    ctx.fillStyle = "rgba(34,211,238,0.18)";
    ctx.fillRect(0, h * Math.random(), w, 30);
  }
}

function drawExplosion(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, intensity: number, t: number, parts: Particle[], playing: boolean) {
  // periodic burst
  const cycle = (t % 2.5);
  if (playing && cycle < 0.05 && parts.length < 200) {
    const cx = w / 2 + (Math.random() - 0.5) * w * 0.3;
    const cy = h / 2 + (Math.random() - 0.5) * h * 0.3;
    for (let i = 0; i < 80; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 100 + Math.random() * 400;
      parts.push({
        x: cx, y: cy,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        life: 1, size: 2 + Math.random() * 3,
      });
    }
  }
  // fireball glow
  if (cycle < 0.6) {
    const a = (1 - cycle / 0.6) * 0.7 * intensity;
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, h * 0.6);
    g.addColorStop(0, hexToRgba("#fff7ed", a));
    g.addColorStop(0.3, hexToRgba(color, a));
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  // sparks
  for (const p of parts) {
    if (playing) {
      p.x += p.vx * 0.016; p.y += p.vy * 0.016 + 80 * 0.016;
      p.vx *= 0.97; p.vy *= 0.97; p.life -= 0.016;
    }
    if (p.life <= 0) continue;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = color;
    ctx.shadowBlur = 12; ctx.shadowColor = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
}

function hexToRgba(hex: string, a: number) {
  const m = hex.replace("#", "");
  const v = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
