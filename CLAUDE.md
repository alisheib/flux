# FLUX — AI Development Guide

## What is FLUX
Business management SaaS for import/distribution companies in Africa. Multi-tenant. Live at **fluxtz.com**.

## Stack
- **Framework:** Next.js 16 (App Router, Server Components + Client Components)
- **Styling:** Tailwind CSS 4 + shadcn/ui components + custom CSS classes in `globals.css`
- **Database:** PostgreSQL (Neon) via Prisma 7 ORM
- **Auth:** JWT in httpOnly cookies, bcrypt hashing
- **Hosting:** Vercel
- **PDF:** `@react-pdf/renderer` for invoice PDFs (client-side generation)
- **Charts:** Recharts
- **Excel:** Custom `excel-export.ts` utility

## Architecture

```
src/
  app/
    (app)/             # Authenticated app pages (wrapped in layout with sidebar + header)
      dashboard/       # KPI cards, revenue chart, recent sales, low stock alerts
      pos/             # Point of sale — product grid + cart + checkout
      inventory/       # Products CRUD, categories, stock management
      shipments/       # Import container tracking, landed cost, expense allocation
      invoices/        # Invoice list + detail dialog, PDF download, WhatsApp share
      receivables/     # Customer debt tracking, aging, payment recording
      accounting/      # P&L by shipment, monthly charts
      reports/         # Sales analytics with date presets, charts, Excel export
      tally/           # TRA fiscal compliance (Tanzania Revenue Authority)
      users/           # Team management with role-based access
      settings/        # Organization config, tax, invoice numbering, permissions
      profile/         # User profile, name/password change
      activity/        # Audit log viewer
      stock-movements/ # Stock history (sales, refunds, adjustments)
    api/               # REST API routes — all under /api/*
    login/             # Auth pages
    register/
    forgot-password/
    reset-password/
    invoice/[id]/      # Public invoice view (shareable link)
    page.tsx           # Landing page (public, dark theme)
  components/
    app-sidebar.tsx    # Main sidebar navigation (always dark)
    app-header.tsx     # Breadcrumb header with search, notifications, user dropdown
    ui/                # shadcn/ui components (customized)
    flux-logo.tsx      # FluxMark logo — DO NOT MODIFY
    auth-provider.tsx  # Auth context
    receipt-sheet.tsx  # Mobile receipt bottom sheet
  lib/
    auth.ts            # JWT creation/verification, password hashing
    db.ts              # Prisma client (uses pg adapter for Neon)
    audit.ts           # Audit logging helper
    stock.ts           # Stock movement recording
    calculations.ts    # formatCurrency, formatNumber
    invoice-pdf.tsx    # @react-pdf/renderer invoice template (white, professional)
    invoice-template.ts # HTML invoice template (server-side fallback)
    excel-export.ts    # Excel file generation with currency formatting
    validate.ts        # Input validation helpers
    sanitize.ts        # HTML stripping
  generated/prisma/    # Auto-generated Prisma client (gitignored)
prisma/
  schema.prisma        # 16+ models: Organization, User, Product, Sale, Invoice, etc.
```

## Design System

The UI uses a "Savannah Ochre" warm brand palette defined in `globals.css`:

### Key Design Tokens
- **Primary button (`btn-brand`):** Dark ink `#0f0e0a` in light mode, amber `#e39340` in dark mode
- **Accent button (`btn-accent`):** Amber `#d97706` always (used for POS "Complete Sale")
- **Sidebar:** Always dark (`#0f0e0a`) regardless of theme
- **Focus rings:** Amber, 20% opacity, no double rings
- **Border radius:** Inputs/cards = 10px, dialogs = 20px

### Custom CSS Classes (in globals.css)
- `btn-brand` / `btn-accent` — Button styles
- `badge-success`, `badge-danger`, `badge-warn`, `badge-info`, `badge-violet`, `badge-neutral` — Status badges
- `kpi-icon-blue`, `kpi-icon-green`, `kpi-icon-amber`, `kpi-icon-purple`, `kpi-icon-accent` — KPI card icon backgrounds
- `chip` / `chip active` — Filter pill buttons
- `stock-good`, `stock-low`, `stock-out` — Inventory stock level pills
- `empty-state-icon` — Rounded container for empty state icons
- `stripe-accent` — Kente-inspired gradient stripe

### Component Patterns
- **KPI Cards:** Colored icon box (top-left) + label + large display value + subtitle
- **Tables:** Uppercase sticky headers, subtle row borders, hover states
- **Toasts:** Left-border accent (green/red/amber/blue), card background, via Sonner
- **Dialogs:** 20px radius, max-h-90vh, proper padding
- **Empty States:** Centered icon in `empty-state-icon` box + title + description
- **WhatsApp Messages:** Professional format with bold org name, separators, structured items

