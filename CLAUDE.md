# FLUX — AI Development Guide

## What is FLUX
Business management SaaS for import/distribution companies in Africa. Multi-tenant. Live at **fluxtz.com**.

## Stack
- **Framework:** Next.js 16 (App Router, Server Components + Client Components)
- **Styling:** Tailwind CSS 4 + shadcn/ui components + custom CSS classes in `globals.css`
- **Database:** PostgreSQL (Neon) via Prisma 7 ORM
- **Auth:** JWT in httpOnly cookies, bcrypt hashing
- **Hosting:** Vercel (auto-deploy from `main`)
- **PDF:** `@react-pdf/renderer` for invoice PDFs (client-side generation)
- **Charts:** Recharts
- **Excel:** SheetJS (xlsx) for import parsing, custom `excel-export.ts` for export

## Architecture

```
src/
  app/
    (app)/             # Authenticated pages (sidebar + header layout)
      dashboard/       # KPI cards, revenue chart, recent sales, low stock
      pos/             # Point of sale — product grid + cart + checkout + customer typeahead + "save as proforma"
      inventory/       # Products CRUD, categories, stock, area selling (sqm)
      shipments/       # Import containers, landed cost, expense allocation
      invoices/        # Invoice list + detail, PDF download, WhatsApp share
      proformas/       # Quote list + detail dialog + convert-to-invoice flow
      receivables/     # Debt tracking, aging, payment recording
      customers/       # Customer CRM — list, detail (4 tabs), typeahead search
      accounting/      # P&L by shipment, monthly charts
      reports/         # Sales analytics, date presets, Excel export
      tally/           # TRA fiscal compliance (Tanzania Revenue Authority)
      users/           # Team management, role-based access
      settings/        # Org config, tax, invoice numbering, permissions, currency lock
      profile/         # User profile, name/password change
      activity/        # Audit log viewer
      stock-movements/ # Stock history (sales, refunds, adjustments)
      imports/         # Excel Import module — templates, upload, validate, history
      suppliers/       # Supplier management (linked to purchase orders)
      purchase-orders/ # PO creation, receiving, stock update
    api/               # REST API routes — all under /api/*
    login/ register/ forgot-password/ reset-password/
    invoice/[id]/      # Public invoice view (shareable link)
  components/
    app-sidebar.tsx    # Sidebar navigation (always dark)
    app-header.tsx     # Breadcrumb header
    customer-typeahead.tsx  # Reusable combobox: search customers by name/phone/TIN
    customer-dialog.tsx     # Add/Edit customer dialog (used in list, POS, invoices)
    receipt-sheet.tsx  # Mobile receipt bottom sheet
    session-guard.tsx  # Inactivity logout
    ui/                # shadcn/ui components + Progress
  lib/
    auth.ts            # JWT, password hashing, role hierarchy
    db.ts              # Prisma client (pg adapter for Neon)
    audit.ts           # Audit logging
    stock.ts           # Stock movement recording (atomic, inside transactions)
    calculations.ts    # formatCurrency, formatNumber, calculateShipmentCosts
    invoice-pdf.tsx    # @react-pdf/renderer invoice PDF
    invoice-template.ts # HTML invoice template
    receipt-template.ts # Receipt HTML template
    validate.ts        # Client-side input validation helpers
prisma/
  schema.prisma        # 22 models (see below)
tests/
  unit/                # 861 tests across 17 files (npm test)
```

## Database Models (22)
Organization, User, Shipment, ShipmentItem, ShipmentExpense, Category, Product, Sale, SaleItem, Invoice, AuditLog, Subscription, OrgSettings, StockMovement, CreditNote, Payment, Supplier, PurchaseOrder, PurchaseOrderItem, **Customer**, **ImportTemplate**, **ImportJob**, ImportRowLog, ImportDiff

## Key Decisions Made
- **Currency locked after first sale** — prevents data corruption from mid-stream currency change
- **Multi-currency entry feature** — see `## Currency Architecture` below
- **Customer is optional** — walk-in sales use free-text `customer` field, registered customers use `customerId` FK
- **TIN stored in backend only** — `Invoice.customerTin` exists in DB for records, never shown on PDF output (customer security)
- **Stock check inside transaction** — prevents race condition overselling on concurrent sales
- **Duplicate productId in sale items** — aggregated before stock check to prevent bypass
- **orgId in every update/delete query** — belt-and-suspenders multi-tenant isolation
- **Password rules enforced on ALL endpoints** — 8+ chars, upper, lower, number, special (profile, admin, register)
- **Soft delete for customers** — deactivate sets status, preserves sale/invoice history

