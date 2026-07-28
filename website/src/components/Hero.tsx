"use client";

import { motion } from "framer-motion";
import Wordmark from "./Wordmark";
import PhoneFrame from "./PhoneFrame";

const easeOut = [0.16, 1, 0.3, 1] as const;

export default function Hero() {
  return (
    <section id="top" className="pb-16 pt-32 sm:pt-40">
      <div className="mx-auto w-full max-w-4xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: easeOut }}
          className="mb-8 flex justify-center"
        >
          <Wordmark size={26} />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: easeOut, delay: 0.05 }}
          className="text-balance text-5xl font-extrabold leading-[1.04] tracking-[-0.035em] sm:text-6xl md:text-7xl"
        >
          Your invoices,
          <br />
          turned into decisions.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: easeOut, delay: 0.15 }}
          className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-muted sm:text-xl"
        >
          Snap a photo of any supplier invoice. Sift turns it into tracked spend,
          price-creep alerts, and live recipe costs — priced from your own paperwork.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: easeOut, delay: 0.25 }}
          className="mt-10 flex flex-col items-center gap-3"
        >
          <a
            href="#waitlist"
            className="rounded-full bg-brand px-8 py-4 text-base font-semibold text-white shadow-lg shadow-brand/25 transition-transform duration-200 hover:scale-[1.03] active:scale-95"
          >
            Join the waitlist
          </a>
          <span className="text-sm text-muted">
            Free to start when we launch. No card required.
          </span>
        </motion.div>
      </div>

      {/* Real app screenshot, front and center — the actual dashboard, not a
          mockup. A floating stat card echoes Sift's price-alert USP and
          overlaps the phone the way a lock-screen widget would. */}
      <div className="relative mx-auto mt-16 w-full max-w-[300px] px-6">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: easeOut, delay: 0.35 }}
        >
          <PhoneFrame src="/screens/home.png" alt="Sift dashboard showing this month's spend and vendor breakdown" priority />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easeOut, delay: 0.6 }}
          className="absolute -left-8 top-12 w-[172px] rounded-2xl border border-border bg-surface p-3.5 shadow-xl shadow-black/[0.08] sm:-left-16"
        >
          <div className="mb-1.5 flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "#E07A30" }} />
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted">Price alert</span>
          </div>
          <div className="text-[13px] font-semibold leading-snug">Chicken Thigh, boneless</div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs text-muted">$1.62 → $1.94/lb</span>
            <span className="text-xs font-bold" style={{ color: "#E07A30" }}>+20%</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
