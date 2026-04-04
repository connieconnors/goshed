import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/** Allow only same-origin paths (no open redirect). */
function safeRedirectPath(next: string | null): string {
  if (!next || typeof next !== "string") return "/";
  const path = next.startsWith("/") ? next : `/${next}`;
  if (path.startsWith("//") || path.includes("\\")) return "/";
  return path;
}

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { searchParams } = url;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  /**
   * Always redirect to the same origin that received this request. Using NEXT_PUBLIC_APP_URL
   * here breaks local magic links when env points at production (blink / wrong host / no session cookie on localhost).
   */
  const origin = url.origin;
  const envAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envAppUrl && envAppUrl !== origin) {
    console.warn(
      "[auth/callback] NEXT_PUBLIC_APP_URL differs from request origin — using request origin for redirect:",
      { requestOrigin: origin, NEXT_PUBLIC_APP_URL: envAppUrl }
    );
  }

  console.log("[auth/callback] hit", {
    pathname: url.pathname,
    hasCode: !!code,
    codeLength: code?.length ?? 0,
    nextParam,
    origin,
    userAgent: request.headers.get("user-agent")?.slice(0, 80) ?? null,
  });

  if (!code) {
    const path = safeRedirectPath(nextParam);
    const fallbackTarget = `${origin}${path}`;
    console.log("[auth/callback] no ?code= — redirecting (expired link or direct visit)", fallbackTarget);
    return NextResponse.redirect(fallbackTarget);
  }

  const cookieStore = await cookies();
  const cookiesToSet: CookieToSet[] = [];
  const isProduction = process.env.NODE_ENV === "production";

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesFromSupabase) {
          console.log(
            "[auth/callback] Supabase setAll (session cookies queued for redirect response)",
            cookiesFromSupabase.length,
            cookiesFromSupabase.map((c) => c.name)
          );
          cookiesFromSupabase.forEach(({ name, value, options }) => {
            cookiesToSet.push({
              name,
              value,
              options: {
                path: "/",
                ...options,
                ...(isProduction && { secure: true, sameSite: "lax" as const }),
              },
            });
          });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth/callback] exchangeCodeForSession failed:", error.message, error);
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const user = data.user;
  const session = data.session;
  console.log("[auth/callback] exchangeCodeForSession ok — session established for redirect", {
    userId: user?.id ?? null,
    email: user?.email ?? null,
    hasSession: !!session,
    accessTokenLen: session?.access_token?.length ?? 0,
    refreshTokenLen: session?.refresh_token?.length ?? 0,
    expiresAt: session?.expires_at ?? null,
  });

  if (cookiesToSet.length === 0) {
    console.warn(
      "[auth/callback] WARNING: no auth cookies were queued after exchange — browser may not stay signed in. Check @supabase/ssr cookie setAll wiring."
    );
  }

  if (user?.id) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (serviceRoleKey) {
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey,
        { auth: { persistSession: false } }
      );
      const { data: existing, error: selectErr } = await admin
        .from("users")
        .select("id, welcome_sent")
        .eq("id", user.id)
        .maybeSingle();
      if (selectErr) {
        console.error("[auth/callback] public.users select failed:", selectErr.message);
      } else {
        console.log("[auth/callback] public.users (welcome_sent for PasswordOnboardingGate / session API)", {
          rowExists: !!existing,
          welcome_sent: existing?.welcome_sent ?? null,
          note: "welcome_sent false → client shows password onboarding modal after / loads",
        });
      }
      if (!existing) {
        const { error: insertErr } = await admin.from("users").insert({
          id: user.id,
          email: user.email ?? null,
          welcome_sent: false,
        });
        if (insertErr) {
          console.error("[auth/callback] public.users insert failed:", insertErr.message);
        } else {
          console.log("[auth/callback] inserted public.users row welcome_sent=false for", user.id);
        }
      }
    } else {
      console.warn(
        "[auth/callback] SUPABASE_SERVICE_ROLE_KEY missing — skipped public.users select/insert (trigger may still create row; welcome_sent not logged here)"
      );
    }
  }

  const path = safeRedirectPath(nextParam);
  const target = `${origin}${path}`;
  const sep = target.includes("?") ? "&" : "?";
  const finalUrl = `${target}${sep}signed_in=1`;

  console.log("[auth/callback] issuing 302 redirect (PasswordOnboardingGate runs only on client after HTML loads; it does not run in this route)", {
    finalUrl,
    cookiesToAttach: cookiesToSet.length,
    cookieNames: cookiesToSet.map((c) => c.name),
  });

  const redirectResponse = NextResponse.redirect(finalUrl);
  cookiesToSet.forEach(({ name, value, options }) => {
    redirectResponse.cookies.set(name, value, options as Parameters<NextResponse["cookies"]["set"]>[2]);
  });
  console.log("[auth/callback] done — response is redirect + Set-Cookie headers");
  return redirectResponse;
}
