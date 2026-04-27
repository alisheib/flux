# FLUX — AR + Mobile Receipt Handoff

## Files included
- `page-receivables.jsx` — Customer Debts page (KPIs, aging chart, customer table, detail dialog, record payment dialog)
- `receipt-sheet.jsx` — Mobile bottom-sheet receipt for POS

## Wiring changes (apply to your existing FLUX app)

### 1. `src/core.jsx` — add nav item
In the `navigation` array, after `accounting`:
```js
{ id: 'receivables', label: 'Receivables', icon: 'wallet' },
```

### 2. `src/shell.jsx` — add page title
In the `pageTitles` map:
```js
receivables: 'Customer debts',
```

### 3. `src/app.jsx` — add route
In the route switch:
```jsx
{route === 'receivables' && <Receivables pushToast={pushToast} />}
```

### 4. `FLUX.html` — load scripts
After your other page scripts:
```html
<script type="text/babel" src="src/page-receivables.jsx"></script>
<script type="text/babel" src="src/receipt-sheet.jsx"></script>
```

### 5. `src/page-pos.jsx` — swap receipt for sheet on mobile
Add at top of POS component (with other state):
```js
const { isMobile } = useBreakpoint();
```

Replace the `<ReceiptDialog>` block with:
```jsx
{showReceipt && (
  isMobile ? (
    <ReceiptSheet
      open={!!showReceipt}
      receipt={showReceipt}
      onClose={() => { setShowReceipt(null); clearCart(); }}
      onNewSale={() => { setShowReceipt(null); clearCart(); }}
      pushToast={pushToast}
    />
  ) : (
    <ReceiptDialog receipt={showReceipt} onClose={() => { setShowReceipt(null); clearCart(); }} />
  )
)}
```

## Next.js / shadcn translation
See chat for full Tailwind/shadcn versions of both components — the JSX in this folder is the FLUX-native (vanilla CSS-vars) version that runs in the prototype.

## Tokens used (already in your tokens.css)
- `--accent-700` (#c2410c) — primary CTA
- `--success-500/700` — paid/collected states
- `--warn-500/700` — partial / aging 31-60
- `--danger-500/700` — overdue
- `--font-display`, `--font-mono` — type roles
