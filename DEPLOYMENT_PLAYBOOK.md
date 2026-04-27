# FLUX — Deployment Playbook

> For colleagues, future developers, or AI sessions continuing this project.

---

## What is FLUX?

Multi-tenant business management platform for import/distribution businesses.

**Live:** https://fluxtz.com
**GitHub:** github.com/alisheib/flux (private)
**Stack:** Next.js 16 · Tailwind CSS 4 · shadcn/ui · Prisma 7 · PostgreSQL (Neon) · Vercel
**Domain:** Namecheap (fluxtz.com)
**DB:** Neon PostgreSQL 16 (eu-central-1 Frankfurt)
**Deploy:** Vercel auto-deploys on push to `main`

---

## Architecture

```
Browser → Vercel Edge → Next.js App Router → Prisma 7 → Neon PostgreSQL
```

```
src/
  app/
    (app)/              # Authenticated pages (sidebar layout)
      page.tsx          # Dashboard
      pos/              # Point of Sale
      inventory/        # Product management (dynamic fields per category)
      shipments/        # Import costing
      invoices/         # Invoice management
      receivables/      # Accounts receivable / customer debts
      accounting/       # P&L per shipment
      reports/          # Sales analytics + Excel export
      activity/         # Audit trail viewer
      stock-movements/  # Stock history + manual adjustments
      tally/            # TRA fiscal compliance (Tanzania)
      users/            # Team management
      settings/         # Org config, tax, margins, roles
      profile/          # User profile
    api/                # REST API routes (all paginated)
  components/           # UI (shadcn/ui, sidebar, header, error boundary)
  lib/                  # Auth, DB, audit, stock, pagination, calculations
prisma/
  schema.prisma         # 16 models
```

