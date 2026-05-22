# FLUX

Business management SaaS for import/distribution companies in Africa.

**Live:** https://fluxtz.com

## Features
- Point of Sale with customer typeahead and area selling (sqm)
- Inventory management with categories, stock tracking, low stock alerts
- Shipment costing — containers, expenses, landed cost breakdown, margin pricing
- Invoicing with PDF generation and WhatsApp sharing
- Customer CRM — TIN search, purchase history, outstanding balance tracking
- Accounts receivable — aging, partial payments, credit sales
- Excel import — template wizard, validation, bulk data ingestion
- Accounting — P&L by shipment, monthly revenue charts
- Reports — sales analytics, date presets, Excel export
- TRA Tally — Tanzania Revenue Authority fiscal compliance
- Team management — role-based access (admin, manager, accountant, salesman)

## Stack
Next.js 16 + Tailwind CSS 4 + shadcn/ui + Prisma 7 + PostgreSQL (Neon) + Vercel

## Dev
```bash
npm run dev      # Start dev server
npm run build    # Production build
npm test         # 861 unit tests
```

## Deployment
Vercel auto-deploys from `main`. See `CLAUDE.md` for full architecture docs.
