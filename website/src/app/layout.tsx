import type { Metadata } from "next";
import "./globals.css";
import MotionProvider from "@/components/MotionProvider";

const SITE_URL = "https://siftcosts.com";

// Organization + WebSite only: no ratings, prices or offers, so nothing here
// can drift from the App Store listing.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Sift",
      url: SITE_URL,
      logo: `${SITE_URL}/sift-icon.png`,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "Sift",
      url: SITE_URL,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

export const metadata: Metadata = {
  title: "Sift — Shopping clarity for home and business",
  description:
    "Grocery receipts and restaurant invoices, organized in separate Personal and Business workspaces. Track spending, compare prices, and see the bigger picture.",
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/" },
  applicationName: "Sift",
  // Smart App Banner. Safari shows it only once the app is live in the
  // visitor's storefront, so it is inert during the prelaunch waitlist.
  itunes: { appId: "6797084602" },
  openGraph: {
    url: "/",
    siteName: "Sift",
    locale: "en_US",
    title: "Sift — Shopping clarity for home and business",
    description:
      "Grocery receipts and restaurant invoices, organized in separate Personal and Business workspaces.",
    type: "website",
    images: [{url:"/social-card.png",width:1200,height:630,alt:"Sift — every purchase, a little clearer"}],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/social-card.png"],
    title: "Sift — Shopping clarity for home and business",
    description:
      "Grocery receipts and restaurant invoices, organized in separate Personal and Business workspaces.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
        {/* Scroll-reveal sections render with inline opacity:0 until Framer
            Motion hydrates; without JavaScript they would stay invisible
            (including the closing waitlist form). */}
        <noscript>
          <style>{`[style*="opacity:0"]{opacity:1!important;transform:none!important}`}</style>
        </noscript>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
