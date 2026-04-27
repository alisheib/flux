// FLUX — Accounts Receivable / Customer Debts page
// Outstanding credit, aging buckets, payment recording, customer drill-down.

const AR_DEMO = {
  customers: [
    { id: 1, name: 'Big Corp Ltd.', phone: '+255 712 445 821', email: 'accounts@bigcorp.co.tz', owed: 1825000, lastPay: '2026-04-12', status: 'overdue', oldest: 47, txns: 8, avatar: 'a' },
    { id: 2, name: 'Mwanza Trading', phone: '+255 754 110 207', email: 'mwz@mwanza-trading.co.tz', owed: 980500, lastPay: '2026-04-18', status: 'current', oldest: 9, txns: 5, avatar: 'b' },
    { id: 3, name: 'Coastal Construction', phone: '+255 766 091 332', email: 'pm@coastalconstr.tz', owed: 3420000, lastPay: '2026-03-04', status: 'overdue', oldest: 75, txns: 12, avatar: 'c' },
    { id: 4, name: 'Acacia Hotel Group', phone: '+255 783 555 119', email: 'fb@acaciagroup.co.tz', owed: 542000, lastPay: '2026-04-19', status: 'current', oldest: 4, txns: 3, avatar: 'd' },
    { id: 5, name: 'Kilimanjaro Coffee', phone: '+255 757 220 198', email: 'orders@kili-coffee.co.tz', owed: 188000, lastPay: '2026-04-09', status: 'current', oldest: 22, txns: 2, avatar: 'a' },
    { id: 6, name: 'Mbeya Stationers', phone: '+255 622 884 091', email: 'admin@mbeyastat.co.tz', owed: 67500, lastPay: '2026-01-28', status: 'overdue', oldest: 92, txns: 1, avatar: 'b' },
    { id: 7, name: 'Zanzibar Resort', phone: '+255 778 002 145', email: 'finance@zanzres.co.tz', owed: 1240000, lastPay: '2026-02-22', status: 'overdue', oldest: 64, txns: 6, avatar: 'c' },
    { id: 8, name: 'Arusha Auto Glass', phone: '+255 745 111 776', email: 'kennedy@arushaauto.tz', owed: 0, lastPay: '2026-04-21', status: 'paid', oldest: 0, txns: 14, avatar: 'd' },
  ],
  sample_txns: [
    { id: 'INV-2026-0118', date: '2026-03-04', total: 1250000, paid: 400000, due: '2026-04-03', status: 'overdue' },
    { id: 'INV-2026-0124', date: '2026-03-19', total: 880000, paid: 880000, due: '2026-04-18', status: 'paid' },
    { id: 'INV-2026-0131', date: '2026-04-04', total: 720000, paid: 0, due: '2026-05-04', status: 'pending' },
    { id: 'INV-2026-0139', date: '2026-04-12', total: 1450000, paid: 600000, due: '2026-05-12', status: 'partial' },
  ],
  payment_history: [
    { id: 'PAY-0042', date: '2026-04-19', amount: 400000, method: 'Mobile Money', invoice: 'INV-2026-0124', note: 'M-Pesa ref XGT45MT' },
    { id: 'PAY-0038', date: '2026-04-12', amount: 600000, method: 'Bank Transfer', invoice: 'INV-2026-0139', note: 'NMB ref 882-091' },
    { id: 'PAY-0033', date: '2026-03-29', amount: 480000, method: 'Cash', invoice: 'INV-2026-0124', note: '' },
    { id: 'PAY-0029', date: '2026-03-15', amount: 400000, method: 'Mobile Money', invoice: 'INV-2026-0118', note: 'Tigo Pesa' },
  ],
};

