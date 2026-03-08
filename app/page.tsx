'use client';

import { useRef, useState, useEffect } from 'react';

type AnalyzeResult = {
  item_label: string;
  value_range: string;
  shippable: boolean;
  description: string;
};

type RecommendResult = {
  recommendation: 'gift' | 'donate' | 'sell' | 'keep' | 'trash';
  reason: string;
  next_step: string;
};

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

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleZoneClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
    setError(null);
    setRecommendResult(null);
    setRecommendError(null);
    setLoading(true);

    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || data.details || 'Analysis failed');
        return;
      }
      const analysis = data as AnalyzeResult;
      setResult(analysis);
      setLoading(false);

      setRecommendLoading(true);
      try {
        const recRes = await fetch('/api/recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_label: analysis.item_label,
            value_range: analysis.value_range,
            shippable: analysis.shippable,
          }),
        });
        const recData = await recRes.json();
        if (!recRes.ok) {
          setRecommendError(recData.error || recData.details || 'Recommendation failed');
          return;
        }
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

  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '48px 24px',
    }}>
      <div style={{ width: '100%', maxWidth: '390px' }}>
        <h1 style={{
          fontFamily: 'var(--font-cormorant)',
          fontSize: '40px',
          fontWeight: 300,
          color: 'var(--ink)',
          lineHeight: 1,
        }}>
          go<em style={{ color: 'var(--accent)' }}>shed</em>
        </h1>
        <p style={{ color: 'var(--ink-soft)', fontSize: '12px', letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: '4px' }}>
          let it go, beautifully
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
          aria-hidden
        />
        <div
          role="button"
          tabIndex={0}
          onClick={handleZoneClick}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleZoneClick(); } }}
          style={{
            marginTop: '32px',
            background: 'var(--surface)',
            borderRadius: '28px',
            border: '1.5px dashed var(--soft)',
            height: '280px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            cursor: 'pointer',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Selected item"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: '26px',
              }}
            />
          ) : (
            <>
              <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '24px', fontStyle: 'italic', color: 'var(--ink)', textAlign: 'center', padding: '0 24px' }}>
                What are you holding onto?
              </p>
              <p style={{ fontSize: '13px', color: 'var(--ink-soft)' }}>
                Snap a picture — we'll figure out the rest
              </p>
            </>
          )}
        </div>

        {loading && (
          <div style={{
            marginTop: '20px',
            padding: '24px',
            background: 'var(--surface)',
            borderRadius: '16px',
            border: '1px solid var(--surface2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
          }}>
            <span style={{
              width: '24px',
              height: '24px',
              border: '2px solid var(--soft)',
              borderTopColor: 'var(--accent)',
              borderRadius: '50%',
              animation: 'goshed-spin 0.8s linear infinite',
            }} />
            <span style={{ color: 'var(--ink-soft)', fontSize: '14px' }}>Analyzing…</span>
          </div>
        )}

        {!loading && result && (
          <div style={{
            marginTop: '20px',
            padding: '20px',
            background: 'var(--white)',
            borderRadius: '16px',
            border: '1px solid var(--surface2)',
            boxShadow: '0 2px 8px rgba(44, 36, 22, 0.06)',
          }}>
            <p style={{
              fontFamily: 'var(--font-cormorant)',
              fontSize: '18px',
              fontWeight: 500,
              color: 'var(--ink)',
              marginBottom: '8px',
            }}>
              {result.item_label}
            </p>
            <p style={{ fontSize: '13px', color: 'var(--accent)', marginBottom: '8px' }}>
              {result.value_range}
            </p>
            <p style={{
              fontSize: '12px',
              color: 'var(--ink-soft)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '12px',
            }}>
              {result.shippable ? 'Shippable' : 'Not shippable'}
            </p>
            <p style={{ fontSize: '14px', color: 'var(--ink)', lineHeight: 1.5 }}>
              {result.description}
            </p>
          </div>
        )}

        {result && recommendLoading && (
          <div style={{
            marginTop: '16px',
            padding: '20px',
            background: 'var(--surface)',
            borderRadius: '16px',
            border: '1px solid var(--surface2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
          }}>
            <span style={{
              width: '22px',
              height: '22px',
              border: '2px solid var(--soft)',
              borderTopColor: 'var(--accent)',
              borderRadius: '50%',
              animation: 'goshed-spin 0.8s linear infinite',
            }} />
            <span style={{ color: 'var(--ink-soft)', fontSize: '14px' }}>Getting recommendation…</span>
          </div>
        )}

        {result && !recommendLoading && recommendResult && (
          <div style={{
            marginTop: '16px',
            padding: '20px',
            background: 'var(--surface)',
            borderRadius: '16px',
            border: '1px solid var(--soft)',
            boxShadow: '0 2px 8px rgba(44, 36, 22, 0.06)',
          }}>
            <p style={{
              fontSize: '11px',
              color: 'var(--ink-soft)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              marginBottom: '8px',
            }}>
              Our recommendation
            </p>
            <p style={{
              fontFamily: 'var(--font-cormorant)',
              fontSize: '22px',
              fontWeight: 500,
              color: 'var(--accent)',
              marginBottom: '12px',
              textTransform: 'capitalize',
            }}>
              {recommendResult.recommendation}
            </p>
            <p style={{ fontSize: '14px', color: 'var(--ink)', lineHeight: 1.55, marginBottom: '14px' }}>
              {recommendResult.reason}
            </p>
            <p style={{
              fontSize: '13px',
              color: 'var(--green)',
              fontWeight: 500,
              lineHeight: 1.4,
            }}>
              Next step: {recommendResult.next_step}
            </p>
          </div>
        )}

        {result && !recommendLoading && recommendError && (
          <div style={{
            marginTop: '16px',
            padding: '16px',
            background: 'var(--surface)',
            borderRadius: '12px',
            border: '1px solid var(--soft)',
            color: 'var(--ink-soft)',
            fontSize: '14px',
          }}>
            {recommendError}
          </div>
        )}

        {!loading && error && (
          <div style={{
            marginTop: '20px',
            padding: '16px',
            background: 'var(--surface)',
            borderRadius: '12px',
            border: '1px solid var(--soft)',
            color: 'var(--ink-soft)',
            fontSize: '14px',
          }}>
            {error}
          </div>
        )}
      </div>
    </main>
  );
}