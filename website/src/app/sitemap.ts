import type { MetadataRoute } from "next";
import legal from "@/content/legal.json";

const BASE = "https://siftcosts.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const legalUpdated = new Date(legal.updated);
  return [
    { url: `${BASE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/support`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/privacy`, lastModified: legalUpdated, changeFrequency: "yearly", priority: 0.4 },
    { url: `${BASE}/terms`, lastModified: legalUpdated, changeFrequency: "yearly", priority: 0.4 },
  ];
}
