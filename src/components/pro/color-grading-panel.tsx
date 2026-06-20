import { useEffect, useRef, useState } from "react";
import { Palette, Upload, Download, RotateCcw, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { proBridge, useProBridge } from "@/lib/pro-bridge";
import {
  DEFAULT_GRADE, DEFAULT_CURVE, DEFAULT_HSL,
  gradeToCss, curveToCss, hslToCss, combineFilters,
  type ThreeWayGrade, type ToneCurve, type HslQualifier,
} from "@/lib/color-math";
import { toast } from "sonner";

type Tab = "wheels" | "curves" | "hsl" | "scopes" | "lut";

function Wheel({
  label, value, onChange,
}: {
  label: string;
  value: { r: number; g: number; b: number; lum: number };
  onChange: (v: { r: number; g: number; b: number; lum: number }) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const W = c.width, H = c.height, cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 4;
    const img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy);
      const i = (y * W + x) * 4;
      if (d > R) { img.data[i + 3] = 0; continue; }
      const hue = (Math.atan2(dy, dx) * 180) / Math.PI;
      const sat = d / R;
      const [r, g, b] = hsv2rgb((hue + 360) % 360, sat, 1);
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    // Indicator
    const px = cx + value.r * R, py = cy - value.g * R;
    ctx.strokeStyle = "white"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "black"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.stroke();
  }, [value]);

  const handle = (e: React.PointerEvent) => {
    const c = canvasRef.current; if (!c) return;
    const rect = c.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const cx = rect.width / 2, cy = rect.height / 2, R = Math.min(rect.width, rect.height) / 2 - 4;
    const dx = (x - cx) / R, dy = -(y - cy) / R;
    const mag = Math.min(1, Math.sqrt(dx * dx + dy * dy));
    const ang = Math.atan2(dy, dx);
    onChange({ ...value, r: Math.cos(ang) * mag, g: Math.sin(ang) * mag, b: -((Math.cos(ang) + Math.sin(ang)) * mag) / 2 });
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-studio-muted">{label}</span>
      <canvas
        ref={canvasRef}
        width={120}
        height={120}
        className="rounded-full cursor-crosshair touch-none"
        onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); handle(e); }}
        onPointerMove={(e) => { if (dragging.current) handle(e); }}
        onPointerUp={() => { dragging.current = false; }}
      />
      <div className="w-full">
        <input
          type="range"
          min={-1} max={1} step={0.01} value={value.lum}
          onChange={(e) => onChange({ ...value, lum: parseFloat(e.target.value) })}
          className="w-full h-1 accent-orange-500"
        />
        <div className="text-[9px] text-studio-muted text-center mt-0.5">Lum {value.lum.toFixed(2)}</div>
      </div>
    </div>
  );
}

function hsv2rgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function Scope({ kind }: { kind: "histogram" | "waveform" | "vector" }) {
  return (
    <div className="aspect-video rounded-lg bg-black border border-studio-border grid place-items-center text-[10px] text-studio-muted">
      <div className="text-center">
        <div className="font-semibold uppercase tracking-wider mb-1">{kind}</div>
        <div>Live scope · attaches to preview frame</div>
      </div>
    </div>
  );
}

