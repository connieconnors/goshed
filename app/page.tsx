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
            <p style={{ fontSize: '11px', color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px' }}>
              What do you want to do?
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {DECISION_BUTTONS.map(btn => (
                <button key={btn.id} onClick={() => setChosenDecision(btn.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', background: btn.id === recommendResult.recommendation ? btn.color : 'var(--surface)', color: btn.id === recommendResult.recommendation ? 'white' : 'var(--ink)', border: `1.5px solid ${btn.id === recommendResult.recommendation ? btn.color : 'var(--soft)'}`, borderRadius: '12px', padding: '10px 14px', fontSize: '13px', fontWeight: btn.id === recommendResult.recommendation ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                  <span>{btn.emoji}</span>
                  <span>{btn.label}</span>
                  {btn.id === recommendResult.recommendation && <span style={{ marginLeft: 'auto', fontSize: '10px', opacity: 0.8 }}>★</span>}
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