## Currency Architecture

Every money column on every model stores the **org's base currency** (the canonical amount). Foreign-currency entry is supported as user-facing input only — the system converts at input time using a rate the user provides (or auto-fetches from `/api/fx/latest`), and persists both the converted org-currency value AND the original entry metadata.

### Code surfaces
- **`src/lib/currency.ts`** — canonical currency registry. `CURRENCIES` is the supported list (15+ codes including TZS, KES, NGN, UGX, ZAR, GHS, EUR, GBP, CNY, INR, AED, JPY, etc.). Single source of truth for symbols, decimal rules, and Excel format strings. `normalizeCurrencyCode` handles aliases (e.g. TSH → TZS) and falls back to USD on null/whitespace.
- **`src/lib/calculations.ts:formatCurrency`** — public display helper, delegates to the registry. **Never silently falls through to `$` for unknown codes** (a critical bug from before this rewrite).
- **`src/lib/currency-entry.ts`** — server-side parser. `parseCurrencyEntry(input, fieldLabel)` validates and normalizes the optional `{amount, currency, rate}` payload before persistence. `formatEntryForAudit` builds the audit-log line.
- **`src/components/currency-amount-input.tsx`** — reusable UI. Shows a single amount field by default; expands to a foreign-entry block with auto-fetched rate; emits both the converted org-currency amount and `CurrencyMeta` for the parent to send to the server.
- **`src/app/api/fx/latest/route.ts`** — auth-gated proxy to `open.er-api.com` (free, no API key, supports ~160 currencies). 6h in-memory cache + Next server cache.

### Entry-metadata columns (added in migration `20260523_add_currency_entry_columns.sql`)
| Model | Columns |
|---|---|
| `Product` | `costEntry{Currency,Amount,Rate}`, `sellingEntry{Currency,Amount,Rate}`, `pricePerSqmEntry{Currency,Amount,Rate}` |
| `ShipmentItem` | `entryCurrency`, `entryAmount`, `entryRate` |
| `ShipmentExpense` | `entryCurrency`, `entryRate` (uses existing `amountLocal` for the raw value) |
| `PurchaseOrderItem` | `entryCurrency`, `entryAmount`, `entryRate` |
| `Payment` | `entryCurrency`, `entryAmount`, `entryRate` |

All nullable, all additive. Pre-existing rows remain valid.

### API payload contract
Every API route that accepts a money field also accepts an OPTIONAL entry object:
```jsonc
// POST /api/products
{
  "name": "5mm Float Glass",
  "costPrice": 214593,                                       // org-currency value
  "costEntry": { "amount": 82, "currency": "USD", "rate": 2616.99 }, // optional
  ...
}
```
Semantics:
- **Omitted / undefined** → on create, columns stay NULL. On update, columns are unchanged.
- **Explicit `null`** → columns are cleared. Use this when a user collapses the foreign-entry block during edit.
- **`{amount, currency, rate}`** → must include all three; amount ≥ 0, rate > 0, currency normalized via `normalizeCurrencyCode`. Partial objects are rejected with 400.

### UI behavior
- Inventory list shows `entered $82 @ 2616.99` beneath the cost cell when entry metadata exists.
- Opening an existing product for edit auto-expands the foreign-entry block with the saved values restored.
- All currency formatting goes through `formatCurrency(value, orgCurrency)`. Never call without a currency arg or with a hardcoded string — both forms used to silently render as `$`.

### Deployment steps for the entry-metadata columns
The schema change is additive (nullable columns only). Two ways to apply on Neon:
1. **`npx prisma db push`** — preferred; Prisma reads `schema.prisma` and runs the same DDL.
2. **Manual** — copy `prisma/migrations/20260523_add_currency_entry_columns.sql` into the Neon SQL editor. Idempotent (uses `IF NOT EXISTS`).

## Proforma Architecture

A **proforma** is a non-binding price quotation issued to a customer before a sale closes. It's distinct from an invoice in three ways: no stock impact, not part of revenue/receivables, and it expires.

### Lifecycle states
```
draft ── sent ──┬── accepted ── converted ──► (locked, linked to Invoice)
                │
                ├── declined  (terminal — preserved for audit)
                │
                └── expired   (auto-stamped when validUntil < now)
```

