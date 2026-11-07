import Link from 'next/link';
import { pageMetadata } from '@/lib/pageMetadata';
import content from '../../content/legal.json';
export const metadata = pageMetadata('/terms', 'Terms of Service — Sift', 'The terms for using Sift, including Free and Pro plan allowances, Apple subscriptions, AI accuracy and account deletion.');
export default function LegalPage() {
  return <main className="mx-auto w-full max-w-2xl px-5 py-16 sm:py-24">
    <Link href="/" className="text-sm underline">Sift home</Link>
    <h1 className="mt-6 text-3xl font-semibold">Terms of Service</h1>
    <p className="mt-2 text-sm text-muted">Last updated: {content.updated}</p>
    <div className="mt-10 space-y-8">{content.terms.map(section => <section key={section.title}>
      <h2 className="mb-2 text-xl font-semibold">{section.title}</h2>
      <p className="text-base leading-7">{section.text}</p>
    </section>)}</div>
    <p className="mt-10"><Link href="/support" className="underline">Contact support</Link></p>
  </main>;
}
