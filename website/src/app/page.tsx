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
const ALERT = "#A65524";

export default function Home() {
  return (
    <>
      <SiteNav />
      <main className="flex flex-col">
        <Hero />
        <LaunchFilm />

        {/* Primary waitlist slot. The hero + nav CTAs scroll here. */}
        <section id="waitlist" className="mx-auto w-full max-w-xl scroll-mt-24 px-6 pb-8">
          <WaitlistForm source="hero" />
        </section>

        <FeatureSection
          eyebrow="Purchasing intelligence"
          accent={BRAND}
          title={<>Every invoice.<br />A bigger picture.</>}
          subtitle="Build your saved-invoice milestones, see your weekly upload rhythm, and keep the next useful action in view. Pro adds deeper purchasing patterns and price insights."
          visual={<PhoneFrame src={media.screens.intelligence.src} alt="Sift's expanded Purchasing intelligence with saved-invoice milestones, weekly activity, recipe costing and price insights using fictional data" maxWidthClass="max-w-[320px]" />}
        />

        <FeatureSection
          eyebrow="Scan & review"
          accent={BRAND}
          title={<>Snap a photo,<br />skip the data entry.</>}
          subtitle="Photograph or import an invoice. AI drafts the line items, prices, and totals. Review the details, mark missing deliveries, and make corrections before saving."
          reverse
          visual={<PhoneFrame src={media.screens.review.src} alt="Current Sift invoice review with extracted line items, missing-delivery controls and the invoice total" maxWidthClass="max-w-[320px]" />}
        />

        <FeatureSection
          eyebrow="Pro · Price alerts"
          accent={ALERT}
          title={<>Spot price changes<br />before the next order.</>}
          subtitle="Compare new invoice prices with your purchasing history and review the supplier changes that need attention."
          visual={<PhoneFrame src={media.screens.alerts.src} alt="Current Sift price alerts comparing fictional supplier prices with earlier purchases" maxWidthClass="max-w-[320px]" />}
        />

        <FeatureSection
          eyebrow="Invoice library"
          accent={BRAND}
          reverse
          title={<>Every invoice.<br />Easy to find.</>}
          subtitle="Keep supplier history together, search by vendor or invoice number, and open the records behind your daily, weekly, and monthly spending."
          visual={<PhoneFrame src={media.screens.library.src} alt="Current Sift invoice library with searchable fictional supplier invoices and dates" maxWidthClass="max-w-[320px]" />}
        />

        <FeatureSection
          flagship
          eyebrow="Pro · Recipe costing"
          accent={BRAND}
          title={<>See what every dish<br />actually costs to make.</>}
          subtitle="Confirm ingredients and quantities, then match prices from your invoices to estimate each dish’s ingredient cost and ingredient margin. Estimates become more useful as you add and match data."
          visual={<PhoneFrame src={media.screens.recipes.src} alt="Current Sift recipe list showing sample ingredient costs, ingredient margins and confidence labels" maxWidthClass="max-w-[340px]" />}
        />

        <ClosingCTA />
      </main>
      <Footer />
    </>
  );
}
