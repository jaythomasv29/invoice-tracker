import type { Metadata } from "next";

const SOCIAL_IMAGE = { url: "/social-card.png", width: 1200, height: 630, alt: "Sift — every purchase, a little clearer" };

/** Per-page title/description/canonical. Child `openGraph`/`twitter` objects
 * replace the root ones wholesale, so the social card is restated here. */
export function pageMetadata(path: string, title: string, description: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, siteName: "Sift", type: "website", images: [SOCIAL_IMAGE] },
    twitter: { card: "summary_large_image", title, description, images: [SOCIAL_IMAGE.url] },
  };
}