---

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `JWT_SECRET` | Yes | 32+ char signing key (`openssl rand -base64 32`) |
| `NEXT_PUBLIC_APP_URL` | Yes | Public URL (https://fluxtz.com) |
| `RESEND_API_KEY` | No | Resend.com for emails (logs to console if missing) |
| `FROM_EMAIL` | No | Sender address |
| `GOOGLE_CLIENT_ID` | No | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth |

Current values: Vercel → Project → Settings → Environment Variables.
Never commit `.env` to git.

---

## Database

**16 models:** Organization, User, Shipment, ShipmentItem, ShipmentExpense, Category, Product, Sale, SaleItem, Invoice, AuditLog, Subscription, OrgSettings, StockMovement, CreditNote, Payment

### Schema changes:
```bash
# Edit prisma/schema.prisma, then:
npx prisma generate    # Regenerate client
npx prisma db push     # Push to Neon
```

### Key constraints:
- `@@unique([orgId, sku])` on Product — SKU unique per org
- Multi-tenant isolation via `orgId` on all tables
- Cascade deletes from Organization down

---

## Deployment

### Normal workflow:
```bash
git add . && git commit -m "description"
git push    # Vercel auto-deploys in ~2-3 min
```

### Build command (Vercel):
```
npx prisma generate && npx prisma db push && next build
```

### DNS (Namecheap):
| Type | Host | Value |
|------|------|-------|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

SSL auto-provisioned by Vercel.

---

## Running Locally

```bash
git clone https://github.com/alisheib/flux.git
cd flux
npm install
```

Create `.env`:
```env
DATABASE_URL="postgresql://..."
JWT_SECRET="openssl-rand-base64-32-output"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

```bash
npx prisma generate
npx prisma db push
npm run dev
```

### Prisma 7 notes:
- DB URL in `prisma.config.ts` (NOT in schema.prisma)
- Uses `@prisma/adapter-pg` in `src/lib/db.ts`
- `turbopack: {}` required in `next.config.ts`

### Demo credentials (after seeding):
`admin@flux.com` / `password123`

---

## Features by Module

| Module | Key Features |
|--------|-------------|
| **POS** | Cart, discounts, tax, cash/card/M-Pesa/credit, receipt PDF, mobile bottom sheet |
| **Inventory** | Dynamic fields per category, stock alerts, deactivation, SKU unique |
| **Shipments** | FOB costing, expenses, landed cost breakdown, status validation |
| **Invoices** | Auto-generated, PDF download, auto-overdue, salesperson column |
| **Receivables** | Credit sales, partial payments (M-Pesa/Tigo/Airtel/Bank/Cash/Card), aging analysis |
| **Accounting** | P&L per shipment, monthly revenue vs costs chart |
| **Reports** | Top products, by category/payment/salesperson, date range, Excel export |
| **Activity** | Full audit trail — who did what, when, filterable |
| **Stock** | Movement history (sale/refund/adjustment), manual adjustments |
| **Users** | RBAC: admin/manager/accountant/salesman, per-module permissions |
| **Settings** | Org info, tax, margins, invoice prefix, role permissions, TRA toggle |

---

## Security

| Layer | Implementation |
|-------|---------------|
| Auth | JWT (httpOnly cookies, 8h expiry), bcrypt 12 rounds |
| Session | 30-min inactivity logout, periodic JWT check |
| Headers | X-Frame-Options DENY, nosniff, XSS-Protection, Referrer-Policy, HSTS |
| Rate limiting | Login 5/15min, Register 3/hr, Payments 10/min, Credit notes 10/min |
| Validation | All server-side: quantity>0, price>0, valid payment methods, status enums |
| Sanitization | HTML tag stripping, filename sanitization on PDF downloads |
| Audit | All mutations logged (create/update/delete) with user + timestamp |

---

## Changelog

### v2.0 — Enterprise Release (April 2026)
- **Accounts Receivable** — credit sales, partial payments, aging analysis, customer debt tracking
- **Audit trail** — all 20+ mutation endpoints logged, Activity page with filters
- **Stock movements** — full history, manual adjustments, Stock Movements page
- **Credit notes / refunds** — with optional restock
- **Subscription enforcement** — user + sales limits per plan
- **Pagination** — all list APIs paginated
- **Dynamic inventory** — category defines which fields products need
- **Mobile receipt sheet** — bottom sheet with drag-to-dismiss for iPhone
- **Salesperson tracking** — who made which sale (dashboard, invoices, reports)
- **Security headers** — X-Frame-Options, CSP, XSS-Protection, Referrer-Policy
- **Rate limiting** — on payment, credit note, auth endpoints
- **Server-side validation** — anti-tamper (quantity, price, method, status)
- **Error boundary** — graceful error handling in UI
- **Responsive** — all dialogs max-h-[90vh], all grids mobile-first, no overflow at 393px
- **Excel export** — currency symbols ($, TSh, €, £)
- **PDF sanitization** — filename injection prevention
- Real dashboard costs (replaced fake 60% estimate)
- Auto-overdue invoice marking
- Password policy unified to 8 chars minimum
- Product deactivation toggle
- Google OAuth subscription fix

### v1.2 — Security & Validation
- Session expiry, inactivity logout, rate limiting, HSTS
- Full input validation, branded toasts, international phone input

### v1.1 — Production Hardening
- Password strength, email verification, Resend integration
- Product validation, styled dropdowns

### v1.0 — Initial Release
- POS, Inventory, Shipments, Invoicing, Accounting, Reports
- TRA compliance, RBAC, dark/light theme, mobile responsive

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails "datasource url" | URL goes in `prisma.config.ts`, not schema |
| Build fails "Expected 1 arguments" | Need `@prisma/adapter-pg` in `src/lib/db.ts` |
| "No data" after deploy | Register at `/register`, then seed from Settings |
| Rate limit 429 locally | Expected — disabled in dev mode |
| DNS not working | A record @→76.76.21.21, CNAME www→cname.vercel-dns.com, wait 30min |

---

## Accounts

| Service | URL | Account |
|---------|-----|---------|
| GitHub | github.com/alisheib/flux | alisheib |
| Vercel | vercel.com | alisheib |
| Neon | neon.tech | alisheib |
| Namecheap | namecheap.com | alisheib |

---

*Last updated: April 27, 2026*
*Powered by Ali Sheib*
