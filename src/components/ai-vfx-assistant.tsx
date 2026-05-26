import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Loader as Loader2, Wand as Wand2, Video, Flame, CloudRain, Zap, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AI_VFX_PRESETS, matchVfxPreset, presetToJob, processVfxJob, type VfxJob } from "@/lib/ai-vfx-engine";

type Msg = { role: "user" | "assistant"; content: string; vfxApplied?: boolean };

const MODES = [
  { id: "chat", label: "Chat", icon: Sparkles, desc: "Ask questions and get help" },
  { id: "vfx", label: "VFX", icon: Flame, desc: "Apply CGI and visual effects" },
  { id: "cgi", label: "CGI", icon: Video, desc: "Advanced CGI and compositing" },
] as const;

const QUICK_VFX = [
  "Add explosion with fire and smoke",
  "Apply cyberpunk neon style",
  "Make it look like a Marvel movie",
  "Add heavy rain and lightning",
  "Cinematic Hollywood color grade",
  "Add dramatic slow motion",
  "Realistic fire and flames",
  "Atmospheric smoke and haze",
];

export function AiVfxAssistant({
  selectedClip,
  disabled,
  onApplyVfx,
  isProcessing,
}: {
  selectedClip: { id: string; url: string; name: string; start: number; duration: number } | null;
  disabled: boolean;
  onApplyVfx: (job: VfxJob, presetName: string) => Promise<void>;
  isProcessing: boolean;
}) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: "Hi! I'm your AI Director for VFX and CGI. Select a clip in the timeline, then tell me what effect you want — explosions, cyberpunk, Marvel colors, weather, slow motion, and more. I'll process the actual video."
    },
  ]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"chat" | "vfx" | "cgi">("vfx");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isProcessing]);

  async function send(prompt: string) {
    if (!prompt.trim() || isProcessing) return;
    if (disabled || !selectedClip) {
      toast.error("Select a video clip in the timeline first");
      return;
    }

    setMessages((m) => [...m, { role: "user", content: prompt }]);
    setInput("");

    // Match prompt to VFX preset
    const preset = matchVfxPreset(prompt);

    if (preset) {
      setMessages((m) => [...m, {
        role: "assistant",
        content: `Perfect! I'll apply "${preset.name}" — ${preset.description}. This may take a moment to process...`
      }]);

      const job = presetToJob(preset, selectedClip.url, selectedClip.start, selectedClip.duration);
      try {
        await onApplyVfx(job, preset.name);
        setMessages((m) => [...m, {
          role: "assistant",
          content: `Done! I've applied ${preset.name} to "${selectedClip.name}". The edited clip is now in your timeline. Want to try another effect?`,
          vfxApplied: true
        }]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "VFX processing failed";
        toast.error(msg);
        setMessages((m) => [...m, { role: "assistant", content: `Error: ${msg}` }]);
      }
    } else {
      // Fallback: show preset suggestions
      setMessages((m) => [...m, {
        role: "assistant",
        content: `I couldn't match that to a known effect. Try one of these:\n${AI_VFX_PRESETS.slice(0, 6).map(p => `• ${p.name}: ${p.description}`).join('\n')}`
      }]);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-studio-border">
        <div className="flex items-center gap-2 mb-2">
          <div className="size-6 rounded-md bg-gradient-to-br from-orange-500 to-pink-600 grid place-items-center">
            <Sparkles className="size-3.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold">AI VFX Director</div>
            <div className="text-[10px] text-studio-muted truncate">
              {selectedClip ? `Clip: ${selectedClip.name}` : "Select a video clip to begin"}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1 p-1 bg-studio-surface rounded-lg">
          {MODES.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id as any)}
                className={cn(
                  "py-1 text-[9px] flex flex-col items-center gap-0.5 rounded transition-colors",
                  mode === m.id ? "bg-zinc-800 text-foreground" : "text-studio-muted hover:text-foreground"
                )}
              >
                <Icon className="size-3" />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              m.role === "user"
                ? "ml-6 px-3 py-2 rounded-lg bg-gradient-to-r from-orange-500/20 to-pink-500/20 text-xs border border-orange-500/30"
                : "mr-6 px-3 py-2 rounded-lg bg-studio-surface border border-studio-border text-xs",
              m.vfxApplied && "ring-2 ring-emerald-500/50 bg-emerald-500/10"
            )}
          >
            {m.content}
          </div>
        ))}
        {isProcessing && (
          <div className="mr-6 px-3 py-2 rounded-lg bg-studio-surface border border-studio-border text-xs flex items-center gap-2 text-studio-muted">
            <Loader2 className="size-3 animate-spin" />
            Processing VFX — this may take 10-30 seconds...
          </div>
        )}
      </div>

      <div className="px-3 pt-2 pb-1 border-t border-studio-border space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-studio-muted">Quick VFX</div>
        <div className="flex flex-wrap gap-1">
          {QUICK_VFX.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={isProcessing || !selectedClip}
              className="text-[9px] px-2 py-1 rounded-full bg-gradient-to-r from-orange-500/10 to-pink-500/10 border border-orange-500/20 hover:border-orange-500/40 transition-colors text-studio-muted hover:text-foreground disabled:opacity-50"
            >
              <Wand2 className="size-2 inline mr-1" />
              {s}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe the VFX you want..."
            className="h-8 text-xs"
            disabled={isProcessing}
          />
          <Button type="submit" size="sm" disabled={isProcessing || !input.trim() || !selectedClip}
            className="bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-600 hover:to-pink-700 text-white shrink-0">
            {isProcessing ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          </Button>
        </form>
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";
