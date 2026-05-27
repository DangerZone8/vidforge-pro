import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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

  // Validate email format
  function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailError("");
    
    // Validate email before submission
    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    // Validate password length
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        // Check if email already exists
        const { data: existingUser } = await supabase.auth.admin?.listUsers() ?? { data: null };
        if (existingUser?.users?.some(u => u.email === email)) {
          toast.error("Email already registered. Please sign in instead.");
          setBusy(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created! Check your email to confirm your account.");
        // Reset form after successful signup
        setEmail("");
        setPassword("");
        setMode("signin");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        // Verify session was created
        if (data.session) {
          toast.success("Welcome back!");
          // Navigation happens automatically via useEffect when user is set
        } else {
          toast.error("Sign in successful but session not established. Please try again.");
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Authentication failed";
      toast.error(errorMessage);
      console.error("[auth] error:", err);
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message || "Google sign-in failed");
        setBusy(false);
      }
    } catch (err) {
      toast.error("Google sign-in error. Please try again.");
      console.error("[google auth] error:", err);
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
          <div className="text-xs text-muted-foreground">© CreatorCut Studio</div>
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

          <Button variant="outline" onClick={handleGoogle} disabled={busy} className="w-full h-10">
            <GoogleIcon className="size-4" /> Continue with Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-studio-border" /></div>
            <div className="relative flex justify-center"><span className="bg-studio-bg px-2 text-[11px] uppercase tracking-widest text-muted-foreground">or email</span></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                required 
                value={email} 
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError("");
                }} 
                placeholder="you@studio.com"
                className={emailError ? "border-red-500" : ""}
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
            <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="text-foreground hover:text-studio-accent underline-offset-4 hover:underline">
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.3 0-6-2.74-6-6.1s2.7-6.1 6-6.1c1.88 0 3.14.8 3.86 1.5l2.64-2.54C16.93 3.42 14.7 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.1-3.85 9.1-9.3 0-.6-.05-1.08-.15-1.55H12" />
    </svg>
  );
}
