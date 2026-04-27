"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

/** Shape returned by GET /api/auth/session (subset used in the client). */
export type AuthSessionUser = {
  id: string;
  email?: string | null;
  [key: string]: unknown;
};

export type AuthSessionSnapshot = {
  user: AuthSessionUser | null;
  itemCount: number | null;
  /** True when RevenueCat reports an active GoShed Pro entitlement. */
  isPro: boolean;
  /** public.users.code — short beta / access code when set */
  code: string | null;
  /** public.users.welcome_sent — false until password onboarding completed or skipped */
  welcomeSent: boolean;
};

type AuthSessionContextValue = AuthSessionSnapshot & {
  /** True until the first session fetch finishes. */
  loading: boolean;
  /** Refetch session + profile; returns latest snapshot. */
  refresh: () => Promise<AuthSessionSnapshot>;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

function parseSessionJson(data: Record<string, unknown>): AuthSessionSnapshot {
  const user = (data.user as AuthSessionUser | null | undefined) ?? null;
  const itemCount =
    typeof data.itemCount === "number" && Number.isFinite(data.itemCount) ? data.itemCount : null;
  const isPro = data.isPro === true;
  const rawCode = data.code;
  const code =
    rawCode === undefined || rawCode === null
      ? null
      : typeof rawCode === "string"
        ? rawCode
        : String(rawCode);
  const welcomeSent =
    user === null ? true : data.welcomeSent === false ? false : true;
  return { user, itemCount, isPro, code, welcomeSent };
}

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthSessionUser | null>(null);
  const [itemCount, setItemCount] = useState<number | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [welcomeSent, setWelcomeSent] = useState(true);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (): Promise<AuthSessionSnapshot> => {
    const res = await fetch("/api/auth/session", { credentials: "include", cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    const data = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
    const snap = parseSessionJson(data);
    setUser(snap.user);
    setItemCount(snap.itemCount);
    setIsPro(snap.isPro);
    setCode(snap.code);
    setWelcomeSent(snap.welcomeSent);
    return snap;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | undefined;
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = supabase.auth.onAuthStateChange(() => {
        void refresh();
      });
      subscription = data.subscription;
    } catch (e) {
      console.error("[AuthSessionProvider] Supabase client init failed — auth listeners disabled", e);
    }
    return () => subscription?.unsubscribe();
  }, [refresh]);

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      user,
      itemCount,
      isPro,
      code,
      welcomeSent,
      loading,
      refresh,
    }),
    [user, itemCount, isPro, code, welcomeSent, loading, refresh]
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession(): AuthSessionContextValue {
  const ctx = useContext(AuthSessionContext);
  if (!ctx) {
    throw new Error("useAuthSession must be used within AuthSessionProvider");
  }
  return ctx;
}
