export default function Home() {
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
        <div style={{
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
        }}>
          <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '24px', fontStyle: 'italic', color: 'var(--ink)', textAlign: 'center', padding: '0 24px' }}>
            What are you holding onto?
          </p>
          <p style={{ fontSize: '13px', color: 'var(--ink-soft)' }}>
            Snap a picture — we'll figure out the rest
          </p>
        </div>
      </div>
    </main>
  )
}