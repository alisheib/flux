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
      pos/             # Point of sale — product grid + cart + checkout + customer typeahead
      inventory/       # Products CRUD, categories, stock, area selling (sqm)
      shipments/       # Import containers, landed cost, expense allocation
      invoices/        # Invoice list + detail, PDF download, WhatsApp share
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
- **Customer is optional** — walk-in sales use free-text `customer` field, registered customers use `customerId` FK
- **TIN stored in backend only** — `Invoice.customerTin` exists in DB for records, never shown on PDF output (customer security)
- **Stock check inside transaction** — prevents race condition overselling on concurrent sales
- **Duplicate productId in sale items** — aggregated before stock check to prevent bypass
- **orgId in every update/delete query** — belt-and-suspenders multi-tenant isolation
- **Password rules enforced on ALL endpoints** — 8+ chars, upper, lower, number, special (profile, admin, register)
- **Soft delete for customers** — deactivate sets status, preserves sale/invoice history

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

## Design System — "Savannah Ochre"
- **btn-brand:** Dark ink `#0f0e0a` (light) / amber `#e39340` (dark)
- **btn-accent:** Amber `#d97706` always
- **Sidebar:** Always dark `#0f0e0a`
- **Focus rings:** Amber 20% opacity
- **Border radius:** Inputs/cards 10px, dialogs 20px
- **Badges:** `badge-success` (green), `badge-danger` (red), `badge-warn` (amber), `badge-info` (blue), `badge-violet`
- **KPI Cards:** Colored icon box + label + large value + subtitle
- **Tables:** Uppercase sticky headers, row hover
- **Empty states:** Centered icon box + title + description + CTA
- **NEVER modify `flux-logo.tsx`**

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
3. **Multi-Currency** — Exchange rate table, per-transaction currency
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
