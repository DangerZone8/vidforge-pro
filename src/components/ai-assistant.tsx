import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Send, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { runAiEdit, type AiEditResult } from "@/lib/ai-edit.functions";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Add explosion VFX with fire and smoke",
  "Apply cyberpunk color grading and neon glow",
  "Make this scene look like a Marvel movie",
  "Add raining effect with thunder sound",
  "Vintage film noir look",
  "Magical sparkles and dreamy glow",
];

export function AiAssistant({
  selectedClipName,
  disabled,
  onApply,
}: {
  selectedClipName: string | null;
  disabled: boolean;
  onApply: (r: AiEditResult) => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi! Select a clip, then describe the look you want — I'll apply VFX, color grading, and effects." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const callAi = useServerFn(runAiEdit);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(prompt: string) {
    if (!prompt.trim() || loading) return;
    if (disabled) {
      toast.error("Select a clip in the timeline first");
      return;
    }
    setMessages((m) => [...m, { role: "user", content: prompt }]);
    setInput("");
    setLoading(true);
    try {
      const result = await callAi({ data: { prompt, clipName: selectedClipName ?? undefined } });
      onApply(result);
      setMessages((m) => [...m, { role: "assistant", content: result.message }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "AI request failed";
      toast.error(msg);
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-studio-border flex items-center gap-2">
        <div className="size-6 rounded-md bg-studio-accent/20 grid place-items-center">
          <Sparkles className="size-3.5 text-studio-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold">AI Director</div>
          <div className="text-[10px] text-studio-muted truncate">
            {selectedClipName ? `Editing: ${selectedClipName}` : "Select a clip to start"}
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "ml-6 px-3 py-2 rounded-lg bg-studio-accent/20 text-xs"
                : "mr-6 px-3 py-2 rounded-lg bg-studio-surface border border-studio-border text-xs"
            }
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="mr-6 px-3 py-2 rounded-lg bg-studio-surface border border-studio-border text-xs flex items-center gap-2 text-studio-muted">
            <Loader2 className="size-3 animate-spin" /> Directing the scene…
          </div>
        )}
      </div>

      <div className="px-3 pt-2 pb-1 border-t border-studio-border space-y-2">
        <div className="flex flex-wrap gap-1">
          {SUGGESTIONS.slice(0, 4).map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={loading}
              className="text-[10px] px-2 py-1 rounded-full bg-studio-surface border border-studio-border hover:border-studio-accent transition-colors text-studio-muted hover:text-foreground"
            >
              <Wand2 className="size-2.5 inline mr-1" />
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
            placeholder="Describe the look…"
            className="h-8 text-xs"
            disabled={loading}
          />
          <Button type="submit" size="sm" disabled={loading || !input.trim()} className="bg-studio-accent hover:bg-studio-accent/90 text-white shrink-0">
            <Send className="size-3.5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
