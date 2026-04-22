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
  lib/                # Auth, DB client, calculations, email, utils
prisma/
  schema.prisma       # Database schema (PostgreSQL)
tests/
  e2e.js              # 20 basic E2E tests
  e2e-advanced.js     # 20 advanced E2E tests (dialogs, popups, workflows)
  e2e-register-login.js  # 10 auth flow tests (register, login, validation)
```

---

## Environment Variables

| Variable | Where | Purpose | Required |
|----------|-------|---------|----------|
| `DATABASE_URL` | Vercel + `.env` | Neon PostgreSQL connection string | Yes |
| `JWT_SECRET` | Vercel + `.env` | Signs auth tokens (32+ chars) | Yes |
| `NEXT_PUBLIC_APP_URL` | Vercel + `.env` | Public URL (https://fluxtz.com) | Yes |
| `RESEND_API_KEY` | Vercel + `.env` | Resend.com API key for sending emails | No (logs to console if missing) |
| `FROM_EMAIL` | Vercel + `.env` | Sender address (e.g. `FLUX <noreply@fluxtz.com>`) | No (defaults to noreply@fluxtz.com) |

**Current values are in Vercel → Project → Settings → Environment Variables.**
Never commit `.env` to git (it's in `.gitignore`).

### Current production values (for reference, secrets redacted):
```
DATABASE_URL=postgresql://neondb_owner:***@ep-soft-cake-alb9loyr.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=LHHxKtrFOpyOglTfw0OYpaWFNbk8rHiu0GKMvQHxzN0=
NEXT_PUBLIC_APP_URL=https://fluxtz.com
RESEND_API_KEY=(not yet configured — sign up at resend.com)
FROM_EMAIL=FLUX <noreply@fluxtz.com>
```

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
```

### Create `.env` file in project root:
```env
DATABASE_URL="postgresql://neondb_owner:YOUR_PASSWORD@ep-YOUR-ENDPOINT.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"
JWT_SECRET="generate-with-openssl-rand-base64-32"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
# Optional:
RESEND_API_KEY="re_xxxxxxxxxxxx"
FROM_EMAIL="FLUX <noreply@fluxtz.com>"
```

To generate a JWT secret: `openssl rand -base64 32`

### Start the app:
```bash
npx prisma generate    # Generate Prisma client
npx prisma db push     # Sync schema to database
npm run dev            # Start dev server on port 3000
```

Open http://localhost:3000

### Important: Prisma 7 configuration
- `prisma/schema.prisma` has `provider = "postgresql"` but NO `url` field
- The database URL is configured in `prisma.config.ts` via `process.env.DATABASE_URL`
- The Prisma client uses `@prisma/adapter-pg` (see `src/lib/db.ts`)
- Next.js 16 uses Turbopack — `turbopack: {}` is set in `next.config.ts` alongside webpack config

### First-time setup:
1. Open http://localhost:3000/register
2. Create your admin account (org name, name, email, strong password)
3. Optionally go to Settings → Data Management → Seed Demo Data

