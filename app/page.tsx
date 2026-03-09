'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';

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

const LOADING_PHRASES = [
  'Looking at what this is',
  'Checking useful possibilities',
  'Finding the best next life',
];

/** Derive shippable when analysis doesn't provide it: false if fragile, oversized, or full set; else true. */
function deriveShippable(analysis: { item_label?: string; description?: string }): boolean {
  const text = `${analysis.item_label ?? ''} ${analysis.description ?? ''}`.toLowerCase();
  if (/fragile|oversized|full set|set of|bulky|large piece|furniture|mirror|glass|breakable/.test(text)) {
    return false;
  }
  return true;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Return the first sentence of a string (up to and including the first period). */
function firstSentence(text: string): string {
  const trimmed = text.trim();
  const i = trimmed.indexOf('.');
  return i === -1 ? trimmed : trimmed.slice(0, i + 1).trim();
}

/** Recommendation headline: "Donate this", "Curb it", etc. */
function recommendationHeadline(label: string): string {
  return label === 'Curb it' ? label : `${label} this`;
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [recommendResult, setRecommendResult] = useState<RecommendResult | null>(null);
  const [recommendError, setRecommendError] = useState<string | null>(null);
  const [chosenDecision, setChosenDecision] = useState<string | null>(null);
  const [loadingPhraseIndex, setLoadingPhraseIndex] = useState(0);

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => {
      setLoadingPhraseIndex(i => (i + 1) % LOADING_PHRASES.length);
    }, 1500);
    return () => clearInterval(id);
  }, [loading]);

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
    setLoadingPhraseIndex(0);
    setLoading(true);

    try {
      const dataUrl = await fileToDataUrl(file);
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

  const recommendedAction = recommendResult
    ? ACTION_OPTIONS.find(o => o.id === recommendResult.recommendation)
    : null;

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
          <Link href="/login" style={{ fontSize: '12px', color: 'var(--ink-soft)', textDecoration: 'none', marginTop: '8px', borderBottom: '1px solid var(--soft)', paddingBottom: '1px' }}>
            Sign in
          </Link>
        </div>

        {/* Photo zone */}
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange}
          style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} aria-hidden />
        <div role="button" tabIndex={0} onClick={handleZoneClick}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleZoneClick(); } }}
          style={{ marginTop: '32px', background: 'var(--surface)', borderRadius: '28px', border: '1.5px dashed var(--soft)', height: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', cursor: 'pointer', overflow: 'hidden', position: 'relative' }}>
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
          <div style={{ marginTop: '24px', padding: '20px', background: 'var(--white)', borderRadius: '16px', border: '1px solid var(--surface2)', boxShadow: '0 2px 8px rgba(44,36,22,0.06)' }}>
            <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '18px', fontWeight: 500, color: 'var(--ink)', marginBottom: '8px' }}>{result.item_label}</p>
            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--accent)', marginBottom: '8px' }}>{result.value_range}</p>
            <p style={{ fontSize: '12px', color: 'var(--ink-soft)', letterSpacing: '0.04em', marginBottom: '12px' }}>
              {result.shippable ? 'Shipping possible' : 'Local only'}
            </p>
            <p style={{ fontSize: '13px', color: 'var(--ink-soft)', lineHeight: 1.5, marginBottom: 0 }}>{firstSentence(result.description)}</p>
          </div>
        )}

        {/* Recommendation spinner */}
        {result && recommendLoading && (
          <div style={{ marginTop: '24px', padding: '20px', background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <span style={{ width: '22px', height: '22px', border: '2px solid var(--soft)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'goshed-spin 0.8s linear infinite' }} />
            <span style={{ color: 'var(--ink-soft)', fontSize: '14px' }}>Getting recommendation…</span>
          </div>
        )}

        {/* Recommendation card */}
        {result && !recommendLoading && recommendResult && (
          <div style={{ marginTop: '24px', padding: '24px', background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--soft)', boxShadow: '0 2px 8px rgba(44,36,22,0.06)' }}>
            <p style={{ fontSize: '11px', color: 'var(--ink-soft)', letterSpacing: '0.06em', marginBottom: '12px', marginTop: 0 }}>Best Next Life</p>
            <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '18px', fontWeight: 600, color: 'var(--ink)', marginBottom: '10px', marginTop: 0 }}>
              {recommendationHeadline(ACTION_OPTIONS.find(o => o.id === recommendResult.recommendation)?.label ?? recommendResult.recommendation)}
            </p>
            <p style={{ fontSize: '14px', color: 'var(--ink)', lineHeight: 1.5, marginBottom: 0, marginTop: 0 }}>{firstSentence(recommendResult.reason)}</p>
          </div>
        )}

        {/* Primary action: single medium-width button centered below card */}
        {result && !recommendLoading && recommendResult && !chosenDecision && recommendedAction && (
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button
              onClick={() => setChosenDecision(recommendResult.recommendation)}
              style={{
                height: '42px',
                paddingLeft: '28px',
                paddingRight: '28px',
                background: 'var(--green)',
                color: 'white',
                border: 'none',
                borderRadius: '14px',
                fontSize: '14px',
                fontWeight: 500,
                fontFamily: 'inherit',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {recommendedAction.icon}
              <span>{recommendedAction.label}</span>
            </button>

            {/* Alternative actions: quiet inline */}
            <p style={{ fontSize: '11px', color: 'var(--ink-soft)', letterSpacing: '0.04em', marginTop: '18px', marginBottom: '6px' }}>Or instead</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '4px 0', maxWidth: '320px', lineHeight: 1.6 }}>
              {ACTION_OPTIONS.filter(o => o.id !== recommendResult.recommendation).map((btn, i) => (
                <span key={btn.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
                  {i > 0 && <span style={{ color: 'var(--ink-soft)', fontSize: '12px', margin: '0 6px', opacity: 0.7 }}>·</span>}
                  <button
                    type="button"
                    onClick={() => setChosenDecision(btn.id)}
                    style={{
                      padding: 0,
                      background: 'none',
                      border: 'none',
                      color: 'var(--ink-soft)',
                      fontSize: '12px',
                      fontWeight: 400,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    {btn.label === 'Curb it' ? 'Curb' : btn.label}
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Post-decision confirmation */}
        {chosenDecision && recommendResult && (
          <div style={{ marginTop: '16px', padding: '24px', background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--soft)' }}>
            {(() => {
              const btn = ALL_DISPLAY_OPTIONS.find(b => b.id === chosenDecision);
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <span style={{ display: 'flex' }}>{btn?.icon}</span>
                    <span style={{ fontFamily: 'var(--font-cormorant)', fontSize: '18px', color: 'var(--ink)' }}>
                      {btn?.label} — good call.
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--green)', fontWeight: 500, lineHeight: 1.5, marginBottom: '16px' }}>
                    {recommendResult.next_step}
                  </p>
                  <button onClick={() => setChosenDecision(null)}
                    style={{ fontSize: '12px', color: 'var(--ink-soft)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                    ← Change my mind
                  </button>
                </>
              );
            })()}
          </div>
        )}

        {/* Errors */}
        {result && !recommendLoading && recommendError && (
          <div style={{ marginTop: '16px', padding: '16px', background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--soft)', color: 'var(--ink-soft)', fontSize: '14px' }}>
            <p style={{ margin: 0, marginBottom: '6px' }}>We couldn&apos;t decide just yet.</p>
            <p style={{ margin: 0, fontSize: '13px' }}>Try again or choose the best next life yourself.</p>
          </div>
        )}
        {!loading && error && (
          <div style={{ marginTop: '20px', padding: '16px', background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--soft)', color: 'var(--ink-soft)', fontSize: '14px' }}>{error}</div>
        )}

      </div>
    </main>
  );
}
