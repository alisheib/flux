import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import Link from "next/link";
import type { Metadata } from "next";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "flux-secret-key-change-in-production-2026"
);

export const metadata: Metadata = {
  title: "FLUX — Business Management Platform for Africa",
  description:
    "All-in-one business management for import & distribution companies. Point of Sale, Inventory, Shipment Costing, Invoicing, Accounts Receivable, Accounting & Reports. Built for Tanzania and Africa.",
  keywords: [
    "business management software",
    "POS system Tanzania",
    "inventory management Africa",
    "invoicing software",
    "accounting platform",
    "import distribution ERP",
    "fluxtz",
    "flux tz",
    "Tanzania business software",
    "point of sale Africa",
    "accounts receivable",
    "shipment costing",
  ],
};

export default async function LandingPage() {
  // If logged in, redirect to dashboard
  const cookieStore = await cookies();
  const token = cookieStore.get("flux-token")?.value;
  if (token) {
    try {
      await jwtVerify(token, JWT_SECRET);
      redirect("/dashboard");
    } catch {}
  }

  const features = [
    { icon: "🛒", title: "Point of Sale", desc: "Fast POS with cart, discounts, tax, and multiple payment methods including M-Pesa and credit sales." },
    { icon: "📦", title: "Inventory Management", desc: "Track stock in real-time with low-stock alerts, dynamic product fields per category, and barcode support." },
    { icon: "🚢", title: "Shipment Costing", desc: "Import container tracking with FOB costs, customs expenses, and landed cost breakdown per product." },
    { icon: "📄", title: "Invoicing & PDF", desc: "Auto-generated invoices from sales with PDF download, WhatsApp sharing, and public invoice links." },
    { icon: "💳", title: "Accounts Receivable", desc: "Track customer debts with partial payments (M-Pesa, Tigo, Airtel, Bank), aging analysis, and collection tools." },
    { icon: "📊", title: "Accounting & Reports", desc: "P&L per shipment, revenue vs costs charts, sales analytics by product, category, and salesperson." },
    { icon: "🔒", title: "Enterprise Security", desc: "Role-based access, full audit trail, rate limiting, session management, and server-side validation." },
    { icon: "📱", title: "Mobile Ready", desc: "Fully responsive on iPhone and Android. Mobile receipt bottom sheet, touch-optimized POS, no app install needed." },
  ];

  return (
    <div className="min-h-screen bg-[#0f0e0a] text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 md:px-12 lg:px-20">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#d97706] text-lg font-extrabold text-white">
            F
          </div>
          <span className="text-xl font-bold tracking-tight">FLUX</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:text-white"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-[#d97706] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#b45309]"
          >
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-20 pt-16 md:px-12 md:pt-24 lg:px-20 lg:pt-32">
        {/* Glow */}
        <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-[#d97706]/10 blur-[120px]" />
        {/* Dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-amber-300/90">
            <span className="size-1.5 rounded-full bg-[#d97706]" />
            Built for Africa
          </div>

          <h1 className="mb-6 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl lg:text-6xl">
            The current that moves{" "}
            <span className="bg-gradient-to-r from-[#d97706] to-[#f59e0b] bg-clip-text text-transparent">
              your business
            </span>{" "}
            forward.
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-white/50">
            Import, warehouse, and sell with precision. FLUX is the all-in-one platform
            for import &amp; distribution businesses — from Dar es Salaam to Dakar.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-[#d97706] px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-amber-900/30 transition-all hover:bg-[#b45309] hover:shadow-xl hover:shadow-amber-900/40"
            >
              Start free today
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-8 py-3.5 text-base font-medium text-white/70 transition-colors hover:border-white/30 hover:text-white"
            >
              Sign in to workspace
            </Link>
          </div>
        </div>

        {/* Kente stripe */}
        <div className="mx-auto mt-16 h-[3px] max-w-lg overflow-hidden rounded-full">
          <div className="flex h-full">
            <div className="flex-1 bg-[#d97706]" />
            <div className="flex-1 bg-[#16a34a]" />
            <div className="flex-1 bg-[#1e40af]" />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-white/5 bg-white/[0.02] px-6 py-12 md:px-12 lg:px-20">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 md:grid-cols-4">
          {[
            ["16+", "Modules"],
            ["13", "Screens"],
            ["6", "Payment methods"],
            ["100%", "Mobile ready"],
          ].map(([val, label]) => (
            <div key={label} className="text-center">
              <div className="text-3xl font-extrabold text-[#d97706]">{val}</div>
              <div className="mt-1 text-sm text-white/40">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 md:px-12 lg:px-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold tracking-tight md:text-4xl">
              Everything you need, nothing you don&apos;t.
            </h2>
            <p className="mx-auto max-w-xl text-base text-white/40">
              From the moment goods land at port to the moment cash hits your account — FLUX handles every step.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition-all hover:border-[#d97706]/30 hover:bg-white/[0.04]"
              >
                <div className="mb-4 text-3xl">{f.icon}</div>
                <h3 className="mb-2 text-base font-semibold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-white/40">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Payment methods */}
      <section className="border-t border-white/5 px-6 py-16 md:px-12 lg:px-20">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-3 text-2xl font-bold">Accept every payment method.</h2>
          <p className="mb-8 text-white/40">Cash, card, M-Pesa, Tigo Pesa, Airtel Money, bank transfers, and credit sales — all built in.</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {["Cash", "Visa / Card", "M-Pesa", "Tigo Pesa", "Airtel Money", "Bank Transfer", "Credit / Debt"].map((m) => (
              <span
                key={m}
                className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-medium text-white/70"
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 md:px-12 lg:px-20">
        <div className="mx-auto max-w-3xl rounded-3xl border border-[#d97706]/20 bg-gradient-to-br from-[#d97706]/10 to-transparent p-10 text-center md:p-16">
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
            Ready to run your business, not your spreadsheets?
          </h2>
          <p className="mb-8 text-base text-white/50">
            Set up in minutes. No credit card required. Free plan available.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-xl bg-[#d97706] px-8 py-4 text-base font-semibold text-white shadow-lg shadow-amber-900/30 transition-all hover:bg-[#b45309]"
          >
            Create your workspace
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-10 md:px-12 lg:px-20">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#d97706] text-sm font-extrabold text-white">
              F
            </div>
            <span className="font-bold">FLUX</span>
            <span className="text-sm text-white/30">· Business Management Platform</span>
          </div>
          <div className="flex gap-6 text-sm text-white/30">
            <Link href="/login" className="hover:text-white/60">Sign in</Link>
            <Link href="/register" className="hover:text-white/60">Register</Link>
          </div>
          <div className="text-sm text-white/20">
            &copy; 2026 Flux Systems · Powered by Ali Sheib
          </div>
        </div>
      </footer>

      {/* Kente bottom stripe */}
      <div className="h-[3px]">
        <div className="flex h-full">
          <div className="flex-1 bg-[#d97706]" />
          <div className="flex-1 bg-[#16a34a]" />
          <div className="flex-1 bg-[#1e40af]" />
        </div>
      </div>
    </div>
  );
}
