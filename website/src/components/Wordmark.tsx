import Image from "next/image";
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
  const iconSize = Math.round(size * 1.4);
  const style: CSSProperties = { fontSize: size, letterSpacing: "-0.02em" };
  return (
    <span className={`inline-flex items-center gap-2 font-bold ${className}`} style={style}>
      <Image src="/sift-icon.png" alt="" width={iconSize} height={iconSize} className="rounded-[24%]" />
      <span>Sift</span>
    </span>
  );
}
