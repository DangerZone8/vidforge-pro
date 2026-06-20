import { useState } from "react";
import { Diamond, Target, Layers as LayersIcon, Gauge, ArrowRightLeft, Scissors } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { proBridge, useProBridge } from "@/lib/pro-bridge";
import { toast } from "sonner";

type Tab = "keyframes" | "masks" | "chroma" | "tracking" | "speed" | "transitions";

const TRANSITIONS = [
  { id: "fade", name: "Cross Fade", emoji: "🌫️" },
  { id: "dissolve", name: "Dissolve", emoji: "💨" },
  { id: "wipe-l", name: "Wipe Left", emoji: "⬅️" },
  { id: "wipe-r", name: "Wipe Right", emoji: "➡️" },
  { id: "iris", name: "Iris", emoji: "🌀" },
  { id: "zoom-in", name: "Zoom In", emoji: "🔍" },
  { id: "zoom-out", name: "Zoom Out", emoji: "🔭" },
  { id: "slide-up", name: "Slide Up", emoji: "⬆️" },
  { id: "flash", name: "Flash", emoji: "⚡" },
  { id: "glitch", name: "Glitch", emoji: "📺" },
  { id: "whip-pan", name: "Whip Pan", emoji: "🌪️" },
  { id: "morph", name: "Morph", emoji: "🔄" },
];

