import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { TRENDS, TREND_CATEGORIES, setPendingTrend, type Trend } from "@/lib/trends";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Sparkles, Video, Wand2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/trends")({
  component: TrendsPage,
  head: () => ({ meta: [{ title: "Trends — CreatorCut" }] }),
});

function TrendsPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Trend | null>(null);
  const [intensity, setIntensity] = useState(80);

  function pickRecord() {
    if (!selected) return;
    setPendingTrend({ trendId: selected.id, intensity });
    navigate({ to: "/record", search: { trend: selected.id, intensity } as never });
  }
  function pickApply() {
    if (!selected) return;
    setPendingTrend({ trendId: selected.id, intensity });
    toast.success(`"${selected.name}" trend queued — open any project to apply it`);
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen">
      <header className="h-14 border-b border-studio-border flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-studio-accent" />
          <h1 className="font-medium">Trends</h1>
        </div>
        <div className="text-xs text-studio-muted">Pick a look — record live or apply to a video</div>
      </header>

      <div className="p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {TRENDS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setSelected(t); setIntensity(80); }}
              className="group relative aspect-[4/5] rounded-2xl overflow-hidden border border-studio-border hover:border-white/30 transition-all text-left"
              style={{ background: t.gradient }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute top-3 right-3 text-2xl drop-shadow-lg">{t.emoji}</div>
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="text-lg font-semibold text-white leading-tight">{t.name}</div>
                <div className="text-xs text-white/70 mt-1">{t.tagline}</div>
                <div
                  className="mt-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium bg-white/15 backdrop-blur text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Sparkles className="size-3" /> Try trend
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="text-2xl">{selected.emoji}</span>
                  {selected.name}
                </DialogTitle>
                <DialogDescription>{selected.tagline}</DialogDescription>
              </DialogHeader>

              <div
                className="h-32 rounded-xl border border-studio-border"
                style={{ background: selected.gradient }}
              />

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-studio-muted">Intensity</span>
                  <span className="font-mono">{intensity}%</span>
                </div>
                <Slider value={[intensity]} onValueChange={(v) => setIntensity(v[0])} min={20} max={100} step={5} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  onClick={pickRecord}
                  className={cn(
                    "p-4 rounded-xl border border-studio-border hover:border-white/40 text-left transition-colors bg-studio-surface",
                  )}
                >
                  <div className="flex items-center gap-2 font-medium"><Video className="size-4" /> Record Live</div>
                  <div className="text-xs text-studio-muted mt-1">Open the recorder with this trend already active.</div>
                </button>
                <button
                  onClick={pickApply}
                  className="p-4 rounded-xl border border-studio-border hover:border-white/40 text-left transition-colors bg-studio-surface"
                >
                  <div className="flex items-center gap-2 font-medium"><Wand2 className="size-4" /> Apply to Existing</div>
                  <div className="text-xs text-studio-muted mt-1">Pick a project — we'll AI-process your clip into the trend.</div>
                </button>
              </div>

              <button
                onClick={() => setSelected(null)}
                className="absolute top-3 right-3 size-7 grid place-items-center rounded-lg hover:bg-studio-surface text-studio-muted"
              >
                <X className="size-4" />
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
