import SiteNav from "@/components/SiteNav";
import Hero from "@/components/Hero";
import FeatureSection from "@/components/FeatureSection";
import ClosingCTA from "@/components/ClosingCTA";
import Footer from "@/components/Footer";
import WaitlistForm from "@/components/WaitlistForm";
import PhoneFrame from "@/components/PhoneFrame";


// Brand green is the primary accent; each feature carries a restrained,
// meaning-bearing tint (price alerts orange, verification red) drawn from the
// Sift app's own semantic palette (constants/Colors.ts).
const BRAND = "#17624B";
const ALERT = "#A65524";
const VERIFY = "#BD4938";

export default function Home() {
  return (
    <>
      <SiteNav />
      <main className="flex flex-col">
        <Hero />

        {/* Primary waitlist slot. The hero + nav CTAs scroll here. */}
        <section id="waitlist" className="mx-auto w-full max-w-xl scroll-mt-24 px-6 pb-8">
          <WaitlistForm source="hero" />
        </section>

        <FeatureSection
          eyebrow="Scan & review"
          accent={BRAND}
          title={<>Snap a photo,<br />skip the data entry.</>}
          subtitle="Photograph or import an invoice. AI drafts the line items, prices, and totals for you to review before saving."
          visual={<PhoneFrame src="/screens/invoice.png" alt="A scanned Cascade Foodservice invoice with extracted line items, categories, and totals" maxWidthClass="max-w-[280px]" />}
        />

        <FeatureSection
          eyebrow="Pro · Price alerts"
          accent={ALERT}
          reverse
          title={<>Catch price hikes<br />the moment they happen.</>}
          subtitle="Compare new invoice prices with your purchasing history and review the supplier changes that need attention."
          visual={<PhoneFrame src="/screens/alerts.png" alt="Sift's price alerts list showing a 20% increase on chicken thigh" maxWidthClass="max-w-[280px]" />}
        />

        <FeatureSection
          eyebrow="Verification"
          accent={VERIFY}
          title={<>Know what actually<br />showed up on the truck.</>}
          subtitle="Check delivered items against what you were billed for, and flag what's missing in one tap."
          visual={<PhoneFrame src="/screens/invoice.png" alt="Invoice review with item-level missing delivery and note controls" maxWidthClass="max-w-[280px]" />}
        />

        <FeatureSection
          flagship
          eyebrow="Pro · Recipe costing"
          accent={BRAND}
          title={<>See what every dish<br />actually costs to make.</>}
          subtitle="Confirm ingredients and quantities, then match prices from your invoices to estimate each dish’s ingredient cost and ingredient margin. Estimates become more useful as you add and match data."
          visual={<PhoneFrame src="/screens/recipe.png" alt="Sift recipe list showing sample ingredient costs, estimated margins and confidence labels" maxWidthClass="max-w-[340px]" />}
        />

        <ClosingCTA />
      </main>
      <Footer />
    </>
  );
}
