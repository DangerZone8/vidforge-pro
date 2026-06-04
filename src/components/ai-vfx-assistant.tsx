import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, Send, Wand as Wand2, Flame, CloudRain, Zap, Film, Palette, Star as Stars, Wind, Eye, Loader as Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { VFX_PRESETS, type VfxPreset } from "@/lib/vfx-presets";
import { toast } from "sonner";

type Msg = {
  role: "user" | "assistant";
  content: string;
  preset?: VfxPreset;
  applied?: boolean;
  error?: boolean;
};

function matchPreset(prompt: string): VfxPreset | null {
  const lower = prompt.toLowerCase();
  const keywords: Record<string, string[]> = {
    "action-explosion": ["explosion", "blast", "detonate", "explode", "bomb"],
    "action-fire": ["fire", "inferno", "flame", "burning", "blaze"],
    "action-rain": ["rain", "storm", "downpour", "wet", "rainfall", "rainstorm"],
    "action-lightning": ["lightning", "thunder", "electric", "thunderstorm"],
    "action-smoke": ["smoke", "fog", "mist", "haze", "smog"],
    "scifi-cyberpunk": ["cyberpunk", "neon", "futuristic", "cyber", "dystopia", "blade runner"],
    "scifi-matrix": ["matrix", "digital", "code", "simulation", "hacker"],
    "scifi-tron": ["tron", "electric blue", "grid", "laser"],
    "scifi-hologram": ["hologram", "holo", "flicker", "projection"],
    "scifi-portal": ["portal", "swirl", "vortex", "warp"],
    "cine-blockbuster": ["blockbuster", "marvel", "superhero", "epic", "big budget", "hollywood", "mcu"],
    "color-cinematic": ["cinematic", "teal orange", "color grade", "film look", "movie"],
    "color-noir": ["noir", "black and white", "grayscale", "dramatic shadow"],
    "color-vintage": ["vintage", "retro", "old film", "aged", "sepia", "nostalgic"],
    "cine-thriller": ["thriller", "tense", "cold", "suspense", "dark"],
    "cine-dream": ["dream", "ethereal", "soft glow", "dreamy", "floaty"],
    "cine-romance": ["romance", "warm", "love", "sunset glow", "rosy"],
    "fantasy-magic": ["magic", "sparkle", "wizard", "enchant", "spell"],
    "fantasy-embers": ["embers", "floating fire", "ascend", "rising particles"],
    "fantasy-snow": ["snow", "winter", "snowfall", "blizzard"],
    "fantasy-stars": ["stars", "stardust", "cosmic", "galaxy", "space", "nebula"],
    "vfx-lens-flare": ["lens flare", "anamorphic", "sun flare", "light streak"],
    "vfx-glitch": ["glitch", "digital error", "corrupt", "artifact", "pixel"],
    "vfx-scanlines": ["scanlines", "crt", "retro tv", "monitor"],
    "vfx-film-burn": ["film burn", "scratch", "old projector", "grain"],
    "vfx-vignette": ["vignette", "dark edges", "darkened corners"],
  };

  let best: VfxPreset | null = null;
  let bestScore = 0;

  for (const [presetId, kws] of Object.entries(keywords)) {
    let score = 0;
    for (const kw of kws) {
      if (lower.includes(kw)) score += kw.split(" ").length * 2;
      else {
        for (const w of kw.split(" ")) {
          if (w.length >= 4 && lower.includes(w)) score += 0.5;
        }
      }
    }
    if (score > bestScore) {
      bestScore = score;
      const preset = VFX_PRESETS.find((p) => p.id === presetId) ?? null;
      if (preset) best = preset;
    }
  }

  return bestScore >= 1 ? best : null;
}

const QUICK_PROMPTS = [
  { label: "Explosion + fire", icon: Flame, prompt: "Add explosion with fire and smoke" },
  { label: "Cyberpunk neon", icon: Zap, prompt: "Apply cyberpunk neon lights style" },
  { label: "Cinematic grade", icon: Film, prompt: "Cinematic Hollywood color grade teal orange" },
  { label: "Heavy rain", icon: CloudRain, prompt: "Add heavy rain and storm" },
  { label: "Marvel style", icon: Stars, prompt: "Make this look like a Marvel blockbuster movie" },
  { label: "Dream glow", icon: Sparkles, prompt: "Soft dreamy ethereal glow" },
  { label: "Blade Runner", icon: Eye, prompt: "Blade Runner cyberpunk dystopia neon city" },
  { label: "Film noir", icon: Palette, prompt: "Black and white film noir dramatic shadows" },
  { label: "Magic sparkles", icon: Wand2, prompt: "Add magical sparkles enchanted fantasy" },
  { label: "Smoke & haze", icon: Wind, prompt: "Atmospheric smoke and mist haze" },
];

