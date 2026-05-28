import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
  head: () => ({ meta: [{ title: "Signing in… — CreatorCut" }] }),
});

function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function handle() {
      try {
        // Handle PKCE / authorization code flow (?code=...)
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const errorDescription =
          url.searchParams.get("error_description") ||
          url.searchParams.get("error");

        if (errorDescription) {
          throw new Error(errorDescription);
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(
            window.location.href
          );
          if (error) throw error;
        }

        // Implicit flow tokens land in the hash (#access_token=...).
        // supabase-js auto-detects and persists those on load, so we just
        // wait for the session to be available.
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (cancelled) return;

        if (data.session) {
          // Clean the URL so tokens/codes don't linger in history.
          window.history.replaceState({}, "", "/dashboard");
          navigate({ to: "/dashboard", replace: true });
        } else {
          navigate({ to: "/login", replace: true });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Sign-in failed";
        console.error("[auth-callback] error:", msg);
        toast.error(`Sign-in failed: ${msg}`);
        if (!cancelled) navigate({ to: "/login", replace: true });
      }
    }

    handle();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-studio-bg text-foreground">
      <div className="text-center space-y-3">
        <div className="size-8 rounded-lg bg-studio-accent animate-pulse mx-auto" />
        <p className="text-sm text-muted-foreground">Completing sign-in…</p>
      </div>
    </div>
  );
}
