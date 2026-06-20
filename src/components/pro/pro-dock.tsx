import { useState } from "react";
import { Palette, Headphones, Sparkles, Diamond, X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ColorGradingPanel } from "./color-grading-panel";
import { AudioMixerPanel } from "./audio-mixer-panel";
import { AiSuperpowersPanel } from "./ai-superpowers-panel";
import { MotionCompositingPanel } from "./motion-compositing-panel";

type DockTool = "color" | "mixer" | "ai" | "motion" | null;

const TOOLS = [
  { id: "color" as const, icon: Palette, label: "Color", color: "from-orange-500 to-pink-500" },
  { id: "mixer" as const, icon: Headphones, label: "Mixer", color: "from-emerald-500 to-teal-500" },
  { id: "ai" as const, icon: Sparkles, label: "AI", color: "from-purple-500 to-pink-500" },
  { id: "motion" as const, icon: Diamond, label: "Motion", color: "from-blue-500 to-cyan-500" },
];

export function ProDock() {
  const [open, setOpen] = useState<DockTool>(null);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Floating launcher rail */}
      <div className={cn(
        "fixed right-3 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-1.5 p-1.5 rounded-2xl bg-studio-bg/95 backdrop-blur border border-studio-border shadow-2xl transition-all",
        collapsed && "translate-x-[calc(100%-28px)]",
      )}>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="size-6 grid place-items-center rounded-lg hover:bg-studio-surface text-studio-muted"
          title={collapsed ? "Show pro tools" : "Hide"}
        >
          <ChevronRight className={cn("size-3.5 transition-transform", !collapsed && "rotate-180")} />
        </button>
        {TOOLS.map((t) => {
          const Icon = t.icon;
          const active = open === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setOpen(active ? null : t.id)}
              className={cn(
                "group relative size-10 grid place-items-center rounded-xl transition-all",
                active
                  ? `bg-gradient-to-br ${t.color} shadow-lg scale-105`
                  : "bg-studio-surface hover:bg-studio-bg border border-studio-border",
              )}
              title={t.label}
            >
              <Icon className={cn("size-4", active ? "text-white" : "text-studio-muted group-hover:text-foreground")} />
              <span className="absolute right-full mr-2 px-2 py-0.5 rounded bg-black/90 text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition">
                {t.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Slide-in panel */}
      {open && !collapsed && (
        <div className="fixed right-16 top-4 bottom-4 w-[340px] z-40 rounded-2xl bg-studio-bg border border-studio-border shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-right-4 duration-200">
          <button
            onClick={() => setOpen(null)}
            className="absolute top-2 right-2 z-10 size-6 grid place-items-center rounded-lg hover:bg-studio-surface text-studio-muted"
          >
            <X className="size-3.5" />
          </button>
          {open === "color" && <ColorGradingPanel />}
          {open === "mixer" && <AudioMixerPanel />}
          {open === "ai" && <AiSuperpowersPanel />}
          {open === "motion" && <MotionCompositingPanel />}
        </div>
      )}
    </>
  );
}
