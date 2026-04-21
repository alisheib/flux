# FLUX — Business Management Platform

Multi-tenant platform for import/distribution businesses. Handles POS sales, inventory, shipment costing, invoicing, accounting, TRA fiscal compliance, and user management.

**Stack:** Next.js 15 + Tailwind CSS 4 + shadcn/ui + Prisma + SQLite (dev) / PostgreSQL (prod)

---

## Quick Start (Development)

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Open http://localhost:3000. Seed demo data from Settings > Data Management.

**Demo credentials** (after seeding): `admin@flux.com` / `password123`

---

## Running Tests

```bash
# Start dev server first, then:
node tests/e2e.js
```

20 E2E tests covering all screens (login, register, dashboard, POS, inventory, shipments, invoices, accounting, reports, tally, users, settings, profile, navigation, theme toggle).

---

## Taking Screenshots

```bash
node take-screenshots.js
```

Outputs to `runtime/screenshots/light/` and `runtime/screenshots/dark/` — 14 pages x desktop + mobile x 2 themes = 56 screenshots.

---

## Deployment Guide: Domain Purchase to Live

### Step 1: Buy a Domain

1. Go to [Namecheap](https://namecheap.com), [Google Domains](https://domains.google), or [Cloudflare Registrar](https://dash.cloudflare.com)
2. Search for your domain (e.g., `flux-app.com`)
3. Purchase it (~$10-15/year for .com)

### Step 2: Set Up a PostgreSQL Database

**Option A: Neon (recommended, free tier)**
1. Go to https://neon.tech and create an account
2. Create a new project
3. Copy the connection string: `postgresql://user:pass@host/dbname?sslmode=require`

**Option B: Supabase**
1. Go to https://supabase.com and create a project
2. Go to Settings > Database > Connection string (URI)

**Option C: Railway**
1. Go to https://railway.app
2. Add a PostgreSQL service
3. Copy the `DATABASE_URL` from the Variables tab

### Step 3: Deploy to Vercel

1. Push your code to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USER/flux.git
   git push -u origin main
   ```

2. Go to https://vercel.com and sign in with GitHub

3. Click **"New Project"** and import your repository

4. Configure **Environment Variables** in Vercel:
   ```
   DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
   JWT_SECRET=your-random-secret-at-least-32-chars
   NEXT_PUBLIC_APP_URL=https://your-domain.com
   ```
   Generate a JWT secret: `openssl rand -base64 32`

5. Configure **Build Settings**:
   - Framework: Next.js (auto-detected)
   - Build command: `npx prisma generate && npx prisma db push && next build`
   - Output directory: `.next`

6. Click **Deploy**

### Step 4: Update Prisma for PostgreSQL

Before deploying, update `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Then commit and push. Vercel will auto-redeploy.

### Step 5: Connect Your Domain

1. In Vercel, go to your project > Settings > Domains
2. Add your domain (e.g., `flux-app.com`)
3. Vercel will show you DNS records to add:
   - **A Record:** `76.76.21.21`
   - **CNAME:** `cname.vercel-dns.com`
4. Go to your domain registrar's DNS settings and add these records
5. Wait 5-30 minutes for DNS propagation
6. Vercel will auto-provision an SSL certificate

### Step 6: Seed Production Data

1. Open `https://your-domain.com/register` and create your admin account
2. Go to Settings > Data Management > Seed Demo Data (optional)
3. Or start entering real data immediately

### Step 7: Post-Deployment Checklist

- [ ] Verify login/register works
- [ ] Verify all pages load (dashboard, POS, inventory, etc.)
- [ ] Verify dark/light theme toggle
- [ ] Test POS sale flow end-to-end
- [ ] Test invoice generation and PDF download
- [ ] Verify mobile responsiveness
- [ ] Set up your organization info in Settings
- [ ] Create user accounts for your team
- [ ] Enable TRA Tally integration if needed (Settings > TRA Tally Integration)

---

## Alternative Deployment: VPS (DigitalOcean/Hetzner)

If you prefer a VPS over Vercel:

```bash
# On your VPS (Ubuntu 22.04+)
sudo apt update && sudo apt install -y nodejs npm nginx certbot python3-certbot-nginx

# Clone and build
git clone https://github.com/YOUR_USER/flux.git
cd flux
npm install
npx prisma generate
npx prisma db push

# Build for production
npm run build

# Run with PM2
npm install -g pm2
pm2 start npm --name flux -- start
pm2 save
pm2 startup

# Nginx reverse proxy
sudo tee /etc/nginx/sites-available/flux <<EOF
server {
    server_name your-domain.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/flux /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# SSL certificate
sudo certbot --nginx -d your-domain.com
```

---

## Project Structure

```
src/
  app/
    (app)/          # Authenticated pages (dashboard, pos, inventory, etc.)
    api/            # API routes (auth, settings, products, sales, etc.)
    login/          # Public login page
    register/       # Public registration
  components/       # Shared components (sidebar, header, UI primitives)
  lib/              # Utilities (auth, db, calculations)
  generated/prisma/ # Prisma client (auto-generated)
prisma/
  schema.prisma     # Database schema
tests/
  e2e.js            # 20 end-to-end tests
runtime/
  screenshots/      # Light and dark mode screenshots
```

---

Powered by **Ali Sheib**
