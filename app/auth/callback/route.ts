import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/** Allow only same-origin paths (no open redirect). */
function safeRedirectPath(next: string | null): string {
  if (!next || typeof next !== "string") return "/";
  const path = next.startsWith("/") ? next : `/${next}`;
  if (path.startsWith("//") || path.includes("\\")) return "/";
  return path;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { searchParams } = url;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || url.origin;

  const hasCode = code != null && code !== "";
  console.error("[auth/callback] URL code param present:", hasCode, {
    hasCode,
    codeLength: code?.length ?? 0,
    allParams: Object.fromEntries(searchParams.entries()),
  });

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            const isProduction = process.env.NODE_ENV === "production";
            cookiesToSet.forEach(({ name, value, options }) => {
              const opts = {
                path: "/",
                ...options,
                ...(isProduction && { secure: true, sameSite: "lax" as const }),
              };
              cookieStore.set(name, value, opts);
            });
          },
        },
      }
    );
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback] exchangeCodeForSession failed:", {
        message: error.message,
        name: error.name,
        status: error.status,
        fullError: error,
        codePresent: true,
        codeLength: code.length,
      });
      return NextResponse.redirect(`${origin}/login?error=auth`);
    }
  }

  const path = safeRedirectPath(nextParam);
  const sep = path.includes("?") ? "&" : "?";
  return NextResponse.redirect(`${origin}${path}${sep}signed_in=1`);
}
