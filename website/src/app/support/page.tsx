import Link from 'next/link';
export const metadata = { title: 'Support — Sift' };
export default function SupportPage() {
  return <main className="mx-auto w-full max-w-2xl px-5 py-16 sm:py-24">
    <Link href="/" className="text-sm underline">Sift home</Link>
    <h1 className="mt-6 text-3xl font-semibold">Sift support</h1>
    <p className="mt-6 text-base leading-7">For help with scanning, sign-in, restaurant data or privacy, email <a className="underline" href="mailto:chimpchamp92@gmail.com">chimpchamp92@gmail.com</a>. Include your app version and a description of the problem. Please do not email passwords, verification codes or unredacted invoices.</p>
    <h2 className="mt-8 text-xl font-semibold">Testing on iPhone</h2>
    <p className="mt-2 leading-7">Install Sift through your TestFlight invitation. The app runs independently of a computer. Internet access is required for sign-in, cloud records and AI scans.</p>
    <h2 className="mt-8 text-xl font-semibold">Scans and AI permission</h2>
    <p className="mt-2 leading-7">Use a clear, well-lit photo with all invoice edges visible. You can import up to five invoice images together. Allow Anthropic AI processing when prompted; you can withdraw permission in Profile. Review the extracted details before saving.</p>
    <h2 className="mt-8 text-xl font-semibold">Subscriptions</h2>
    <p className="mt-2 leading-7">Use Profile → Restore purchases after reinstalling or changing devices. Use Manage subscription to cancel in Apple settings. Account deletion does not cancel Apple billing. <a className="underline" href="https://reportaproblem.apple.com">Request a refund from Apple</a>.</p>
    <h2 className="mt-8 text-xl font-semibold">Delete your account</h2>
    <p className="mt-2 leading-7">Use Profile → Delete account. Data belonging to restaurants where you are the only member is erased; shared records stay with remaining members. Contact support if you cannot complete the process.</p>
    <p className="mt-10 flex gap-6"><Link className="underline" href="/privacy">Privacy policy</Link><Link className="underline" href="/terms">Terms of service</Link></p>
  </main>;
}
