import type { Metadata } from "next";
import { Cormorant_Garamond, Source_Serif_4 } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const GA_MEASUREMENT_ID = "G-CPJMZSBPRJ";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-source-serif",
});

export const metadata: Metadata = {
  title: "GoShed",
  manifest: "/manifest.json",
  description:
    "Snap a photo of something you own and get an AI recommendation — gift, donate, sell, keep or trash — based on your life context.",
  openGraph: {
    title: "GoShed",
    description:
      "Snap a photo of something you own and get an AI recommendation — gift, donate, sell, keep or trash — based on your life context.",
    url: "https://www.goshed.app",
    siteName: "GoShed",
    images: [{ url: "https://www.goshed.app/goshed-favicon-light.png", width: 1200, height: 630, alt: "GoShed" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GoShed",
    description:
      "Snap a photo of something you own and get an AI recommendation — gift, donate, sell, keep or trash — based on your life context.",
    images: ["https://www.goshed.app/goshed-favicon-light.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${cormorant.variable} ${sourceSerif.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="GoShed" />
        <link rel="apple-touch-icon" href="/icons/icon-512x512.png" />
      </head>
      <body className="antialiased" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }} suppressHydrationWarning>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="gtag-config" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }} suppressHydrationWarning>
          {children}
        </div>
        <footer
          style={{
            padding: "16px 24px",
            textAlign: "center",
            fontSize: "11px",
            color: "var(--ink-soft)",
            fontFamily: "var(--font-body)",
          }}
        >
          © 2026 GoShed ·{" "}
          <a href="/privacy" style={{ color: "inherit", textDecoration: "none" }}>Privacy</a>
          {" · "}
          <a href="/terms" style={{ color: "inherit", textDecoration: "none" }}>Terms</a>
          {" · "}
          <a href="mailto:support@thriftshopper.com" style={{ color: "inherit", textDecoration: "none" }}>Contact</a>
        </footer>
      </body>
    </html>
  );
}
