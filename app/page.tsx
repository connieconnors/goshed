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

const DECISION_BUTTONS = [
  { id: 'gift',      emoji: '🎁', label: 'Gift',      color: '#6b4fa0' },
  { id: 'donate',    emoji: '🤲', label: 'Donate',    color: '#4e7c4e' },
  { id: 'sell',      emoji: '🏷️', label: 'Sell',      color: '#c07a2a' },
  { id: 'curb',      emoji: '🪧', label: 'Curb it',   color: '#4a7a8a' },
  { id: 'repurpose', emoji: '♻️', label: 'Repurpose', color: '#7a6a3a' },
  { id: 'keep',      emoji: '🗂️', label: 'Keep',      color: '#888'    },
  { id: 'trash',     emoji: '🗑️', label: 'Trash',     color: '#a05050' },
];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

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
    setLoading(true);

    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || data.details || 'Analysis failed'); return; }
      const analysis = data as AnalyzeResult;
      setResult(analysis);
      setLoading(false);

      setRecommendLoading(true);
      try {
        const recRes = await fetch('/api/recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_label: analysis.item_label, value_range: analysis.value_range, shippable: analysis.shippable }),
        });
        const recData = await recRes.json();
        if (!recRes.ok) { setRecommendError(recData.error || recData.details || 'Recommendation failed'); return; }
        setRecommendResult(recData as RecommendResult);
      } catch (recErr) {
        setRecommendError(recErr instanceof Error ? recErr.message : 'Something went wrong');
      } finally {
        setRecommendLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const recommendedBtn = recommendResult
    ? DECISION_BUTTONS.find(b => b.id === recommendResult.recommendation)
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

        {/* Analyzing spinner */}
        {loading && (
          <div style={{ marginTop: '20px', padding: '24px', background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <span style={{ width: '24px', height: '24px', border: '2px solid var(--soft)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'goshed-spin 0.8s linear infinite' }} />
            <span style={{ color: 'var(--ink-soft)', fontSize: '14px' }}>Analyzing…</span>
          </div>
        )}

        {/* Analysis card */}
        {!loading && result && (
          <div style={{ marginTop: '20px', padding: '20px', background: 'var(--white)', borderRadius: '16px', border: '1px solid var(--surface2)', boxShadow: '0 2px 8px rgba(44,36,22,0.06)' }}>
            <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '18px', fontWeight: 500, color: 'var(--ink)', marginBottom: '8px' }}>{result.item_label}</p>
            <p style={{ fontSize: '13px', color: 'var(--accent)', marginBottom: '8px' }}>{result.value_range}</p>
            <p style={{ fontSize: '12px', color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
              {result.shippable ? 'Shippable' : 'Local only'}
            </p>
            <p style={{ fontSize: '14px', color: 'var(--ink)', lineHeight: 1.5 }}>{result.description}</p>
          </div>
        )}

        {/* Recommendation spinner */}
        {result && recommendLoading && (
          <div style={{ marginTop: '16px', padding: '20px', background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <span style={{ width: '22px', height: '22px', border: '2px solid var(--soft)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'goshed-spin 0.8s linear infinite' }} />
            <span style={{ color: 'var(--ink-soft)', fontSize: '14px' }}>Getting recommendation…</span>
          </div>
        )}

        {/* Recommendation card */}
        {result && !recommendLoading && recommendResult && (
          <div style={{ marginTop: '16px', padding: '20px', background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--soft)', boxShadow: '0 2px 8px rgba(44,36,22,0.06)' }}>
            <p style={{ fontSize: '11px', color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>Our recommendation</p>
            {recommendedBtn && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: recommendedBtn.color, borderRadius: '20px', padding: '6px 16px', marginBottom: '12px' }}>
                <span>{recommendedBtn.emoji}</span>
                <span style={{ color: 'white', fontWeight: 600, fontSize: '15px' }}>{recommendedBtn.label}</span>
              </div>
            )}
            <p style={{ fontSize: '14px', color: 'var(--ink)', lineHeight: 1.55, marginBottom: '14px' }}>{recommendResult.reason}</p>
            {!chosenDecision && (
              <p style={{ fontSize: '13px', color: 'var(--green)', fontWeight: 500, lineHeight: 1.4 }}>
                Next step: {recommendResult.next_step}
              </p>
            )}
          </div>
        )}

        {/* Decision buttons */}
        {result && !recommendLoading && recommendResult && !chosenDecision && (
          <div style={{ marginTop: '16px' }}>
            {/* Primary recommended action */}
            <button
              onClick={() => setChosenDecision(recommendResult.recommendation)}
              style={{
                width: '100%',
                height: '44px',
                background: 'var(--green)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 600,
                fontFamily: 'inherit',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '12px',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#4d5e47')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--green)')}
            >
              {(() => {
                const icons: Record<string, React.ReactNode> = {
                  gift: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="8" width="18" height="14" rx="2"/><path d="M12 8v14M3 13h18"/><path d="M8 8c0-2.2 1.8-4 4-4s4 1.8 4 4"/></svg>,
                  donate: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
                  sell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
                  curb: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>,
                  repurpose: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
                  keep: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>,
                  trash: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
                };
                const labels: Record<string, string> = { gift: 'Gift', donate: 'Donate', sell: 'Sell', curb: 'Curb it', repurpose: 'Repurpose', keep: 'Keep', trash: 'Trash' };
                return <>{icons[recommendResult.recommendation]}<span>{labels[recommendResult.recommendation]}</span></>;
              })()}
            </button>

            {/* Other possibilities */}
            <p style={{ fontSize: '11px', color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>
              Other possibilities
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {[
                { id: 'gift', label: 'Gift', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="8" width="18" height="14" rx="2"/><path d="M12 8v14M3 13h18"/><path d="M8 8c0-2.2 1.8-4 4-4s4 1.8 4 4"/></svg> },
                { id: 'sell', label: 'Sell', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> },
                { id: 'repurpose', label: 'Repurpose', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> },
                { id: 'keep', label: 'Keep', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> },
                { id: 'curb', label: 'Curb it', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg> },
                { id: 'trash', label: 'Trash', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> },
              ].filter(b => b.id !== recommendResult.recommendation).map(btn => (
                <button
                  key={btn.id}
                  onClick={() => setChosenDecision(btn.id)}
                  style={{
                    height: '44px',
                    padding: '0 16px',
                    background: 'var(--white)',
                    color: 'var(--green)',
                    border: '1px solid #D8CDBE',
                    borderRadius: '12px',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--white)')}
                >
                  {btn.icon}
                  <span>{btn.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Post-decision confirmation */}
        {chosenDecision && recommendResult && (
          <div style={{ marginTop: '16px', padding: '20px', background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--soft)' }}>
            {(() => {
              const btn = DECISION_BUTTONS.find(b => b.id === chosenDecision);
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '20px' }}>{btn?.emoji}</span>
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
          <div style={{ marginTop: '16px', padding: '16px', background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--soft)', color: 'var(--ink-soft)', fontSize: '14px' }}>{recommendError}</div>
        )}
        {!loading && error && (
          <div style={{ marginTop: '20px', padding: '16px', background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--soft)', color: 'var(--ink-soft)', fontSize: '14px' }}>{error}</div>
        )}

      </div>
    </main>
  );
}
