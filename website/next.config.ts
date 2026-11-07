import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { qualities: [75, 90] },
  // This site lives nested inside the Sift Expo app's repo (its own
  // package-lock.json one level up otherwise confuses Next's workspace-root
  // detection) — pin the root explicitly to this directory.
  turbopack: {
    root: path.join(__dirname),
  },
  poweredByHeader: false,
  // Baseline hardening. No script CSP: Next's inline bootstrap scripts would
  // need nonces; frame-ancestors alone is safe and blocks clickjacking.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
