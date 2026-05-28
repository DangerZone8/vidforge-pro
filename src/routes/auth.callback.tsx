import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
  head: () => ({ meta: [{ title: "Signing in… — CreatorCut" }] }),
});

function AuthCallback() {
  const navigate = useNavigate();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    async function handle() {
      try {
        const url = new URL(window.location.href);
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
        const code = url.searchParams.get("code");
        const accessToken = url.searchParams.get("access_token") || hashParams.get("access_token");
        const refreshToken = url.searchParams.get("refresh_token") || hashParams.get("refresh_token");
        const errorParam = url.searchParams.get("error_description") || hashParams.get("error_description") || url.searchParams.get("error");

        if (errorParam) {
          throw new Error(decodeURIComponent(errorParam));
        }

        // 1. PKCE code exchange (Supabase default for OAuth)
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (error) throw error;
        }
        // 2. Explicit token set (implicit flow or Lovable Cloud tokens)
        else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        }
        // 3. Hash fragment tokens — supabase-js auto-detects with detectSessionInUrl: true
        // We just need to wait for the session to be established

        // Wait for session to be available (with retries)
        let session = null;
        for (let i = 0; i < 10; i++) {
          const { data } = await supabase.auth.getSession();
          session = data.session;
          if (session) break;
          await new Promise((r) => setTimeout(r, 200));
        }

        if (session) {
          // Clear the URL hash/params to avoid re-processing on refresh
          if (window.location.hash || window.location.search) {
            window.history.replaceState(null, "", "/dashboard");
          }
          navigate({ to: "/dashboard", replace: true });
        } else {
          console.error("[auth-callback] No session established after OAuth");
          toast.error("Sign-in failed: Could not establish session");
          navigate({ to: "/login", replace: true });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Sign-in failed";
        console.error("[auth-callback] error:", msg);
        toast.error(`Sign-in failed: ${msg}`);
        navigate({ to: "/login", replace: true });
      }
    }

    handle();
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