### Code surfaces
- **`src/lib/proforma-template.ts`** — PDF template. Sibling of `invoice-template.ts`. Six visual states: `draft / sent / accepted / converted / expired / declined`. Watermark for expired, conversion stamp for converted, acceptance signature block for the rest. **NEVER renders `customerTin`** — same security rule as the tax invoice.
- **`src/app/api/proformas/route.ts`** — `GET` (list, auto-marks past-validity ones as expired) and `POST` (create). Computes subtotal/tax/total server-side; client can't lie.
- **`src/app/api/proformas/[id]/route.ts`** — `GET`/`PUT`/`DELETE`. Converted proformas are locked against updates and deletes (terminal state).
- **`src/app/api/proformas/[id]/convert/route.ts`** — `POST` the critical action. Atomically: creates the `Sale` + `Invoice`, decrements stock, links the proforma via `convertedToInvoiceId`, stamps `convertedAt`, sets status to `converted`. Idempotent — re-running on an already-converted proforma returns the existing invoice with `alreadyConverted: true`.
- **`src/app/api/proformas/[id]/download/route.ts`** — Same Puppeteer pipeline as `/invoices/[id]/download`. Falls back to HTML if Chromium isn't available.
- **`src/app/(app)/proformas/page.tsx`** — list + detail dialog + convert + delete + download actions.
- **`src/app/(app)/pos/page.tsx`** — adds "Save as proforma (quote)" alongside "Complete sale". Same cart payload, different endpoint; status defaults to `sent`.
- **`src/components/app-sidebar.tsx`** — `Proformas` nav entry between Invoices and Accounting.

### Schema (added in `prisma/migrations/20260529_add_proforma_module.sql`)
| Table / column | Purpose |
|---|---|
| `Proforma` | Standalone quote — no `saleId` link until converted. |
| `ProformaItem` | Line items, mirrors `SaleItem`. |
| `Proforma.convertedToInvoiceId` | One-to-one back-ref into `Invoice` once converted. |
| `Proforma.validUntil` | Required. Past this date status auto-flips to `expired`. |
| `OrgSettings.proformaPrefix` | Defaults `"PRO"` — separate from `invoicePrefix` so the two number sequences never collide. |
| `OrgSettings.proformaNextNum` | Defaults `1`. |
| `OrgSettings.proformaValidityDays` | Defaults `14`. |

### Deployment
Same migration story as the currency feature — additive only, run `npx prisma db push` or paste `prisma/migrations/20260529_add_proforma_module.sql` into Neon. Idempotent.

### Design source
The PDF was designed by Claude Design per `Flux main proforma showcase/` (handoff materials deleted post-implementation — the canonical source of truth going forward is `src/lib/proforma-template.ts` itself, which contains inline rationale comments for D1–D8 decisions).

## Auth & Roles
- **Admin:** Full access
- **Manager:** All except user management
- **Accountant:** Read-only on most, full on accounting/invoices/payments
- **Salesman:** POS + own sales only
- Custom permissions configurable in Settings → Roles

## Dev Commands
```bash
npm run dev          # Start dev server
npm run build        # Production build
npm test             # Run 861 unit tests (17 files)
npx prisma generate  # Regenerate Prisma client after schema changes
npx prisma db push   # Push schema changes to database
```

## Demo Credentials
- **Email:** admin@flux.com | **Password:** password123
- **Seed:** POST /api/seed (creates demo org with products, shipments, sales)

## Deployment
Vercel auto-deploys from `main`. Required env vars: `DATABASE_URL`, `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`

## FLUX UI Kit — single reference

**This is THE reference for everything visual.** Every page in FLUX is built from these locations; nothing exists in a separate kit folder. When a new screen or PDF needs design tokens, components, or brand assets, it pulls from here — no exceptions, no parallel files.

### Where the kit lives

```
src/
  app/
    globals.css              ← design tokens (colors, radii, badges, KPI patterns, btn-* classes)
  components/
    ui/                      ← shadcn primitives (Button, Input, Dialog, Table, Tabs,
                               Select, DropdownMenu, Popover, Tooltip, Card,
                               Badge, Label, Separator, ScrollArea, Sheet, Textarea,
                               Avatar, Command, Form, FormSelect, InputGroup, Progress, Sonner)
    flux-logo.tsx            ← brand mark — IMMUTABLE
    app-sidebar.tsx          ← canonical nav + density rules
    app-header.tsx           ← breadcrumb shape
    currency-amount-input.tsx← canonical money-entry control
    customer-typeahead.tsx   ← canonical customer picker (POS + invoices)
  lib/
    currency.ts              ← currency registry — single source of truth for symbols/decimals
    invoice-template.ts      ← tax-invoice PDF — pattern for any new printable A4 document
    invoice-pdf.tsx          ← React-PDF variant of the above
    receipt-template.ts      ← POS receipt template
    proforma-template.ts     ← quote PDF — sibling of invoice-template.ts
```

