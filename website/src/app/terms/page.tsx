import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Sift",
};

// Ported from ../../../legal/terms-of-service.html — see privacy/page.tsx's
// header comment for why this lives here now. Content unchanged, including
// its unfilled placeholders — fill in the date + contact email in BOTH
// places before publishing.
export default function TermsOfServicePage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16 sm:py-24">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Terms of Service</h1>
      <p className="mt-1 mb-10 text-sm text-muted">
        Last updated: [FILL IN DATE BEFORE PUBLISHING]
      </p>

      <div className="space-y-8 text-[15px] leading-relaxed text-foreground/80">
        <p>These terms govern your use of Sift (&ldquo;the app&rdquo;). By creating an account, you agree to them.</p>

        <Section title="The service">
          <p>
            Sift lets you photograph or import supplier invoices, automatically extracts vendor,
            line-item, and price data from them, and surfaces price-change alerts and spend summaries
            for your restaurant or business.
          </p>
        </Section>

        <Section title="Your account">
          <ul className="list-disc space-y-2 pl-5">
            <li>You must provide a valid email address and keep access to it, since sign-in works via one-time email codes.</li>
            <li>You&apos;re responsible for what&apos;s uploaded to your organization&apos;s account and for keeping your device secure.</li>
            <li>If you&apos;re an Owner, you&apos;re responsible for the organization&apos;s data and for the actions of team members you invite.</li>
          </ul>
        </Section>

        <Section title="Accuracy of extracted data">
          <p>
            Invoice line items, prices, and vendor names are extracted automatically using AI and may
            occasionally be inaccurate — for example, misread text on a low-quality photo. The app
            flags low-confidence extractions for your review, but you&apos;re responsible for
            verifying data before relying on it for accounting, payment, or dispute decisions.
          </p>
        </Section>

        <Section title="Acceptable use">
          <p>
            You agree not to use the app to upload content you don&apos;t have the right to upload,
            attempt to disrupt or reverse-engineer the service, or use it for anything unlawful.
          </p>
        </Section>

        <Section title="Data ownership">
          <p>
            You retain ownership of the invoice data and photos you upload. We process it only to
            provide the app&apos;s features, as described in our{" "}
            <Link className="text-brand-dark underline" href="/privacy">
              Privacy Policy
            </Link>
            .
          </p>
        </Section>

        <Section title="Termination">
          <p>
            You can delete your account at any time from More → Delete account in the app. We may
            suspend or terminate access for violations of these terms.
          </p>
        </Section>

        <Section title="Disclaimer and limitation of liability">
          <p>
            The app is provided &ldquo;as is,&rdquo; without warranties of any kind. We are not liable
            for financial decisions made based on extracted or summarized data, including inaccurate
            AI extraction. To the extent permitted by law, our liability is limited to the amount
            you&apos;ve paid us in the past 12 months (currently $0, as the app has no paid tier at
            launch).
          </p>
        </Section>

        <Section title="Changes to these terms">
          <p>
            If we make material changes, we&apos;ll update the &ldquo;Last updated&rdquo; date above
            and, where appropriate, notify you in the app.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions? Email{" "}
            <a className="text-brand-dark underline" href="mailto:[FILL IN CONTACT EMAIL]">
              [FILL IN CONTACT EMAIL]
            </a>
            .
          </p>
        </Section>
      </div>

      <Link href="/" className="mt-16 inline-block text-sm text-muted hover:text-foreground">
        ← Back to sift.app
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
