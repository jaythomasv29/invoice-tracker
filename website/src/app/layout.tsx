import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sift — Invoice intelligence for restaurants",
  description:
    "Scan any invoice and Sift turns it into tracked spend, price-creep alerts, and live recipe costs — priced from your own paperwork.",
  metadataBase: new URL("https://sift.app"),
  openGraph: {
    title: "Sift — Invoice intelligence for restaurants",
    description:
      "Scan any invoice and Sift turns it into tracked spend, price-creep alerts, and live recipe costs.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sift — Invoice intelligence for restaurants",
    description:
      "Scan any invoice and Sift turns it into tracked spend, price-creep alerts, and live recipe costs.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
