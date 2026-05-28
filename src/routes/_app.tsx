import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppSidebar } from "@/components/app-sidebar";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading, refreshAuth } = useAuth();
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(false);

  useEffect(() => {
    if (loading || user || checkingSession) return;

    let cancelled = false;
    setCheckingSession(true);

    async function verifyBeforeRedirect() {
      let restoredSession = await refreshAuth();

      for (let i = 0; !restoredSession && i < 4; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        restoredSession = await refreshAuth();
      }

      if (cancelled) return;
      setCheckingSession(false);

      if (!restoredSession) {
        navigate({ to: "/login", replace: true });
      }
    }

    verifyBeforeRedirect();

    return () => {
      cancelled = true;
    };
  }, [checkingSession, loading, navigate, refreshAuth, user]);

  if (loading || checkingSession || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="size-8 rounded-lg bg-studio-accent animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-studio-bg text-foreground">
      <AppSidebar />
      <div className="flex-1 pl-16 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
