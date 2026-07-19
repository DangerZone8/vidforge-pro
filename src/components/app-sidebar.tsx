import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutGrid, Video, Sparkles, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const items = [
  { to: "/dashboard", icon: LayoutGrid, label: "Projects" },
  { to: "/record", icon: Video, label: "Record" },
  { to: "/trends", icon: Sparkles, label: "Trends" },
] as const;

export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { signOut, user } = useAuth();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-16 border-r border-studio-border flex flex-col items-center py-5 gap-6 bg-studio-bg z-40">
      <Link to="/dashboard" className="size-10 bg-studio-accent rounded-xl grid place-items-center font-bold text-lg text-white shadow-lg shadow-studio-accent/30">
        C
      </Link>
      <nav className="flex flex-col gap-2">
        {items.map((it) => {
          const active = path.startsWith(it.to);
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              title={it.label}
              className={cn(
                "size-10 rounded-lg grid place-items-center transition-colors",
                active ? "bg-white/10 text-foreground" : "text-studio-muted hover:text-foreground hover:bg-white/5"
              )}
            >
              <Icon className="size-4" />
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col items-center gap-3">
        <button
          onClick={signOut}
          title="Sign out"
          className="size-10 rounded-lg grid place-items-center text-studio-muted hover:text-foreground hover:bg-white/5"
        >
          <LogOut className="size-4" />
        </button>
        <div className="size-9 rounded-full bg-studio-surface border border-studio-border grid place-items-center text-xs font-semibold uppercase">
          {(user?.email ?? "?").charAt(0)}
        </div>
      </div>
    </aside>
  );
}
