import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const FALLBACK_SUPABASE_URL = "https://nwjpaiboqflpsfcuxvuo.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53anBhaWJvcWZscHNmY3V4dnVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMDMyNzYsImV4cCI6MjA5NDY3OTI3Nn0.itoQOadS9z-i9Cu9yRc3vO16u1-v624VwbLle-lCjp4";

const env = import.meta.env as Record<string, string | undefined>;

const SUPABASE_URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL || FALLBACK_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.SUPABASE_PUBLISHABLE_KEY ||
  env.VITE_SUPABASE_ANON_KEY ||
  FALLBACK_SUPABASE_PUBLISHABLE_KEY;

let supabaseClient: ReturnType<typeof createClient<Database>> | undefined;

export function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return supabaseClient;
}

export const supabase = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get(_, prop, receiver) {
    return Reflect.get(getSupabaseClient(), prop, receiver);
  },
});