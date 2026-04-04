import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Single browser client instance to avoid "Multiple GoTrueClient instances" warning
// and possible hydration/state issues. Use this in client components.
// createBrowserClient (@supabase/ssr) uses cookie storage, not localStorage, so auth
// works in mobile Safari and other contexts where localStorage is restricted.
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createSupabaseBrowserClient() {
  if (browserClient) return browserClient;
  if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
    const msg =
      "[goshed] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY — add them to .env.local and restart dev.";
    if (typeof window !== "undefined") console.error(msg);
    throw new Error(msg);
  }
  browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return browserClient;
}