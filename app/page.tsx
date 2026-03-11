'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase';

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

type NearbyCharitiesLocal = { name: string; address: string; rating?: number; open_now: boolean | null; place_id: string };
type NearbyCharitiesNational = { name: string; note: string; url: string };
type NearbyCharitiesResponse = {
  local: NearbyCharitiesLocal[];
  national: NearbyCharitiesNational[];
  source: string;
  item_label?: string | null;
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

/** Confirmation / done label: "Listed ✓", "Donated ✓", etc. */
export const DECISION_DONE_LABELS: Record<RecommendResult['recommendation'], string> = {
  sell: 'Listed ✓',
  donate: 'Donated ✓',
  gift: 'Gifted ✓',
  keep: 'Kept ✓',
  repurpose: 'Repurposed ✓',
  curb: 'Curbed ✓',
  trash: 'Trashed ✓',
};

const LOADING_PHRASES = [
  'Looking at what this is',
  'Checking useful possibilities',
  'Finding the best next life',
];

/** Fallback national pickup list when API fails (mirrors API default). */
const NATIONAL_PICKUP_FALLBACK: NearbyCharitiesNational[] = [
  { name: 'Habitat for Humanity ReStore', note: 'Accepts furniture, appliances, building materials. Free pickup available.', url: 'https://www.habitat.org/restores' },
  { name: 'Vietnam Veterans of America', note: 'Accepts clothing, housewares, small furniture. Free pickup.', url: 'https://pickupplease.org' },
  { name: 'Salvation Army', note: 'Accepts most household items. Pickup available in many areas.', url: 'https://www.salvationarmyusa.org/usn/donate-goods' },
];

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

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
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
  const [nearbyCharities, setNearbyCharities] = useState<NearbyCharitiesResponse | null>(null);
  const [nearbyCharitiesLoading, setNearbyCharitiesLoading] = useState(false);
  const lastNearbyFetchKeyRef = useRef<string | null>(null);
  const analysisImageDataUrlRef = useRef<string | null>(null);
  const savedForItemRef = useRef<string | null>(null);
  const savedItemIdRef = useRef<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [decisionJustConfirmed, setDecisionJustConfirmed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      const res = await fetch("/api/auth/session", { credentials: "include" });
      const { user } = await res.json().catch(() => ({ user: null }));
      setIsLoggedIn(!!user);
    };
    checkSession();
    const supabase = createSupabaseBrowserClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => checkSession());
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const redirect = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("redirect_after_login") : null;
    if (!redirect) return;
    fetch("/api/auth/session", { credentials: "include" })
      .then((res) => res.json().catch(() => ({ user: null })))
      .then(({ user }) => {
        if (user) {
          sessionStorage.removeItem("redirect_after_login");
          window.location.href = redirect;
        }
      });
  }, []);
  useEffect(() => {
    return () => { if (refinementPhotoUrl) URL.revokeObjectURL(refinementPhotoUrl); };
  }, [refinementPhotoUrl]);

  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => {
      setLoadingPhraseIndex(i => (i + 1) % LOADING_PHRASES.length);
    }, 1500);
    return () => clearInterval(id);
  }, [loading]);

  // When donate is recommended, fetch nearby charities (with geolocation if allowed). Only once per recommendation.
  useEffect(() => {
    console.log('[nearby-charities] effect ran', { recommendation: recommendResult?.recommendation, item_label: result?.item_label });
    if (!recommendResult || recommendResult.recommendation !== 'donate' || !result?.item_label) {
      setNearbyCharities(null);
      lastNearbyFetchKeyRef.current = null;
      return;
    }
    const key = `donate-${result.item_label}`;
    if (lastNearbyFetchKeyRef.current === key) return;
    lastNearbyFetchKeyRef.current = key;

    let cancelled = false;
    let fetchFired = false;
    setNearbyCharitiesLoading(true);
    const fetchWithLocation = (lat?: number, lng?: number) => {
      const hasCoords = lat != null && lng != null;
      if (fetchFired && !hasCoords) return;
      fetchFired = true; // set immediately so 10s fallback skips
      console.log('[nearby-charities] sending lat/lng:', lat, lng);
      fetch('/api/nearby-charities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat,
          lng,
          item_label: result.item_label,
        }),
      })
        .then((res) => res.json())
        .then((data: NearbyCharitiesResponse) => {
          console.log('[nearby-charities] API response:', { local: data.local, national: data.national, source: data.source });
          if (!cancelled) {
            setNearbyCharities(data);
            console.log('[nearby-charities] setting state with:', data.local?.length, 'local results, source:', data.source);
          } else {
            console.log('[nearby-charities] skipped setState (cancelled)');
          }
        })
        .catch(() => {
          if (!cancelled && !hasCoords) {
            setNearbyCharities({ local: [], national: NATIONAL_PICKUP_FALLBACK, source: 'national_only' });
          }
        })
        .finally(() => {
          if (!cancelled) setNearbyCharitiesLoading(false);
        });
    };
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      console.log('[nearby-charities] requesting geolocation...');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          console.log('[nearby-charities] geolocation success', pos.coords.latitude, pos.coords.longitude);
          fetchWithLocation(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          console.log('[nearby-charities] geolocation error/denied', err?.code, err?.message);
          fetchWithLocation();
        },
        { timeout: 8000, maximumAge: 300000 }
      );
      // If user never responds to permission prompt, callback may never fire. Fallback so we still call the API.
      const fallback = setTimeout(() => {
        if (!fetchFired && !cancelled) {
          console.log('[nearby-charities] geolocation fallback (no response in 10s), fetching national only');
          fetchWithLocation();
        }
      }, 10000);
      return () => { cancelled = true; clearTimeout(fallback); };
    } else {
      console.log('[nearby-charities] no geolocation API, fetching national only');
      fetchWithLocation();
    }
    return () => { cancelled = true; };
  }, [recommendResult?.recommendation, result?.item_label]);

  const handleZoneClick = () => inputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
    setError(null);
    setRecommendResult(null);
    setRecommendError(null);
    setChosenDecision(null);
    setNearbyCharities(null);
    savedForItemRef.current = null;
    savedItemIdRef.current = null;
    setLoadingPhraseIndex(0);
    setRefinementNote('');
    setShowNoteInput(false);
    if (refinementPhotoUrl) URL.revokeObjectURL(refinementPhotoUrl);
    setRefinementPhotoUrl(null);
    setLoading(true);

    try {
      const dataUrl = await resizeAndToDataUrl(file);
      analysisImageDataUrlRef.current = dataUrl;
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      });
      const raw = await res.text();
      let data: { error?: string; details?: string } & AnalyzeResult;
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        setError('We couldn\'t analyze this image. Try again or use a different photo.');
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
  };

  // Save to Supabase when we have analysis + recommendation and user is logged in (once per item)
  useEffect(() => {
    if (!result || !recommendResult || isLoggedIn !== true) return;
    const key = `${result.item_label}-${recommendResult.recommendation}`;
    if (savedForItemRef.current === key) return;
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
      .then((data: { id?: string }) => {
        if (data?.id) savedItemIdRef.current = data.id;
      })
      .catch((err) => console.error('[shed] save item failed:', err));
  }, [result, recommendResult, isLoggedIn]);

  const recommendedAction = recommendResult
    ? ACTION_OPTIONS.find(o => o.id === recommendResult.recommendation)
    : null;

  const handlePrimaryDecision = () => {
    if (!recommendResult) return;
    const decision = recommendResult.recommendation;
    setChosenDecision(decision);
    setDecisionJustConfirmed(true);
    if (savedItemIdRef.current) {
      fetch(`/api/items/${savedItemIdRef.current}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' }),
      }).catch((err) => console.error('[shed] mark decision failed:', err));
    }
    setTimeout(() => setDecisionJustConfirmed(false), 800);
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
      setRecommendResult(recData as RecommendResult);
      setChosenDecision(optionId);
      if (savedItemIdRef.current) {
        fetch(`/api/items/${savedItemIdRef.current}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recommendation: optionId }),
        }).catch((err) => console.error('[shed] update item recommendation failed:', err));
      }
    } catch {
      setRecommendError('retry');
    } finally {
      setRecommendLoading(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px' }}>
      <div style={{ width: '100%', maxWidth: '390px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-cormorant)', fontSize: '40px', fontWeight: 300, color: 'var(--ink)', lineHeight: 1 }}>
              go<em style={{ color: 'var(--accent)' }}>shed</em>
            </h1>
            <p style={{ color: 'var(--ink-soft)', fontSize: '12px', letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: '4px' }}>
              let it go, beautifully
            </p>
          </div>
          <div style={{ marginTop: '8px' }}>
            {mounted && isLoggedIn === true && (
              <Link href="/dashboard" style={{ fontSize: '12px', color: 'var(--ink-soft)', textDecoration: 'none', borderBottom: '1px solid var(--soft)', paddingBottom: '1px' }}>
                My Shed
              </Link>
            )}
            {mounted && isLoggedIn === false && (
              <Link href="/login" style={{ fontSize: '12px', color: 'var(--ink-soft)', textDecoration: 'none', borderBottom: '1px solid var(--soft)', paddingBottom: '1px' }}>
                Sign in
              </Link>
            )}
          </div>
        </div>

        {/* Photo zone */}
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange}
          style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} aria-hidden />
        <div role="button" tabIndex={0} onClick={handleZoneClick}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleZoneClick(); } }}
          style={{ marginTop: '28px', background: 'var(--surface)', borderRadius: '20px', border: '1.5px dashed var(--soft)', height: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', cursor: 'pointer', overflow: 'hidden', position: 'relative' }}>
          {previewUrl ? (
            <img src={previewUrl} alt="Selected item" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '26px' }} />
          ) : (
            <>
              <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '24px', fontStyle: 'italic', color: 'var(--ink)', textAlign: 'center', padding: '0 24px' }}>
                What are you holding onto?
              </p>
              <p style={{ fontSize: '13px', color: 'var(--ink-soft)' }}>Snap a picture — we'll figure out the rest</p>
            </>
          )}
        </div>

        {/* Logged-out only: tagline, example pills, no-account line */}
        {mounted && isLoggedIn === false && (
          <div style={{ marginTop: '28px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '20px', fontWeight: 300, color: 'var(--ink-soft)', lineHeight: 1.4, margin: 0 }}>
              GoShed tells you what to do with it.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
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
            <p style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '14px', marginBottom: 0 }}>
              No account needed to try
            </p>
          </div>
        )}

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
            <p style={{ fontSize: '13px', lineHeight: 1.3, fontWeight: 500, color: 'var(--ink-soft)', marginBottom: '10px' }}>
              {result.shippable ? 'Easy to ship' : 'Local only'}
            </p>
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

            {/* Other options: pill chips */}
            <p style={{ fontSize: '13px', lineHeight: 1.2, fontWeight: 500, color: 'var(--ink-soft)', textAlign: 'center', marginTop: '18px', marginBottom: '10px' }}>Other options</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px' }}>
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

            {/* Where to donate: nearby + national fallback (only when recommendation is donate) */}
            {recommendResult.recommendation === 'donate' && (
              <div style={{ marginTop: '20px', padding: '16px', background: 'var(--white)', borderRadius: '14px', border: '1px solid var(--surface2)' }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginTop: 0, marginBottom: '12px' }}>Where to donate</p>
                {nearbyCharitiesLoading ? (
                  <p style={{ fontSize: '13px', color: 'var(--ink-soft)', margin: 0 }}>Finding nearby options…</p>
                ) : nearbyCharities ? (
                  <>
                    {nearbyCharities.local.length > 0 && (
                      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px 0' }}>
                        {nearbyCharities.local.map((place) => (
                          <li key={place.place_id} style={{ fontSize: '13px', color: 'var(--ink)', marginBottom: '8px', lineHeight: 1.4 }}>
                            <a href={`https://www.google.com/maps/search/?api=1&query_place_id=${place.place_id}`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 500, color: 'var(--accent)', textDecoration: 'none' }}>{place.name}</a>
                            {place.address && <span style={{ color: 'var(--ink-soft)', display: 'block', marginTop: '2px' }}>{place.address}</span>}
                            {(place.rating != null || place.open_now != null) && (
                              <span style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>
                                {place.rating != null && ` ★ ${place.rating}`}
                                {place.open_now === true && ' · Open now'}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--ink-soft)', marginTop: nearbyCharities.local.length ? 8 : 0, marginBottom: '6px' }}>National pickup</p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {nearbyCharities.national.map((org) => (
                        <li key={org.name} style={{ fontSize: '13px', marginBottom: '12px', lineHeight: 1.4 }}>
                          <a href={org.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 500, color: 'var(--accent)', textDecoration: 'none' }}>{org.name}</a>
                          <span style={{ color: 'var(--ink-soft)', display: 'block', marginTop: '2px' }}>{org.note}</span>
                          {/pickup/i.test(org.note) && (
                            <a href={org.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', display: 'inline-block', marginTop: '4px' }}>Schedule free pickup →</a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            )}
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
                const doneLabel = DECISION_DONE_LABELS[chosenDecision as keyof typeof DECISION_DONE_LABELS] ?? `${displayLabel} ✓`;
                return (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                      <span style={{ display: 'flex', width: '24px', height: '24px', borderRadius: '50%', background: 'var(--green)', color: 'var(--white)', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700 }}>✓</span>
                      <span style={{ fontFamily: 'var(--font-cormorant)', fontSize: '16px', fontWeight: 600, color: 'var(--ink)' }}>
                        {doneLabel.replace(' ✓', '')} — good call.
                      </span>
                    </div>
                    <p style={{ fontSize: '14px', color: 'var(--ink)', lineHeight: 1.5, marginBottom: '8px' }}>
                      {firstSentence(recommendResult.reason)}
                    </p>
                    <p style={{ fontSize: '14px', color: 'var(--green)', fontWeight: 500, lineHeight: 1.5, marginBottom: '14px' }}>
                      {recommendResult.next_step}
                    </p>
                    <button onClick={() => setChosenDecision(null)}
                      style={{ fontSize: '13px', color: 'var(--ink-soft)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                      ← Change my mind
                    </button>
                  </>
                );
              })()}
            </div>

            {/* Where to donate: also show when user overrode to donate */}
            {chosenDecision === 'donate' && (
              <div style={{ marginTop: '20px', padding: '16px', background: 'var(--white)', borderRadius: '14px', border: '1px solid var(--surface2)' }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginTop: 0, marginBottom: '12px' }}>Where to donate</p>
                {nearbyCharitiesLoading ? (
                  <p style={{ fontSize: '13px', color: 'var(--ink-soft)', margin: 0 }}>Finding nearby options…</p>
                ) : nearbyCharities ? (
                  <>
                    {nearbyCharities.local.length > 0 && (
                      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px 0' }}>
                        {nearbyCharities.local.map((place) => (
                          <li key={place.place_id} style={{ fontSize: '13px', color: 'var(--ink)', marginBottom: '8px', lineHeight: 1.4 }}>
                            <a href={`https://www.google.com/maps/search/?api=1&query_place_id=${place.place_id}`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 500, color: 'var(--accent)', textDecoration: 'none' }}>{place.name}</a>
                            {place.address && <span style={{ color: 'var(--ink-soft)', display: 'block', marginTop: '2px' }}>{place.address}</span>}
                            {(place.rating != null || place.open_now != null) && (
                              <span style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>
                                {place.rating != null && ` ★ ${place.rating}`}
                                {place.open_now === true && ' · Open now'}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--ink-soft)', marginTop: nearbyCharities.local.length ? 8 : 0, marginBottom: '6px' }}>National pickup</p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {nearbyCharities.national.map((org) => (
                        <li key={org.name} style={{ fontSize: '13px', marginBottom: '12px', lineHeight: 1.4 }}>
                          <a href={org.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 500, color: 'var(--accent)', textDecoration: 'none' }}>{org.name}</a>
                          <span style={{ color: 'var(--ink-soft)', display: 'block', marginTop: '2px' }}>{org.note}</span>
                          {/pickup/i.test(org.note) && (
                            <a href={org.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', display: 'inline-block', marginTop: '4px' }}>Schedule free pickup →</a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            )}
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
    </main>
  );
}