### Seed demo credentials (only if you seed data):
- `admin@flux.com` / `password123` (note: doesn't meet new password policy — only works via seed API)

---

## Running Tests

```bash
# Start dev server first
npm run dev

# In another terminal:
node tests/e2e.js              # 20 basic tests (pages, navigation, theme)
node tests/e2e-advanced.js     # 20 advanced tests (dialogs, popups, workflows)
node tests/e2e-register-login.js  # 10 auth tests (register, login, validation)
```

All 50 tests must pass before deploying.

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

### Build fails with "Expected 1 arguments, but got 0" on PrismaClient
- Prisma 7 requires an adapter. `src/lib/db.ts` must use `@prisma/adapter-pg`:
  ```typescript
  import { PrismaPg } from "@prisma/adapter-pg";
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  new PrismaClient({ adapter });
  ```

### Build fails with "webpack config and no turbopack config"
- Next.js 16 uses Turbopack by default. Add `turbopack: {}` to `next.config.ts`

### Turbopack error with @react-pdf/renderer
- The `canvas` module alias (`canvas: false`) is in webpack config
- Both `turbopack: {}` and `webpack` config coexist in `next.config.ts`

### Rate limit blocking tests (429 errors)
- Rate limiting is disabled in development (`NODE_ENV !== "production"`)
- If you get 429 locally, check `src/lib/rate-limit.ts` — the dev bypass should work

### Domain not working
- DNS propagation takes 5-30 minutes
- Verify A record (`@` → `76.76.21.21`) and CNAME (`www` → `cname.vercel-dns.com`)
- Check Vercel → Settings → Domains for green checkmarks
- SSL "PR_END_OF_FILE_ERROR" means cert not yet provisioned — wait 10 min

### Dropdowns disappearing in dialogs
- Base UI Select portals conflict with Radix Dialog focus trap
- Use native `<select>` inside Dialog components (not shadcn Select)
- See `src/app/(app)/inventory/page.tsx` for the pattern

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

### v1.1 — Production Hardening
- **Password strength**: 8+ chars, uppercase, lowercase, number, special character
- **Email validation**: regex check on register
- **Phone number**: optional field on registration, stored on Organization
- **Email verification**: token-based flow, verification banner in app, resend button
- **Email service**: Resend integration (`src/lib/email.ts`)
  - Verification email on register
  - Welcome email on register
  - Login notification email on every sign-in
- **Product validation**: no negative prices/quantities, trim strings, no empty names
- **Removed Google login** (no OAuth configured)
- **Fixed all dropdowns**: 10 native `<select>` elements styled to match design system
- **50 E2E tests** (20 basic + 20 advanced + 10 auth)
- Professional placeholder text (no "John Doe", "Acme Corp")

### v1.2 — Security & Validation
- **Session expiry**: JWT 8 hours (was 7 days), cookie maxAge 8 hours
- **Inactivity logout**: 30-min auto-logout with 2-min warning toast
- **Session guard**: periodic JWT validation every 5 minutes
- **Rate limiting**: 5 login attempts/15 min, 3 registrations/hour (production only)
- **HSTS**: Strict-Transport-Security with preload
- **Branded toasts**: rich color system (emerald/red/amber/sky), close button, descriptions
- **Full validation**: email, password strength, phone, numbers-only, SKU format, required fields
- **Input restrictors**: numbersOnly on price/quantity fields blocks invalid keystrokes
- **Notification bell**: Popover dropdown with empty state
- **International phone input**: country flag dropdown with auto country code on register
- **50 E2E tests**: 3 consecutive runs, 150 executions, 0 failures

### Key technical decisions
- **Prisma 7** with `prisma.config.ts` for DB URL (not in schema.prisma)
- **@prisma/adapter-pg** required for PostgreSQL in Prisma 7 (see `src/lib/db.ts`)
- **JWT auth** with httpOnly cookies
- **Multi-tenant** via `orgId` on all tables
- **shadcn/ui** components with Tailwind CSS 4
- **Native `<select>`** inside Radix Dialog (Base UI Select portals conflict with Dialog focus trap)
- **Resend** for transactional emails (graceful degradation — logs if no API key)

---

## Email Service Setup (Resend)

The app uses **Resend** (resend.com) for transactional emails. Without `RESEND_API_KEY`, emails are logged to console — the app works fine.

### To enable real emails:
1. Sign up at **resend.com** (free: 3000 emails/month)
2. Add domain `fluxtz.com` in Resend → Domains
3. Add DNS records Resend provides (DKIM, SPF, DMARC)
4. Create API key in Resend → API Keys
5. Add to Vercel: `RESEND_API_KEY=re_xxxxx`
6. Add to Vercel: `FROM_EMAIL=FLUX <noreply@fluxtz.com>`
7. Redeploy

### Email templates (`src/lib/email.ts`):
- `sendVerificationEmail()` — sent on register, link to verify
- `sendWelcomeEmail()` — sent on register, onboarding steps
- `sendLoginNotification()` — sent on every login, includes time and IP

---

## Security Notes

### Authentication & Sessions
- Passwords hashed with **bcrypt** 12 rounds (via `src/lib/auth.ts`)
- Password policy: 8+ chars, uppercase, lowercase, number, special char
- JWT tokens in **httpOnly** cookies (not accessible to JavaScript)
- CSRF protection via **SameSite=Lax** cookies
- **8-hour session expiry** (JWT + cookie maxAge)
- **30-minute inactivity auto-logout** with 2-min warning toast (`src/components/session-guard.tsx`)
- **Periodic JWT check** every 5 minutes (catches server-side invalidation)

### Rate Limiting (`src/lib/rate-limit.ts`)
- **Login**: 5 attempts per IP+email per 15 minutes → 429
- **Register**: 3 attempts per IP per hour → 429
- Rate limiting disabled in development (`NODE_ENV !== "production"`)
- In-memory store with automatic cleanup every 5 minutes

### Headers (via `next.config.ts`)
- `Strict-Transport-Security`: 1 year, includeSubDomains, preload (HSTS)
- `X-Frame-Options`: DENY (no iframe embedding)
- `X-Content-Type-Options`: nosniff
- `X-XSS-Protection`: 1; mode=block
- `Referrer-Policy`: strict-origin-when-cross-origin
- `Permissions-Policy`: camera, microphone, geolocation, payment all blocked

### Data Protection
- Email verification flow (unverified users see warning banner)
- Login notification emails (user alerted on each sign-in with IP)
- All API routes check auth via `getSession()` or `verifyToken()`
- Multi-tenant isolation: all queries scoped by `orgId`
- Middleware blocks all unauthenticated access to app routes

---

*Last updated: April 22, 2026*
*Powered by Ali Sheib*
