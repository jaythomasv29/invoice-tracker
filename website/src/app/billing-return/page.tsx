import type { Metadata } from "next";
import BillingReturnClient from "./BillingReturnClient";

// Transitional utility screen Stripe redirects mobile Safari to after
// checkout/portal, with ?status=success or ?status=cancel (see the
// create-checkout / billing-portal edge functions). It bounces the user back
// into the native app via the `sift://` custom URL scheme.
export const metadata: Metadata = {
  title: "Returning to Sift…",
  robots: { index: false, follow: false },
};

// In Next.js 16, searchParams is a Promise and must be awaited.
export default async function BillingReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const { status } = await searchParams;
  const raw = Array.isArray(status) ? status[0] : status;
  // Anything other than an explicit "cancel" is treated as success.
  const resolved = raw === "cancel" ? "cancel" : "success";

  return <BillingReturnClient status={resolved} />;
}