## Important Rules
- **NEVER modify `flux-logo.tsx`** — the FluxMark logo is final
- **Keep all functionality** when making style changes
- **No "try for free" language** — use "Get started" for CTAs
- **No China-specific references** — keep origin/import references generic
- **Export buttons must be disabled** when there's no data to export
- **Invoice download = PDF** via `@react-pdf/renderer`, never open print dialogs
- **After registration, auto-login** (redirect to /dashboard, API sets JWT cookie)
- **Sidebar updates live** when TRA Tally is toggled (via `flux-tally-toggle` custom event)

## Database
- **Multi-tenant:** All queries scoped by `orgId`
- **Schema:** See `prisma/schema.prisma`
- **Key models:** Organization, User, Product, Category, Sale, SaleItem, Invoice, Shipment, ShipmentItem, ShipmentExpense, Payment, CreditNote, AuditLog, StockMovement, Subscription, OrgSettings

## Auth & Roles
- **Admin:** Full access
- **Manager:** All except user management
- **Accountant:** Read-only on most, full on accounting/invoices
- **Salesman:** POS + own sales only
- Custom permissions configurable in Settings

## API Pattern
All API routes at `src/app/api/*/route.ts`:
1. Verify JWT from cookie
2. Scope query by `orgId`
3. Validate input
4. Perform operation
5. Log to audit trail
6. Return JSON

## Dev Commands
```bash
npm run dev              # Start dev server
npx next build           # Production build
npx prisma generate      # Regenerate Prisma client
npx prisma db push       # Push schema changes
node take-screenshots.js # Capture all pages (puppeteer)
```

## Demo Credentials
- **Email:** admin@flux.com
- **Password:** password123
- **Seed:** POST /api/seed (creates demo org with products, shipments, sales)

## Deployment
Vercel auto-deploys from `main` branch. See `DEPLOYMENT_PLAYBOOK.md` for full guide.
Required env vars: `DATABASE_URL`, `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`

---

## Roadmap — Features to Build

Prioritized by business impact. Each section includes what's needed so Claude Design can create the UI and a developer can implement it.

### Phase 1 — Critical (Makes FLUX usable daily)

#### 1. Offline POS
**Why:** Africa has unreliable internet. POS must work offline and sync when reconnected. This is promised on the landing page but not implemented.
**What's needed:**
- Service Worker for caching the POS page + product catalog
- IndexedDB local storage for cart, pending sales, product prices/stock
- Sync queue: when offline, sales save locally; when online, batch-POST to `/api/sales`
- Conflict resolution: stock may have changed while offline
- Visual indicator: "Offline" badge in POS header, "X sales pending sync" banner
- **Design needed:** Offline status bar/badge, sync progress indicator, conflict resolution dialog

#### 2. Barcode / QR Scanning
**Why:** Every real POS and warehouse needs barcode scanning. Both camera-based and USB scanner.
**What's needed:**
- Camera scanner component (use `html5-qrcode` or `quagga2` library)
- USB barcode scanner support: listen for rapid keystrokes ending in Enter, match to SKU
- Scan button in POS search bar + inventory search
- Bulk scan mode for stock-taking (scan multiple items quickly)
- Barcode generation: print barcode labels for products (Code128 or EAN-13)
- **Schema:** Add `barcode` field to Product model
- **Design needed:** Scan button in POS header, camera overlay, barcode label print layout, scan history list

#### 3. Purchase Orders + Supplier Management
**Why:** Businesses don't only import via shipments — they buy locally too. PO completes the buy-sell cycle.
**What's needed:**
- **Suppliers model:** name, contact, phone, email, address, payment terms, notes
- **PurchaseOrder model:** supplier, status (draft/sent/received/cancelled), items, total, expected date
- **PO items:** product, quantity ordered, unit cost, quantity received
- **Receiving flow:** Mark PO as received → auto-update stock quantities
- **Supplier page:** CRUD list with contact info, purchase history, outstanding balance
- **PO page:** Create/edit/view POs, receive goods, partial receiving
- Link POs to shipments (imported goods) or standalone (local purchases)
- **Design needed:** Supplier list page, supplier detail card, PO create/edit form, PO list with status badges, receive goods dialog with quantity inputs

#### 4. Multi-Currency
**Why:** Import businesses deal in USD, EUR, CNY for purchases and local currency (TSh, KSh, NGN) for sales.
**What's needed:**
- Exchange rate table: currency pairs with date-specific rates
- Per-transaction currency: sales in local, shipments in USD/EUR
- Dashboard/reports: show in org's base currency with conversion
- Currency selector in POS, shipments, invoices
- Auto-fetch rates from an API (optional, can be manual entry)
- **Schema:** Add `Currency` model, add `currency` + `exchangeRate` fields to Sale, Shipment, Invoice
- **Design needed:** Currency selector dropdown, exchange rate settings table, multi-currency totals display

