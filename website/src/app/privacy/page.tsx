import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Sift",
};

// Ported from ../../../legal/privacy-policy.html (the app's canonical copy,
// authored for the App Store submission checklist in ../../SETUP.md) so it
// has a real public URL to put in EXPO_PUBLIC_PRIVACY_POLICY_URL / App Store
// Connect's App Privacy section, instead of needing a separate static host.
// Content is unchanged from that file, including its unfilled placeholders —
// fill in the date + contact email in BOTH places before publishing.
export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16 sm:py-24">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Privacy Policy</h1>
      <p className="mt-1 mb-10 text-sm text-muted">
        Last updated: July 28, 2026
      </p>

      <div className="space-y-8 text-[15px] leading-relaxed text-foreground/80">
        <p>
          Sift (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;the app&rdquo;) helps independent restaurant
          operators scan, track, and analyze supplier invoices. This policy explains what data we
          collect, why, and how you can control it.
        </p>

        <Section title="Who this applies to">
          <p>
            This policy covers the Sift mobile app and the backend services it talks to. If you use
            the app on behalf of a restaurant or organization, your organization&apos;s owner is
            responsible for the account, but this policy still explains how your personal data is
            handled.
          </p>
        </Section>

        <Section title="What we collect">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground">Account information:</strong> your email address,
              used to sign you in (we use email + one-time code, never a password).
            </li>
            <li>
              <strong className="text-foreground">Organization information:</strong> your
              restaurant/business name, entered during onboarding.
            </li>
            <li>
              <strong className="text-foreground">Invoice data:</strong> photos of invoices you
              capture or import, and the vendor names, line items, prices, quantities, and dates our
              system extracts from them.
            </li>
            <li>
              <strong className="text-foreground">Usage data:</strong> basic crash and error reports
              (via Sentry) once crash reporting is enabled, to help us fix bugs. These reports do not
              include invoice photos or financial data.
            </li>
          </ul>
          <p className="mt-3">
            We do not collect location data, contacts, or browsing history, and the app contains no
            advertising or third-party tracking SDKs.
          </p>
        </Section>

        <Section title="How we use it">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              To operate the app&apos;s core features: scanning invoices, extracting line-item data,
              tracking vendor prices, and generating price-change alerts and spend summaries for your
              organization.
            </li>
            <li>To authenticate you and keep your organization&apos;s data separate from every other organization&apos;s data.</li>
            <li>To diagnose and fix crashes or errors.</li>
          </ul>
          <p className="mt-3">
            We do not sell your data, and we do not use your invoice data to train third-party AI
            models beyond what&apos;s needed to extract line items from the specific invoice you scan
            (see &ldquo;Third-party services&rdquo; below).
          </p>
        </Section>

        <Section title="Third-party services we use">
          <p className="mb-3">
            These are the processors your data passes through to make the app work. Each only
            receives the data necessary for its function:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li><strong className="text-foreground">Clerk</strong> — authentication (manages your email/sign-in, never sees your invoice data).</li>
            <li><strong className="text-foreground">Supabase</strong> — our database and file storage (stores your organization&apos;s invoices, extracted data, and invoice photos).</li>
            <li><strong className="text-foreground">Anthropic (Claude)</strong> — reads invoice photos you scan to extract vendor, line-item, and price data. Photos are sent for this extraction only.</li>
            <li><strong className="text-foreground">Sentry</strong> — crash and error reporting (technical diagnostics only, not invoice content).</li>
          </ul>
        </Section>

        <Section title="Data retention">
          <p>
            We retain your account and invoice data for as long as your account is active, so you can
            search your invoice history and track price trends over time. You can request deletion at
            any time (see below).
          </p>
        </Section>

        <Section title="Your controls">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground">Delete your account:</strong> In the app, go to More
              → Delete account. This permanently removes your sign-in access. Your organization&apos;s
              invoice data remains available to any other members of your organization, since it&apos;s
              shared organizational data, not personal data tied only to you.
            </li>
            <li><strong className="text-foreground">Delete your organization&apos;s data:</strong> contact us at the email below and we&apos;ll process the request.</li>
            <li><strong className="text-foreground">Export your data:</strong> use More → Export to CSV at any time to get a copy of your organization&apos;s invoice history.</li>
          </ul>
        </Section>

        <Section title="Children's privacy">
          <p>
            Sift is a business tool for restaurant operators and is not directed at children. We do
            not knowingly collect data from anyone under 16.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            If we make material changes to this policy, we&apos;ll update the &ldquo;Last
            updated&rdquo; date above and, where appropriate, notify you in the app.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy or a data request? Email{" "}
            <a className="text-brand-dark underline" href="mailto:support@siftcosts.com">
              support@siftcosts.com
            </a>
            .
          </p>
        </Section>
      </div>

      <Link href="/" className="mt-16 inline-block text-sm text-muted hover:text-foreground">
        ← Back to siftcosts.com
      </Link>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}
