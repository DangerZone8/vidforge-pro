import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading, refreshAuth } = useAuth();
  const navigate = useNavigate();
  const redirectAttempted = useRef(false);

  useEffect(() => {
    // Wait until auth is done loading before deciding whether to redirect
    if (loading) return;
    if (user) return;
    if (redirectAttempted.current) return;

    // If we're on an auth callback route, don't redirect — let the callback handle it
    const path = window.location.pathname;
    if (path === "/auth/callback") return;

    redirectAttempted.current = true;

    let cancelled = false;

    async function verifyBeforeRedirect() {
      // Give the session a few attempts to establish (covers OAuth callback race)
      let restoredSession = await refreshAuth();

      for (let i = 0; !restoredSession && i < 6; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        restoredSession = await refreshAuth();
      }

      if (cancelled) return;

      if (!restoredSession) {
        navigate({ to: "/login", replace: true });
      }
    }

    verifyBeforeRedirect();

    return () => {
      cancelled = true;
    };
  }, [loading, navigate, refreshAuth, user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="size-8 rounded-lg bg-studio-accent animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-studio-bg text-foreground">
      <Outlet />
    </div>
  );
}
