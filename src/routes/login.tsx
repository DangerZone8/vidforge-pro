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

  function validateEmail(v: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
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
        await handleSignUp();
      } else {
        await handleSignIn();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp() {
    // Step 1: Try to create the account
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: undefined },
    });

    // Step 2: Handle Supabase's silent-duplicate behavior.
    // When email confirmation is ON and the email already exists, Supabase returns
    // success with an empty identities array instead of an error.
    const isSilentDuplicate =
      !signUpError &&
      signUpData.user &&
      Array.isArray(signUpData.user.identities) &&
      signUpData.user.identities.length === 0;

    if (isSilentDuplicate) {
      // Account already exists — sign them in directly
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        // Likely wrong password for an existing account
        if (isInvalidCredentials(signInError.message)) {
          toast.error("This email is already registered. Check your password and try signing in instead.");
        } else {
          toast.error(signInError.message);
        }
        return;
      }
      if (signInData.session) {
        toast.success("Welcome back!");
      }
      return;
    }

    // Step 3: Handle real signup errors
    if (signUpError) {
      if (isAlreadyExists(signUpError.message)) {
        toast.error("This email is already registered. Please sign in instead.");
      } else {
        toast.error(signUpError.message || "Sign up failed. Please try again.");
      }
      return;
    }

    // Step 4: Account created — get a session immediately (auto-confirm path)
    if (signUpData.session) {
      toast.success("Account created — welcome!");
      return;
    }

    // Step 5: No session yet (email confirmation required by Supabase config).
    // Try signing in directly — this works if auto-confirm is enabled in Supabase
    // but the session wasn't returned inline.
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (!signInError && signInData.session) {
      toast.success("Account created — welcome!");
      return;
    }

    // Step 6: Email confirmation is genuinely required
    toast.error("Account created, but your Supabase project requires email confirmation. Disable it in Authentication > Settings.");
  }

  async function handleSignIn() {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (isInvalidCredentials(error.message)) {
        toast.error("Incorrect email or password. Please try again.");
      } else if (error.message.toLowerCase().includes("email not confirmed")) {
        toast.error("Your email is not confirmed. Contact support or use a different account.");
      } else {
        toast.error(error.message || "Sign in failed. Please try again.");
      }
      return;
    }

    if (data.session) {
      toast.success("Welcome back!");
    } else {
      toast.error("Session could not be established. Please try again.");
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

function isInvalidCredentials(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("invalid login credentials") || m.includes("invalid_credentials") || m.includes("wrong password");
}

function isAlreadyExists(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("already registered") || m.includes("already exists") || m.includes("user already");
}
