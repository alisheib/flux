import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { jwtVerify } from "jose";
import { FluxMark } from "@/components/flux-logo";
import {
  ShoppingCart, Package, Ship, FileText, Wallet,
  BarChart3, LayoutGrid, Smartphone, ArrowRight, Check,
} from "lucide-react";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "flux-secret-key-change-in-production-2026"
);

const features = [
  { icon: ShoppingCart, title: "Point of Sale", desc: "Fast checkout for retail, hospitality and trade counters. Works offline." },
  { icon: Package, title: "Inventory", desc: "Real-time stock across locations with low-stock alerts and barcode lookup." },
  { icon: Ship, title: "Shipments", desc: "Track imports from China to Dar with full landed cost — including duty." },
  { icon: FileText, title: "Invoicing", desc: "TRA-fiscalized invoices, sent via WhatsApp, email or SMS in one tap." },
  { icon: Wallet, title: "Receivables", desc: "Customer credit, aging buckets and one-tap WhatsApp payment reminders." },
  { icon: BarChart3, title: "Accounting", desc: "P&L, balance sheet, cash flow — auto-generated from every transaction." },
  { icon: LayoutGrid, title: "Reports", desc: "Z-reports, daily takings, top products. Export to PDF or Excel instantly." },
  { icon: Smartphone, title: "Mobile", desc: "Run your shop from a phone. Designed for one thumb, even on 4G." },
];

