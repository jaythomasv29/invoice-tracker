"use client";

import { motion } from "framer-motion";
import WaitlistForm from "@/components/WaitlistForm";

const easeOut = [0.16, 1, 0.3, 1] as const;

/**
 * Closing CTA. Repeats the waitlist hook. Owns the second waitlist slot
 * (#waitlist-footer).
 */
export default function ClosingCTA() {
  return (
    <section className="py-40">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-20% 0px" }}
        transition={{ duration: 0.8, ease: easeOut }}
        className="mx-auto max-w-3xl px-6 text-center"
      >
        <h2 className="text-balance text-4xl font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-6xl">
          Stop guessing what
          <br />
          your food costs.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-balance text-lg text-muted sm:text-xl">
          Join the waitlist and be first in when Sift launches on the App Store.
        </p>

        {/* Second waitlist slot — same pattern as the hero. */}
        <section id="waitlist-footer" className="mx-auto mt-10 flex max-w-xl flex-col items-center gap-3">
          <WaitlistForm source="footer" />
          <span className="text-sm text-muted">Free to start. No card required.</span>
        </section>
      </motion.div>
    </section>
  );
}
