import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "flux-secret-key-change-in-production-2026"
);

/* ------------------------------------------------------------------ */
/*  Kente stripe (reusable)                                           */
/* ------------------------------------------------------------------ */
function KenteStripe() {
  return (
    <div className="flex h-1.5 w-full">
      <div className="flex-1 bg-amber-500" />
      <div className="flex-1 bg-amber-600" />
      <div className="flex-1 bg-amber-700" />
      <div className="flex-1 bg-amber-500" />
      <div className="flex-1 bg-amber-600" />
      <div className="flex-1 bg-amber-700" />
      <div className="flex-1 bg-amber-500" />
      <div className="flex-1 bg-amber-600" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Features data                                                     */
/* ------------------------------------------------------------------ */
const features = [
  {
    icon: "\uD83D\uDED2",
    title: "Point of Sale",
    description:
      "Fast checkout with barcode scanning, cart management, receipts, and multi-payment support.",
  },
  {
    icon: "\uD83D\uDCE6",
    title: "Inventory",
    description:
      "Real-time stock tracking, low-stock alerts, categories, and stock movement history.",
  },
  {
    icon: "\uD83D\uDEA2",
    title: "Shipments",
    description:
      "Full landed-cost tracking from supplier to warehouse with expense breakdowns per item.",
  },
  {
    icon: "\uD83D\uDCDC",
    title: "Invoicing",
    description:
      "Professional PDF invoices with line items, taxes, discounts, and email delivery.",
  },
  {
    icon: "\uD83D\uDCB3",
    title: "Receivables",
    description:
      "Track customer balances, record payments, issue credit notes, and manage aging reports.",
  },
  {
    icon: "\uD83D\uDCCA",
    title: "Accounting",
    description:
      "Automated journal entries, chart of accounts, trial balance, and financial reports.",
  },
  {
    icon: "\uD83D\uDD12",
    title: "Security",
    description:
      "Role-based access, audit logs, granular permissions, and secure session management.",
  },
  {
    icon: "\uD83D\uDCF1",
    title: "Mobile Ready",
    description:
      "Fully responsive design works on any device. Install as a PWA for native-like experience.",
  },
];

const paymentMethods = [
  "Cash",
  "Visa / Card",
  "M-Pesa",
  "Tigo Pesa",
  "Airtel Money",
  "Bank Transfer",
  "Credit / Debt",
];

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */
export default async function Home() {
  /* ---- Auth check: redirect logged-in users to dashboard ---- */
  const cookieStore = await cookies();
  const token = cookieStore.get("flux-token")?.value;
  if (token) {
    try {
      await jwtVerify(token, JWT_SECRET);
      redirect("/dashboard");
    } catch {
      /* invalid token - show landing page */
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* ── Nav ──────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-md bg-amber-500 text-sm font-extrabold text-zinc-950">
              F
            </div>
            <span className="text-lg font-bold tracking-tight text-zinc-100">
              FLUX
            </span>
          </Link>

          {/* Right */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-100"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400"
            >
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pb-16 pt-20 sm:pt-28 md:pt-36">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0 -top-40 flex justify-center">
          <div className="h-[500px] w-[700px] rounded-full bg-amber-500/8 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-4xl px-6 text-center">
          {/* Badge */}
          <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-4 py-1.5 text-sm text-zinc-400">
            <span className="size-2 rounded-full bg-amber-500" />
            Built for Africa
          </div>

          {/* Heading */}
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            The current that moves{" "}
            <span className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
              your business
            </span>{" "}
            forward.
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400 sm:text-xl">
            All-in-one management for import and distribution businesses.
            From shipment costing to point of sale, invoicing to accounting
            &mdash; one platform, zero friction.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex h-12 items-center rounded-xl bg-amber-500 px-8 text-base font-semibold text-zinc-950 shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-400 hover:shadow-amber-500/30"
            >
              Start free today
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 items-center rounded-xl border border-zinc-700 px-8 text-base font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
            >
              Sign in to workspace
            </Link>
          </div>

          {/* Kente stripe */}
          <div className="mx-auto mt-16 max-w-md">
            <KenteStripe />
          </div>
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────────────── */}
      <section className="border-y border-zinc-800/60 bg-zinc-900/40">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 px-6 py-10 sm:grid-cols-4 sm:gap-8">
          {[
            ["16+", "Modules"],
            ["13", "Screens"],
            ["6", "Payment methods"],
            ["100%", "Mobile ready"],
          ].map(([value, label]) => (
            <div key={label} className="text-center">
              <div className="text-2xl font-bold text-amber-500 sm:text-3xl">
                {value}
              </div>
              <div className="mt-1 text-sm text-zinc-500">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features grid ────────────────────────────────────── */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need, nothing you don&apos;t
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-zinc-400">
              Purpose-built modules that work together seamlessly to run your
              entire operation.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-6 transition-colors hover:border-amber-500/40 hover:bg-zinc-900/70"
              >
                <div className="mb-4 text-3xl">{f.icon}</div>
                <h3 className="mb-2 text-base font-semibold text-zinc-100">
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed text-zinc-500">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Payment methods ──────────────────────────────────── */}
      <section className="border-t border-zinc-800/60 py-16">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="mb-2 text-xl font-semibold text-zinc-200">
            Accepted payment methods
          </h2>
          <p className="mb-8 text-sm text-zinc-500">
            Support the ways your customers actually pay.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {paymentMethods.map((m) => (
              <span
                key={m}
                className="rounded-full border border-zinc-800 bg-zinc-900/60 px-4 py-1.5 text-sm text-zinc-300"
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA section ──────────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-6">
          <div className="rounded-2xl border border-amber-500/30 bg-zinc-900/60 px-8 py-14 text-center sm:px-16">
            <h2 className="text-2xl font-bold sm:text-3xl">
              Ready to run your business?
            </h2>
            <p className="mx-auto mt-4 max-w-md text-zinc-400">
              Join businesses across Africa using Flux to manage inventory,
              sales, and finances in one place.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex h-12 items-center rounded-xl bg-amber-500 px-8 text-base font-semibold text-zinc-950 shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-400"
              >
                Get started free
              </Link>
              <Link
                href="/login"
                className="inline-flex h-12 items-center rounded-xl border border-zinc-700 px-8 text-base font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800/60 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-md bg-amber-500 text-xs font-extrabold text-zinc-950">
                F
              </div>
              <span className="text-base font-bold tracking-tight text-zinc-300">
                FLUX
              </span>
            </div>

            {/* Links */}
            <div className="flex items-center gap-6 text-sm text-zinc-500">
              <Link href="/login" className="transition-colors hover:text-zinc-300">
                Sign in
              </Link>
              <Link href="/register" className="transition-colors hover:text-zinc-300">
                Register
              </Link>
            </div>

            {/* Copyright */}
            <p className="text-sm text-zinc-600">
              &copy; 2026 Flux Systems &middot; Powered by Ali Sheib
            </p>
          </div>
        </div>
      </footer>

      {/* ── Bottom Kente stripe ──────────────────────────────── */}
      <KenteStripe />
    </div>
  );
}
