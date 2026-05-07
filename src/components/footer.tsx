import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card mt-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <Link
            href="/"
            className="text-base font-semibold text-primary hover:text-accent transition-colors"
          >
            CleanHome
          </Link>
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link
              href="/privacy"
              className="hover:text-primary transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="hover:text-primary transition-colors"
            >
              Termini e Condizioni
            </Link>
            <Link
              href="/refund"
              className="hover:text-primary transition-colors"
            >
              Politica di Rimborso
            </Link>
          </nav>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} CleanHome. Tutti i diritti riservati.
        </p>
      </div>
    </footer>
  );
}
