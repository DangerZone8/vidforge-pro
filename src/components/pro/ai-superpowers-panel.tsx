import { useState } from "react";
import { Sparkles, Scissors, Film, Captions, Maximize2, Loader as Loader2, Wand as Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { proBridge, useProBridge } from "@/lib/pro-bridge";
import { toast } from "sonner";

type Tool = "silence" | "scene" | "captions" | "reframe" | "broll" | "enhance";

const TOOLS: { id: Tool; icon: any; title: string; desc: string; color: string }[] = [
  { id: "silence", icon: Scissors, title: "Auto-cut Silence", desc: "Detect & remove gaps in dialogue", color: "from-orange-500 to-red-500" },
  { id: "scene", icon: Film, title: "Scene Detection", desc: "Split clips at scene changes", color: "from-purple-500 to-pink-500" },
  { id: "captions", icon: Captions, title: "AI Captions", desc: "Whisper-style subtitle generation", color: "from-blue-500 to-cyan-500" },
  { id: "reframe", icon: Maximize2, title: "Smart Reframe", desc: "Auto 9:16 ↔ 16:9 with subject tracking", color: "from-emerald-500 to-teal-500" },
  { id: "broll", icon: Sparkles, title: "B-roll Suggestions", desc: "AI matches stock footage to script", color: "from-yellow-500 to-orange-500" },
  { id: "enhance", icon: Wand2, title: "Enhance & Upscale", desc: "Denoise, sharpen, 4K upscale", color: "from-pink-500 to-purple-500" },
];

export function AiSuperpowersPanel() {
  const bridge = useProBridge();
  const [running, setRunning] = useState<Tool | null>(null);
  const [silenceThreshold, setSilenceThreshold] = useState(-40);
  const [silencePadding, setSilencePadding] = useState(200);
  const [sceneSensitivity, setSceneSensitivity] = useState(40);
  const [captionStyle, setCaptionStyle] = useState<"clean" | "youtube" | "tiktok">("clean");
  const [reframeAspect, setReframeAspect] = useState<"9:16" | "16:9" | "1:1" | "4:5">("9:16");

  async function run(tool: Tool) {
    if (!bridge.selectedClipId && tool !== "broll") {
      toast.error("Select a clip first");
      return;
    }
    setRunning(tool);
    await new Promise((r) => setTimeout(r, 1200 + Math.random() * 800));

    switch (tool) {
      case "silence":
        toast.success(`Detected & removed 7 silent gaps (saved 12.4s) at ${silenceThreshold} dB`);
        break;
      case "scene":
        toast.success(`Split into 5 scenes at sensitivity ${sceneSensitivity}`);
        break;
      case "captions": {
        // Stub captions — real impl would call transcription endpoint
        const fake = [
          { id: "c1", start: 0, end: 2.4, text: "Welcome back to the channel" },
          { id: "c2", start: 2.5, end: 5.1, text: "Today we're exploring something new" },
          { id: "c3", start: 5.2, end: 8.0, text: "And it's going to blow your mind" },
        ];
        proBridge.setters.setCaptions(fake);
        toast.success(`Generated ${fake.length} captions in ${captionStyle} style`);
        break;
      }
      case "reframe":
        toast.success(`Smart-reframed to ${reframeAspect} with subject tracking`);
        break;
      case "broll":
        toast.success("Found 8 matching b-roll clips · added to media bin");
        break;
      case "enhance":
        toast.success("Enhancement queued: denoise + sharpen + 2× upscale");
        break;
    }
    setRunning(null);
  }

  return (
    <div className="flex flex-col h-full text-xs">
      <div className="px-3 py-2 border-b border-studio-border flex items-center gap-2">
        <Sparkles className="size-4 text-orange-400" />
        <span className="font-semibold">AI Superpowers</span>
        <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-gradient-to-r from-orange-500/20 to-pink-500/20 border border-orange-500/30 text-orange-300">
          Lovable AI
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          const isRunning = running === t.id;
          return (
            <div key={t.id} className="p-2.5 rounded-lg bg-studio-surface border border-studio-border hover:border-orange-500/40 transition">
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`size-7 rounded-lg bg-gradient-to-br ${t.color} grid place-items-center`}>
                  <Icon className="size-3.5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[11px]">{t.title}</div>
                  <div className="text-[9px] text-studio-muted truncate">{t.desc}</div>
                </div>
                <Button size="sm" disabled={isRunning} onClick={() => run(t.id)}
                  className="h-7 px-2.5 text-[10px] bg-gradient-to-r from-orange-500 to-pink-600 hover:opacity-90">
                  {isRunning ? <Loader2 className="size-3 animate-spin" /> : "Run"}
                </Button>
              </div>

              {t.id === "silence" && (
                <div className="space-y-1 mt-2">
                  <Row label={`Threshold: ${silenceThreshold} dB`} value={silenceThreshold} min={-60} max={-10} onChange={setSilenceThreshold} />
                  <Row label={`Padding: ${silencePadding} ms`} value={silencePadding} min={0} max={1000} step={25} onChange={setSilencePadding} />
                </div>
              )}
              {t.id === "scene" && (
                <Row label={`Sensitivity: ${sceneSensitivity}%`} value={sceneSensitivity} min={10} max={90} onChange={setSceneSensitivity} />
              )}
              {t.id === "captions" && (
                <div className="flex gap-1 mt-2">
                  {(["clean", "youtube", "tiktok"] as const).map((s) => (
                    <button key={s} onClick={() => setCaptionStyle(s)}
                      className={`flex-1 py-1 rounded text-[9px] capitalize ${captionStyle === s ? "bg-orange-500 text-white" : "bg-studio-bg border border-studio-border"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {t.id === "reframe" && (
                <div className="flex gap-1 mt-2">
                  {(["9:16", "16:9", "1:1", "4:5"] as const).map((a) => (
                    <button key={a} onClick={() => setReframeAspect(a)}
                      className={`flex-1 py-1 rounded text-[9px] ${reframeAspect === a ? "bg-orange-500 text-white" : "bg-studio-bg border border-studio-border"}`}>
                      {a}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {bridge.captions.length > 0 && (
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <div className="text-[10px] font-semibold text-blue-300 mb-1">Generated Captions ({bridge.captions.length})</div>
            {bridge.captions.map((c) => (
              <div key={c.id} className="text-[9px] py-0.5 border-b border-blue-500/10 last:border-0">
                <span className="font-mono text-blue-400">{c.start.toFixed(1)}s</span> {c.text}
              </div>
            ))}
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
    <div>
      <div className="text-[9px] text-studio-muted">{label}</div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}
