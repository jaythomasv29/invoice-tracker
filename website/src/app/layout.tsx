import type { Metadata } from "next";
import "./globals.css";
import MotionProvider from "@/components/MotionProvider";

export const metadata: Metadata = {
  title: "Sift — Shopping clarity for home and business",
  description:
    "Grocery receipts and restaurant invoices, organized in separate Personal and Business workspaces. Track spending, compare prices, and see the bigger picture.",
  metadataBase: new URL("https://siftcosts.com"),
  openGraph: {
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
      <body className="min-h-full flex flex-col"><MotionProvider>{children}</MotionProvider></body>
    </html>
  );
}
