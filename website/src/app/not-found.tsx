import Link from "next/link";

export const metadata = { title: "Page not found — Sift" };

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <p className="text-sm font-semibold text-brand-ink">404</p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">This page isn’t here.</h1>
      <p className="mt-4 leading-relaxed text-muted">The link may be out of date. Head back to the Sift home page, or find help and our policies below.</p>
      <p className="mt-8 flex flex-wrap justify-center gap-6 text-sm">
        <Link className="font-semibold underline" href="/">Sift home</Link>
        <Link className="underline" href="/support">Support</Link>
        <Link className="underline" href="/privacy">Privacy</Link>
        <Link className="underline" href="/terms">Terms</Link>
      </p>
    </main>
  );
}
