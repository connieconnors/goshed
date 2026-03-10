import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", padding: "48px 24px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <Link href="/" style={{ fontSize: "12px", color: "var(--ink-soft)", textDecoration: "none", marginBottom: 32, display: "inline-block" }}>
          ← Back to GoShed
        </Link>
        <h1 style={{ fontFamily: "var(--font-cormorant)", fontSize: "28px", fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>
          GoShed Privacy Policy
        </h1>
        <p style={{ fontSize: "13px", color: "var(--ink-soft)", marginBottom: 32 }}>Last Updated: March 2026</p>

        <section style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ink)", marginBottom: 24 }}>
            Privacy Policy for GoShed. GoShed (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;), a subsidiary of ThriftShopper Inc., is designed to help people make everyday decisions by providing suggestions, reminders, and recommendations. This Privacy Policy explains what information we collect and how we use it.
          </p>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontFamily: "var(--font-cormorant)", fontSize: "18px", fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>1. Information We Collect</h2>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ink)", marginBottom: 12 }}>
            We collect limited information necessary to operate GoShed.
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ink)", marginBottom: 4, fontWeight: 500 }}>Information you provide</p>
          <ul style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ink)", marginBottom: 12, paddingLeft: 20 }}>
            <li>Email address (when signing up)</li>
            <li>Any preferences or product information you choose to share</li>
            <li>Messages or feedback you send us</li>
          </ul>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ink)", marginBottom: 4, fontWeight: 500 }}>Automatically collected information</p>
          <ul style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ink)", marginBottom: 12, paddingLeft: 20 }}>
            <li>Device and browser type</li>
            <li>Basic usage analytics (pages visited, features used)</li>
            <li>Cookies or similar technologies used to improve performance</li>
          </ul>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ink)", marginBottom: 0 }}>We do not sell your personal data.</p>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontFamily: "var(--font-cormorant)", fontSize: "18px", fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>2. How We Use Information</h2>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ink)", marginBottom: 8 }}>We use collected information to:</p>
          <ul style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ink)", marginBottom: 0, paddingLeft: 20 }}>
            <li>Provide and improve GoShed&apos;s recommendations</li>
            <li>Personalize suggestions</li>
            <li>Maintain and improve system performance</li>
            <li>Communicate with users about updates or important changes</li>
          </ul>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontFamily: "var(--font-cormorant)", fontSize: "18px", fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>3. AI-Generated Recommendations</h2>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ink)", marginBottom: 8 }}>
            GoShed uses automated systems to generate suggestions and recommendations. These recommendations are based on available information and patterns but may not always be accurate or complete.
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ink)", marginBottom: 0 }}>
            Users should exercise their own judgment when making decisions based on these suggestions.
          </p>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontFamily: "var(--font-cormorant)", fontSize: "18px", fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>4. Data Storage</h2>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ink)", marginBottom: 0 }}>
            Your information may be stored on secure cloud infrastructure operated by trusted providers. We take reasonable steps to protect your data.
          </p>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontFamily: "var(--font-cormorant)", fontSize: "18px", fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>5. Third-Party Services</h2>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ink)", marginBottom: 0 }}>
            GoShed may use third-party services (such as analytics, hosting, or AI providers) to operate the platform. These services may process limited data necessary to provide functionality.
          </p>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontFamily: "var(--font-cormorant)", fontSize: "18px", fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>6. Your Choices</h2>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ink)", marginBottom: 8 }}>You may request to:</p>
          <ul style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ink)", marginBottom: 12, paddingLeft: 20 }}>
            <li>Access your data</li>
            <li>Correct inaccurate information</li>
            <li>Delete your account</li>
          </ul>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ink)", marginBottom: 0 }}>
            Contact: <a href="mailto:support@thriftshopper.com" style={{ color: "var(--accent)", textDecoration: "none" }}>support@thriftshopper.com</a>
          </p>
        </section>

        <section style={{ marginBottom: 0 }}>
          <h2 style={{ fontFamily: "var(--font-cormorant)", fontSize: "18px", fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>7. Changes to This Policy</h2>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ink)", marginBottom: 0 }}>
            We may update this Privacy Policy periodically. If we make significant changes, we will update the date at the top of this page.
          </p>
        </section>
      </div>
    </main>
  );
}
