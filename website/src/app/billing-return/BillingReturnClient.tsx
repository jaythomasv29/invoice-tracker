"use client";

import { useEffect } from "react";

type BillingStatus = "success" | "cancel";

const COPY: Record<BillingStatus, { heading: string; subtext: string }> = {
  success: {
    heading: "Payment successful",
    subtext: "Opening Sift…",
  },
  cancel: {
    heading: "Checkout canceled",
    subtext: "Opening Sift…",
  },
};

export default function BillingReturnClient({ status }: { status: BillingStatus }) {
  const deepLink = `sift://billing-return?status=${status}`;

  // Custom URL schemes don't always fire reliably from mobile Safari, so we try
  // automatically on mount but always keep the manual button below as a fallback.
  useEffect(() => {
    window.location.href = deepLink;
  }, [deepLink]);

  const { heading, subtext } = COPY[status];

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="w-full max-w-sm">
        <div
          className={`mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full ${
            status === "success" ? "bg-brand-light text-brand-dark" : "bg-surface text-muted"
          }`}
          aria-hidden="true"
        >
          {status === "success" ? (
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 13 4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          )}
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{heading}</h1>
        <p className="mt-2 text-base text-muted">{subtext}</p>

        <a
          href={deepLink}
          className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-brand px-6 py-3.5 text-base font-semibold text-white transition hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand/40"
        >
          Open Sift
        </a>

        <p className="mt-4 text-sm text-muted">
          If Sift didn&apos;t open automatically, tap the button above.
        </p>
      </div>
    </main>
  );
}
