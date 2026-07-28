import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This site lives nested inside the Sift Expo app's repo (its own
  // package-lock.json one level up otherwise confuses Next's workspace-root
  // detection) — pin the root explicitly to this directory.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
