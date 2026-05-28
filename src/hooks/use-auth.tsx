import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  refreshAuth: () => Promise<Session | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshAuth = useCallback(async () => {
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      setSession(data.session ?? null);
      setError(null);
      return data.session ?? null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to get session";
      console.error("[auth] refresh error:", errorMessage);
      setSession(null);
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Listen for auth state changes — the callback runs synchronously,
    // so we avoid async operations inside it to prevent deadlocks.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log("[auth] state changed:", event, newSession ? "has session" : "no session");
        setSession(newSession);
        setLoading(false);
        setError(null);

        if (event === "SIGNED_IN" && !newSession) {
          setError("Sign in failed: No session established");
        } else if (event === "TOKEN_REFRESHED" && !newSession) {
          setError("Session lost. Please sign in again.");
        }
      }
    );

    // Initialize by checking existing session
    refreshAuth();

    // Safety net: never let the app stay stuck on the loading screen
    const safety = setTimeout(() => {
      setLoading(false);
    }, 5000);

    return () => {
      subscription?.unsubscribe();
      clearTimeout(safety);
    };
  }, [refreshAuth]);

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    loading,
    error,
    refreshAuth,
    signOut: async () => {
      try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        setSession(null);
        setError(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Sign out failed";
        console.error("[auth] signOut error:", errorMessage);
        setError(errorMessage);
        throw err;
      }
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
