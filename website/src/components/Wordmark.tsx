import type { CSSProperties } from "react";

/**
 * Sift wordmark — a brand-green dot + "Sift", mirroring the in-app brand mark
 * (see app/(auth)/index.tsx's brandDot/brandText). Kept intentionally minimal.
 */
export default function Wordmark({
  size = 20,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const dot = Math.round(size * 0.42);
  const style: CSSProperties = { fontSize: size, letterSpacing: "-0.02em" };
  return (
    <span className={`inline-flex items-center gap-2 font-bold ${className}`} style={style}>
      <span
        aria-hidden
        className="inline-block rounded-full bg-brand"
        style={{ width: dot, height: dot }}
      />
      <span>Sift</span>
    </span>
  );
}
