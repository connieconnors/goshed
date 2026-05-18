import { NextResponse } from "next/server";

const PASSWORD_RESET_FLOW_COOKIE = "goshed_password_reset_flow";
const PASSWORD_RESET_FLOW_MAX_AGE_SECONDS = 10 * 60;

export function POST(request: Request) {
  const url = new URL(request.url);
  const response = NextResponse.json({ ok: true });
  const cookieOptions = {
    path: "/",
    maxAge: PASSWORD_RESET_FLOW_MAX_AGE_SECONDS,
    sameSite: "lax" as const,
    secure: url.protocol === "https:" || process.env.NODE_ENV === "production",
  };

  response.cookies.set(PASSWORD_RESET_FLOW_COOKIE, "1", {
    ...cookieOptions,
    ...(url.hostname.endsWith("goshed.app") ? { domain: ".goshed.app" } : {}),
  });

  console.log("[api/auth/password-reset-flow] set reset intent cookie", {
    host: url.host,
    domain: url.hostname.endsWith("goshed.app") ? ".goshed.app" : null,
    maxAge: PASSWORD_RESET_FLOW_MAX_AGE_SECONDS,
  });

  return response;
}
