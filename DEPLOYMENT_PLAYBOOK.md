# FLUX — Deployment Playbook

> **For colleagues, future developers, or AI sessions continuing this project.**
> This document contains everything needed to understand, maintain, and redeploy FLUX.

---

## What is FLUX?

FLUX is a multi-tenant business management platform for import/distribution businesses.

**Core modules:** POS, Inventory, Shipments, Invoicing, Accounting, Reports, TRA Fiscal Compliance, User Management.

**Stack:** Next.js 15 + Tailwind CSS 4 + shadcn/ui + Prisma 7 + PostgreSQL (Neon)

**Live URL:** https://fluxtz.com
**GitHub:** https://github.com/alisheib/flux (private)
**Domain registrar:** Namecheap (fluxtz.com)
**Database host:** Neon (PostgreSQL 16, eu-central-1 Frankfurt)
**Deployment:** Vercel (auto-deploys on push to `main`)

---

## Architecture

```
Browser → Vercel Edge → Next.js App Router → Prisma → Neon PostgreSQL
```

```
src/
  app/
    (app)/            # Authenticated pages (sidebar layout)
      page.tsx        # Dashboard
      pos/            # Point of Sale
      inventory/      # Product management
      shipments/      # Container import tracking
      invoices/       # Invoice management
      accounting/     # P&L overview
      reports/        # Business reports
      tally/          # TRA fiscal compliance (Tanzania)
      users/          # Team management
      settings/       # Org config, tax, margins, roles, tally toggle
      profile/        # User profile & password
    api/              # All API routes
    login/            # Public login
    register/         # Public registration
    forgot-password/  # Password recovery
    reset-password/   # Password reset
  components/         # Shared UI (sidebar, header, shell, shadcn)
  lib/                # Auth, DB client, calculations, utils
prisma/
  schema.prisma       # Database schema (PostgreSQL)
tests/
  e2e.js              # 20 basic E2E tests
  e2e-advanced.js     # 20 advanced E2E tests (dialogs, popups, workflows)
```

---

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `DATABASE_URL` | Vercel + `.env` | Neon PostgreSQL connection string |
| `JWT_SECRET` | Vercel + `.env` | Signs auth tokens (32+ chars) |
| `NEXT_PUBLIC_APP_URL` | Vercel + `.env` | Public URL (https://fluxtz.com) |

**Current values are in Vercel → Project → Settings → Environment Variables.**
Never commit `.env` to git (it's in `.gitignore`).

---

## Database

- **Provider:** Neon (neon.tech)
- **Version:** PostgreSQL 16
- **Region:** eu-central-1 (Frankfurt)
- **Project:** flux-prod
- **Schema:** Managed by Prisma (`prisma/schema.prisma`)

### Key tables:
- `Organization` — multi-tenant root
- `User` — auth, roles (admin/manager/supervisor/cashier/staff)
- `OrgSettings` — config, margins, tally toggle, role permissions
- `Product`, `Category` — inventory
- `Sale`, `SaleItem` — POS transactions
- `Invoice`, `InvoiceItem` — invoicing
- `Shipment`, `ShipmentItem`, `ShipmentExpense` — import costing

### Schema changes:
```bash
# Edit prisma/schema.prisma, then:
npx prisma generate          # Regenerate client
npx prisma db push            # Push to Neon (dev)
# OR for production migrations:
npx prisma migrate dev        # Create migration
npx prisma migrate deploy     # Apply in production
```

---

## Deployment Flow

### Auto-deploy (normal workflow):
1. Make changes locally
2. `git add . && git commit -m "description"`
3. `git push origin main`
4. Vercel auto-detects push and redeploys (~2-3 min)

### Build command on Vercel:
```
npx prisma generate && npx prisma db push && next build
```

### Manual redeploy:
Vercel → Deployments → ⋯ → Redeploy

---

## DNS Configuration (Namecheap)

| Type | Host | Value |
|------|------|-------|
| A Record | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

SSL is auto-provisioned by Vercel (free).

---

## Key Features & Toggles

### TRA Tally Integration
- Controlled by toggle in **Settings → TRA Tally Integration**
- Stored in `OrgSettings.tallyEnabled` (boolean)
- When disabled: Tally (TRA) item hidden from sidebar
- When enabled: Shows TRA fiscal compliance page with EFD receipt management

### Role-Based Access Control
- Roles: admin, manager, supervisor, cashier, staff
- Per-module permissions configurable in **Settings → Role Permissions**
- Stored as JSON in `OrgSettings.rolePermissions`

### Theme
- Light/Dark mode toggle in header
- Persisted via next-themes (localStorage)

---

## Running Locally

```bash
git clone https://github.com/alisheib/flux.git
cd flux
npm install

# Create .env with:
# DATABASE_URL="postgresql://..."
# JWT_SECRET="your-secret"
# NEXT_PUBLIC_APP_URL="http://localhost:3000"

npx prisma generate
npx prisma db push
npm run dev
```

Open http://localhost:3000

### Seed demo data:
Login as admin → Settings → Data Management → Seed Demo Data

### Default demo credentials (after seeding):
- `admin@flux.com` / `password123`

---

## Running Tests

```bash
# Start dev server first
npm run dev

# In another terminal:
node tests/e2e.js            # 20 basic tests
node tests/e2e-advanced.js   # 20 advanced tests (dialogs, popups)
```

All 40 tests must pass before deploying.

---

## Taking Screenshots

```bash
node take-screenshots.js
```

Saves 56 screenshots to `runtime/screenshots/light/` and `runtime/screenshots/dark/`.

---

## Troubleshooting

### Build fails with "PrismaBetterSqlite3 not compatible with postgres"
- `src/lib/db.ts` must use plain `new PrismaClient()`, not the SQLite adapter
- Fixed in commit `e7a0073`

### Build fails with "datasource url no longer supported"
- Prisma 7 moved URL config to `prisma.config.ts`
- `schema.prisma` should only have `provider`, no `url`

### "No data" after deploy
- Database is empty on first deploy
- Register at `/register` to create org + admin
- Optionally seed demo data from Settings

### Domain not working
- DNS propagation takes 5-30 minutes
- Verify A record (`@` → `76.76.21.21`) and CNAME (`www` → `cname.vercel-dns.com`)
- Check Vercel → Settings → Domains for green checkmarks

---

## Contacts & Accounts

| Service | URL | Account |
|---------|-----|---------|
| GitHub | github.com/alisheib/flux | alisheib |
| Vercel | vercel.com | alisheib |
| Neon | neon.tech | alisheib |
| Namecheap | namecheap.com | alisheib |

---

## What was done (changelog)

### v1 — Initial Release
- Full platform: POS, Inventory, Shipments, Invoicing, Accounting, Reports
- TRA fiscal compliance (Tanzania) with enable/disable toggle
- Role-based access control with per-module permissions
- Dark/Light theme
- Mobile responsive
- 40 E2E tests passing
- Login, Register, Forgot Password, Reset Password flows
- Profile page with password change
- Settings: Org info, Tax, Invoice, Margins, Roles, Tally toggle, Seed data, Reset data
- PostgreSQL on Neon, deployed on Vercel
- Domain: fluxtz.com

### Key technical decisions
- **Prisma 7** with `prisma.config.ts` for DB URL (not in schema.prisma)
- **Plain PrismaClient** for PostgreSQL (no adapter needed, unlike SQLite)
- **JWT auth** with httpOnly cookies
- **Multi-tenant** via `orgId` on all tables
- **shadcn/ui** components with Tailwind CSS 4

---

*Last updated: April 21, 2026*
*Powered by Ali Sheib*
