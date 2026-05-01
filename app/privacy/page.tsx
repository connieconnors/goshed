import Link from "next/link";

const sectionStyle = { marginBottom: 24 };
const h2Style = { fontFamily: "var(--font-cormorant)", fontSize: "18px", fontWeight: 600, color: "var(--ink)", marginBottom: 8 };
const pStyle = { fontSize: 14, lineHeight: 1.6, color: "var(--ink)", marginBottom: 12 };
const pStyleLast = { fontSize: 14, lineHeight: 1.6, color: "var(--ink)", marginBottom: 0 };
const ulStyle = { fontSize: 14, lineHeight: 1.6, color: "var(--ink)", marginBottom: 12, paddingLeft: 20 };
const subheadStyle = { fontSize: 14, lineHeight: 1.6, color: "var(--ink)", marginBottom: 6, fontWeight: 500 };

export default function PrivacyPage() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", padding: "48px 24px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <Link href="/" style={{ fontSize: "12px", color: "var(--ink-soft)", textDecoration: "none", marginBottom: 32, display: "inline-block" }}>
          ← Back to GoShed
        </Link>
        <h1 style={{ fontFamily: "var(--font-cormorant)", fontSize: "28px", fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>
          Privacy Policy for GoShed
        </h1>
        <p style={{ fontSize: "13px", color: "var(--ink-soft)", marginBottom: 32 }}>Last Updated: March 2026</p>

        <section style={sectionStyle}>
          <p style={pStyle}>
            GoShed (&ldquo;GoShed,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is a service provided by ThriftShopper Inc. that helps people make everyday decisions by providing suggestions, reminders, and recommendations. This Privacy Policy explains what information we collect, how we use it, and the choices you have when you use the GoShed mobile app and related services (&ldquo;Application&rdquo; or &ldquo;Service&rdquo;).
          </p>
          <p style={pStyleLast}>By using GoShed, you agree to the practices described in this Privacy Policy.</p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>1. Data We Collect and Why</h2>
          <p style={pStyle}>
            We collect information that is necessary to operate, secure, and improve GoShed and to provide features like AI‑powered recommendations and subscriptions.
          </p>
          <p style={subheadStyle}>1.1 Information you provide</p>
          <ul style={ulStyle}>
            <li>Contact information such as your email address when you sign up or contact support.</li>
            <li>Preferences, lists, and product or item information you choose to enter into GoShed.</li>
            <li>Messages, notes, and other content you submit through the Application.</li>
            <li>Feedback, support requests, and other communications you send to us.</li>
          </ul>
          <p style={{ ...pStyle, marginBottom: 12 }}><strong>Why:</strong> To store your items, personalize recommendations, and provide core features (including AI‑generated suggestions).</p>
          <p style={subheadStyle}>1.2 Information collected automatically</p>
          <p style={pStyle}>When you use GoShed, we automatically collect certain technical and usage information, such as:</p>
          <ul style={ulStyle}>
            <li>Device information (device model, operating system, language, app version).</li>
            <li>Technical identifiers and network information (IP address, device identifiers, crash logs).</li>
          </ul>
          <p style={{ ...pStyle, marginBottom: 12 }}><strong>Why:</strong> To keep the app secure, diagnose issues, and ensure compatibility across devices.</p>
          <ul style={ulStyle}>
            <li>Usage data (features used, screens viewed, taps/clicks, session times, basic interaction events).</li>
            <li>Subscription and purchase status (for example, whether you are on the free tier, have purchased additional item slots, or have an active subscription).</li>
          </ul>
          <p style={{ ...pStyle, marginBottom: 12 }}><strong>Why:</strong> To understand how GoShed is used, improve performance and design, and fix bugs.</p>
          <p style={subheadStyle}>1.3 Location and place information</p>
          <p style={pStyle}>If you use features that involve locations or places, we may collect:</p>
          <ul style={ulStyle}>
            <li>Approximate or precise location information, depending on your device settings.</li>
            <li>Place‑related search queries and selected locations.</li>
          </ul>
          <p style={{ ...pStyle, marginBottom: 12 }}><strong>Why:</strong> To power location‑based and place‑based features, such as looking up nearby places or contextual suggestions.</p>
          <p style={pStyle}>You can disable location permissions at the device level, but some features may not work as intended if you do so.</p>
          <p style={subheadStyle}>1.4 Payment and subscription data</p>
          <p style={pStyle}><strong>What:</strong> Payment details processed by our payment provider, purchase history, subscription status (free tier, per‑item unlocks, monthly or yearly plans).</p>
          <p style={{ ...pStyle, marginBottom: 12 }}><strong>Why:</strong> To process payments securely, manage entitlements (for example, number of items or plan type), and prevent fraud.</p>
          <p style={subheadStyle}>1.5 AI interaction data</p>
          <p style={pStyle}><strong>What:</strong> Text you enter into AI‑powered features (such as lists, descriptions, or notes) and limited context about your usage.</p>
          <p style={pStyleLast}><strong>Why:</strong> To generate suggestions and recommendations using third‑party AI models. We use this information only to provide and improve GoShed, operate our business, and comply with legal obligations—not to sell your personal data.</p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>2. How We Use Your Information</h2>
          <p style={pStyle}>We use the information described above to:</p>
          <ul style={ulStyle}>
            <li>Provide GoShed&apos;s core functionality, including storing your items, lists, and preferences.</li>
            <li>Generate and improve suggestions, reminders, and recommendations.</li>
            <li>Personalize your experience based on your activity and settings.</li>
            <li>Operate, maintain, and secure the Application and our backend infrastructure.</li>
            <li>Understand how GoShed is used and improve features, performance, and design.</li>
            <li>Communicate with you about updates, security alerts, changes to terms, and support responses.</li>
          </ul>
          <p style={pStyleLast}>We may use aggregated or de‑identified information (which does not reasonably identify you) for analytics, research, and business purposes.</p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>3. AI and Automated Recommendations</h2>
          <p style={pStyle}>Some GoShed features use artificial intelligence to generate suggestions and recommendations.</p>
          <ul style={ulStyle}>
            <li>We use third‑party AI model providers (such as Anthropic) to process certain content you provide (for example, item descriptions, lists, and notes) and to generate responses.</li>
            <li>When you use AI‑powered features, the text you submit and limited contextual information may be sent to these providers so they can generate suggestions.</li>
            <li>We take steps to limit the data we send and use contractual and technical measures designed to protect your privacy.</li>
            <li>We do not allow our AI providers to use this information for their own targeted advertising.</li>
          </ul>
          <p style={pStyleLast}>AI‑generated outputs may not always be accurate, current, or complete. You should use your own judgment and, where appropriate, verify information before relying on any suggestion.</p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>4. Third‑Party Services We Use</h2>
          <p style={pStyle}>We rely on trusted third‑party service providers to operate GoShed. These providers process limited personal data on our behalf and only as needed to deliver their services. They are not permitted to use your information for their own independent marketing purposes.</p>
          <p style={subheadStyle}>4.1 Authentication, storage, and infrastructure</p>
          <p style={pStyle}>We use a managed backend platform (including services such as Supabase) to provide: user authentication and account management; secure storage of your account data and the content you create in GoShed; and core application infrastructure. Your email address, authentication data, and stored content may be processed and stored by these providers so that we can operate GoShed reliably and securely.</p>
          <p style={subheadStyle}>4.2 Payments and subscriptions</p>
          <p style={pStyle}>For payments and subscriptions, iOS purchases are processed by Apple through the App Store. We also use subscription and entitlement management services such as RevenueCat to manage free tiers, purchase history, and subscription plans (such as monthly or yearly access). These services may process payment status, purchase history, and basic account identifiers as needed to complete transactions, manage your plan, prevent fraud, and comply with legal obligations.</p>
          <p style={subheadStyle}>4.3 Analytics and diagnostics</p>
          <p style={pStyle}>We use analytics and diagnostics tools, such as Google Analytics and similar services, to help us understand how GoShed is used and to identify issues. These services may collect: device and technical information (device type, OS, IP address, app version); usage information (screens viewed, actions taken, feature usage, session duration); and crash and performance data. We use this information to improve GoShed&apos;s reliability and user experience and do not use analytics data for cross‑app targeted advertising.</p>
          <p style={subheadStyle}>4.4 Maps, location, and place information</p>
          <p style={pStyle}>When you use features that involve location or places, we may use mapping and geolocation services such as Google Maps Platform (for example, Places API). These services may receive: approximate or precise location information, depending on your device settings; place‑related queries and selected locations; and technical identifiers necessary to return place data and operate the service. This data is used to power place lookups and location‑based features within GoShed.</p>
          <p style={subheadStyle}>4.5 AI model providers</p>
          <p style={pStyleLast}>As described above, we use AI model providers such as Anthropic to process some of the content you submit in order to generate suggestions and recommendations. These providers receive the text and limited context necessary to produce responses and act as our processors for this purpose.</p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>5. Data Retention</h2>
          <p style={pStyle}>We retain personal information for as long as necessary to provide GoShed, comply with legal obligations, resolve disputes, and enforce our agreements.</p>
          <ul style={ulStyle}>
            <li>Account‑level information (such as email and preferences) is generally kept while your account is active and for a reasonable period thereafter.</li>
            <li>Usage and analytics data may be retained in aggregated or de‑identified form for a longer period where it cannot reasonably be linked back to you.</li>
            <li>If you request deletion of your account, we will delete or de‑identify personal information associated with your account, subject to data we may need to keep for legal, security, or legitimate business reasons.</li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>6. Your Choices and Rights</h2>
          <p style={pStyle}>Depending on your location, you may have certain rights regarding your personal data. Subject to applicable law, you may:</p>
          <ul style={ulStyle}>
            <li>Request access to the personal information we hold about you.</li>
            <li>Request correction of inaccurate or incomplete information.</li>
            <li>Request deletion of your account and associated personal information.</li>
            <li>Object to or restrict certain processing, or withdraw consent where processing is based on consent.</li>
          </ul>
          <p style={pStyle}>You can also: stop using GoShed and uninstall the app at any time to stop further data collection; and manage app‑level permissions (such as location and notifications) via your device settings.</p>
          <p style={pStyle}>To exercise your rights, contact us at <span style={{ color: "var(--accent)" }}>support@thriftshopper.com</span>. We may need to verify your identity before fulfilling certain requests.</p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>7. Children&apos;s Privacy</h2>
          <p style={pStyle}>GoShed is not directed to children under 13, and we do not knowingly collect personal information from children under 13. If we learn that we have collected personal information from a child under 13, we will take reasonable steps to delete it as soon as possible.</p>
          <p style={pStyleLast}>If you are a parent or guardian and believe that a child has provided us with personal information, please contact us at <span style={{ color: "var(--accent)" }}>support@thriftshopper.com</span>.</p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>8. Security</h2>
          <p style={pStyle}>We use reasonable technical, administrative, and physical safeguards designed to help protect your information from unauthorized access, loss, misuse, or alteration. These measures include secure cloud infrastructure and restricted access to personal data.</p>
          <p style={pStyleLast}>However, no method of transmission over the internet or method of electronic storage is completely secure, and we cannot guarantee absolute security.</p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>9. International Transfers</h2>
          <p style={pStyle}>If you access GoShed from outside the United States, your information may be transferred to and processed in the United States or other countries where we or our service providers operate. These locations may have data protection laws that are different from those in your country.</p>
          <p style={pStyleLast}>Where required by law, we implement appropriate safeguards to protect personal data transferred across borders.</p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>10. Changes to This Policy</h2>
          <p style={pStyle}>We may update this Privacy Policy from time to time. When we do, we will revise the &ldquo;Last Updated&rdquo; date at the top of this page. If we make material changes, we may provide additional notice, such as an in‑app notification or email.</p>
          <p style={pStyleLast}>Your continued use of GoShed after the updated Privacy Policy becomes effective means you accept the changes.</p>
        </section>

        <section id="contact" style={{ marginBottom: 0 }}>
          <h2 style={h2Style}>11. Contact Us</h2>
          <p style={pStyle}>If you have any questions about this Privacy Policy or our data practices, please contact us at:</p>
          <p style={pStyle}>ThriftShopper Inc. / GoShed</p>
          <p style={pStyleLast}>Email: <span style={{ color: "var(--accent)" }}>support@thriftshopper.com</span></p>
        </section>
      </div>
    </main>
  );
}
