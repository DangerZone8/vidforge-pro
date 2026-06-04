import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-safe";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader as Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Sign in — CreatorCut" }] }),
});

function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [emailError, setEmailError] = useState("");

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  function validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailError("");

    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          // Auto-confirm is enabled, but if no session came back, sign in directly
          const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
          if (signInErr) throw signInErr;
        }
        toast.success("Account created — welcome!");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.session) {
          toast.success("Welcome back!");
        } else {
          toast.error("Session not established. Please try again.");
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Authentication failed";
      toast.error(errorMessage);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-studio-bg text-foreground grid lg:grid-cols-2">
      <div className="hidden lg:flex relative overflow-hidden border-r border-studio-border">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,oklch(0.35_0.18_295/.4),transparent_55%),radial-gradient(circle_at_80%_70%,oklch(0.4_0.15_240/.3),transparent_50%)]" />
        <div className="relative z-10 p-12 flex flex-col justify-between w-full">
          <Link to="/" className="flex items-center gap-2">
            <div className="size-9 rounded-xl bg-studio-accent grid place-items-center font-bold">C</div>
            <span className="font-semibold tracking-tight">CreatorCut</span>
          </Link>
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight text-balance">
              Record, edit, and ship video — all in your browser.
            </h1>
            <p className="text-muted-foreground max-w-md">
              A modern studio for creators. Capture webcam and screen, edit on a real timeline, and export to MP4.
            </p>
          </div>
          <div className="text-xs text-muted-foreground">&copy; CreatorCut Studio</div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {mode === "signin" ? "Sign in to continue to your studio." : "Start your free creator account."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                placeholder="you@studio.com"
                className={emailError ? "border-red-500" : ""}
                disabled={busy}
              />
              {emailError && <p className="text-xs text-red-500">{emailError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={busy}
              />
              {mode === "signup" && <p className="text-xs text-muted-foreground">Minimum 6 characters</p>}
            </div>
            <Button type="submit" disabled={busy} className="w-full h-10">
              {busy && <Loader2 className="size-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {mode === "signin" ? "New to CreatorCut?" : "Already have an account?"}{" "}
            <button
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              disabled={busy}
              className="text-foreground hover:text-studio-accent underline-offset-4 hover:underline disabled:opacity-50"
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