export function MotionCompositingPanel() {
  const bridge = useProBridge();
  const [tab, setTab] = useState<Tab>("keyframes");
  const [speedRamp, setSpeedRamp] = useState({ start: 100, peak: 25, end: 100, easing: "ease-in-out" });
  const [maskShape, setMaskShape] = useState<"rect" | "ellipse" | "free">("ellipse");
  const [maskFeather, setMaskFeather] = useState(20);
  const [trackPoint, _setTrackPoint] = useState<{ x: number; y: number } | null>(null);

  const chroma = bridge.chromaKey ?? { enabled: false, color: "#00ff00", threshold: 40, smoothing: 10 };

  return (
    <div className="flex flex-col h-full text-xs">
      <div className="px-3 py-2 border-b border-studio-border flex items-center gap-2">
        <Diamond className="size-4 text-orange-400" />
        <span className="font-semibold">Motion & Compositing</span>
      </div>

      <div className="flex border-b border-studio-border text-[10px] uppercase tracking-wider overflow-x-auto">
        {(["keyframes", "masks", "chroma", "tracking", "speed", "transitions"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-1.5 px-1.5 whitespace-nowrap ${tab === t ? "bg-studio-surface text-foreground border-b-2 border-orange-500" : "text-studio-muted hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {tab === "keyframes" && (
          <div className="space-y-2">
            <p className="text-[10px] text-studio-muted">Animate position, scale, rotation, opacity. Diamond icons mark keyframes.</p>
            {(["Position X", "Position Y", "Scale", "Rotation", "Opacity"] as const).map((prop) => (
              <div key={prop} className="p-2 rounded-lg bg-studio-surface border border-studio-border">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-semibold">{prop}</span>
                  <Button size="sm" variant="ghost" className="h-6 px-1.5"
                    onClick={() => {
                      if (!bridge.selectedClipId) return toast.error("Select a clip");
                      toast.success(`Keyframe set at ${bridge.currentTime.toFixed(2)}s`);
                    }}>
                    <Diamond className="size-3 text-orange-400 fill-orange-400" />
                  </Button>
                </div>
                <Slider defaultValue={[prop === "Scale" || prop === "Opacity" ? 100 : 0]}
                  min={prop === "Rotation" ? -180 : prop === "Opacity" || prop === "Scale" ? 0 : -500}
                  max={prop === "Rotation" ? 180 : prop === "Opacity" ? 100 : prop === "Scale" ? 300 : 500} step={1} />
                <div className="flex justify-between mt-1">
                  <button className="text-[9px] text-studio-muted hover:text-orange-400">‹ Prev</button>
                  <button className="text-[9px] text-studio-muted hover:text-orange-400">Linear ▾</button>
                  <button className="text-[9px] text-studio-muted hover:text-orange-400">Next ›</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "masks" && (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-1.5">
              {(["rect", "ellipse", "free"] as const).map((s) => (
                <button key={s} onClick={() => setMaskShape(s)}
                  className={`py-2 rounded-lg text-[10px] capitalize ${maskShape === s ? "bg-orange-500 text-white" : "bg-studio-surface border border-studio-border"}`}>
                  {s === "free" ? "Free Draw" : s}
                </button>
              ))}
            </div>
            <Row label={`Feather: ${maskFeather}px`} value={maskFeather} min={0} max={100} onChange={setMaskFeather} />
            <div className="flex gap-1.5">
              <Button size="sm" className="flex-1 h-7 text-[10px]" variant="outline">Invert</Button>
              <Button size="sm" className="flex-1 h-7 text-[10px] bg-orange-500 hover:bg-orange-600">Apply Mask</Button>
            </div>
            <p className="text-[9px] text-studio-muted">Tip: Hold ⌥ on the preview to draw the mask shape.</p>
          </div>
        )}

        {tab === "chroma" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold flex-1">Chroma Key</span>
              <button
                onClick={() => proBridge.setters.setChromaKey({ ...chroma, enabled: !chroma.enabled })}
                className={`px-2 py-1 rounded text-[10px] ${chroma.enabled ? "bg-emerald-600 text-white" : "bg-studio-bg border border-studio-border"}`}>
                {chroma.enabled ? "ON" : "OFF"}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-studio-muted">Key color</span>
              <input type="color" value={chroma.color}
                onChange={(e) => proBridge.setters.setChromaKey({ ...chroma, color: e.target.value })}
                className="w-10 h-7 rounded bg-transparent border border-studio-border" />
              <div className="flex gap-1">
                <button onClick={() => proBridge.setters.setChromaKey({ ...chroma, color: "#00ff00" })}
                  className="size-6 rounded bg-green-500 border border-studio-border" title="Green screen" />
                <button onClick={() => proBridge.setters.setChromaKey({ ...chroma, color: "#0000ff" })}
                  className="size-6 rounded bg-blue-500 border border-studio-border" title="Blue screen" />
              </div>
            </div>
            <Row label={`Threshold: ${chroma.threshold}`} value={chroma.threshold} min={0} max={100}
              onChange={(v) => proBridge.setters.setChromaKey({ ...chroma, threshold: v })} />
            <Row label={`Smoothing: ${chroma.smoothing}`} value={chroma.smoothing} min={0} max={50}
              onChange={(v) => proBridge.setters.setChromaKey({ ...chroma, smoothing: v })} />
            <Button size="sm" className="w-full h-7 text-[10px] bg-orange-500 hover:bg-orange-600">
              Spill Suppression
            </Button>
          </div>
        )}

        {tab === "tracking" && (
          <div className="space-y-2">
            <div className="aspect-video rounded-lg bg-black border border-studio-border grid place-items-center text-[10px] text-studio-muted">
              <div className="text-center">
                <Target className="size-6 mx-auto mb-1 text-orange-400" />
                <div className="font-semibold">Motion Tracking</div>
                <div>Click subject in preview to set tracker</div>
              </div>
            </div>
            <Button size="sm" className="w-full h-7 text-[10px] bg-gradient-to-r from-orange-500 to-pink-600">
              {trackPoint ? `Tracking at (${trackPoint.x},${trackPoint.y})` : "Analyze Motion"}
            </Button>
            <div className="grid grid-cols-2 gap-1.5">
              <Button size="sm" variant="outline" className="h-7 text-[10px]">Pin Text to Tracker</Button>
              <Button size="sm" variant="outline" className="h-7 text-[10px]">Stabilize Footage</Button>
            </div>
          </div>
        )}

        {tab === "speed" && (
          <div className="space-y-2">
            <div className="p-2 rounded-lg bg-studio-surface border border-studio-border">
              <div className="flex items-center gap-2 mb-2">
                <Gauge className="size-4 text-orange-400" />
                <span className="text-[10px] font-semibold">Speed Ramp Curve</span>
              </div>
              <Row label={`Start: ${speedRamp.start}%`} value={speedRamp.start} min={10} max={400} onChange={(v) => setSpeedRamp({ ...speedRamp, start: v })} />
              <Row label={`Peak: ${speedRamp.peak}%`} value={speedRamp.peak} min={10} max={400} onChange={(v) => setSpeedRamp({ ...speedRamp, peak: v })} />
              <Row label={`End: ${speedRamp.end}%`} value={speedRamp.end} min={10} max={400} onChange={(v) => setSpeedRamp({ ...speedRamp, end: v })} />
              <div className="flex gap-1 mt-2">
                {(["linear", "ease-in", "ease-out", "ease-in-out"] as const).map((e) => (
                  <button key={e} onClick={() => setSpeedRamp({ ...speedRamp, easing: e })}
                    className={`flex-1 py-1 rounded text-[9px] ${speedRamp.easing === e ? "bg-orange-500 text-white" : "bg-studio-bg border border-studio-border"}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { name: "Slow-mo", desc: "25%" },
                { name: "Time-lapse", desc: "400%" },
                { name: "Freeze Frame", desc: "0%" },
              ].map((p) => (
                <button key={p.name} className="p-2 rounded-lg bg-studio-surface border border-studio-border hover:border-orange-500/40 text-left">
                  <div className="text-[10px] font-semibold">{p.name}</div>
                  <div className="text-[9px] text-studio-muted">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === "transitions" && (
          <div className="space-y-2">
            <p className="text-[10px] text-studio-muted">Drag onto a clip boundary, or click to apply at playhead.</p>
            <div className="grid grid-cols-3 gap-1.5">
              {TRANSITIONS.map((t) => (
                <button key={t.id}
                  onClick={() => toast.success(`Added ${t.name} transition`)}
                  className="p-2 rounded-lg bg-studio-surface border border-studio-border hover:border-orange-500/40 text-center">
                  <div className="text-xl mb-0.5">{t.emoji}</div>
                  <div className="text-[9px] font-semibold">{t.name}</div>
                </button>
              ))}
            </div>
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30">
              <div className="text-[10px] font-semibold text-purple-300 mb-1">AI Smart Cut</div>
              <p className="text-[9px] text-studio-muted mb-2">Analyzes audio rhythm & motion to suggest optimal cut points and transition styles.</p>
              <Button size="sm" className="w-full h-7 text-[10px] bg-gradient-to-r from-purple-500 to-pink-600">
                <ArrowRightLeft className="size-3 mr-1" /> Generate Smart Cuts
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, min, max, step = 1, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void;
}) {
  return (
    <div className="mb-1.5">
      <div className="text-[9px] text-studio-muted mb-0.5">{label}</div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}
