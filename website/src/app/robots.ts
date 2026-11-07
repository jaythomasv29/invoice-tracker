import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/billing-return"] },
    sitemap: "https://siftcosts.com/sitemap.xml",
    host: "https://siftcosts.com",
  };
}
