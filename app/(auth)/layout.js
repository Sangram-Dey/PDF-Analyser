import { FileText, Sparkles } from "lucide-react";

// Shared split screen for /sign-in and /sign-up: an animated product preview on the left, Clerk's form on the right.
// The (auth) folder name is a route group: it shares this layout without adding "/auth" to the URL.
export default function AuthLayout({ children }) {
  return (
    <main className="flex min-h-screen flex-wrap bg-background">
      <section className="relative flex min-w-0 flex-[1_1_520px] flex-col gap-10 overflow-hidden bg-sidebar bg-[radial-gradient(circle_at_15%_10%,hsl(var(--glow)/0.22),transparent_40%),radial-gradient(circle_at_90%_90%,hsl(var(--primary)/0.35),transparent_45%)] p-8 text-sidebar-foreground sm:p-14">
        <div className="flex items-center gap-2.5 text-xl font-bold">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-glow">
            <FileText className="size-5 text-white" />
          </span>
          Sourcework
        </div>

        <div className="max-w-xl animate-in fade-in slide-in-from-bottom-3 duration-700 motion-reduce:animate-none">
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Ask your documents.
            <br />
            <span className="text-glow">Get answers with receipts.</span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-sidebar-foreground/80">
            Upload PDFs and spreadsheets, ask in plain language, and every answer points to the exact page or row it came from.
          </p>
        </div>

        {/* Decorative preview: an invoice being scanned, a highlighted line and the cited answer. */}
        <div aria-hidden="true" className="relative hidden min-h-[360px] flex-1 md:block">
          <div className="absolute left-[4%] top-2 h-[340px] w-[290px] -rotate-2 overflow-hidden rounded-2xl bg-white p-6 shadow-2xl motion-safe:animate-float">
            <p className="text-[11px] font-bold tracking-wider text-foreground">INVOICE · PAGE 1</p>
            <div className="mt-4 flex flex-col gap-2.5">
              {[90, 70, 82].map((width) => <span key={width} className="h-2 rounded bg-border" style={{ width: `${width}%` }} />)}
              <span className="-mx-1.5 rounded-md bg-glow/40 px-1.5 py-1 text-xs font-semibold text-foreground motion-safe:animate-pulse">
                Total amount due: 1,250.00 USD
              </span>
              {[76, 88, 60, 84, 66].map((width) => <span key={width} className="h-2 rounded bg-border" style={{ width: `${width}%` }} />)}
            </div>
            <span className="absolute inset-x-0 h-[3px] bg-glow shadow-[0_0_18px_4px_hsl(var(--glow)/0.6)] motion-safe:animate-scan" />
          </div>

          <div className="absolute left-[calc(4%+150px)] top-[290px] max-w-[320px] rounded-2xl rounded-bl-sm bg-white/95 px-4 py-3.5 text-sm leading-relaxed text-foreground shadow-2xl animate-in fade-in slide-in-from-bottom-4 fill-mode-both delay-500 duration-700 motion-reduce:animate-none">
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-secondary-foreground">
              <Sparkles className="size-3.5" />
              ANSWER
            </p>
            The total due is <strong>1,250.00 USD</strong>{" "}
            <span className="inline-grid h-[18px] min-w-5 place-items-center rounded bg-secondary px-1 text-[11px] font-bold text-secondary-foreground">1</span>
          </div>
        </div>

        <p className="text-sm text-sidebar-muted">Your projects are private to your account.</p>
      </section>

      <section className="flex min-w-0 flex-[1_1_420px] items-center justify-center px-6 py-12">
        <div className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both delay-150 duration-700 motion-reduce:animate-none">{children}</div>
      </section>
    </main>
  );
}
