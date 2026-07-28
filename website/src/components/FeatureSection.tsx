"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

const easeOut = [0.16, 1, 0.3, 1] as const;

export interface FeatureSectionProps {
  eyebrow: string;
  title: ReactNode;
  subtitle: string;
  accent: string;
  visual: ReactNode;
  reverse?: boolean;
  flagship?: boolean;
}

/**
 * A feature row that fades up into place once, on scroll. The flagship
 * variant (Recipe Costing) gets extra vertical room and a larger, centered
 * visual for emphasis.
 */
export default function FeatureSection({
  eyebrow,
  title,
  subtitle,
  accent,
  visual,
  reverse = false,
  flagship = false,
}: FeatureSectionProps) {
  const copy = (
    <div className={flagship ? "text-center" : ""}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-15% 0px" }}
        transition={{ duration: 0.7, ease: easeOut }}
      >
        <span
          className="inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.14em]"
          style={{ color: accent, background: `color-mix(in srgb, ${accent} 12%, transparent)` }}
        >
          {eyebrow}
        </span>
        <h2 className="mt-5 text-balance text-4xl font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-5xl">
          {title}
        </h2>
        <p className={`mt-5 text-balance text-lg leading-relaxed text-muted ${flagship ? "mx-auto max-w-2xl" : "max-w-md"}`}>
          {subtitle}
        </p>
      </motion.div>
    </div>
  );

  const art = (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.7, ease: easeOut }}
      className={flagship ? "mx-auto max-w-md" : ""}
    >
      {visual}
    </motion.div>
  );

  if (flagship) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-32 sm:py-40">
        {copy}
        <div className="mt-14">{art}</div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-6 py-28 sm:py-36">
      <div className={`grid items-center gap-12 md:grid-cols-2 md:gap-16 ${reverse ? "md:[&>*:first-child]:order-2" : ""}`}>
        <div>{copy}</div>
        <div>{art}</div>
      </div>
    </section>
  );
}
