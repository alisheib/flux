# FLUX — Business Management Platform

Multi-tenant SaaS platform for import/distribution businesses. Handles POS, inventory, shipment costing, invoicing, accounts receivable, accounting, and TRA fiscal compliance.

**Live:** https://fluxtz.com
**Stack:** Next.js 16 · Tailwind CSS 4 · shadcn/ui · Prisma 7 · PostgreSQL (Neon) · Vercel

---

## Features

### Core Business
- **POS** — Point of sale with cart, discounts, tax, multiple payment methods (Cash, Card, M-Pesa, Tigo, Airtel, Bank Transfer, Credit)
- **Inventory** — Products with dynamic fields per category, stock tracking, low-stock alerts, product deactivation
- **Shipments** — Import costing with FOB, expenses, landed cost breakdown, margin calculations
- **Invoices** — Auto-generated from sales, PDF download, public share links, auto-overdue marking
- **Accounts Receivable** — Credit sales, partial payments, aging analysis (0-30/31-60/61-90/90+), customer debt tracking
- **Accounting** — P&L per shipment, monthly revenue vs costs, expense breakdowns
- **Reports** — Sales analytics, top products, by category/payment method/salesperson, Excel export with currency symbols

### Platform
- **Multi-tenant** — Organization isolation on all data
- **Role-based access** — Admin, Manager, Accountant, Salesman with configurable permissions
- **Audit trail** — Every create/update/delete logged with user, timestamp, details
- **Stock movements** — Full history (sale, refund, manual adjustment) with balance tracking
- **Credit notes** — Refund system with optional restock
- **Subscription enforcement** — User and sales limits per plan
- **Pagination** — All list APIs paginated for scale

### Security
- JWT authentication with httpOnly cookies
- bcrypt password hashing (12 rounds)
- Rate limiting on auth + payment endpoints
- Security headers (X-Frame-Options, CSP, XSS-Protection)
- Server-side validation on all inputs (anti-tamper)
- Input sanitization (HTML strip)
- Filename sanitization on PDF downloads

### Mobile
- Fully responsive (tested iPhone 16, 393px)
- Mobile receipt bottom sheet with drag-to-dismiss
- All dialogs: max-h-[90vh] with overflow scroll
- No horizontal overflow on any page

---

## Quick Start

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Open http://localhost:3000. Seed demo data from Settings.

**Demo:** `admin@flux.com` / `password123`

---

## Project Structure

```
src/
  app/
    (app)/             # Authenticated pages
      pos/             # Point of sale
      inventory/       # Product management
      shipments/       # Import costing
      invoices/        # Invoice management
      receivables/     # Accounts receivable
      accounting/      # P&L and cost analysis
      reports/         # Sales analytics
      activity/        # Audit log viewer
      stock-movements/ # Stock history
      users/           # User management
      settings/        # Organization config
    api/               # REST API routes
    login/             # Public auth pages
    register/
  components/          # UI components (shadcn/ui)
  lib/                 # Utilities
    auth.ts            # JWT, passwords, sessions
    db.ts              # Prisma client
    audit.ts           # Audit logging
    stock.ts           # Stock movement recording
    pagination.ts      # API pagination helper
    calculations.ts    # Financial calculations
    subscription-check.ts
    sanitize.ts        # Input sanitization
    excel-export.ts    # Excel generation
    invoice-pdf.tsx    # Invoice PDF template
    receipt-template.ts
prisma/
  schema.prisma        # Database schema (14 models)
```

---

## Database Models

Organization, User, Shipment, ShipmentItem, ShipmentExpense, Category, Product, Sale, SaleItem, Invoice, AuditLog, Subscription, OrgSettings, StockMovement, CreditNote, Payment

---

## Deployment

See [DEPLOYMENT_PLAYBOOK.md](DEPLOYMENT_PLAYBOOK.md) for full deployment guide.

**Quick deploy to Vercel:**
1. Push to GitHub
2. Import in Vercel
3. Set env vars: `DATABASE_URL`, `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`
4. Build command: `npx prisma generate && npx prisma db push && next build`

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | 32+ char random secret |
| `NEXT_PUBLIC_APP_URL` | Yes | App URL (https://fluxtz.com) |
| `RESEND_API_KEY` | No | Email service (Resend) |
| `GOOGLE_CLIENT_ID` | No | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth |

---

Powered by **Ali Sheib**
