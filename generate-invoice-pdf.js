const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, 'runtime');

async function run() {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  // Invoice data (Serengeti Hotels — biggest order)
  const invoice = {
    number: 'INV-0003',
    date: 'April 20, 2026',
    dueDate: 'May 20, 2026',
    status: 'Issued',
    company: {
      name: 'Flux Demo Company',
      address: '123 Samora Avenue, Dar es Salaam',
      phone: '+255 22 123 4567',
      email: 'info@fluxdemo.co.tz',
    },
    customer: {
      name: 'Serengeti Hotels Group',
      phone: '+255 789 876 543',
      email: 'procurement@serengetihotels.com',
      address: 'Arusha Branch, Tanzania',
    },
    items: [
      { name: 'Clear Float Glass 6mm (3300×2140mm)', qty: 50, price: 43, total: 2150 },
      { name: 'Clear Float Glass 10mm (3300×2140mm)', qty: 25, price: 72, total: 1800 },
      { name: 'Silver Mirror 4mm (2440×1830mm)', qty: 30, price: 36, total: 1080 },
    ],
    subtotal: 5030,
    discount: 150,
    taxRate: 18,
    taxAmount: 878.40,
    total: 5758.40,
    currency: 'USD',
    paymentMethod: 'Bank Transfer',
    notes: 'Phase 2 renovation - Arusha branch',
  };

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter',sans-serif; color:#0f0e0a; background:#fff; font-size:13px; line-height:1.5; }
  .page { max-width:800px; margin:0 auto; padding:48px; }

  /* Header */
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:40px; padding-bottom:24px; border-bottom:3px solid #d97706; }
  .logo-area { display:flex; align-items:center; gap:14px; }
  .logo-mark { width:48px; height:48px; background:#d97706; border-radius:12px; display:flex; align-items:center; justify-content:center; }
  .logo-mark svg { width:28px; height:28px; }
  .company-name { font-size:22px; font-weight:700; letter-spacing:-0.03em; color:#0f0e0a; }
  .company-details { font-size:11.5px; color:#595441; margin-top:4px; line-height:1.6; }
  .invoice-title { text-align:right; }
  .invoice-title h1 { font-size:32px; font-weight:700; color:#d97706; letter-spacing:-0.02em; }
  .invoice-number { font-size:16px; font-weight:600; color:#0f0e0a; margin-top:4px; }
  .invoice-status { display:inline-block; background:#dbeafe; color:#2563eb; font-size:11px; font-weight:600; padding:3px 10px; border-radius:999px; margin-top:6px; }

  /* Meta section */
  .meta { display:grid; grid-template-columns:1fr 1fr; gap:32px; margin-bottom:36px; }
  .meta-box { }
  .meta-label { font-size:10.5px; font-weight:600; text-transform:uppercase; letter-spacing:0.08em; color:#7e7862; margin-bottom:8px; }
  .meta-value { font-size:13px; color:#0f0e0a; }
  .meta-value strong { font-weight:600; }
  .meta-row { margin-bottom:4px; }

  /* Items table */
  .items-table { width:100%; border-collapse:collapse; margin-bottom:28px; }
  .items-table thead th {
    text-align:left; font-size:10.5px; font-weight:600; text-transform:uppercase;
    letter-spacing:0.06em; color:#7e7862; padding:10px 14px;
    border-bottom:2px solid #e2ded4; background:#f6f4ef;
  }
  .items-table thead th:last-child, .items-table thead th:nth-child(2), .items-table thead th:nth-child(3) { text-align:right; }
  .items-table tbody td { padding:12px 14px; border-bottom:1px solid #edeae3; font-size:13px; }
  .items-table tbody td:last-child, .items-table tbody td:nth-child(2), .items-table tbody td:nth-child(3) { text-align:right; font-variant-numeric:tabular-nums; }
  .items-table tbody tr:last-child td { border-bottom:none; }
  .item-name { font-weight:500; color:#0f0e0a; }

  /* Totals */
  .totals-section { display:flex; justify-content:flex-end; margin-bottom:36px; }
  .totals-box { width:300px; }
  .totals-row { display:flex; justify-content:space-between; padding:8px 0; font-size:13px; color:#595441; }
  .totals-row.discount { color:#059669; }
  .totals-row.total {
    font-size:20px; font-weight:700; color:#0f0e0a; padding:14px 0 0;
    margin-top:8px; border-top:2px solid #0f0e0a;
  }
  .totals-row .label { }
  .totals-row .amount { font-variant-numeric:tabular-nums; font-weight:500; }
  .totals-row.total .amount { color:#d97706; }

  /* Notes + payment */
  .footer-section { display:grid; grid-template-columns:1fr 1fr; gap:32px; margin-bottom:36px; padding-top:24px; border-top:1px solid #e2ded4; }
  .footer-label { font-size:10.5px; font-weight:600; text-transform:uppercase; letter-spacing:0.08em; color:#7e7862; margin-bottom:6px; }
  .footer-value { font-size:12.5px; color:#595441; line-height:1.6; }

  /* Bottom */
  .bottom-bar { text-align:center; padding-top:24px; border-top:1px solid #e2ded4; }
  .bottom-bar p { font-size:11px; color:#aea893; }
  .bottom-bar .brand { color:#d97706; font-weight:600; }

  /* Kente stripe */
  .kente { height:4px; background:linear-gradient(90deg, #d97706 0 33.33%, #0f0e0a 33.33% 66.66%, #9a3412 66.66% 100%); margin-bottom:32px; border-radius:2px; }
</style>
</head>
<body>
<div class="page">
  <div class="kente"></div>

  <div class="header">
    <div class="logo-area">
      <div class="logo-mark">
        <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
          <g fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="7">
            <path d="M20 15 L20 49"/><path d="M20 15 L44 15"/><path d="M20 32 Q32 32 38 32 T50 40"/>
          </g>
          <circle cx="50" cy="40" r="3" fill="#faead0"/>
        </svg>
      </div>
      <div>
        <div class="company-name">Flux Demo Company</div>
        <div class="company-details">
          123 Samora Avenue, Dar es Salaam<br/>
          +255 22 123 4567 · info@fluxdemo.co.tz
        </div>
      </div>
    </div>
    <div class="invoice-title">
      <h1>INVOICE</h1>
      <div class="invoice-number">${invoice.number}</div>
      <div class="invoice-status">${invoice.status}</div>
    </div>
  </div>

  <div class="meta">
    <div class="meta-box">
      <div class="meta-label">Bill To</div>
      <div class="meta-value">
        <div class="meta-row"><strong>${invoice.customer.name}</strong></div>
        <div class="meta-row">${invoice.customer.address}</div>
        <div class="meta-row">${invoice.customer.phone}</div>
        <div class="meta-row">${invoice.customer.email}</div>
      </div>
    </div>
    <div class="meta-box" style="text-align:right;">
      <div class="meta-label">Invoice Details</div>
      <div class="meta-value">
        <div class="meta-row"><strong>Date:</strong> ${invoice.date}</div>
        <div class="meta-row"><strong>Due:</strong> ${invoice.dueDate}</div>
        <div class="meta-row"><strong>Payment:</strong> ${invoice.paymentMethod}</div>
        <div class="meta-row"><strong>Currency:</strong> ${invoice.currency}</div>
      </div>
    </div>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th style="width:50%">Item</th>
        <th>Qty</th>
        <th>Unit Price</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      ${invoice.items.map(item => `
      <tr>
        <td><span class="item-name">${item.name}</span></td>
        <td>${item.qty}</td>
        <td>$${item.price.toFixed(2)}</td>
        <td><strong>$${item.total.toFixed(2)}</strong></td>
      </tr>`).join('')}
    </tbody>
  </table>

  <div class="totals-section">
    <div class="totals-box">
      <div class="totals-row"><span class="label">Subtotal</span><span class="amount">$${invoice.subtotal.toFixed(2)}</span></div>
      <div class="totals-row discount"><span class="label">Discount</span><span class="amount">-$${invoice.discount.toFixed(2)}</span></div>
      <div class="totals-row"><span class="label">Tax (${invoice.taxRate}% TVA)</span><span class="amount">$${invoice.taxAmount.toFixed(2)}</span></div>
      <div class="totals-row total"><span class="label">Total Due</span><span class="amount">$${invoice.total.toFixed(2)}</span></div>
    </div>
  </div>

  <div class="footer-section">
    <div>
      <div class="footer-label">Notes</div>
      <div class="footer-value">${invoice.notes}</div>
    </div>
    <div style="text-align:right;">
      <div class="footer-label">Payment Instructions</div>
      <div class="footer-value">
        Bank: CRDB Bank Tanzania<br/>
        Account: 0150-1234567-001<br/>
        Swift: CORUTZTZ
      </div>
    </div>
  </div>

  <div class="bottom-bar">
    <p>Thank you for your business!</p>
    <p style="margin-top:4px;">Generated by <span class="brand">FLUX</span> Business Management Platform · Powered by Ali Sheib</p>
  </div>
</div>
</body>
</html>`;

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--no-sandbox'],
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  // Generate PDF
  await page.pdf({
    path: path.join(OUT, 'FLUX-Invoice-INV-0003.pdf'),
    format: 'A4',
    printBackground: true,
    margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
  });
  console.log('✓ PDF saved: FLUX-Invoice-INV-0003.pdf');

  // Also screenshot the invoice as PNG
  await page.setViewport({ width: 900, height: 1200 });
  await page.screenshot({
    path: path.join(OUT, 'invoice-pdf-preview.png'),
    fullPage: true,
  });
  console.log('✓ PNG saved: invoice-pdf-preview.png');

  await browser.close();

  // Now take screenshots with WhatsApp button visible
  console.log('\nTaking WhatsApp button screenshots...');

  const browser2 = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--no-sandbox'],
  });

  const page2 = await browser2.newPage();

  // Login
  await page2.goto('http://localhost:4000/login', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1000));
  const em = await page2.$('input[type="email"]');
  if (em) { await em.click({clickCount:3}); await em.type('admin@flux.com'); }
  const pw = await page2.$('input[type="password"]');
  if (pw) { await pw.click({clickCount:3}); await pw.type('password123'); }
  const sub = await page2.$('button[type="submit"]');
  if (sub) await sub.click();
  await new Promise(r => setTimeout(r, 3000));

  // Go to invoices
  await page2.goto('http://localhost:4000/invoices', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2500));

  // Find and click the WhatsApp button on a row that has a phone number (Serengeti or Nyerere)
  // First let's find a "View" button
  const btns = await page2.$$('button');
  for (const btn of btns) {
    const txt = await page2.evaluate(el => el.textContent?.trim(), btn);
    if (txt === 'View') {
      await btn.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 1500));

  // Scroll the dialog to ensure WhatsApp button is visible
  await page2.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]') || document.querySelector('.fixed');
    if (dialog) {
      const scrollable = dialog.querySelector('.overflow-y-auto, .overflow-auto') || dialog;
      scrollable.scrollTop = scrollable.scrollHeight;
    }
  });
  await new Promise(r => setTimeout(r, 500));

  await page2.screenshot({
    path: path.join(OUT, 'invoice-whatsapp-button.png'),
    fullPage: false,
  });
  console.log('✓ PNG saved: invoice-whatsapp-button.png');

  // Also take the accounting page with real data (fix for pages 14/15)
  await page2.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 500));

  console.log('\nRe-taking accounting screenshots...');
  await page2.goto('http://localhost:4000/accounting', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  await page2.screenshot({ path: path.join(OUT, '14-accounting.png'), fullPage: true });
  console.log('✓ PNG saved: 14-accounting.png');

  await page2.evaluate(() => { document.documentElement.classList.add('dark'); document.documentElement.style.colorScheme='dark'; });
  await new Promise(r => setTimeout(r, 500));
  await page2.screenshot({ path: path.join(OUT, '15-accounting-dark.png'), fullPage: true });
  console.log('✓ PNG saved: 15-accounting-dark.png');

  await browser2.close();

  console.log('\n✓ All done! Files in C:/flux/runtime/:');
  fs.readdirSync(OUT).sort().forEach(f => {
    const size = (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0);
    console.log(`  ${f} (${size} KB)`);
  });
}

run().catch(err => { console.error('Error:', err.message); process.exit(1); });
