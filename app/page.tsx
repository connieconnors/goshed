'use client';

import { useRef, useState, useEffect, useCallback, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthSession } from '@/lib/auth-session-context';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import { getRandomActionPrompt, type ActionPromptType } from '@/lib/actionPrompts';
import { PaywallModal } from '@/app/components/PaywallModal';
import { ShedSignupModal } from '@/app/components/ShedSignupModal';
import { SentimentalNudge } from '@/components/SentimentalNudge';
import {
  fetchConsignmentPlacesClient,
  type ConsignmentPlaceRow,
} from '@/lib/fetchConsignmentPlacesClient';
import { MOMENT_COPY } from '@/lib/momentCopy';
import {
  FREE_LOGGED_IN_ITEM_LIMIT,
  GUEST_ANALYSIS_LIMIT,
} from '@/lib/freeTier';
import {
  guestGateDismissedInStorage,
  markGuestGateDismissed,
} from '@/lib/guestGateStorage';

type AnalyzeResult = {
  item_label: string;
  value_range: string;
  shippable: boolean;
  description: string;
};

type RecommendResult = {
  recommendation: 'gift' | 'donate' | 'sell' | 'keep' | 'trash' | 'curb' | 'repurpose';
  reason: string;
  next_step: string;
};


const ICON_GIFT = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="8" width="18" height="14" rx="2"/><path d="M12 8v14M3 13h18"/><path d="M8 8c0-2.2 1.8-4 4-4s4 1.8 4 4"/></svg>;
const ICON_DONATE = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>;
const ICON_SELL = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>;
const ICON_CURB = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>;
const ICON_REPURPOSE = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>;
const ICON_KEEP = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>;
const ICON_TRASH = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;
const ICON_RECYCLE = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 16l-3-4 3-4"/><path d="M17 16l3-4-3-4"/><path d="M4 12h16"/><path d="M12 3v18"/></svg>;

type ActionOptionId = RecommendResult['recommendation'] | 'recycle';

const ACTION_OPTIONS: { id: RecommendResult['recommendation']; label: string; icon: React.ReactNode }[] = [
  { id: 'gift', label: 'Gift', icon: ICON_GIFT },
  { id: 'donate', label: 'Donate', icon: ICON_DONATE },
  { id: 'sell', label: 'Sell', icon: ICON_SELL },
  { id: 'curb', label: 'Curb it', icon: ICON_CURB },
  { id: 'repurpose', label: 'Repurpose', icon: ICON_REPURPOSE },
  { id: 'keep', label: 'Keep', icon: ICON_KEEP },
  { id: 'trash', label: 'Trash', icon: ICON_TRASH },
];

const ALL_DISPLAY_OPTIONS: { id: ActionOptionId; label: string; icon: React.ReactNode }[] = [
  ...ACTION_OPTIONS,
  { id: 'recycle', label: 'Recycle', icon: ICON_RECYCLE },
];

/** Order and subset for "Other options" chips: no Trash. */
const OTHER_OPTIONS_ORDER: RecommendResult['recommendation'][] = ['sell', 'donate', 'gift', 'keep', 'repurpose', 'curb'];

/** Action phrase for recommendation CTA: "Gift it →", etc. */
const RECOMMENDATION_ACTION_PHRASES: Record<RecommendResult['recommendation'], string> = {
  sell: 'Sell it',
  donate: 'Donate it',
  gift: 'Gift it',
  keep: 'Keep it',
  repurpose: 'Repurpose it',
  curb: 'Curb it',
  trash: 'Trash it',
};

const LOADING_PHRASES = [
  'Looking at what this is',
  'Checking useful possibilities',
  'Finding the best next life',
];

/** Gate for item save: only one POST per key across effect double-invokes (e.g. Strict Mode). Reset when user starts a new item. */
let lastSavedItemKey: string | null = null;
const GUEST_GATE_REMINDER_COUNT = FREE_LOGGED_IN_ITEM_LIMIT - 1;

/** Derive shippable when analysis doesn't provide it: false if fragile, oversized, or full set; else true. */
function deriveShippable(analysis: { item_label?: string; description?: string }): boolean {
  const text = `${analysis.item_label ?? ''} ${analysis.description ?? ''}`.toLowerCase();
  if (/fragile|oversized|full set|set of|bulky|large piece|furniture|mirror|glass|breakable/.test(text)) {
    return false;
  }
  return true;
}

const MAX_IMAGE_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

/** Resize image to reduce payload and avoid body/API limits; returns data URL. */
function resizeAndToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w <= MAX_IMAGE_DIMENSION && h <= MAX_IMAGE_DIMENSION) {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }
      if (w > h) {
        h = Math.round((h * MAX_IMAGE_DIMENSION) / w);
        w = MAX_IMAGE_DIMENSION;
      } else {
        w = Math.round((w * MAX_IMAGE_DIMENSION) / h);
        h = MAX_IMAGE_DIMENSION;
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        resolve(dataUrl);
      } catch {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    };
    img.src = url;
  });
}

/** Return the first sentence of a string (up to and including the first period). */
function firstSentence(text: string): string {
  const trimmed = text.trim();
  const i = trimmed.indexOf('.');
  return i === -1 ? trimmed : trimmed.slice(0, i + 1).trim();
}

/** Decision title for card: Sell, Donate, Gift, Keep, Repurpose, Curb (no "this"). */
function getDecisionTitle(id: RecommendResult['recommendation']): string {
  if (id === 'curb') return 'Curb';
  return ACTION_OPTIONS.find(o => o.id === id)?.label ?? id;
}

