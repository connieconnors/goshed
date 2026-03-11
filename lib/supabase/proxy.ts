import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session on each request and writes updated
 * cookies to both the request (for downstream server code) and the response
 * (for the browser). Required for cookie-based sessions to persist in
 * production (e.g. goshed.app).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          const isProduction = process.env.NODE_ENV === "production";
          cookiesToSet.forEach(({ name, value, options }) => {
            const opts = {
              path: "/",
              ...options,
              ...(isProduction && { secure: true, sameSite: "lax" as const }),
            };
            request.cookies.set(name, value, opts as object);
            response.cookies.set(name, value, opts as object);
          });
        },
      },
    }
  );

  // Refresh session so expired tokens are renewed; updated tokens are written
  // to request and response cookies via setAll above. Use getSession() to trigger
  // refresh (getClaims() is preferred in newer @supabase/ssr but getSession works).
  try {
    await supabase.auth.getSession();
  } catch {
    // Ignore auth errors (e.g. no session); still return response with existing cookies
  }

  return response;
}