export function AiVfxAssistant({
  selectedClip,
  disabled,
  onApplyPreset,
  onApplyVfxJob,
  isProcessing,
}: {
  selectedClip: { id: string; url: string; name: string; start: number; duration: number } | null;
  disabled: boolean;
  onApplyPreset: (clipId: string, presetId: string) => void;
  onApplyVfxJob?: (job: any, presetName: string) => Promise<void>;
  isProcessing?: boolean;
}) {
  const [messages, setMessages] = useState<Msg[]>([{
    role: "assistant",
    content: "Hi! I'm your AI VFX Director. Select a clip in the timeline, then describe the look you want — explosions, cyberpunk, Marvel color grade, rain, magic, and more. Effects apply instantly to the preview.",
  }]);
  const [input, setInput] = useState("");
  const [showQuick, setShowQuick] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const appliedCount = useRef(0);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const apply = useCallback((prompt: string) => {
    if (!prompt.trim()) return;
    if (!selectedClip) {
      toast.error("Select a clip in the timeline first");
      setMessages((m) => [...m,
        { role: "user", content: prompt },
        { role: "assistant", content: "Please select a clip in the timeline first — click any clip to select it, then come back here.", error: true },
      ]);
      return;
    }

    const preset = matchPreset(prompt);
    const hadPrevious = appliedCount.current > 0;

    setMessages((m) => [...m, { role: "user", content: prompt }]);
    setInput("");

    if (preset) {
      onApplyPreset(selectedClip.id, preset.id);
      appliedCount.current += 1;
      const reply = hadPrevious
        ? `Stacked "${preset.name}" on "${selectedClip.name}". You can layer multiple effects — they compose together in the preview.`
        : `Applying "${preset.name}" to "${selectedClip.name}" — done instantly! The effect is live in the preview. Want to try another?`;
      setMessages((m) => [...m, { role: "assistant", content: reply, preset, applied: true }]);
    } else {
      const suggestions = VFX_PRESETS.slice(0, 5)
        .map((p) => `• "${p.name}" — ${p.description}`)
        .join("\n");
      setMessages((m) => [...m, {
        role: "assistant",
        content: `I couldn't match that prompt precisely. Try being more specific, like:\n\n${suggestions}\n\nOr pick one of the quick-apply buttons below.`,
      }]);
    }
  }, [selectedClip, onApplyPreset]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    apply(input);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-2.5 border-b border-studio-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-gradient-to-br from-orange-500 to-pink-600 grid place-items-center shrink-0">
            <Sparkles className="size-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold">AI VFX Director</div>
            <div className={cn("text-[10px] truncate", selectedClip ? "text-emerald-400" : "text-studio-muted")}>
              {selectedClip ? `● ${selectedClip.name}` : "No clip selected"}
            </div>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {messages.map((msg, i) => (
          <div key={i} className={cn(
            "rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap",
            msg.role === "user"
              ? "ml-4 bg-gradient-to-r from-orange-500/20 to-pink-500/20 border border-orange-500/30 text-foreground"
              : "mr-4 bg-studio-surface border border-studio-border text-foreground",
            msg.applied && "border-emerald-500/40 bg-emerald-500/10",
            msg.error && "border-red-500/30 bg-red-500/10 text-red-400",
          )}>
            {msg.preset && msg.applied && (
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-lg">{msg.preset.emoji}</span>
                <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wide">
                  Applied: {msg.preset.name}
                </span>
              </div>
            )}
            {msg.content}
          </div>
        ))}
        {isProcessing && (
          <div className="mr-4 px-3 py-2 rounded-lg bg-studio-surface border border-studio-border text-xs flex items-center gap-2 text-studio-muted">
            <Loader2 className="size-3 animate-spin text-orange-400" />
            Processing VFX with FFmpeg…
          </div>
        )}
      </div>

      <div className="border-t border-studio-border shrink-0">
        <button
          onClick={() => setShowQuick((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-studio-muted hover:text-foreground transition-colors"
        >
          Quick Apply
          {showQuick ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />}
        </button>
        {showQuick && (
          <div className="px-3 pb-2 grid grid-cols-2 gap-1">
            {QUICK_PROMPTS.map((q) => {
              const Icon = q.icon;
              return (
                <button
                  key={q.prompt}
                  onClick={() => apply(q.prompt)}
                  disabled={!selectedClip}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-studio-bg border border-studio-border hover:border-orange-500/50 transition-all text-left disabled:opacity-40 group"
                >
                  <Icon className="size-3 text-orange-400 shrink-0" />
                  <span className="text-[9px] font-medium truncate group-hover:text-foreground text-studio-muted">{q.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-3 pb-3 pt-2 border-t border-studio-border shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={selectedClip ? "Describe a look or effect…" : "Select a clip first…"}
            className="h-8 text-xs"
            disabled={isProcessing}
          />
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim() || isProcessing}
            className="bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-600 hover:to-pink-700 text-white shrink-0 h-8"
          >
            {isProcessing ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          </Button>
        </form>
        {selectedClip && (
          <p className="text-[9px] text-studio-muted mt-1.5 text-center">
            Effects apply instantly · Stacks with existing VFX
          </p>
        )}
      </div>
    </div>
  );
}