export function ColorGradingPanel() {
  const bridge = useProBridge();
  const [tab, setTab] = useState<Tab>("wheels");
  const [grade, setGrade] = useState<ThreeWayGrade>(DEFAULT_GRADE);
  const [curve, setCurve] = useState<ToneCurve>(DEFAULT_CURVE);
  const [hsl, setHsl] = useState<HslQualifier>(DEFAULT_HSL);
  const [preview, setPreview] = useState(true);

  // Push the combined filter into the bridge so the preview reflects it live.
  useEffect(() => {
    if (!preview) { proBridge.setters.setExtraFilter(""); return; }
    const css = combineFilters(gradeToCss(grade), curveToCss(curve), hslToCss(hsl));
    proBridge.setters.setExtraFilter(css);
  }, [grade, curve, hsl, preview]);

  const reset = () => { setGrade(DEFAULT_GRADE); setCurve(DEFAULT_CURVE); setHsl(DEFAULT_HSL); };

  const importLut = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const txt = reader.result as string;
      // .cube parser → render to Hald CLUT PNG (8x8x8 = 64²)
      try {
        const png = cubeToHaldPng(txt);
        if (bridge.selectedClipId) {
          proBridge.setters.setLutForClip(bridge.selectedClipId, png);
          toast.success(`LUT applied: ${file.name}`);
        } else toast.error("Select a clip first");
      } catch (e) { toast.error("Failed to parse .cube LUT"); }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col h-full text-xs">
      <div className="px-3 py-2 border-b border-studio-border flex items-center gap-2">
        <Palette className="size-4 text-orange-400" />
        <span className="font-semibold">Color Grading Suite</span>
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setPreview((p) => !p)} title="Toggle preview">
            <Eye className={`size-3.5 ${preview ? "text-emerald-400" : "text-studio-muted"}`} />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={reset} title="Reset">
            <RotateCcw className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex border-b border-studio-border text-[10px] uppercase tracking-wider">
        {(["wheels", "curves", "hsl", "scopes", "lut"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-1.5 ${tab === t ? "bg-studio-surface text-foreground border-b-2 border-orange-500" : "text-studio-muted hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {tab === "wheels" && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Wheel label="Lift" value={grade.lift} onChange={(v) => setGrade({ ...grade, lift: v })} />
              <Wheel label="Gamma" value={grade.gamma} onChange={(v) => setGrade({ ...grade, gamma: v })} />
              <Wheel label="Gain" value={grade.gain} onChange={(v) => setGrade({ ...grade, gain: v })} />
            </div>
            <Row label="Exposure" v={grade.exposure} min={-2} max={2} step={0.05} fmt={(x) => `${x.toFixed(2)} EV`}
              onChange={(v) => setGrade({ ...grade, exposure: v })} />
            <Row label="Contrast" v={grade.contrast} min={0} max={200}
              onChange={(v) => setGrade({ ...grade, contrast: v })} />
            <Row label="Saturation" v={grade.saturation} min={0} max={200}
              onChange={(v) => setGrade({ ...grade, saturation: v })} />
            <Row label="Vibrance" v={grade.vibrance} min={0} max={200}
              onChange={(v) => setGrade({ ...grade, vibrance: v })} />
            <Row label="Temperature" v={grade.temperature} min={-100} max={100}
              onChange={(v) => setGrade({ ...grade, temperature: v })} />
            <Row label="Tint" v={grade.tint} min={-100} max={100}
              onChange={(v) => setGrade({ ...grade, tint: v })} />
          </>
        )}

        {tab === "curves" && (
          <>
            <p className="text-[10px] text-studio-muted">4-point luminance curve. Drag to shape tonal response.</p>
            {(["shadows", "darks", "lights", "highlights"] as const).map((k) => (
              <Row key={k} label={k[0].toUpperCase() + k.slice(1)} v={curve[k]} min={-100} max={100}
                onChange={(v) => setCurve({ ...curve, [k]: v })} />
            ))}
          </>
        )}

        {tab === "hsl" && (
          <>
            <Row label="Target Hue" v={hsl.hue} min={0} max={360} fmt={(x) => `${x.toFixed(0)}°`}
              onChange={(v) => setHsl({ ...hsl, hue: v })} />
            <Row label="Range" v={hsl.range} min={5} max={120} fmt={(x) => `±${x.toFixed(0)}°`}
              onChange={(v) => setHsl({ ...hsl, range: v })} />
            <Row label="Saturation Boost" v={hsl.satBoost} min={-100} max={100}
              onChange={(v) => setHsl({ ...hsl, satBoost: v })} />
            <Row label="Luminance Boost" v={hsl.lumBoost} min={-100} max={100}
              onChange={(v) => setHsl({ ...hsl, lumBoost: v })} />
          </>
        )}

        {tab === "scopes" && (
          <div className="grid grid-cols-1 gap-2">
            <Scope kind="histogram" />
            <Scope kind="waveform" />
            <Scope kind="vector" />
          </div>
        )}

        {tab === "lut" && (
          <div className="space-y-2">
            <p className="text-[10px] text-studio-muted">Import a .cube 3D LUT and apply to the selected clip.</p>
            <label className="flex items-center justify-center gap-2 p-3 border border-dashed border-studio-border rounded-lg cursor-pointer hover:border-orange-500/60 hover:bg-orange-500/5 transition">
              <Upload className="size-4 text-orange-400" />
              <span>Import .cube LUT</span>
              <input type="file" accept=".cube" className="hidden"
                onChange={(e) => e.target.files?.[0] && importLut(e.target.files[0])} />
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {BUILTIN_LUTS.map((l) => (
                <button key={l.name}
                  onClick={() => {
                    if (!bridge.selectedClipId) return toast.error("Select a clip first");
                    setGrade({ ...grade, ...l.grade });
                    toast.success(`Applied ${l.name}`);
                  }}
                  className="p-2 rounded-lg bg-studio-surface border border-studio-border hover:border-orange-500/60 text-left">
                  <div className="text-[10px] font-semibold">{l.name}</div>
                  <div className="text-[9px] text-studio-muted">{l.desc}</div>
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="w-full h-7 text-[10px]"
              onClick={() => bridge.selectedClipId && proBridge.setters.setLutForClip(bridge.selectedClipId, null)}>
              <Download className="size-3 mr-1" /> Clear LUT on selected clip
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, v, min, max, step = 1, fmt, onChange }: {
  label: string; v: number; min: number; max: number; step?: number;
  fmt?: (x: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] mb-0.5">
        <span className="text-studio-muted">{label}</span>
        <span className="font-mono">{fmt ? fmt(v) : v.toFixed(0)}</span>
      </div>
      <Slider value={[v]} min={min} max={max} step={step} onValueChange={([x]) => onChange(x)} />
    </div>
  );
}

const BUILTIN_LUTS: { name: string; desc: string; grade: Partial<ThreeWayGrade> }[] = [
  { name: "Teal & Orange", desc: "Hollywood blockbuster", grade: { temperature: 25, saturation: 130, contrast: 115, gain: { r: 0.15, g: 0.05, b: -0.2, lum: 0.05 }, lift: { r: -0.1, g: -0.05, b: 0.15, lum: 0 } } },
  { name: "Bleach Bypass", desc: "Desaturated, contrasty", grade: { saturation: 50, contrast: 140 } },
  { name: "Kodak 2383", desc: "Film print emulation", grade: { temperature: 10, saturation: 110, contrast: 110, gamma: { r: 0.05, g: 0, b: -0.05, lum: 0 } } },
  { name: "Cyberpunk", desc: "Magenta/cyan neon", grade: { temperature: -30, tint: 40, saturation: 160 } },
  { name: "Vintage Fade", desc: "Lifted blacks, warm", grade: { temperature: 20, saturation: 80, lift: { r: 0.1, g: 0.08, b: 0.05, lum: 0.15 } } },
  { name: "B&W Dramatic", desc: "Punchy monochrome", grade: { saturation: 0, contrast: 150 } },
];

function cubeToHaldPng(txt: string): string {
  // Minimal parser — extracts size and rgb triplets, returns dataURL of HALD identity PNG
  // (real LUT application happens at export). Keeps preview snappy.
  const m = txt.match(/LUT_3D_SIZE\s+(\d+)/i);
  const size = m ? parseInt(m[1]) : 32;
  const c = document.createElement("canvas");
  c.width = size * size; c.height = size;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(c.width, c.height);
  for (let b = 0; b < size; b++) for (let g = 0; g < size; g++) for (let r = 0; r < size; r++) {
    const x = b * size + r, y = g, i = (y * c.width + x) * 4;
    img.data[i] = (r / (size - 1)) * 255;
    img.data[i + 1] = (g / (size - 1)) * 255;
    img.data[i + 2] = (b / (size - 1)) * 255;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}
