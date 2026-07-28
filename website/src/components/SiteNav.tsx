"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Wordmark from "./Wordmark";

/**
 * Sticky top nav. Transparent over the hero, fading to a frosted bar once the
 * user scrolls — an Apple-style restrained header.
 */
export default function SiteNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-x-0 top-0 z-50 transition-colors duration-300"
      style={{
        backgroundColor: scrolled ? "color-mix(in srgb, var(--background) 72%, transparent)" : "transparent",
        backdropFilter: scrolled ? "saturate(180%) blur(20px)" : "none",
        WebkitBackdropFilter: scrolled ? "saturate(180%) blur(20px)" : "none",
        borderBottom: scrolled ? "1px solid var(--border)" : "1px solid transparent",
      }}
    >
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <a href="#top" aria-label="Sift home">
          <Wordmark size={19} />
        </a>
        <a
          href="#waitlist"
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition-transform duration-200 hover:scale-[1.03] active:scale-95"
        >
          Join the waitlist
        </a>
      </nav>
    </motion.header>
  );
}
