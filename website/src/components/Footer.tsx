import Link from "next/link";
import Wordmark from "./Wordmark";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <Wordmark size={18} />
          <p className="text-sm text-muted">Invoice intelligence for restaurants.</p>
        </div>
        <nav className="flex items-center gap-6 text-sm text-muted">
          <Link href="/privacy" className="transition-colors hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-foreground">
            Terms
          </Link>
          <span className="text-muted/70">© {year} Sift</span>
        </nav>
      </div>
    </footer>
  );
}
