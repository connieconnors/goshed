"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

const PASSWORD_RESET_FLOW_COOKIE = "goshed_password_reset_flow";

function clearPasswordResetFlowCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${PASSWORD_RESET_FLOW_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  if (window.location.hostname.endsWith("goshed.app")) {
    document.cookie = `${PASSWORD_RESET_FLOW_COOKIE}=; Max-Age=0; Path=/; Domain=.goshed.app; SameSite=Lax; Secure`;
  }
}

function recoveryErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return "Could not establish a password recovery session.";
}

function firstParam(name: string, searchParams: URLSearchParams, hashParams: URLSearchParams): string | null {
  return searchParams.get(name) ?? hashParams.get(name);
}

export default function RecoveryPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const establishRecoverySession = async () => {
      clearPasswordResetFlowCookie();
      try {
        const supabase = createSupabaseBrowserClient();
        const url = new URL(window.location.href);
        const searchParams = url.searchParams;
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const accessToken = firstParam("access_token", searchParams, hashParams);
        const refreshToken = firstParam("refresh_token", searchParams, hashParams);
        const tokenHash = firstParam("token_hash", searchParams, hashParams);

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
        } else if (tokenHash) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          });
          if (verifyError) throw verifyError;
        } else {
          throw new Error(
            "This reset link does not contain recovery credentials. Please request a new password reset link."
          );
        }

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!userData.user) throw new Error("No recovery user was found. Please request a new password reset link.");

        if (!cancelled) {
          router.replace("/reset-password");
          router.refresh();
        }
      } catch (recoveryError) {
        console.error("[auth/recovery] failed to establish recovery session:", recoveryError);
        if (!cancelled) setError(recoveryErrorMessage(recoveryError));
      }
    };

    void establishRecoverySession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div
      style={{
        padding: 40,
        maxWidth: 400,
        margin: "0 auto",
        fontFamily: "inherit",
        color: "var(--ink)",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 26,
          fontWeight: 600,
          margin: "0 0 8px",
          color: "var(--ink)",
        }}
      >
        Preparing password reset
      </h2>
      {error ? (
        <>
          <p style={{ color: "#b42318", fontSize: 14, marginBottom: 12, lineHeight: 1.45 }}>{error}</p>
          <Link href="/login" style={{ fontSize: 14, color: "var(--ink-soft)", textDecoration: "underline" }}>
            Back to sign in
          </Link>
        </>
      ) : (
        <p style={{ color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.45 }}>
          Checking your reset link…
        </p>
      )}
    </div>
  );
}