function HomeContent() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  /** Same handler as main input; `capture` nudges phones to open the camera (used for “+ Add another item”). */
  const addAnotherCameraInputRef = useRef<HTMLInputElement>(null);
  const refinementPhotoRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [recommendResult, setRecommendResult] = useState<RecommendResult | null>(null);
  const [recommendError, setRecommendError] = useState<string | null>(null);
  const [chosenDecision, setChosenDecision] = useState<string | null>(null);
  const [loadingPhraseIndex, setLoadingPhraseIndex] = useState(0);
  const [refinementNote, setRefinementNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [refinementPhotoUrl, setRefinementPhotoUrl] = useState<string | null>(null);
  const analysisImageDataUrlRef = useRef<string | null>(null);
  const savedForItemRef = useRef<string | null>(null);
  const savedItemIdRef = useRef<string | null>(null);
  /** Mirrors server `items.bucket_change_count` for the current saved item (home flow). */
  const savedItemBucketChangeCountRef = useRef(0);
  type HomePendingRec = {
    recData: RecommendResult;
    optionId: RecommendResult['recommendation'];
    priorRecommendation: RecommendResult['recommendation'];
  };
  const homePendingOtherRef = useRef<HomePendingRec | null>(null);
  const [homeSentimentalOpen, setHomeSentimentalOpen] = useState(false);
  const [homeConsignmentExpanded, setHomeConsignmentExpanded] = useState(false);
  const [homeConsignmentLoading, setHomeConsignmentLoading] = useState(false);
  const [homeConsignmentPlaces, setHomeConsignmentPlaces] = useState<ConsignmentPlaceRow[]>([]);
  const confirmedActionPromptRef = useRef<Record<string, string>>({});
  /** LLM-generated two-beat gift copy (packaging + recipient); null while loading or when decision is not gift. */
  const [giftConfirmationBeats, setGiftConfirmationBeats] = useState<string | null>(null);
  const {
    refresh: refreshAuthSession,
    loading: sessionLoading,
    user: authUser,
    welcomeSent,
  } = useAuthSession();
  const isLoggedIn = sessionLoading ? null : !!authUser;
  const showFreePlanHomeCopy = !sessionLoading && isLoggedIn === false;
  const [decisionJustConfirmed, setDecisionJustConfirmed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [contextualPlaces, setContextualPlaces] = useState<{ name: string; distance_mi: number; place_id: string }[]>([]);
  const [pickupDonationPlaces, setPickupDonationPlaces] = useState<{ name: string; distance_mi: number; place_id: string }[]>([]);
  /** True after donate-flow geolocation + contextual-places request finishes (avoids flashing empty-state while loading). */
  const [donationPlacesFetchDone, setDonationPlacesFetchDone] = useState(false);
  const [rainNext24h, setRainNext24h] = useState<boolean | null>(null);
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [showFreePlanNudge, setShowFreePlanNudge] = useState(false);
  const [freePlanNudgeItemCount, setFreePlanNudgeItemCount] = useState(FREE_LOGGED_IN_ITEM_LIMIT - 1);
  const freePlanNudgeDismissedThisSessionRef = useRef(false);
  /** True when opened from footer Upgrade (voluntary title); false for item-limit / ?paywall=1. */
  const [paywallVoluntary, setPaywallVoluntary] = useState(false);
  const [paywallItemCount, setPaywallItemCount] = useState(FREE_LOGGED_IN_ITEM_LIMIT);
  const [showAiConsent, setShowAiConsent] = useState(false);
  /** Resolves when user accepts AI note during Upgrade guest → purchase (see `waitForAiConsentBeforeGuestPurchase`). */
  const aiConsentGuestPurchaseResolverRef = useRef<(() => void) | null>(null);
  /**
   * True once the user accepts the AI sheet this tab session (set synchronously with localStorage).
   * Upgrade signup keeps `goshed_ai_consent` so the home sheet does not return after account creation.
   */
  const aiConsentAgreedThisSessionRef = useRef(false);
  const [showGuestGateModal, setShowGuestGateModal] = useState(false);
  const [shedSignupModalOpen, setShedSignupModalOpen] = useState(false);
  const guestGateDismissedRef = useRef(false);
  const GUEST_COUNT_KEY = "goshed_guest_analysis_count";
  const getStoredGuestCount = (): number => {
    if (typeof localStorage === "undefined") return 0;
    const v = localStorage.getItem(GUEST_COUNT_KEY);
    const n = parseInt(v ?? "0", 10);
    return Number.isFinite(n) ? n : 0;
  };
  const guestAnalysisCountRef = useRef(getStoredGuestCount());
  /** Force guest-mode limit from URL (e.g. ?guest=1). Set in useEffect to avoid hydration mismatch. */
  const [forceGuestMode, setForceGuestMode] = useState(false);
  const effectiveGuest = (isLoggedIn !== true) || forceGuestMode;

  useEffect(() => {
    if (chosenDecision == null || chosenDecision !== 'sell') {
      setHomeConsignmentExpanded(false);
      setHomeConsignmentPlaces([]);
      setHomeConsignmentLoading(false);
    }
  }, [chosenDecision]);

  const recordGuestFlowComplete = useCallback(() => {
    if (!effectiveGuest) return;
    const next = (guestAnalysisCountRef.current || 0) + 1;
    guestAnalysisCountRef.current = next;
    if (typeof localStorage !== "undefined") localStorage.setItem(GUEST_COUNT_KEY, String(next));
    if (
      !guestGateDismissedRef.current &&
      (
        next === GUEST_ANALYSIS_LIMIT ||
        next === GUEST_GATE_REMINDER_COUNT ||
        next === FREE_LOGGED_IN_ITEM_LIMIT
      )
    ) {
      setShowGuestGateModal(true);
    }
  }, [effectiveGuest]);

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  useEffect(() => {
    setMounted(true);
    guestAnalysisCountRef.current = getStoredGuestCount();
    guestGateDismissedRef.current = guestGateDismissedInStorage();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = window.location.search;
    setForceGuestMode(q.includes("guest=1") || q.includes("guest=true"));
    if (q.includes("paywall=1") || q.includes("paywall=true")) {
      setPaywallVoluntary(false);
      setShowPaywallModal(true);
    } else if (q.includes("upgrade=1") || q.includes("upgrade=true")) {
      setPaywallVoluntary(true);
      setShowPaywallModal(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("upgrade");
      const search = url.searchParams.toString();
      router.replace(`${url.pathname}${search ? `?${search}` : ""}${url.hash}`, { scroll: false });
    }
  }, [router]);

  useEffect(() => {
    const onVoluntary = () => {
      setPaywallVoluntary(true);
      setShowPaywallModal(true);
    };
    window.addEventListener("goshed-open-voluntary-paywall", onVoluntary);
    return () => window.removeEventListener("goshed-open-voluntary-paywall", onVoluntary);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("goshed_ai_consent")) {
      aiConsentAgreedThisSessionRef.current = true;
    } else {
      setShowAiConsent(true);
    }
  }, []);

  useEffect(() => {
    const justSignedIn = typeof window !== "undefined" && window.location.search.includes("signed_in=1");

    const run = async () => {
      let loggedIn = !!(await refreshAuthSession()).user;
      if (justSignedIn) {
        if (loggedIn) {
          router.replace("/", { scroll: false });
          return;
        }
        // Mobile/slow clients: cookies may not be available on first request; retry with backoff.
        for (const delay of [300, 1000]) {
          await new Promise((r) => setTimeout(r, delay));
          loggedIn = !!(await refreshAuthSession()).user;
          if (loggedIn) {
            router.replace("/", { scroll: false });
            return;
          }
        }
        router.replace("/", { scroll: false });
      }
    };

    run();
  }, [router, refreshAuthSession]);

  useEffect(() => {
    const redirect = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("redirect_after_login") : null;
    if (!redirect) return;
    refreshAuthSession().then(({ user }) => {
      if (user) {
        sessionStorage.removeItem("redirect_after_login");
        window.location.href = redirect;
      }
    });
  }, [refreshAuthSession]);
  useEffect(() => {
    return () => { if (refinementPhotoUrl) URL.revokeObjectURL(refinementPhotoUrl); };
  }, [refinementPhotoUrl]);

  // Donate: browser geolocation + POST /api/contextual-places (no login). Separate from Sell/consignment GET.
  useEffect(() => {
    if (chosenDecision !== 'donate') {
      setContextualPlaces([]);
      setPickupDonationPlaces([]);
      setDonationPlacesFetchDone(false);
      return;
    }
    setDonationPlacesFetchDone(false);
    if (!navigator.geolocation) {
      setContextualPlaces([]);
      setPickupDonationPlaces([]);
      setDonationPlacesFetchDone(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        void fetch('/api/contextual-places', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            lat,
            lng,
            item_label: result?.item_label,
            value_range: result?.value_range,
            description: result?.description,
          }),
        })
          .then((res) => res.json())
          .then(
            (data: {
              places?: { name: string; distance_mi: number; place_id: string }[];
              pickupPlaces?: { name: string; distance_mi: number; place_id: string }[];
            }) => {
              setContextualPlaces(data.places ?? []);
              setPickupDonationPlaces(data.pickupPlaces ?? []);
            }
          )
          .catch(() => {
            setContextualPlaces([]);
            setPickupDonationPlaces([]);
          })
          .finally(() => {
            setDonationPlacesFetchDone(true);
          });
      },
      () => {
        setContextualPlaces([]);
        setPickupDonationPlaces([]);
        setDonationPlacesFetchDone(true);
      }
    );
  }, [chosenDecision, result?.item_label, result?.description, result?.value_range]);

  // Fetch weather for curb — rain in next 24h so they know whether to put it out today
  useEffect(() => {
    if (chosenDecision !== 'curb') {
      setRainNext24h(null);
      return;
    }
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        fetch(`/api/weather-forecast?lat=${lat}&lon=${lng}`)
          .then((res) => res.json())
          .then((data: { rain_next_24h?: boolean }) => setRainNext24h(!!data.rain_next_24h))
          .catch(() => setRainNext24h(null));
      },
      () => setRainNext24h(null)
    );
  }, [chosenDecision]);

  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => {
      setLoadingPhraseIndex(i => (i + 1) % LOADING_PHRASES.length);
    }, 1500);
    return () => clearInterval(id);
  }, [loading]);

  const handleZoneClick = () => inputRef.current?.click();

  const handleAiConsentAccept = async () => {
    if (typeof window !== "undefined") {
      try {
        const bridge = (
          window as Window & { ReactNativeWebView?: { postMessage: (data: string) => void } }
        ).ReactNativeWebView;
        bridge?.postMessage("goshed-native-ai-consent-accepted");
      } catch {
        /* not running inside the native WebView shell */
      }
    }
    aiConsentAgreedThisSessionRef.current = true;
    localStorage.setItem("goshed_ai_consent", "1");
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("users").update({ ai_consent_shown: true }).eq("id", user.id);
      }
    } catch {
      /* missing env or update failed — localStorage still records consent for this device */
    }
    setShowAiConsent(false);
    const resolve = aiConsentGuestPurchaseResolverRef.current;
    aiConsentGuestPurchaseResolverRef.current = null;
    resolve?.();
  };

  /** Blocks until the same AI consent sheet as initial load is accepted (if `goshed_ai_consent` is not set). */
  const waitForAiConsentBeforeGuestPurchase = useCallback(async () => {
    if (typeof window !== "undefined" && localStorage.getItem("goshed_ai_consent")) {
      return;
    }
    if (aiConsentAgreedThisSessionRef.current) {
      return;
    }
    await new Promise<void>((resolve) => {
      aiConsentGuestPurchaseResolverRef.current = resolve;
      setShowAiConsent(true);
    });
  }, []);

  /** Run analyze + recommend with an existing data URL (e.g. after paywall success). */
  const runAnalyzeWithDataUrl = useCallback(async (dataUrl: string) => {
    setError(null);
    setRecommendError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
        credentials: 'include',
      });
      const raw = await res.text();
      let data: { error?: string; details?: string; itemCount?: number } & AnalyzeResult;
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        setError('We couldn\'t analyze this image. Try again or use a different photo.');
        return;
      }
      if (res.status === 401) {
        setLoading(false);
        setError('Sign in to analyze this photo.');
        return;
      }
      if (res.status === 402) {
        setPaywallVoluntary(false);
        setPaywallItemCount(typeof data.itemCount === 'number' ? data.itemCount : FREE_LOGGED_IN_ITEM_LIMIT);
        setShowPaywallModal(true);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        if (data.details) console.error('[analyze] API error details:', data.details);
        setError(data.details && typeof data.details === 'string' ? data.details : (data.error || 'Analysis failed'));
        return;
      }
      const analysis = data as AnalyzeResult;
      setResult(analysis);
      setLoading(false);

      setRecommendLoading(true);
      try {
        const item_label = analysis.item_label;
        const value_range = analysis.value_range;
        if (item_label === undefined || value_range === undefined) {
          console.error('Recommend: missing analysis fields for recommendation');
          setRecommendError('retry');
          return;
        }
        const shippable =
          typeof analysis.shippable === 'boolean' ? analysis.shippable : deriveShippable(analysis);

        const recRes = await fetch('/api/recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_label,
            value_range,
            shippable: shippable ?? false,
            user_note: refinementNote.trim() || undefined,
          }),
        });
        const recRaw = await recRes.text();
        let recData: RecommendResult & { error?: string; details?: string };
        try {
          recData = recRaw ? JSON.parse(recRaw) : {};
        } catch {
          setRecommendError('retry');
          return;
        }
        if (!recRes.ok) {
          console.error('Recommend API error:', recRes.status, recData.error ?? '', recData.details ?? '');
          setRecommendError('retry');
          return;
        }
        setRecommendResult(recData as RecommendResult);
        recordGuestFlowComplete();
      } catch (recErr) {
        console.error('Recommend request failed:', recErr);
        setRecommendError('retry');
      } finally {
        setRecommendLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [refinementNote, isLoggedIn, forceGuestMode, recordGuestFlowComplete]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (effectiveGuest && !guestGateDismissedRef.current && guestAnalysisCountRef.current >= FREE_LOGGED_IN_ITEM_LIMIT) {
      e.target.value = '';
      setShowGuestGateModal(true);
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
    setError(null);
    setRecommendResult(null);
    setRecommendError(null);
    setChosenDecision(null);
    setContextualPlaces([]);
    savedForItemRef.current = null;
    savedItemIdRef.current = null;
    savedItemBucketChangeCountRef.current = 0;
    lastSavedItemKey = null;
    confirmedActionPromptRef.current = {};
    setGiftConfirmationBeats(null);
    setLoadingPhraseIndex(0);
    setRefinementNote('');
    setShowNoteInput(false);
    if (refinementPhotoUrl) URL.revokeObjectURL(refinementPhotoUrl);
    setRefinementPhotoUrl(null);
    setLoading(true);
    homePendingOtherRef.current = null;
    setHomeSentimentalOpen(false);
    setHomeConsignmentExpanded(false);
    setHomeConsignmentLoading(false);
    setHomeConsignmentPlaces([]);

    try {
      const dataUrl = await resizeAndToDataUrl(file);
      analysisImageDataUrlRef.current = dataUrl;
      await runAnalyzeWithDataUrl(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  /** After confirming a decision: clear the flow and return to the home upload zone. */
  const handleAddAnotherItem = () => {
    const cam = addAnotherCameraInputRef.current;
    if (cam) cam.value = '';
    if (inputRef.current) inputRef.current.value = '';

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    setRecommendResult(null);
    setRecommendError(null);
    setChosenDecision(null);
    setContextualPlaces([]);
    setPickupDonationPlaces([]);
    setRainNext24h(null);
    savedForItemRef.current = null;
    savedItemIdRef.current = null;
    savedItemBucketChangeCountRef.current = 0;
    lastSavedItemKey = null;
    confirmedActionPromptRef.current = {};
    setGiftConfirmationBeats(null);
    setLoadingPhraseIndex(0);
    setRefinementNote('');
    setShowNoteInput(false);
    if (refinementPhotoUrl) URL.revokeObjectURL(refinementPhotoUrl);
    setRefinementPhotoUrl(null);
    analysisImageDataUrlRef.current = null;
    setLoading(false);
    setRecommendLoading(false);
    setDecisionJustConfirmed(false);
    homePendingOtherRef.current = null;
    setHomeSentimentalOpen(false);
    setHomeConsignmentExpanded(false);
    setHomeConsignmentLoading(false);
    setHomeConsignmentPlaces([]);
  };

  const closePaywallModal = useCallback(() => {
    setShowPaywallModal(false);
    setPaywallVoluntary(false);
  }, []);

  const handlePaywallSuccess = useCallback(() => {
    closePaywallModal();
    if (paywallVoluntary) {
      void refreshAuthSession();
      return;
    }
    const dataUrl = analysisImageDataUrlRef.current;
    if (dataUrl) runAnalyzeWithDataUrl(dataUrl);
  }, [closePaywallModal, paywallVoluntary, refreshAuthSession, runAnalyzeWithDataUrl]);

  // Save to Supabase when we have analysis + recommendation and user is logged in (once per item).
  // Key is by item_label only so changing recommendation (Other options) updates via PATCH, doesn't create a second item.
  // lastSavedItemKey survives Strict Mode remount so we only POST once per item.
  useEffect(() => {
    if (!result || !recommendResult || isLoggedIn !== true) return;
    const key = result.item_label;
    if (lastSavedItemKey === key) return;
    lastSavedItemKey = key;
    savedForItemRef.current = key;
    fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        photo_url: analysisImageDataUrlRef.current ?? undefined,
        item_label: result.item_label,
        value_range_raw: result.value_range,
        recommendation: recommendResult.recommendation,
        notes: refinementNote.trim() || undefined,
      }),
    })
      .then((res) => res.json())
      .then((data: { id?: string; bucket_change_count?: number }) => {
        if (data?.id) savedItemIdRef.current = data.id;
        if (typeof data?.bucket_change_count === 'number' && Number.isFinite(data.bucket_change_count)) {
          savedItemBucketChangeCountRef.current = data.bucket_change_count;
        } else {
          savedItemBucketChangeCountRef.current = 0;
        }
        refreshAuthSession()
          .then((snap) => {
            const savedCount = typeof snap.itemCount === "number" ? snap.itemCount : null;
            if (
              savedCount !== null &&
              savedCount >= FREE_LOGGED_IN_ITEM_LIMIT - 1 &&
              savedCount <= FREE_LOGGED_IN_ITEM_LIMIT &&
              snap.isPro !== true &&
              !freePlanNudgeDismissedThisSessionRef.current
            ) {
              setFreePlanNudgeItemCount(savedCount);
              setShowFreePlanNudge(true);
            }
          })
          .catch(() => {});
      })
      .catch((err) => console.error('[shed] save item failed:', err));
  }, [result, recommendResult, isLoggedIn, refreshAuthSession]);

  useEffect(() => {
    if (chosenDecision !== 'gift') {
      setGiftConfirmationBeats(null);
      return;
    }
    if (!result?.item_label || !recommendResult?.reason) {
      setGiftConfirmationBeats(null);
      return;
    }
    const ac = new AbortController();
    setGiftConfirmationBeats(null);

    const fallbackGiftPrompt = () =>
      confirmedActionPromptRef.current.gift ??
      (confirmedActionPromptRef.current.gift = getRandomActionPrompt('gift', {
        item_label: result.item_label,
        description: result.description,
      }));

    (async () => {
      try {
        const res = await fetch('/api/gift-action-prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_label: result.item_label,
            reason: recommendResult.reason,
          }),
          signal: ac.signal,
        });
        const data = (await res.json()) as { beats?: string[]; error?: string };
        if (ac.signal.aborted) return;
        if (res.ok && Array.isArray(data.beats) && data.beats.length === 2) {
          const text = data.beats.map((s) => String(s).trim()).join('\n');
          setGiftConfirmationBeats(text || fallbackGiftPrompt());
        } else {
          setGiftConfirmationBeats(fallbackGiftPrompt());
        }
      } catch {
        if (ac.signal.aborted) return;
        setGiftConfirmationBeats(fallbackGiftPrompt());
      }
    })();

    return () => ac.abort();
  }, [chosenDecision, result?.item_label, result?.description, recommendResult?.reason]);

  const patchSavedItemRecommendation = async (recommendation: string): Promise<boolean> => {
    const sid = savedItemIdRef.current;
    if (!sid) return false;
    const res = await fetch(`/api/items/${sid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ recommendation }),
    });
    if (!res.ok) {
      console.error('[home] PATCH item recommendation failed', res.status);
      return false;
    }
    try {
      const data = (await res.json()) as { bucket_change_count?: number | null };
      if (typeof data.bucket_change_count === 'number' && Number.isFinite(data.bucket_change_count)) {
        savedItemBucketChangeCountRef.current = data.bucket_change_count;
      }
    } catch {
      /* ignore */
    }
    return true;
  };

  const fetchRecommendForOverride = async (
    optionId: RecommendResult['recommendation']
  ): Promise<RecommendResult | null> => {
    const r = result;
    if (!r) return null;
    const item_label = r.item_label;
    const value_range = r.value_range;
    const shippable = typeof r.shippable === 'boolean' ? r.shippable : deriveShippable(r);
    try {
      const recRes = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_label,
          value_range,
          shippable,
          user_note: refinementNote.trim() || undefined,
          user_override: optionId,
        }),
      });
      const recRaw = await recRes.text();
      let recData: RecommendResult & { error?: string };
      try {
        recData = recRaw ? JSON.parse(recRaw) : {};
      } catch {
        return null;
      }
      if (!recRes.ok) return null;
      return recData as RecommendResult;
    } catch {
      return null;
    }
  };

  const recommendedAction = recommendResult
    ? ACTION_OPTIONS.find(o => o.id === recommendResult.recommendation)
    : null;

  const commitPrimaryDecisionUi = () => {
    if (!recommendResult) return;
    const decision = recommendResult.recommendation;
    setChosenDecision(decision);
    setDecisionJustConfirmed(true);
    if (savedItemIdRef.current) {
      fetch(`/api/items/${savedItemIdRef.current}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'done' }),
      }).catch((err) => console.error('[shed] mark decision failed:', err));
    }
    setTimeout(() => setDecisionJustConfirmed(false), 800);
  };

  const handlePrimaryDecision = () => {
    if (!recommendResult) return;
    commitPrimaryDecisionUi();
  };

  const handleHomeConsignmentLinkClick = async () => {
    if (homeConsignmentLoading) return;
    setHomeConsignmentExpanded(true);
    setHomeConsignmentLoading(true);
    const places = await fetchConsignmentPlacesClient();
    setHomeConsignmentPlaces(places);
    setHomeConsignmentLoading(false);
  };

  const handleHomeSentimentalKeepGoing = () => {
    const p = homePendingOtherRef.current;
    if (!p) return;
    const next = p.optionId;
    void (async () => {
      const ok = await patchSavedItemRecommendation(next);
      if (ok) {
        setRecommendResult(p.recData);
        setChosenDecision(next);
      }
      homePendingOtherRef.current = null;
    })();
  };

  const handleHomeMoveToKeepNoRemind = async () => {
    const ok = await patchSavedItemRecommendation('keep');
    if (!ok) return false;
    homePendingOtherRef.current = null;
    const rec = await fetchRecommendForOverride('keep');
    if (rec) setRecommendResult(rec);
    setChosenDecision('keep');
    return true;
  };

  const handleHomeMoveToKeepRemind = async () => {
    const ok = await patchSavedItemRecommendation('keep');
    if (!ok) return false;
    homePendingOtherRef.current = null;
    const rec = await fetchRecommendForOverride('keep');
    if (rec) setRecommendResult(rec);
    setChosenDecision('keep');
    const sid = savedItemIdRef.current;
    const email = typeof authUser?.email === 'string' ? authUser.email.trim() : '';
    if (sid && email.length > 0 && result?.item_label) {
      try {
        await fetch('/api/nudge/remind', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            itemId: sid,
            itemName: result.item_label,
            email,
          }),
        });
      } catch {
        /* best-effort */
      }
    }
    return true;
  };

  const handleRefinementPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (refinementPhotoUrl) URL.revokeObjectURL(refinementPhotoUrl);
    setRefinementPhotoUrl(URL.createObjectURL(file));
    e.target.value = '';
  };

  const fetchRecommendWithNote = async () => {
    if (!result || recommendLoading) return;
    const item_label = result.item_label;
    const value_range = result.value_range;
    const shippable = typeof result.shippable === 'boolean' ? result.shippable : deriveShippable(result);
    setRecommendLoading(true);
    setRecommendError(null);
    try {
      const recRes = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_label,
          value_range,
          shippable,
          user_note: refinementNote.trim() || undefined,
        }),
      });
      const recRaw = await recRes.text();
      let recData: RecommendResult & { error?: string; details?: string };
      try {
        recData = recRaw ? JSON.parse(recRaw) : {};
      } catch {
        setRecommendError('retry');
        return;
      }
      if (!recRes.ok) {
        setRecommendError('retry');
        return;
      }
      setRecommendResult(recData as RecommendResult);
    } catch {
      setRecommendError('retry');
    } finally {
      setRecommendLoading(false);
    }
  };

  const handleOtherOptionClick = async (optionId: RecommendResult['recommendation']) => {
    if (!result || recommendLoading) return;
    const priorRecommendation = recommendResult?.recommendation;
    const item_label = result.item_label;
    const value_range = result.value_range;
    const shippable = typeof result.shippable === 'boolean' ? result.shippable : deriveShippable(result);
    setRecommendLoading(true);
    setRecommendError(null);
    try {
      const recRes = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_label,
          value_range,
          shippable,
          user_note: refinementNote.trim() || undefined,
          user_override: optionId,
        }),
      });
      const recRaw = await recRes.text();
      let recData: RecommendResult & { error?: string; details?: string };
      try {
        recData = recRaw ? JSON.parse(recRaw) : {};
      } catch {
        setRecommendError('retry');
        return;
      }
      if (!recRes.ok) {
        setRecommendError('retry');
        return;
      }
      const nextRec = recData as RecommendResult;

      const sid = savedItemIdRef.current;
      const loggedIn = isLoggedIn === true;
      const c = savedItemBucketChangeCountRef.current ?? 0;
      const bucketChanging = priorRecommendation != null && priorRecommendation !== optionId;

      if (sid && loggedIn && bucketChanging) {
        if (c === 1) {
          homePendingOtherRef.current = {
            recData: nextRec,
            optionId,
            priorRecommendation: priorRecommendation as RecommendResult['recommendation'],
          };
          setHomeSentimentalOpen(true);
          return;
        }
      }

      setRecommendResult(nextRec);
      setChosenDecision(optionId);
      if (sid && loggedIn) {
        const ok = await patchSavedItemRecommendation(optionId);
        if (!ok) {
          console.error('[home] Could not sync recommendation to shed');
        }
      }
    } catch {
      setRecommendError('retry');
    } finally {
      setRecommendLoading(false);
    }
  };

  /** Post-decision footer: identical typography and color for all three actions. */
  const postDecisionFooterActionStyle: CSSProperties = {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--accent)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'none',
    padding: 0,
    display: 'inline-block',
    marginBottom: '14px',
    fontFamily: 'inherit',
    lineHeight: 1.45,
  };

  // Defer full UI until after mount so server and client render identical HTML and hydration never mismatches (e.g. with extensions that alter the DOM).
  const homeShellStyle: CSSProperties = {
    flex: 1,
    width: "100%",
    minHeight: 0,
    background: "var(--bg)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    boxSizing: "border-box",
    padding: "68px 20px 24px",
    overflowX: "hidden",
  };

  if (!mounted) {
    return (
      <main className="goshed-home-main" style={{ ...homeShellStyle, justifyContent: "center" }}>
        <div style={{ width: '100%', maxWidth: '390px', textAlign: 'center' }}>
          <p style={{ color: 'var(--ink-soft)', fontSize: '14px' }}>Loading…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="goshed-home-main" style={homeShellStyle}>
      <div style={{ width: '100%', maxWidth: '390px', boxSizing: 'border-box' }}>
        {/* Header — z-index keeps controls above in-page layers; Sign in uses router.push so navigation isn’t lost to overlays/prefetch edge cases */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            position: "relative",
            zIndex: 2,
          }}
        >
          <div>
            <h1 style={{ fontFamily: 'var(--font-cormorant)', fontSize: '36.5px', fontWeight: 300, color: 'var(--ink)', lineHeight: 0.98, margin: 0 }}>
              go<em style={{ color: 'var(--accent)' }}>shed</em>
            </h1>
            <p style={{ color: 'var(--ink-soft)', fontSize: '11px', letterSpacing: '0.155em', textTransform: 'uppercase', margin: '6px 0 0' }}>
              let it go, beautifully
            </p>
          </div>
          <div style={{ marginTop: "6px" }}>
            {isLoggedIn === true ? (
              <Link href="/shed" style={{ display: "inline-flex", alignItems: "center", minHeight: "32px", fontSize: "12px", color: "var(--ink-soft)", textDecoration: "none", borderBottom: "1px solid var(--soft)", paddingBottom: "1px" }}>
                My Shed
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  console.log("[home Sign in click]", {
                    isLoggedIn,
                    sessionLoading,
                    authUserId: authUser?.id ?? null,
                    welcomeSent,
                    wouldShowPasswordGate:
                      typeof window !== "undefined" &&
                      window.location.pathname !== "/login" &&
                      !window.location.pathname.startsWith("/auth/") &&
                      !sessionLoading &&
                      !!authUser &&
                      !welcomeSent,
                  });
                  void router.push("/login");
                }}
                style={{
                  fontSize: "12px",
                  color: "var(--ink-soft)",
                  textDecoration: "none",
                  borderBottom: "1px solid var(--soft)",
                  minHeight: "32px",
                  alignItems: "center",
                  paddingBottom: "1px",
                  background: "none",
                  borderTop: "none",
                  borderLeft: "none",
                  borderRight: "none",
                  paddingLeft: 0,
                  paddingRight: 0,
                  paddingTop: 0,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "inline-flex",
                }}
              >
                Sign in
              </button>
            )}
          </div>
        </div>

        {/* Photo zone — no capture so users can choose camera or library from the sheet */}
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange}
          style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} aria-hidden />
        {/* Dedicated input so “+ Add another item” opens the camera directly on phones */}
        <input
          ref={addAnotherCameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
          aria-hidden
        />
        <div role="button" tabIndex={0} onClick={handleZoneClick}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleZoneClick(); } }}
          className="goshed-photo-slot"
          style={{ marginTop: '32px', background: 'var(--surface)', borderRadius: '22px', border: '1.5px dashed var(--soft)', height: 'clamp(238px, 33svh, 252px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer', overflow: 'hidden', position: 'relative' }}>
          {previewUrl ? (
            <img src={previewUrl} alt="Selected item" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '26px' }} />
          ) : (
            <>
              <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '24px', fontStyle: 'italic', color: 'var(--ink)', textAlign: 'center', padding: '0 24px', margin: 0, transform: 'translateY(-2px)' }}>
                What are you holding onto?
              </p>
              <p style={{ fontSize: '13px', color: 'var(--ink-soft)', margin: 0, transform: 'translateY(-2px)' }}>Snap a picture — we&apos;ll figure out the rest</p>
            </>
          )}
        </div>

        {/* Tagline + pills under the upload box */}
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          {isLoggedIn !== null ? (
            <>
              <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '20px', fontWeight: 300, color: 'var(--ink-soft)', lineHeight: 1.4, margin: 0 }}>
                GoShed tells you what to do with it.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '14px' }}>
                {['Sell', 'Donate', 'Gift'].map((label) => (
                  <span
                    key={label}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      background: 'var(--surface)',
                      color: 'var(--ink)',
                      border: '1px solid var(--surface2)',
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </>
          ) : null}
          {showFreePlanHomeCopy ? (
            <>
              <p style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '14px', marginBottom: 0 }}>
                No account needed to try
              </p>
              <p style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '8px', marginBottom: 0, fontStyle: 'italic', lineHeight: 1.45 }}>
                Free for your first 10 items. Upgrade anytime.
              </p>
            </>
          ) : null}
        </div>

        {/* Loading state: minimal, centered under image */}
        {loading && (
          <div style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--soft)', animation: 'goshed-dot-pulse 1.4s ease-in-out infinite' }} />
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--soft)', animation: 'goshed-dot-pulse 1.4s ease-in-out 0.2s infinite' }} />
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--soft)', animation: 'goshed-dot-pulse 1.4s ease-in-out 0.4s infinite' }} />
            </div>
            <p style={{ color: 'var(--ink)', fontSize: '15px', fontWeight: 500, margin: 0 }}>
              Thinking about this…
            </p>
            <p style={{ color: 'var(--ink-soft)', fontSize: '13px', fontWeight: 400, margin: 0, opacity: 0.85 }}>
              {LOADING_PHRASES[loadingPhraseIndex]}
            </p>
          </div>
        )}

        {/* Analysis card: item identity → practical context */}
        {!loading && result && (
          <div style={{ marginTop: '20px', padding: '20px', background: 'var(--white)', borderRadius: '18px', border: '1px solid var(--surface2)', boxShadow: '0 2px 8px rgba(44,36,22,0.06)' }}>
            <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '18px', lineHeight: 1.35, fontWeight: 500, color: 'var(--ink)', marginBottom: '8px' }}>{result.item_label}</p>
            <p style={{ fontSize: '14px', lineHeight: 1.3, fontWeight: 500, color: 'var(--accent)', marginBottom: '8px' }}>{result.value_range}</p>
            {recommendResult?.recommendation === 'sell' ? (
              <p style={{ fontSize: '13px', lineHeight: 1.3, fontWeight: 500, color: 'var(--ink-soft)', marginBottom: '10px' }}>
                {result.shippable ? 'Easy to ship' : 'Local only'}
              </p>
            ) : null}
            <p style={{ fontSize: '14px', lineHeight: 1.5, fontWeight: 400, color: 'var(--ink-soft)', marginBottom: 0 }}>{firstSentence(result.description)}</p>
          </div>
        )}

        {/* Optional refinement: Know something more? */}
        {!loading && result && (
          <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--surface2)' }}>
            <p style={{ fontSize: '13px', lineHeight: 1.2, fontWeight: 500, color: 'var(--ink-soft)', marginBottom: '10px' }}>Add something?</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              <input
                ref={refinementPhotoRef}
                type="file"
                accept="image/*"
                onChange={handleRefinementPhotoChange}
                style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
                aria-hidden
              />
              <button
                type="button"
                onClick={() => refinementPhotoRef.current?.click()}
                className="goshed-secondary-chip"
              >
                Add photo
              </button>
              <button
                type="button"
                onClick={() => setShowNoteInput(true)}
                className="goshed-secondary-chip"
              >
                Add note
              </button>
            </div>
            {refinementPhotoUrl && (
              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img src={refinementPhotoUrl} alt="Extra" style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '8px' }} />
                <button
                  type="button"
                  onClick={() => { if (refinementPhotoUrl) URL.revokeObjectURL(refinementPhotoUrl); setRefinementPhotoUrl(null); }}
                  style={{ fontSize: '11px', color: 'var(--ink-soft)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Remove
                </button>
              </div>
            )}
            {showNoteInput && (
              <div style={{ marginTop: '10px' }}>
                <textarea
                  value={refinementNote}
                  onChange={(e) => setRefinementNote(e.target.value)}
                  placeholder="Brand, maker, label, condition, size, missing pieces, or sentimental context."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '13px',
                    color: 'var(--ink)',
                    background: 'var(--white)',
                    border: '1px solid var(--surface2)',
                    borderRadius: '10px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    minHeight: '72px',
                  }}
                />
                <p style={{ fontSize: '11px', color: 'var(--ink-soft)', marginTop: '6px', marginBottom: 0 }}>
                  e.g. Found label on back says XYZ · Set of 8 · One handle is chipped
                </p>
                {recommendResult && refinementNote.trim() && (
                  <button
                    type="button"
                    onClick={fetchRecommendWithNote}
                    disabled={recommendLoading}
                    className="goshed-secondary-chip"
                    style={{ marginTop: '10px', color: 'var(--green)', borderColor: 'var(--green)' }}
                  >
                    {recommendLoading ? 'Updating…' : 'Update recommendation'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Recommendation spinner */}
        {result && recommendLoading && (
          <div style={{ marginTop: '16px', padding: '20px', background: 'var(--surface)', borderRadius: '18px', border: '1px solid var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <span style={{ width: '22px', height: '22px', border: '2px solid var(--soft)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'goshed-spin 0.8s linear infinite' }} />
            <span style={{ color: 'var(--ink-soft)', fontSize: '14px' }}>Getting recommendation…</span>
          </div>
        )}

        {/* Recommendation card: clickable action title is the primary CTA */}
        {result && !recommendLoading && recommendResult && !chosenDecision && recommendedAction && (
          <>
            <div style={{ marginTop: '16px', padding: '20px', background: 'var(--surface)', borderRadius: '18px', border: '1px solid var(--soft)', boxShadow: '0 2px 8px rgba(44,36,22,0.06)' }}>
              <p style={{ fontSize: '13px', lineHeight: 1.2, fontWeight: 500, color: 'var(--ink-soft)', marginBottom: '10px', marginTop: 0 }}>Best Next Life</p>
              <button
                type="button"
                className="goshed-primary-btn"
                onClick={handlePrimaryDecision}
                style={{ marginBottom: '12px', width: '100%', justifyContent: 'center' }}
              >
                <span style={{ fontFamily: 'var(--font-cormorant)' }}>
                  {RECOMMENDATION_ACTION_PHRASES[recommendResult.recommendation]} →
                </span>
              </button>
              <p style={{ fontSize: '14px', lineHeight: 1.5, color: 'var(--ink)', marginBottom: 0, marginTop: 0 }}>{firstSentence(recommendResult.reason)}</p>
            </div>

            {/* Other options: 3-column grid (matches detail page, avoids orphan on mobile) */}
            <p style={{ fontSize: '13px', lineHeight: 1.2, fontWeight: 500, color: 'var(--ink-soft)', textAlign: 'center', marginTop: '18px', marginBottom: '10px' }}>Other options</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {OTHER_OPTIONS_ORDER.filter(id => id !== recommendResult.recommendation).map(id => {
                const opt = ACTION_OPTIONS.find(o => o.id === id);
                if (!opt) return null;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className="goshed-secondary-chip"
                    onClick={() => handleOtherOptionClick(opt.id)}
                  >
                    {opt.id === 'curb' ? 'Curb' : opt.label}
                  </button>
                );
              })}
            </div>

          </>
        )}

        {/* Post-decision confirmation */}
        {chosenDecision && recommendResult && (
          <>
            <div
              className={decisionJustConfirmed ? 'goshed-decision-confirmed' : ''}
              style={{ marginTop: '16px', padding: '20px', background: 'var(--surface)', borderRadius: '18px', border: '1px solid var(--soft)' }}
            >
              {(() => {
                const btn = ALL_DISPLAY_OPTIONS.find(b => b.id === chosenDecision);
                const displayLabel = btn?.id === 'curb' ? 'Curb' : btn?.label;
                const confirmationHeader =
                  RECOMMENDATION_ACTION_PHRASES[chosenDecision as keyof typeof RECOMMENDATION_ACTION_PHRASES] ??
                  `${displayLabel ?? 'Decide'} it`;
                const isGift = chosenDecision === 'gift';
                const actionPrompt = isGift
                  ? giftConfirmationBeats
                  : confirmedActionPromptRef.current[chosenDecision] ??
                    (confirmedActionPromptRef.current[chosenDecision] = getRandomActionPrompt(
                      chosenDecision as ActionPromptType,
                      result
                        ? {
                            item_label: result.item_label,
                            description: result.description,
                            value_range: result.value_range,
                          }
                        : undefined
                    ));
                return (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                      <span style={{ display: 'flex', width: '24px', height: '24px', borderRadius: '50%', background: 'var(--green)', color: 'var(--white)', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700 }}>✓</span>
                      <span style={{ fontFamily: 'var(--font-cormorant)', fontSize: '16px', fontWeight: 600, color: 'var(--ink)' }}>
                        {confirmationHeader} — good call.
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: '14px',
                        color: 'var(--ink)',
                        lineHeight: 1.5,
                        marginBottom: '12px',
                        whiteSpace:
                          (isGift && actionPrompt) || chosenDecision === 'sell' ? 'pre-line' : undefined,
                      }}
                    >
                      {isGift && actionPrompt === null ? 'One moment…' : actionPrompt}
                    </p>
                    {chosenDecision === 'curb' && rainNext24h !== null && (
                      <p style={{ fontSize: '13px', color: rainNext24h ? 'var(--ink)' : 'var(--ink-soft)', lineHeight: 1.5, marginBottom: '12px', fontStyle: rainNext24h ? 'normal' : undefined }}>
                        {rainNext24h
                          ? 'Rain expected in the next 24 hours — consider waiting to put it out.'
                          : 'No rain expected — good day to put it out.'}
                      </p>
                    )}
                    {chosenDecision === "donate" && !donationPlacesFetchDone && (
                      <p
                        style={{
                          fontSize: "13px",
                          color: "var(--ink-soft)",
                          lineHeight: 1.5,
                          marginBottom: "12px",
                          marginTop: 0,
                        }}
                      >
                        Finding donation spots near you…
                      </p>
                    )}
                    {chosenDecision === 'donate' && contextualPlaces.length > 0 && (
                      <div style={{ marginBottom: '14px' }}>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px', marginTop: 0 }}>
                          Drop-offs near you:
                        </p>
                        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '14px', lineHeight: 1.6, color: 'var(--ink)' }}>
                          {contextualPlaces.map((place) => (
                            <li key={place.place_id} style={{ marginBottom: '4px' }}>
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(place.place_id)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: 'var(--accent)', textDecoration: 'none' }}
                              >
                                {place.name}
                              </a>
                              {' '}
                              <span style={{ color: 'var(--ink-soft)' }}>{place.distance_mi} mi</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {chosenDecision === 'donate' &&
                      donationPlacesFetchDone &&
                      contextualPlaces.length === 0 &&
                      pickupDonationPlaces.length === 0 && (
                        <p
                          style={{
                            fontSize: '12px',
                            color: 'var(--ink-soft)',
                            lineHeight: 1.45,
                            marginBottom: '12px',
                            marginTop: 0,
                          }}
                        >
                          {process.env.NODE_ENV === 'development' ? (
                            <>
                              No nearby donation results. Allow location for this site, set{' '}
                              <code style={{ fontSize: '11px' }}>GOOGLE_PLACES_API_KEY</code> in{' '}
                              <code style={{ fontSize: '11px' }}>.env.local</code>, then restart{' '}
                              <code style={{ fontSize: '11px' }}>npm run dev</code>. Use{' '}
                              <code style={{ fontSize: '11px' }}>http://localhost</code> (not LAN IP) if the browser
                              blocks geolocation.
                            </>
                          ) : (
                            <>
                              We couldn&apos;t load nearby donation ideas. Allow location for this site in your
                              browser settings, then try confirming Donate again.
                            </>
                          )}
                        </p>
                      )}
                    {chosenDecision === 'donate' && pickupDonationPlaces.length > 0 && (
                      <div style={{ marginBottom: '14px' }}>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px', marginTop: 0 }}>
                          Pickup-capable donation services:
                        </p>
                        <p style={{ fontSize: '12px', color: 'var(--ink-soft)', lineHeight: 1.45, margin: '0 0 8px' }}>
                          Too big to drop off? These organizations may offer pickup for larger donations in some areas — call ahead to confirm.
                        </p>
                        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '14px', lineHeight: 1.6, color: 'var(--ink)' }}>
                          {pickupDonationPlaces.map((place) => (
                            <li key={place.place_id} style={{ marginBottom: '4px' }}>
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(place.place_id)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: 'var(--accent)', textDecoration: 'none' }}
                              >
                                {place.name}
                              </a>
                              {' '}
                              <span style={{ color: 'var(--ink-soft)' }}>{place.distance_mi} mi</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {chosenDecision === 'sell' && (
                      <div style={{ marginBottom: '14px' }}>
                        <button
                          type="button"
                          onClick={() => void handleHomeConsignmentLinkClick()}
                          disabled={homeConsignmentLoading}
                          style={{
                            fontSize: '13px',
                            color: 'var(--accent)',
                            background: 'none',
                            border: 'none',
                            cursor: homeConsignmentLoading ? 'wait' : 'pointer',
                            textDecoration: 'underline',
                            padding: 0,
                            fontFamily: 'inherit',
                            textAlign: 'left',
                          }}
                        >
                          Want to see consignment stores near you?
                        </button>
                        {homeConsignmentExpanded && (
                          <div style={{ marginTop: '10px' }}>
                            {homeConsignmentLoading ? (
                              <p style={{ fontSize: '13px', color: 'var(--ink-soft)', margin: 0 }}>Loading nearby…</p>
                            ) : homeConsignmentPlaces.length === 0 ? (
                              <p style={{ fontSize: '13px', color: 'var(--ink-soft)', margin: 0 }}>
                                No stores found or location unavailable.
                              </p>
                            ) : (
                              <ul
                                style={{
                                  margin: 0,
                                  paddingLeft: '18px',
                                  fontSize: '13px',
                                  lineHeight: 1.55,
                                  color: 'var(--ink)',
                                }}
                              >
                                {homeConsignmentPlaces.map((p) => (
                                  <li key={p.place_id} style={{ marginBottom: '8px' }}>
                                    <a
                                      href={`https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(p.place_id)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}
                                    >
                                      {p.name}
                                    </a>
                                    {p.rating != null ? (
                                      <span style={{ color: 'var(--ink-soft)' }}> · {p.rating.toFixed(1)}★</span>
                                    ) : null}
                                    <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '2px' }}>
                                      {p.address}
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--ink-soft)' }}>{p.distance_mi} mi</div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    <button type="button" onClick={handleAddAnotherItem} style={postDecisionFooterActionStyle}>
                      + Add another item
                    </button>
                    <br />
                    {authUser ? (
                      <Link href="/shed" style={postDecisionFooterActionStyle}>
                        View your Shed →
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShedSignupModalOpen(true)}
                        style={postDecisionFooterActionStyle}
                      >
                        View your Shed →
                      </button>
                    )}
                    <br />
                    <button
                      type="button"
                      onClick={() => {
                        setChosenDecision(null);
                        setGiftConfirmationBeats(null);
                        setContextualPlaces([]);
                        setPickupDonationPlaces([]);
                        setRainNext24h(null);
                        setHomeConsignmentExpanded(false);
                        setHomeConsignmentPlaces([]);
                        setHomeConsignmentLoading(false);
                      }}
                      style={postDecisionFooterActionStyle}
                    >
                      ← Change my mind
                    </button>
                  </>
                );
              })()}
            </div>
          </>
        )}

        {/* Errors */}
        {result && !recommendLoading && recommendError && (
          <div style={{ marginTop: '16px', padding: '16px', background: 'var(--surface)', borderRadius: '18px', border: '1px solid var(--soft)', color: 'var(--ink-soft)', fontSize: '14px' }}>
            <p style={{ margin: 0, marginBottom: '6px' }}>We couldn&apos;t decide just yet.</p>
            <p style={{ margin: 0, fontSize: '13px' }}>Try again or choose the best next life yourself.</p>
          </div>
        )}
        {!loading && error && (
          <div style={{ marginTop: '20px', padding: '16px', background: 'var(--surface)', borderRadius: '18px', border: '1px solid var(--soft)', color: 'var(--ink-soft)', fontSize: '14px' }}>{error}</div>
        )}

      </div>

      <SentimentalNudge
        open={homeSentimentalOpen}
        itemName={result?.item_label ?? 'this item'}
        onClose={() => setHomeSentimentalOpen(false)}
        onMoveToKeepRemind={handleHomeMoveToKeepRemind}
        onMoveToKeepNoRemind={handleHomeMoveToKeepNoRemind}
        onKeepGoing={handleHomeSentimentalKeepGoing}
      />

      <PaywallModal
        open={showPaywallModal}
        onClose={closePaywallModal}
        onPurchaseSuccess={handlePaywallSuccess}
        itemCount={paywallItemCount}
        voluntary={paywallVoluntary}
        beforeGuestPurchase={waitForAiConsentBeforeGuestPurchase}
      />
      {showFreePlanNudge && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="free-plan-nudge-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 51,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            background: "rgba(0,0,0,0.5)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              freePlanNudgeDismissedThisSessionRef.current = true;
              setShowFreePlanNudge(false);
            }
          }}
        >
          <div
            style={{
              background: "var(--white)",
              borderRadius: 18,
              padding: 28,
              maxWidth: 380,
              width: "100%",
              boxShadow: "0 8px 32px rgba(44,36,22,0.15)",
              fontFamily: "var(--font-body)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="free-plan-nudge-title" style={{ fontFamily: "var(--font-cormorant)", fontSize: "22px", fontWeight: 600, color: "var(--ink)", marginTop: 0, marginBottom: 12 }}>
              {freePlanNudgeItemCount >= FREE_LOGGED_IN_ITEM_LIMIT
                ? "You've filled your free shed."
                : "One item left on your free plan."}
            </h2>
            <p style={{ fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.5, marginBottom: 24 }}>
              {freePlanNudgeItemCount >= FREE_LOGGED_IN_ITEM_LIMIT
                ? "Upgrade to keep adding items — plans start at $2.99/month."
                : "Upgrade to keep going — plans start at $2.99/month."}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  freePlanNudgeDismissedThisSessionRef.current = true;
                  setShowFreePlanNudge(false);
                  setPaywallVoluntary(true);
                  setShowPaywallModal(true);
                }}
                style={{
                  width: "100%",
                  padding: "14px 20px",
                  background: "var(--ink)",
                  color: "var(--white)",
                  border: "none",
                  borderRadius: 12,
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Upgrade now
              </button>
              <button
                type="button"
                onClick={() => {
                  freePlanNudgeDismissedThisSessionRef.current = true;
                  setShowFreePlanNudge(false);
                }}
                style={{
                  width: "100%",
                  padding: "14px 20px",
                  background: "transparent",
                  color: "var(--ink-soft)",
                  border: "1px solid var(--surface2)",
                  borderRadius: 12,
                  fontSize: 16,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
      <ShedSignupModal open={shedSignupModalOpen} onClose={() => setShedSignupModalOpen(false)} />
      {showGuestGateModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="guest-gate-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            background: "rgba(0,0,0,0.5)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowGuestGateModal(false);
            }
          }}
        >
          <div
            style={{
              background: "var(--white)",
              borderRadius: 18,
              padding: 28,
              maxWidth: 380,
              width: "100%",
              boxShadow: "0 8px 32px rgba(44,36,22,0.15)",
              fontFamily: "var(--font-body)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="guest-gate-title" style={{ fontFamily: "var(--font-cormorant)", fontSize: "22px", fontWeight: 600, color: "var(--ink)", marginTop: 0, marginBottom: 12 }}>
              Keep your shed.
            </h2>
            <p style={{ fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.5, marginBottom: 24 }}>
              {MOMENT_COPY.guestGateBody}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Link
                href="/set-password"
                onClick={() => {
                  setShowGuestGateModal(false);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "14px 20px",
                  background: "var(--ink)",
                  color: "var(--white)",
                  borderRadius: 12,
                  fontSize: 16,
                  fontWeight: 600,
                  textAlign: "center",
                  textDecoration: "none",
                  boxSizing: "border-box",
                }}
              >
                Create a free account
              </Link>
              <button
                type="button"
                onClick={() => {
                  guestGateDismissedRef.current = true;
                  markGuestGateDismissed();
                  setShowGuestGateModal(false);
                }}
                style={{
                  width: "100%",
                  padding: "14px 20px",
                  background: "transparent",
                  color: "var(--ink-soft)",
                  border: "1px solid var(--surface2)",
                  borderRadius: 12,
                  fontSize: 16,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
      {showAiConsent && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 999, padding: "16px" }}>
          <div style={{ background: "var(--white)", borderRadius: "16px", padding: "28px 24px", maxWidth: "400px", width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
            <h2 style={{ fontFamily: "var(--font-cormorant)", fontSize: "22px", fontWeight: 600, color: "var(--ink)", marginBottom: "12px" }}>
              A note about AI
            </h2>
            <p style={{ fontSize: "14px", color: "var(--ink-soft)", lineHeight: 1.6, marginBottom: "20px" }}>
              GoShed uses AI to analyze your photos and suggest what to do with your items. Photos are sent to <strong style={{ color: "var(--ink)" }}>Anthropic (Claude)</strong> to generate recommendations. We don&apos;t use your data for advertising or share it with anyone else.
            </p>
            <button
              type="button"
              onClick={() => void handleAiConsentAccept()}
              style={{ width: "100%", padding: "14px", fontSize: "15px", fontWeight: 600, borderRadius: "10px", border: "none", background: "var(--ink)", color: "var(--white)", cursor: "pointer" }}
            >
              Got it
            </button>
            <p style={{ fontSize: "11px", color: "var(--ink-soft)", marginTop: "12px", textAlign: "center" }}>
              By continuing you agree to our{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--ink-soft)" }}>
                Privacy Policy
              </a>
              {" "}and{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "var(--ink-soft)" }}>
                Terms
              </a>
              .
            </p>
          </div>
        </div>
      )}
    </main>
  );
}

export default function Home() {
  return <HomeContent />;
}