const payments = [
  { abbr: "TSh", name: "Cash", sub: "Till float", color: "#10b981" },
  { abbr: "VISA", name: "Card", sub: "Visa & Mpay", color: "#3b82f6" },
  { abbr: "M", name: "M-Pesa", sub: "Vodacom", color: "#16a34a" },
  { abbr: "T", name: "Tigo Pesa", sub: "Yas", color: "#0066cc" },
  { abbr: "A", name: "Airtel Money", sub: "Airtel", color: "#dc2626" },
  { abbr: "NMB", name: "Bank Transfer", sub: "All major banks", color: "#d97706" },
  { abbr: "CR", name: "Store Credit", sub: "On account", color: "#7c3aed" },
];

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get("flux-token")?.value;
  if (token) {
    try { await jwtVerify(token, JWT_SECRET); redirect("/dashboard"); } catch {}
  }

  return (
    <div className="min-h-screen" style={{ background: "#0f0e0a", color: "#f5f1e8", fontFeatureSettings: "'cv11', 'ss01'" }}>

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 border-b" style={{ borderColor: "#2a2520", background: "rgba(15,14,10,0.72)", backdropFilter: "blur(16px) saturate(140%)" }}>
        <div className="mx-auto flex h-[68px] max-w-[1280px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <FluxMark size={36} tone="solid-accent" />
            <span className="text-[19px] font-bold tracking-[-0.03em]">FLUX</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden sm:inline-flex rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-white/[0.04]" style={{ color: "#a8a092" }}>
              Sign in
            </Link>
            <Link href="/register" className="inline-flex h-[38px] items-center gap-2 rounded-[10px] px-4 text-[13.5px] font-semibold" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#0f0e0a", boxShadow: "0 6px 24px -6px rgba(245,158,11,0.5), inset 0 1px 0 rgba(255,255,255,0.2)" }}>
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden" style={{ padding: "80px 0 100px" }}>
        {/* Glow */}
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(60% 50% at 50% 0%, rgba(217,119,6,0.18) 0%, transparent 70%), radial-gradient(40% 30% at 80% 20%, rgba(245,158,11,0.10) 0%, transparent 70%)" }} />
        {/* Dot grid */}
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "28px 28px", maskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 75%)", WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 75%)" }} />

        <div className="relative z-[2] mx-auto max-w-[880px] px-6 text-center">
          {/* Kente stripe */}
          <div className="mx-auto mb-6 h-1 w-[60px] rounded-sm" style={{ background: "linear-gradient(90deg, #d97706 0% 33%, #15803d 33% 66%, #1e40af 66% 100%)", boxShadow: "0 0 24px rgba(217,119,6,0.3)" }} />

          {/* Eyebrow */}
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold uppercase tracking-[0.04em]" style={{ background: "rgba(217,119,6,0.10)", border: "1px solid rgba(217,119,6,0.25)", color: "#f59e0b" }}>
            <span className="size-1.5 rounded-full" style={{ background: "#f59e0b", boxShadow: "0 0 8px #f59e0b" }} />
            Built for Africa
          </div>

          <h1 style={{ fontSize: "clamp(44px, 7vw, 80px)", lineHeight: 1.05, letterSpacing: "-0.035em", fontWeight: 700, margin: "0 0 24px", textWrap: "balance" as "wrap" }}>
            The current that moves{" "}
            <span style={{ background: "linear-gradient(135deg, #f59e0b 20%, #d97706 80%)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              your business
            </span>{" "}
            forward.
          </h1>

          <p className="mx-auto" style={{ fontSize: "clamp(17px, 2vw, 20px)", color: "#a8a092", maxWidth: 640, marginBottom: 40, lineHeight: 1.55, textWrap: "pretty" as "wrap" }}>
            All-in-one management for import and distribution businesses. From shipment costing to point of sale, invoicing to accounting — one platform, zero friction.
          </p>

          <div className="flex flex-wrap justify-center gap-3 mb-3">
            <Link href="/register" className="inline-flex h-[52px] items-center gap-2 rounded-xl px-6 text-base font-semibold" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#0f0e0a", boxShadow: "0 6px 24px -6px rgba(245,158,11,0.5), inset 0 1px 0 rgba(255,255,255,0.2)" }}>
              Get started
              <ArrowRight className="size-4" />
            </Link>
            <Link href="/login" className="inline-flex h-[52px] items-center rounded-xl px-6 text-base font-medium" style={{ background: "transparent", color: "#f5f1e8", border: "1px solid #2a2520" }}>
              Sign in to workspace
            </Link>
          </div>

          <div className="mt-7 inline-flex items-center gap-1.5 text-[13px]" style={{ color: "#6f685d" }}>
            <Check className="size-3.5 text-green-500" />
            Setup in minutes
            <span className="mx-2">·</span>
            <Check className="size-3.5 text-green-500" />
            TRA compliant
            <span className="mx-2">·</span>
            <Check className="size-3.5 text-green-500" />
            Built for Africa
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-[1280px] px-6">
          <div className="mb-14 text-center">
            <div className="mx-auto mb-6 h-1 w-[60px] rounded-sm" style={{ background: "linear-gradient(90deg, #d97706 0% 33%, #15803d 33% 66%, #1e40af 66% 100%)", boxShadow: "0 0 24px rgba(217,119,6,0.3)" }} />
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ letterSpacing: "-0.025em" }}>
              Run every part of your business <span style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>in one place</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl" style={{ color: "#a8a092" }}>
              Stop switching between five apps. FLUX brings sales, stock, money and compliance under one roof.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="group relative rounded-2xl p-6 transition-all duration-200 hover:-translate-y-0.5" style={{ background: "#1a1612", border: "1px solid #2a2520" }}>
                  {/* Icon box */}
                  <div className="mb-[18px] inline-flex size-11 items-center justify-center rounded-[10px]" style={{ background: "linear-gradient(135deg, rgba(217,119,6,0.25), rgba(217,119,6,0.08))", border: "1px solid rgba(217,119,6,0.25)", color: "#f59e0b" }}>
                    <Icon className="size-[22px]" strokeWidth={1.75} />
                  </div>
                  <h3 className="mb-2 text-[17px] font-semibold" style={{ letterSpacing: "-0.015em" }}>{f.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#a8a092" }}>{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Payments ── */}
      <section className="pb-20">
        <div className="mx-auto max-w-[1280px] px-6">
          <div className="mb-14 text-center">
            <div className="mx-auto mb-6 h-1 w-[60px] rounded-sm" style={{ background: "linear-gradient(90deg, #d97706 0% 33%, #15803d 33% 66%, #1e40af 66% 100%)", boxShadow: "0 0 24px rgba(217,119,6,0.3)" }} />
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ letterSpacing: "-0.025em" }}>
              Take payment <span style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>any way</span> they pay
            </h2>
            <p className="mx-auto mt-4 max-w-xl" style={{ color: "#a8a092" }}>
              Cash, card, mobile money, bank transfer, store credit — all reconciled, all fiscalized, all in one ledger.
            </p>
          </div>

          <div className="rounded-[20px] p-8 sm:p-14" style={{ background: "radial-gradient(50% 60% at 50% 0%, rgba(217,119,6,0.10) 0%, transparent 70%), #1a1612", border: "1px solid #2a2520" }}>
            <div className="mx-auto grid max-w-[1000px] grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {payments.map((p) => (
                <div key={p.name} className="flex flex-col items-center gap-2.5 rounded-xl p-4 text-center transition-all duration-200 hover:-translate-y-0.5" style={{ border: "1px solid #2a2520", background: "rgba(255,255,255,0.012)" }}>
                  <div className="flex size-10 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ background: p.color }}>
                    {p.abbr}
                  </div>
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs" style={{ color: "#6f685d" }}>{p.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-6">
          <div className="rounded-2xl p-10 text-center sm:p-16" style={{ background: "radial-gradient(60% 60% at 50% 0%, rgba(217,119,6,0.12) 0%, transparent 60%), #1a1612", border: "1px solid rgba(217,119,6,0.25)" }}>
            <div className="mx-auto mb-6 h-1 w-[60px] rounded-sm" style={{ background: "linear-gradient(90deg, #d97706 0% 33%, #15803d 33% 66%, #1e40af 66% 100%)" }} />
            <h2 className="mb-4 text-2xl font-bold sm:text-3xl" style={{ letterSpacing: "-0.025em" }}>Ready to take the current?</h2>
            <p className="mb-8" style={{ color: "#a8a092" }}>Set up your business in minutes. One platform for imports, sales, and accounting.</p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/register" className="inline-flex h-[52px] items-center gap-2 rounded-xl px-6 text-base font-semibold" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#0f0e0a", boxShadow: "0 6px 24px -6px rgba(245,158,11,0.5)" }}>
                Get started <ArrowRight className="size-4" />
              </Link>
              <Link href="/login" className="inline-flex h-[52px] items-center rounded-xl px-6 text-base font-medium" style={{ color: "#f5f1e8", border: "1px solid #2a2520" }}>
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t py-12" style={{ borderColor: "#2a2520" }}>
        <div className="mx-auto max-w-[1280px] px-6">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-2.5">
              <FluxMark size={28} tone="solid-accent" />
              <span className="text-base font-bold tracking-tight" style={{ color: "#d3cebf" }}>FLUX</span>
            </div>
            <div className="flex items-center gap-6 text-sm" style={{ color: "#6f685d" }}>
              <Link href="/login" className="transition-colors hover:text-white">Sign in</Link>
              <Link href="/register" className="transition-colors hover:text-white">Register</Link>
            </div>
            <p className="text-sm" style={{ color: "#3f3b2d" }}>
              &copy; 2026 FLUX Technologies &middot; Powered by Ali Sheib
            </p>
          </div>
        </div>
      </footer>

      {/* Kente bottom stripe */}
      <div className="h-1" style={{ background: "linear-gradient(90deg, #d97706 0% 33%, #15803d 33% 66%, #1e40af 66% 100%)" }} />
    </div>
  );
}