// ---------- Customer detail dialog ----------
const CustomerDetailDialog = ({ customer, onClose, onRecordPayment }) => {
  const [tab, setTab] = useState('outstanding');
  if (!customer) return null;

  const txns = AR_DEMO.sample_txns;
  const pays = AR_DEMO.payment_history;
  const totalInvoiced = txns.reduce((s, t) => s + t.total, 0);
  const totalPaid = txns.reduce((s, t) => s + t.paid, 0);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', animation: 'fade-in 160ms' }} onClick={onClose} />
      <div className="dialog dialog-xl" style={{ position: 'relative', maxWidth: 980, width: '100%', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="dialog-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className={`avatar avatar-${customer.avatar}`} style={{ width: 48, height: 48, fontSize: 16, fontWeight: 600 }}>
              {customer.name.split(' ').slice(0, 2).map(s => s[0]).join('')}
            </div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 600, fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>{customer.name}</h2>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="phone" size={12} />{customer.phone}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="mail" size={12} />{customer.email}</span>
              </div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>

        {/* Hero numbers */}
        <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }} className="grid-cols-2">
          <ArHero label="Outstanding balance" value={fmt.tzs(customer.owed)} accent={customer.status === 'overdue' ? 'danger' : 'accent'} />
          <ArHero label="Total invoiced (lifetime)" value={fmt.tzs(totalInvoiced)} />
          <ArHero label="Total paid" value={fmt.tzs(totalPaid)} accent="success" />
          <ArHero label="Oldest unpaid" value={`${customer.oldest}d`} sub={customer.oldest > 60 ? 'Critical' : customer.oldest > 30 ? 'Aging' : 'Within terms'} accent={customer.oldest > 60 ? 'danger' : customer.oldest > 30 ? 'warn' : 'success'} />
        </div>

        {/* Tabs */}
        <div style={{ padding: '0 24px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="tabs">
            <button className="tab" aria-selected={tab === 'outstanding'} onClick={() => setTab('outstanding')}>Outstanding invoices</button>
            <button className="tab" aria-selected={tab === 'history'} onClick={() => setTab('history')}>Payment history</button>
            <button className="tab" aria-selected={tab === 'statement'} onClick={() => setTab('statement')}>Statement</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
          {tab === 'outstanding' && (
            <div className="table-wrap">
              <table className="tbl tbl-responsive">
                <thead>
                  <tr><th>Invoice</th><th>Date</th><th className="num">Total</th><th className="num">Paid</th><th className="num">Balance</th><th>Due</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {txns.map(t => {
                    const balance = t.total - t.paid;
                    return (
                      <tr key={t.id}>
                        <td data-label="Invoice"><span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 500 }}>{t.id}</span></td>
                        <td data-label="Date">{t.date}</td>
                        <td data-label="Total" className="num">{fmt.tzs(t.total)}</td>
                        <td data-label="Paid" className="num" style={{ color: 'var(--success-700)' }}>{fmt.tzs(t.paid)}</td>
                        <td data-label="Balance" className="num"><strong>{fmt.tzs(balance)}</strong></td>
                        <td data-label="Due">{t.due}</td>
                        <td data-label="Status">
                          <span className={`badge ${t.status === 'overdue' ? 'badge-danger' : t.status === 'partial' ? 'badge-warn' : t.status === 'paid' ? 'badge-success' : 'badge-info'}`}>
                            <span className="badge-dot" />{t.status}
                          </span>
                        </td>
                        <td data-label="">
                          <button className="btn btn-ghost btn-sm btn-icon" aria-label="View invoice"><Icon name="chevronRight" size={14} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'history' && (
            <div className="table-wrap">
              <table className="tbl tbl-responsive">
                <thead>
                  <tr><th>Payment</th><th>Date</th><th className="num">Amount</th><th>Method</th><th>Invoice</th><th>Note</th></tr>
                </thead>
                <tbody>
                  {pays.map(p => (
                    <tr key={p.id}>
                      <td data-label="Payment"><span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{p.id}</span></td>
                      <td data-label="Date">{p.date}</td>
                      <td data-label="Amount" className="num" style={{ color: 'var(--success-700)', fontWeight: 600 }}>+{fmt.tzs(p.amount)}</td>
                      <td data-label="Method"><span className="badge">{p.method}</span></td>
                      <td data-label="Invoice"><span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{p.invoice}</span></td>
                      <td data-label="Note" style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>{p.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'statement' && (
            <div style={{ padding: 24 }}>
              <EmptyState
                icon="invoice"
                title="Generate customer statement"
                body="Send a complete statement showing all invoices, payments, and current balance to the customer via WhatsApp, email, or SMS."
                action={() => {}}
                actionLabel="Generate statement (PDF)"
              />
            </div>
          )}
        </div>

        <div className="dialog-foot" style={{ gap: 8 }}>
          <button className="btn btn-outline btn-sm"><Icon name="phone" size={14} />Call</button>
          <button className="btn btn-whatsapp btn-sm"><Icon name="phone" size={14} />WhatsApp reminder</button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
          <button className="btn btn-primary btn-sm" onClick={onRecordPayment}><Icon name="plus" size={14} />Record payment</button>
        </div>
      </div>
    </div>
  );
};

const ArHero = ({ label, value, sub, accent }) => {
  const tones = {
    danger: 'var(--danger-700)', warn: 'var(--warn-700)', success: 'var(--success-700)', accent: 'var(--accent-700)',
  };
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', color: tones[accent] || 'var(--text)' }} className="num">{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
};

// ---------- Record Payment dialog ----------
const RecordPaymentDialog = ({ open, onClose, customers, preselected, onSave }) => {
  const [customerId, setCustomerId] = useState(preselected?.id || '');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('mpesa');
  const [invoiceId, setInvoiceId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  useEffect(() => { if (open) { setCustomerId(preselected?.id || ''); setAmount(''); setInvoiceId(''); setNote(''); } }, [open, preselected]);

  if (!open) return null;
  const cust = customers.find(c => c.id === customerId);

  const methods = [
    { id: 'mpesa', label: 'M-Pesa', icon: 'phone', color: '#16a34a' },
    { id: 'tigo', label: 'Tigo Pesa', icon: 'phone', color: '#0066cc' },
    { id: 'airtel', label: 'Airtel Money', icon: 'phone', color: '#dc2626' },
    { id: 'bank', label: 'Bank Transfer', icon: 'building', color: 'var(--accent-700)' },
    { id: 'cash', label: 'Cash', icon: 'wallet', color: 'var(--text-muted)' },
    { id: 'card', label: 'Card', icon: 'card', color: '#7c3aed' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 75, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', animation: 'fade-in 140ms' }} onClick={onClose} />
      <div className="dialog" style={{ position: 'relative', width: '100%', maxWidth: 520, animation: 'dialog-in 200ms var(--ease-out)' }}>
        <div className="dialog-head">
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-display)' }}>Record payment</h2>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Log a payment received from a customer</div>
          </div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Customer */}
          <div>
            <label className="label">Customer</label>
            <div className="select" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px' }}>
              <Icon name="user" size={14} style={{ color: 'var(--text-muted)' }} />
              <select value={customerId} onChange={e => setCustomerId(Number(e.target.value))} style={{ border: 'none', outline: 'none', flex: 1, background: 'transparent', height: 38, color: 'var(--text)', fontSize: 14 }}>
                <option value="">— Select customer —</option>
                {customers.filter(c => c.owed > 0).map(c => (
                  <option key={c.id} value={c.id}>{c.name} · owed {fmt.tzs(c.owed)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="label">Amount</label>
            <div className="input-group" style={{ height: 44 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>TSh</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" style={{ fontSize: 18, fontFamily: 'var(--font-mono)', fontWeight: 600 }} />
              {cust && cust.owed > 0 && (
                <button onClick={() => setAmount(String(cust.owed))} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>Full ({fmt.tzs(cust.owed)})</button>
              )}
            </div>
            {cust && amount && Number(amount) > cust.owed && (
              <div style={{ fontSize: 11.5, color: 'var(--warn-700)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="alert" size={12} />Amount exceeds outstanding balance ({fmt.tzs(cust.owed)})
              </div>
            )}
          </div>

          {/* Method picker */}
          <div>
            <label className="label">Payment method</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {methods.map(m => (
                <button key={m.id}
                  onClick={() => setMethod(m.id)}
                  style={{
                    padding: '10px 8px',
                    border: '1.5px solid ' + (method === m.id ? 'var(--accent)' : 'var(--border)'),
                    background: method === m.id ? 'color-mix(in oklab, var(--accent-500) 8%, var(--surface))' : 'var(--surface)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    color: method === m.id ? 'var(--accent-700)' : 'var(--text)',
                    fontSize: 12, fontWeight: 500,
                  }}
                >
                  <Icon name={m.icon} size={16} style={{ color: m.color }} />
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Apply to invoice */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Apply to invoice (optional)</label>
              <div className="select">
                <select value={invoiceId} onChange={e => setInvoiceId(e.target.value)}>
                  <option value="">Auto-allocate (oldest first)</option>
                  {AR_DEMO.sample_txns.filter(t => t.status !== 'paid').map(t => (
                    <option key={t.id} value={t.id}>{t.id} · {fmt.tzs(t.total - t.paid)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="label">Reference / note <span style={{ fontWeight: 400, color: 'var(--text-subtle)' }}>(optional)</span></label>
            <input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. M-Pesa ref XGT45MT" />
          </div>
        </div>
        <div className="dialog-foot">
          <button className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" disabled={!customerId || !amount} onClick={() => { onSave?.({ customerId, amount: Number(amount), method, invoiceId, date, note }); onClose(); }}>
            <Icon name="check" size={13} />Record payment
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------- Aging buckets visualization ----------
const AgingChart = ({ buckets }) => {
  const total = buckets.reduce((s, b) => s + b.amount, 0);
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">Aging analysis</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Outstanding by days overdue</div>
        </div>
        <span className="num" style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total: <strong style={{ color: 'var(--text)' }}>{fmt.tzs(total)}</strong></span>
      </div>
      <div className="card-body">
        {/* Stacked bar */}
        <div style={{ display: 'flex', height: 36, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
          {buckets.map((b, i) => (
            <div key={b.label} title={`${b.label}: ${fmt.tzs(b.amount)}`}
              style={{ flex: b.amount, background: b.color, minWidth: b.amount > 0 ? 4 : 0, borderRight: i < buckets.length - 1 ? '1px solid var(--surface)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#fff' }}
            >
              {b.amount / total > 0.08 && Math.round((b.amount / total) * 100) + '%'}
            </div>
          ))}
        </div>
        {/* Legend grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 18 }} className="grid-cols-2">
          {buckets.map(b => (
            <div key={b.label} style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--surface-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: b.color }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>{b.label}</span>
              </div>
              <div className="num" style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-display)' }}>{fmt.tzs(b.amount)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 2 }}>{b.count} {b.count === 1 ? 'invoice' : 'invoices'}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ---------- Main AR page ----------
const Receivables = ({ pushToast }) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | overdue | current
  const [selected, setSelected] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentFor, setPaymentFor] = useState(null);
  const [tab, setTab] = useState('customers');

  const customers = AR_DEMO.customers;
  const totalOutstanding = customers.reduce((s, c) => s + c.owed, 0);
  const overdueAmount = customers.filter(c => c.status === 'overdue').reduce((s, c) => s + c.owed, 0);
  const overdueCount = customers.filter(c => c.status === 'overdue').length;
  const collectedThisMonth = 4280000;
  const customersWithDebt = customers.filter(c => c.owed > 0).length;

  const filtered = customers.filter(c => {
    if (filter === 'overdue' && c.status !== 'overdue') return false;
    if (filter === 'current' && c.status !== 'current') return false;
    if (filter === 'paid' && c.owed > 0) return false;
    if (search && !(c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search))) return false;
    return true;
  });

  const buckets = [
    { label: '0–30 DAYS', amount: 1620000, count: 5, color: 'var(--success-600)' },
    { label: '31–60 DAYS', amount: 2120000, count: 3, color: 'var(--warn-500)' },
    { label: '61–90 DAYS', amount: 2645000, count: 4, color: '#ea580c' },
    { label: '90+ DAYS', amount: 1875000, count: 2, color: 'var(--danger-600)' },
  ];

  return (
    <div>
      <PageHeader
        title={<>Customer <span style={{ color: 'var(--accent-700)' }}>debts</span></>}
        subtitle="Track credit, age receivables, and record payments"
        actions={<>
          <button className="btn btn-outline btn-sm"><Icon name="download" size={14} />Export</button>
          <button className="btn btn-outline btn-sm"><Icon name="mail" size={14} />Send statements</button>
          <button className="btn btn-primary btn-sm" onClick={() => { setPaymentFor(null); setPaymentOpen(true); }}>
            <Icon name="plus" size={14} />Record payment
          </button>
        </>}
      />

      {/* Hero KPIs */}
      <div className="grid-cols-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <ArKpi label="Total outstanding" value={fmt.tzs(totalOutstanding)} sub={`${customersWithDebt} customers on credit`} icon="wallet" tone="accent" />
        <ArKpi label="Overdue amount" value={fmt.tzs(overdueAmount)} sub={`${overdueCount} customers · oldest 92d`} icon="alert" tone="danger" />
        <ArKpi label="Collected this month" value={fmt.tzs(collectedThisMonth)} delta={12.4} icon="check" tone="success" />
        <ArKpi label="Avg. days to pay" value="34d" sub="vs 41d last quarter" delta={-17} icon="trend" tone="info" />
      </div>

      {/* Aging chart */}
      <div style={{ marginBottom: 20 }}>
        <AgingChart buckets={buckets} />
      </div>

      {/* Tabs + filters + customer table */}
      <div className="card">
        <div className="card-head" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
          <div className="tabs" style={{ borderBottom: 'none' }}>
            <button className="tab" aria-selected={tab === 'customers'} onClick={() => setTab('customers')}>By customer</button>
            <button className="tab" aria-selected={tab === 'invoices'} onClick={() => setTab('invoices')}>Outstanding invoices</button>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="input-group" style={{ flex: 1, minWidth: 200, maxWidth: 320, height: 36 }}>
              <Icon name="search" size={14} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or phone…" />
            </div>

            <div style={{ display: 'inline-flex', gap: 4, padding: 3, borderRadius: 'var(--radius-md)', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
              {[['all', 'All'], ['overdue', 'Overdue'], ['current', 'Current'], ['paid', 'Settled']].map(([v, l]) => (
                <button key={v} onClick={() => setFilter(v)}
                  style={{
                    padding: '6px 10px', borderRadius: 6, fontSize: 12.5, fontWeight: 500,
                    background: filter === v ? 'var(--surface)' : 'transparent',
                    color: filter === v ? 'var(--text)' : 'var(--text-muted)',
                    boxShadow: filter === v ? 'var(--shadow-xs)' : 'none',
                  }}
                >{l}</button>
              ))}
            </div>
            <button className="btn btn-outline btn-sm"><Icon name="filter" size={13} />More filters</button>
          </div>
        </div>

        {tab === 'customers' && (
          <div className="table-wrap">
            <table className="tbl tbl-responsive">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Contact</th>
                  <th className="num">Outstanding</th>
                  <th>Last payment</th>
                  <th className="num">Oldest debt</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7}><EmptyState icon="users" title="No customers match" body="Try clearing filters or search by phone number." /></td></tr>
                ) : filtered.map(c => (
                  <tr key={c.id} onClick={() => setSelected(c)} style={{ cursor: 'pointer' }}>
                    <td data-label="Customer">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className={`avatar avatar-${c.avatar}`}>{c.name.split(' ').slice(0, 2).map(s => s[0]).join('')}</div>
                        <div>
                          <div style={{ fontWeight: 500 }}>{c.name}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-subtle)' }}>{c.txns} {c.txns === 1 ? 'invoice' : 'invoices'}</div>
                        </div>
                      </div>
                    </td>
                    <td data-label="Contact" style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-muted)' }}>{c.phone}</td>
                    <td data-label="Outstanding" className="num" style={{ fontWeight: 600, color: c.owed > 0 ? 'var(--text)' : 'var(--text-subtle)' }}>{fmt.tzs(c.owed)}</td>
                    <td data-label="Last payment" style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{c.lastPay}</td>
                    <td data-label="Oldest debt" className="num" style={{ color: c.oldest > 60 ? 'var(--danger-600)' : c.oldest > 30 ? 'var(--warn-700)' : 'var(--text-muted)', fontWeight: c.oldest > 60 ? 600 : 400 }}>
                      {c.owed > 0 ? `${c.oldest}d` : '—'}
                    </td>
                    <td data-label="Status">
                      <span className={`badge ${c.status === 'overdue' ? 'badge-danger' : c.status === 'paid' ? 'badge-success' : 'badge-info'}`}>
                        <span className="badge-dot" />{c.status === 'paid' ? 'Settled' : c.status[0].toUpperCase() + c.status.slice(1)}
                      </span>
                    </td>
                    <td data-label="" onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        {c.owed > 0 && (
                          <>
                            <button className="btn btn-ghost btn-sm btn-icon" title="Send WhatsApp reminder" aria-label="Send WhatsApp reminder">
                              <Icon name="phone" size={14} style={{ color: '#25D366' }} />
                            </button>
                            <button className="btn btn-primary btn-sm" onClick={() => { setPaymentFor(c); setPaymentOpen(true); }}>
                              <Icon name="plus" size={12} />Record
                            </button>
                          </>
                        )}
                        <button className="btn btn-ghost btn-sm btn-icon" aria-label="View details" onClick={() => setSelected(c)}>
                          <Icon name="chevronRight" size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'invoices' && (
          <div className="table-wrap">
            <table className="tbl tbl-responsive">
              <thead>
                <tr><th>Invoice</th><th>Customer</th><th>Issued</th><th>Due</th><th className="num">Total</th><th className="num">Balance</th><th className="num">Days late</th><th>Status</th></tr>
              </thead>
              <tbody>
                {AR_DEMO.sample_txns.filter(t => t.status !== 'paid').map(t => {
                  const balance = t.total - t.paid;
                  const today = new Date('2026-04-21'), due = new Date(t.due);
                  const daysLate = Math.max(0, Math.round((today - due) / 86400000));
                  return (
                    <tr key={t.id}>
                      <td data-label="Invoice"><span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 500 }}>{t.id}</span></td>
                      <td data-label="Customer">Coastal Construction</td>
                      <td data-label="Issued">{t.date}</td>
                      <td data-label="Due">{t.due}</td>
                      <td data-label="Total" className="num">{fmt.tzs(t.total)}</td>
                      <td data-label="Balance" className="num"><strong>{fmt.tzs(balance)}</strong></td>
                      <td data-label="Days late" className="num" style={{ color: daysLate > 60 ? 'var(--danger-600)' : daysLate > 0 ? 'var(--warn-700)' : 'var(--text-muted)', fontWeight: daysLate > 0 ? 600 : 400 }}>{daysLate > 0 ? `${daysLate}d` : '—'}</td>
                      <td data-label="Status">
                        <span className={`badge ${t.status === 'overdue' ? 'badge-danger' : t.status === 'partial' ? 'badge-warn' : 'badge-info'}`}>
                          <span className="badge-dot" />{t.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CustomerDetailDialog customer={selected} onClose={() => setSelected(null)} onRecordPayment={() => { setPaymentFor(selected); setPaymentOpen(true); setSelected(null); }} />
      <RecordPaymentDialog open={paymentOpen} onClose={() => setPaymentOpen(false)} customers={customers} preselected={paymentFor} onSave={(d) => pushToast?.({ kind: 'success', msg: `Payment of ${fmt.tzs(d.amount)} recorded` })} />
    </div>
  );
};

const ArKpi = ({ label, value, delta, sub, icon, tone }) => {
  const tones = {
    accent: { bg: 'color-mix(in oklab, var(--accent-500) 12%, transparent)', fg: 'var(--accent-700)' },
    danger: { bg: 'color-mix(in oklab, var(--danger-500) 12%, transparent)', fg: 'var(--danger-600)' },
    success: { bg: 'color-mix(in oklab, var(--success-500) 12%, transparent)', fg: 'var(--success-700)' },
    info: { bg: 'color-mix(in oklab, var(--accent-500) 8%, var(--surface-2))', fg: 'var(--text)' },
  };
  const t = tones[tone] || tones.info;
  return (
    <div className="kpi">
      <div className="kpi-top">
        <div style={{ width: 36, height: 36, borderRadius: 9, background: t.bg, color: t.fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={17} /></div>
        {delta != null && (
          <span className={`kpi-delta ${delta > 0 ? 'up' : 'down'}`}>
            <Icon name={delta > 0 ? 'arrowUp' : 'arrowDown'} size={12} />{Math.abs(delta)}%
          </span>
        )}
      </div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ color: tone === 'danger' ? 'var(--danger-700)' : 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--text-subtle)' }}>{sub}</div>}
    </div>
  );
};

Object.assign(window, { Receivables, RecordPaymentDialog, CustomerDetailDialog });
