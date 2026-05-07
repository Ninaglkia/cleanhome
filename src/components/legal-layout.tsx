import Link from "next/link";

interface LegalLayoutProps {
  children: React.ReactNode;
  title: string;
  lastUpdated: string;
  version: string;
}

export function LegalLayout({
  children,
  title,
  lastUpdated,
  version,
}: LegalLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-lg font-semibold text-primary hover:text-accent transition-colors"
          >
            CleanHome
          </Link>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            ← Torna alla home
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-6 py-12">
          {/* Page title block */}
          <div className="mb-10 pb-8 border-b border-border">
            <h1 className="text-3xl sm:text-4xl font-serif text-primary mb-4 leading-tight">
              {title}
            </h1>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              <span>
                <span className="font-medium">Ultimo aggiornamento:</span>{" "}
                {lastUpdated}
              </span>
              <span>
                <span className="font-medium">Versione:</span> {version}
              </span>
            </div>
          </div>

          {/* Legal prose */}
          <div className="legal-prose">{children}</div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-12">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <Link
              href="/"
              className="text-base font-semibold text-primary hover:text-accent transition-colors"
            >
              CleanHome
            </Link>
            <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <Link href="/privacy" className="hover:text-primary transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-primary transition-colors">
                Termini e Condizioni
              </Link>
              <Link href="/refund" className="hover:text-primary transition-colors">
                Politica di Rimborso
              </Link>
            </nav>
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} CleanHome. Tutti i diritti riservati.
          </p>
        </div>
      </footer>
    </div>
  );
}
