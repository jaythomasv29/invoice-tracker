import SiteNav from "@/components/SiteNav";
import Hero from "@/components/Hero";
import FeatureSection from "@/components/FeatureSection";
import ClosingCTA from "@/components/ClosingCTA";
import Footer from "@/components/Footer";
import WaitlistForm from "@/components/WaitlistForm";
import PhoneFrame from "@/components/PhoneFrame";
import LaunchFilm from "@/components/LaunchFilm";
import media from "@/content/media.json";


// Brand green is the primary accent; each feature carries a restrained,
// meaning-bearing tint (price alerts orange, verification red) drawn from the
// Sift app's own semantic palette (constants/Colors.ts).
const BRAND = "#17624B";
// App warning #A65524 is 4.3:1 on its own 12% tint (fails AA for the 12px
// eyebrow); this one-step-darker shade keeps the hue at 4.9:1.
const ALERT = "#9A4C1F";

export default function Home() {
  return (
    <>
      <SiteNav />
      <main className="flex flex-col">
        <Hero />
        <section id="plans" className="scroll-mt-24 mx-auto w-full max-w-5xl px-6 pb-20">
          <p className="text-center text-xs font-bold uppercase tracking-[.18em] text-brand-ink">One app. Two clear spaces.</p>
          <h2 className="mt-4 text-center text-3xl font-extrabold tracking-tight sm:text-5xl">For your household. For your business.</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <article className="rounded-3xl border border-border bg-surface p-7 sm:p-9">
              <p className="text-sm font-semibold text-brand-ink">PERSONAL</p><h3 className="mt-3 text-2xl font-bold">Everyday shopping, in perspective.</h3>
              <p className="mt-4 leading-relaxed text-muted">Groceries, cleaning supplies and household essentials. See where your money goes by store, week and month.</p>
              <p className="mt-6 text-sm text-muted">Free · 5 receipt scans/month</p><p className="mt-2 text-3xl font-extrabold">$4.99<span className="text-base font-medium text-muted"> / month for Pro</span></p>
              <p className="mt-4 leading-relaxed text-muted">40 scans, category and store trends, plus repeat-item net price comparisons when the printed product identity and package size reliably match.</p>
            </article>
            <article className="rounded-3xl border border-border bg-surface p-7 sm:p-9">
              <p className="text-sm font-semibold text-brand-ink">BUSINESS</p><h3 className="mt-3 text-2xl font-bold">A clearer view of your kitchen.</h3>
              <p className="mt-4 leading-relaxed text-muted">Keep supplier invoices together, track food purchasing, and connect your ingredients to recipe costs.</p>
              <p className="mt-6 text-sm text-muted">Free · 10 invoice scans/month</p><p className="mt-2 text-3xl font-extrabold">$9.99<span className="text-base font-medium text-muted"> / month for Pro</span></p>
              <p className="mt-4 leading-relaxed text-muted">100 scans, supplier price alerts, spending intelligence and recipe costing with 10 AI recipe draft attempts each month.</p>
            </article>
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-center text-sm leading-relaxed text-muted">US monthly launch prices. Separate optional subscriptions for Personal and Business. Allowances reset each calendar month. Your saved history stays available when paid access ends. The App Store confirms the actual localized price before purchase.</p>
        </section>
        <FeatureSection
          eyebrow="Personal · Groceries & household"
          accent={BRAND}
          title={<>Your everyday essentials.<br />A clearer picture.</>}
          subtitle="See spending by purchase date and store, with a color-coded breakdown and your saved receipts close at hand. Personal Pro compares repeat-item net prices only when product identity, package size and discounts are reliable."
          visual={<PhoneFrame src={media.screens.personal.src} alt="Sift Personal Home showing a fictional household's October grocery and household spending, $1,141.08 across four stores, with a color-coded store breakdown and receipt metrics" maxWidthClass="max-w-[320px]" />}
        />
        <LaunchFilm />

        {/* Primary waitlist slot. The hero + nav CTAs scroll here. */}
        <section id="waitlist" className="mx-auto w-full max-w-xl scroll-mt-24 px-6 pb-8">
          <WaitlistForm source="hero" />
        </section>

        <FeatureSection
          eyebrow="Business · Purchasing intelligence"
          accent={BRAND}
          title={<>Every invoice.<br />A bigger picture.</>}
          subtitle="Build your saved-invoice milestones, see your weekly upload rhythm, and keep the next useful action in view. Pro adds deeper purchasing patterns and price insights."
          visual={<PhoneFrame src={media.screens.intelligence.src} alt="Sift's Purchasing intelligence with this week's delivery rhythm, recipe costing, and a Smart Sift price insight listing items that crept up, using fictional data" maxWidthClass="max-w-[320px]" />}
        />

        <FeatureSection
          eyebrow="Scan & review"
          accent={BRAND}
          title={<>Snap a photo,<br />skip the data entry.</>}
          subtitle="Photograph or import an invoice. AI drafts the line items, prices, and totals. Review the details, mark missing deliveries, and make corrections before saving."
          reverse
          visual={<PhoneFrame src={media.screens.review.src} alt="Sift invoice review for a fictional supplier invoice, with extracted line items, a quick-check flag on one quantity, and the invoice total" maxWidthClass="max-w-[320px]" />}
        />

        <FeatureSection
          eyebrow="Pro · Price alerts"
          accent={ALERT}
          title={<>Spot price changes<br />before the next order.</>}
          subtitle="Compare new invoice prices with your purchasing history and review the supplier changes that need attention."
          visual={<PhoneFrame src={media.screens.alerts.src} alt="Sift price alerts grouped by product and dated by delivery, comparing fictional supplier prices with earlier purchases" maxWidthClass="max-w-[320px]" />}
        />

        <FeatureSection
          eyebrow="Invoice library"
          accent={BRAND}
          reverse
          title={<>Every invoice.<br />Easy to find.</>}
          subtitle="Keep supplier history together, search by vendor or invoice number, and open the records behind your daily, weekly, and monthly spending."
          visual={<PhoneFrame src={media.screens.library.src} alt="Sift invoice library listing searchable fictional supplier invoices with dates, item counts and totals" maxWidthClass="max-w-[320px]" />}
        />

        <FeatureSection
          flagship
          eyebrow="Business Pro · Recipe costing"
          accent={BRAND}
          title={<>See what every dish<br />actually costs to make.</>}
          subtitle="Confirm ingredients and quantities, then match prices from your invoices to estimate each dish’s ingredient cost and ingredient margin. Estimates become more useful as you add and match data."
          visual={<PhoneFrame src={media.screens.recipes.src} alt="Sift recipe costing list showing fictional dishes with ingredient costs, ingredient margins, and Data-backed or Estimated labels" maxWidthClass="max-w-[340px]" />}
        />

        <ClosingCTA />
      </main>
      <Footer />
    </>
  );
}
