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
          Scan supplier invoices, review your spending, and see your kitchen clearly.
          Pro adds price-change insights and recipe costing from your invoice history.
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

      {/* Full native screen, without overlays obscuring the interface. */}
      <div className="relative mx-auto mt-16 w-full max-w-[348px] px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: easeOut, delay: 0.35 }}
        >
          <PhoneFrame src="/screens/home-fe430ac8.png" alt="Sift dashboard showing historical invoice spending and a vendor breakdown using fictional sample data" priority />
          <p className="mt-6 text-center text-xs text-muted">Actual app screens · fictional sample data</p>
        </motion.div>
      </div>
    </section>
  );
}