### Brand tokens — "Savannah Ochre"
- **btn-brand:** Dark ink `#0f0e0a` (light) / amber `#e39340` (dark)
- **btn-accent:** Amber `#d97706` always
- **Sidebar:** Always dark `#0f0e0a`
- **Focus rings:** Amber 20% opacity
- **Border radius:** Inputs/cards `10px`, dialogs `20px`
- **Badges:** `badge-success` (green), `badge-danger` (red), `badge-warn` (amber), `badge-info` (blue), `badge-violet`
- **KPI Cards:** Colored icon box (`size-10 rounded-lg bg-*-500/12`) + uppercase muted label + large value + subtitle
- **Tables:** Uppercase sticky headers, row hover (`hover:bg-muted/40 transition-colors`)
- **Empty states:** Centered icon box + title + description + CTA
- **NEVER modify `flux-logo.tsx`**

### How to add a new screen / PDF without breaking the kit
1. **Use the shadcn primitives** from `src/components/ui/` — never re-style a Button or Input outside the kit.
2. **Pull tokens from `globals.css`** — never invent a new color value. If you genuinely need one, add it to `globals.css` and document why.
3. **Pull currency formatting from `lib/currency.ts`** — never call `formatCurrency()` without a currency arg or hardcode `$`.
4. **Sidebar entries** go in `app-sidebar.tsx`'s `navItems` array — same shape as every other module.
5. **PDF templates** mirror `invoice-template.ts` structurally — inline styles, A4 portrait, Inter via Google CDN, `formatCurrencyValue` from `lib/currency.ts`.

### Where the kit is NOT
- No separate `ui-kit/`, `design-system/`, `flux-handoff/`, or `tokens/` folder at the repo root.
- No prototype HTML files sitting outside `src/`.
- No vendor-prefixed CSS or framework-flavored copies of the same primitive.

If anyone asks "where's the FLUX UI kit?" — point them here. **One reference.**

## Important Rules
- All queries scoped by `orgId` (multi-tenant)
- Invoice download = PDF via @react-pdf/renderer (never print dialogs)
- After registration, auto-login (redirect to /dashboard)
- Export buttons disabled when no data
- No "try for free" language — use "Get started"
- Keep origin/import references generic (not China-specific)

---

## Roadmap — What's Next

### Built (Current State)
- Core: Dashboard, POS, Inventory (with area selling), Shipments, Invoices, Receivables, Accounting, Reports
- Customer CRM: List, detail (4 tabs), typeahead in POS, add/edit dialog, TIN/phone search
- Excel Import: Templates, 3-step wizard, upload+validate (SheetJS), history
- Suppliers + Purchase Orders: CRUD, receiving flow
- TRA Tally: Tanzania fiscal compliance config
- Security: Rate limiting, input validation, currency lock, orgId on all mutations
- Tests: 861 unit tests covering all business logic, UI states, and edge cases

### Phase 1 — Next to Build
1. **Offline POS** — Service Worker + IndexedDB + sync queue
2. **Barcode Scanning** — Camera + USB scanner, barcode labels
3. ~~**Multi-Currency** — Exchange rate table, per-transaction currency~~ **Done** (see Currency Architecture above)
4. **Email Notifications** — Resend integration, invoice/payment/alert emails

### Phase 2 — Competitive
5. **Double-Entry Accounting** — Chart of accounts, journal entries, balance sheet
6. **Multi-Location / Warehouse** — Stock per location, transfers
7. **Product Variants** — Size/color/thickness per product
8. **Discount Rules** — Bulk pricing, customer-specific, promotions

### Phase 3 — Enterprise
9. Multi-Language (i18n) — French, Swahili, Arabic
10. Public API + Webhooks
11. 2FA / Security hardening
12. Mobile PWA with push notifications
13. White-labeling (custom logo/colors/domain)
14. Multi-country tax compliance (Kenya, Nigeria, Zimbabwe, Uganda)
