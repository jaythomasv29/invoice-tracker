import SiteNav from "@/components/SiteNav";
import Hero from "@/components/Hero";
import FeatureSection from "@/components/FeatureSection";
import ClosingCTA from "@/components/ClosingCTA";
import Footer from "@/components/Footer";
import WaitlistForm from "@/components/WaitlistForm";
import PhoneFrame from "@/components/PhoneFrame";
import { VerifyVisual } from "@/components/FeatureVisuals";

// Brand green is the primary accent; each feature carries a restrained,
// meaning-bearing tint (price alerts orange, verification red) drawn from the
// Sift app's own semantic palette (constants/Colors.ts).
const BRAND = "#5DB075";
const ALERT = "#E07A30";
const VERIFY = "#D94F3A";

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
          eyebrow="Scan"
          accent={BRAND}
          title={<>Snap a photo,<br />skip the data entry.</>}
          subtitle="Point your camera at any invoice — line items, prices, and totals come out the other side automatically, in seconds."
          visual={<PhoneFrame src="/screens/invoice.png" alt="A scanned Cascade Foodservice invoice with extracted line items, categories, and totals" maxWidthClass="max-w-[280px]" />}
        />

        <FeatureSection
          eyebrow="Price alerts"
          accent={ALERT}
          reverse
          title={<>Catch price hikes<br />the moment they happen.</>}
          subtitle="Every new invoice is checked against your price history, so a quiet increase never slips past you."
          visual={<PhoneFrame src="/screens/alerts.png" alt="Sift's price alerts list showing a 20% increase on chicken thigh" maxWidthClass="max-w-[280px]" />}
        />

        <FeatureSection
          eyebrow="Verification"
          accent={VERIFY}
          title={<>Know what actually<br />showed up on the truck.</>}
          subtitle="Check delivered items against what you were billed for, and flag what's missing in one tap."
          visual={<VerifyVisual />}
        />

        <FeatureSection
          flagship
          eyebrow="Recipe costing"
          accent={BRAND}
          title={<>See what every dish<br />actually costs to make.</>}
          subtitle="Sift prices each recipe straight from your invoice history, so your margins update the moment an ingredient does. It's the capability competitors charge far more for — and it ties every other insight back to your menu."
          visual={<PhoneFrame src="/screens/recipe.png" alt="Pad Thai's true plate cost, $3.12, broken down by ingredient" maxWidthClass="max-w-[340px]" />}
        />

        <ClosingCTA />
      </main>
      <Footer />
    </>
  );
}