#### 5. Email Notifications
**Why:** Professional businesses expect automated emails for invoices, receipts, alerts.
**What's needed:**
- Email service integration (Resend API key already in env vars)
- Transactional emails: invoice sent, payment received, payment reminder
- Alert emails: low stock daily digest, overdue invoice weekly digest
- Email templates: branded HTML emails matching FLUX design (amber accent, clean layout)
- Settings: toggle which emails to send, custom reply-to address
- **Design needed:** Email template preview in settings, email log page, toggle switches for each email type

### Phase 2 — Competitive (Matches Zoho/QuickBooks level)

#### 6. Double-Entry Accounting
**Why:** Current P&L is shipment-based only. Real businesses need chart of accounts, journal entries, balance sheet, trial balance, cash flow statement.
**What's needed:**
- Chart of Accounts (assets, liabilities, equity, revenue, expenses)
- Journal entries auto-generated from sales, purchases, payments
- Manual journal entries for adjustments
- Balance sheet, trial balance, cash flow reports
- Period closing (monthly/yearly)
- **Design needed:** Chart of accounts tree view, journal entry form, balance sheet report, trial balance table

#### 7. Multi-Location / Warehouse
**Why:** Businesses have multiple shops or warehouses. Need stock per location, inter-location transfers.
**What's needed:**
- **Location model:** name, address, type (warehouse/shop/transit)
- Stock tracked per location (not just global)
- Transfer orders between locations
- POS selects which location to sell from
- Reports by location
- **Design needed:** Location selector in header, transfer order form, per-location stock view

#### 8. Customer CRM
**Why:** Businesses need to track customer relationships, not just invoices.
**What's needed:**
- **Customer model:** name, phone, email, address, company, tax ID, notes, tags
- Customer detail page with purchase history, payment history, communication log
- Customer groups/segments (VIP, wholesale, retail)
- Customer-specific pricing rules
- **Design needed:** Customer list, customer detail page with tabs (info/history/invoices/payments), customer group management

#### 9. Product Variants
**Why:** Same product in different sizes/colors/thicknesses — very common in glass, hardware, clothing.
**What's needed:**
- Variant attributes: size, color, thickness (configurable per category)
- Each variant has its own SKU, price, stock
- Parent product groups variants together
- POS shows variant selector when adding to cart
- **Design needed:** Variant configuration in product form, variant grid/matrix, POS variant picker

#### 10. Discount Rules & Promotions
**Why:** Bulk pricing, customer-specific discounts, time-limited promotions.
**What's needed:**
- **DiscountRule model:** type (percentage/fixed/bulk), conditions (min qty, customer group, date range), target (product/category/all)
- Auto-apply in POS when conditions met
- Promotion management page
- **Design needed:** Promotion list, create/edit form with condition builder, POS "discount applied" badge

### Phase 3 — Enterprise

#### 11. Multi-Language (i18n)
French (West Africa), Swahili, Arabic support. Use `next-intl` or similar.

#### 12. API + Webhooks
Public REST API with API keys for third-party integrations. Webhook subscriptions for events (sale.created, invoice.paid, stock.low).

#### 13. 2FA / Security
TOTP authenticator app support. SMS verification option. Login from new device alerts.

#### 14. Mobile PWA
Installable progressive web app. Offline support via service worker. Push notifications.

#### 15. White-Labeling
Custom logo, colors, domain per organization. Reseller/partner program support.

#### 16. Tax Compliance (Multi-Country)
KRA (Kenya), FIRS (Nigeria), ZIMRA (Zimbabwe), URA (Uganda). Each country has different e-invoicing and fiscal device requirements.

---

### Design Brief for Claude Design

When requesting designs for any feature above, provide this context:
- **Design system:** Savannah Ochre palette — warm ink neutrals + amber accent
- **Primary button:** Dark ink `#0f0e0a` in light, amber `#e39340` in dark
- **Sidebar:** Always dark `#0f0e0a`
- **Cards:** `rounded-xl`, subtle border, shadow-sm
- **Tables:** Uppercase sticky headers, row hover
- **KPI cards:** Colored icon box (top-left) + label + large value + subtitle
- **Empty states:** Centered icon in rounded box + title + description
- **Badges:** `badge-success` (green), `badge-danger` (red), `badge-warn` (amber), `badge-info` (blue)
- **Inputs:** 10px radius, amber focus ring
- **Dialogs:** 20px radius, max-h 90vh
- **Mobile:** All pages must work at 393px (iPhone 16)
- **Reference:** See existing screenshots in `runtime/screenshots/light/` and `dark/`
