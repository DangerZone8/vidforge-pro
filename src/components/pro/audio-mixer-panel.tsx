import { useEffect, useRef, useState } from "react";
import { Headphones, Volume2, VolumeX, Mic, Activity } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { proBridge, useProBridge } from "@/lib/pro-bridge";

const TRACKS = [0, 1, 2, 3, 4, 5, 6, 7];

function VuBar({ level }: { level: number }) {
  const pct = Math.min(100, level * 100);
  const color = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-yellow-400" : "bg-emerald-500";
  return (
    <div className="w-full h-1.5 bg-black/60 rounded overflow-hidden">
      <div className={`h-full ${color} transition-[width] duration-75`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function TrackStrip({ track }: { track: number }) {
  const bridge = useProBridge();
  const mix = bridge.trackMix[track] ?? { gain: 1, pan: 0, muted: false, solo: false };
  const [level, setLevel] = useState(0);
  const [eq, setEq] = useState({ low: 0, mid: 0, high: 0 });
  const [comp, setComp] = useState({ threshold: -24, ratio: 4, enabled: false });

  // Fake VU animation — replaced by analyser tap when wired to audio engine.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const target = mix.muted ? 0 : Math.random() * mix.gain * 0.7 + (mix.gain > 0 ? 0.1 : 0);
      setLevel((l) => l * 0.7 + target * 0.3);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mix.gain, mix.muted]);

  return (
    <div className="flex flex-col gap-1.5 p-2 bg-studio-surface rounded-lg border border-studio-border min-w-[88px]">
      <div className="text-[10px] font-semibold text-center">A{track + 1}</div>
      <VuBar level={level} />
      <Slider value={[mix.gain * 100]} min={0} max={150} step={1}
        onValueChange={([v]) => proBridge.setters.setTrackMix(track, { gain: v / 100 })}
        orientation="vertical" className="h-24 mx-auto" />
      <div className="text-[9px] text-center font-mono">{(20 * Math.log10(Math.max(0.001, mix.gain))).toFixed(1)} dB</div>
      <div>
        <div className="text-[9px] text-studio-muted">Pan</div>
        <Slider value={[mix.pan]} min={-1} max={1} step={0.05}
          onValueChange={([v]) => proBridge.setters.setTrackMix(track, { pan: v })} />
      </div>
      <div className="grid grid-cols-3 gap-1 text-[9px]">
        {(["low", "mid", "high"] as const).map((b) => (
          <div key={b}>
            <div className="text-studio-muted text-center">{b.toUpperCase()}</div>
            <input type="range" min={-12} max={12} step={0.5} value={eq[b]}
              onChange={(e) => setEq({ ...eq, [b]: parseFloat(e.target.value) })}
              className="w-full h-1 accent-orange-500" />
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        <button onClick={() => proBridge.setters.setTrackMix(track, { muted: !mix.muted })}
          className={`flex-1 py-0.5 rounded text-[9px] font-bold ${mix.muted ? "bg-red-600 text-white" : "bg-studio-bg border border-studio-border"}`}>M</button>
        <button onClick={() => proBridge.setters.setTrackMix(track, { solo: !mix.solo })}
          className={`flex-1 py-0.5 rounded text-[9px] font-bold ${mix.solo ? "bg-yellow-500 text-black" : "bg-studio-bg border border-studio-border"}`}>S</button>
        <button onClick={() => setComp({ ...comp, enabled: !comp.enabled })}
          className={`flex-1 py-0.5 rounded text-[9px] font-bold ${comp.enabled ? "bg-emerald-600 text-white" : "bg-studio-bg border border-studio-border"}`}>C</button>
      </div>
    </div>
  );
}

export function AudioMixerPanel() {
  const bridge = useProBridge();
  const [duck, setDuck] = useState({ enabled: false, amount: 60, source: 0, target: 1 });
  const [nr, setNr] = useState({ enabled: false, amount: 50 });

  return (
    <div className="flex flex-col h-full text-xs">
      <div className="px-3 py-2 border-b border-studio-border flex items-center gap-2">
        <Headphones className="size-4 text-orange-400" />
        <span className="font-semibold">Pro Audio Mixer</span>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {TRACKS.map((t) => <TrackStrip key={t} track={t} />)}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 bg-studio-surface rounded-lg border border-studio-border space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Activity className="size-3 text-emerald-400" />
              <span className="font-semibold text-[10px]">Side-chain Ducking</span>
              <button onClick={() => setDuck({ ...duck, enabled: !duck.enabled })}
                className={`ml-auto px-2 py-0.5 rounded text-[9px] ${duck.enabled ? "bg-emerald-600 text-white" : "bg-studio-bg border border-studio-border"}`}>
                {duck.enabled ? "ON" : "OFF"}
              </button>
            </div>
            <div className="text-[9px] text-studio-muted">When voice on A{duck.source + 1} plays, music on A{duck.target + 1} drops by {duck.amount}%</div>
            <Slider value={[duck.amount]} min={0} max={100} step={1}
              onValueChange={([v]) => setDuck({ ...duck, amount: v })} />
          </div>
          <div className="p-2 bg-studio-surface rounded-lg border border-studio-border space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Mic className="size-3 text-purple-400" />
              <span className="font-semibold text-[10px]">Noise Reduction</span>
              <button onClick={() => setNr({ ...nr, enabled: !nr.enabled })}
                className={`ml-auto px-2 py-0.5 rounded text-[9px] ${nr.enabled ? "bg-purple-600 text-white" : "bg-studio-bg border border-studio-border"}`}>
                {nr.enabled ? "ON" : "OFF"}
              </button>
            </div>
            <div className="text-[9px] text-studio-muted">Spectral gating · {nr.amount}% strength</div>
            <Slider value={[nr.amount]} min={0} max={100} step={1}
              onValueChange={([v]) => setNr({ ...nr, amount: v })} />
          </div>
        </div>

        <div className="p-3 bg-gradient-to-br from-orange-500/10 to-pink-500/10 rounded-lg border border-orange-500/30">
          <div className="flex items-center gap-2 mb-2">
            <Volume2 className="size-4 text-orange-400" />
            <span className="font-semibold">Master Bus</span>
            <button onClick={() => proBridge.setters.setMaster({ muted: !bridge.master.muted })}
              className="ml-auto p-1 rounded hover:bg-white/10">
              {bridge.master.muted ? <VolumeX className="size-3.5 text-red-400" /> : <Volume2 className="size-3.5" />}
            </button>
          </div>
          <Slider value={[bridge.master.gain * 100]} min={0} max={150} step={1}
            onValueChange={([v]) => proBridge.setters.setMaster({ gain: v / 100 })} />
          <div className="text-[10px] mt-1 font-mono text-center">
            {(20 * Math.log10(Math.max(0.001, bridge.master.gain))).toFixed(1)} dB · Peak −∞ dB · LUFS −16.0
          </div>
        </div>
      </div>
    </div>
  );
}
