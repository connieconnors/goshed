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
  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || url.origin;

  if (!code) {
    const path = safeRedirectPath(nextParam);
    return NextResponse.redirect(`${origin}${path}`);
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
    console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const user = data.user;
  let isNewUser = false;
  if (user?.id) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (serviceRoleKey) {
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey,
        { auth: { persistSession: false } }
      );
      const { data: existing } = await admin.from("users").select("id").eq("id", user.id).maybeSingle();
      if (!existing) {
        await admin.from("users").insert({
          id: user.id,
          email: user.email ?? null,
          created_at: new Date().toISOString(),
          welcome_sent: true,
        });
        isNewUser = true;
      }
    }
  }

  const path = safeRedirectPath(nextParam);
  const target = `${origin}${path}`;
  const sep = target.includes("?") ? "&" : "?";
  const query = isNewUser ? `${sep}signed_in=1&new_user=true` : `${sep}signed_in=1`;

  const redirectResponse = NextResponse.redirect(`${target}${query}`);
  cookiesToSet.forEach(({ name, value, options }) => {
    redirectResponse.cookies.set(name, value, options as Parameters<NextResponse["cookies"]["set"]>[2]);
  });
  return redirectResponse;
}
