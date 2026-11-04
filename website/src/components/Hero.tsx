"use client";

import { motion } from "framer-motion";
import Wordmark from "./Wordmark";
import PhoneFrame from "./PhoneFrame";
import media from "@/content/media.json";

const easeOut = [0.16, 1, 0.3, 1] as const;

export default function Hero() {
  return (
    <section id="top" className="pb-16 pt-24 sm:pt-40">
      <div className="mx-auto w-full max-w-4xl px-6 text-center">
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: easeOut }}
          className="mb-8 hidden justify-center sm:flex"
        >
          <Wordmark size={26} />
        </motion.div>

        <motion.h1
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: easeOut, delay: 0.05 }}
          className="text-balance text-4xl font-extrabold leading-[1.04] tracking-[-0.035em] sm:text-6xl md:text-7xl"
        >
          Your invoices,
          <br />
          turned into decisions.
        </motion.h1>

        <motion.p
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: easeOut, delay: 0.15 }}
          className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-muted sm:text-xl"
        >
          Scan supplier invoices, review your spending, and see your kitchen clearly.
          Pro adds price-change insights and recipe costing from your invoice history.
        </motion.p>

        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: easeOut, delay: 0.25 }}
          className="mt-10 flex flex-col items-center gap-3"
        >
          <div className="flex flex-wrap items-center justify-center gap-3"><a
            href="#waitlist"
            className="inline-flex min-h-12 items-center rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-transform duration-200 hover:scale-[1.03] active:scale-95 sm:px-8 sm:py-4 sm:text-base"
          >
            Join the waitlist
          </a>
          <a href="#film" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-border bg-surface px-4 py-3 text-sm font-semibold underline-offset-4 hover:underline sm:px-6 sm:text-base">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m9 5 11 7-11 7V5Z" /></svg>
            Watch the film
          </a></div>
          <span className="text-sm text-muted">
            Free to start when we launch. No card required.
          </span>
        </motion.div>
      </div>

      {/* Full native screen, without overlays obscuring the interface. */}
      <div className="relative mx-auto mt-16 w-full max-w-[400px] px-6">
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: easeOut, delay: 0.35 }}
        >
          <PhoneFrame src={media.screens.home.src} alt="Current Sift Home with November spending, a color-coded supplier bar, and invoice metrics using fictional sample data" priority maxWidthClass="max-w-[352px]" />
          <p className="mt-6 text-center text-xs text-muted">Actual app screens · fictional sample data</p>
        </motion.div>
      </div>
    </section>
  );
}
