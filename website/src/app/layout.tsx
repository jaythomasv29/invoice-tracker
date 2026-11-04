import type { Metadata } from "next";
import "./globals.css";
import MotionProvider from "@/components/MotionProvider";

export const metadata: Metadata = {
  title: "Sift — Invoice intelligence for restaurants",
  description:
    "Scan supplier invoice photos and Sift turns it into tracked spend, price-creep alerts, and live recipe costs — priced from your own paperwork.",
  metadataBase: new URL("https://siftcosts.com"),
  openGraph: {
    title: "Sift — Invoice intelligence for restaurants",
    description:
      "Scan supplier invoice photos and Sift turns it into tracked spend, price-creep alerts, and live recipe costs.",
    type: "website",
    images: [{url:"/social-card.png",width:1200,height:630,alt:"Sift — your kitchen, in the clear"}],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/social-card.png"],
    title: "Sift — Invoice intelligence for restaurants",
    description:
      "Scan supplier invoice photos and Sift turns it into tracked spend, price-creep alerts, and live recipe costs.",
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
