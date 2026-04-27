// FLUX — Mobile receipt bottom sheet (after sale completion)
// Used on mobile (< 768px) instead of the desktop receipt dialog.

const ReceiptSheet = ({ open, onClose, receipt, onNewSale, pushToast }) => {
  const [closing, setClosing] = useState(false);
  const sheetRef = useRef(null);
  const startY = useRef(0);
  const dragY = useRef(0);

  const close = () => {
    setClosing(true);
    setTimeout(() => { setClosing(false); onClose(); }, 220);
  };

  // Drag-to-dismiss
  const onTouchStart = (e) => { startY.current = e.touches[0].clientY; dragY.current = 0; };
  const onTouchMove = (e) => {
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0 && sheetRef.current) {
      dragY.current = dy;
      sheetRef.current.style.transform = `translateY(${dy}px)`;
    }
  };
  const onTouchEnd = () => {
    if (sheetRef.current) {
      if (dragY.current > 100) close();
      else sheetRef.current.style.transform = '';
    }
  };

  if (!open && !closing) return null;
  if (!receipt) return null;

  const change = (receipt.tendered || 0) - receipt.total;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} role="dialog" aria-modal="true" aria-label="Receipt">
      {/* Backdrop */}
      <div
        onClick={close}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          animation: closing ? 'fade-out 220ms forwards' : 'fade-in 200ms',
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          maxHeight: '92vh',
          background: 'var(--surface)',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -12px 40px rgba(0,0,0,0.32)',
          display: 'flex', flexDirection: 'column',
          animation: closing ? 'sheet-out 220ms forwards' : 'sheet-in 280ms var(--ease-out)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Drag handle */}
        <div style={{ padding: '10px 0 4px', display: 'flex', justifyContent: 'center', flex: '0 0 auto' }}>
          <span style={{ width: 44, height: 5, borderRadius: 999, background: 'var(--border-strong)' }} />
        </div>

        {/* Success icon + amount */}
        <div style={{
          padding: '8px 20px 22px',
          textAlign: 'center', flex: '0 0 auto',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'linear-gradient(180deg, color-mix(in oklab, var(--success-500) 7%, var(--surface)) 0%, var(--surface) 80%)',
          position: 'relative',
        }}>
          {/* Kente stripe accent */}
          <div style={{
            position: 'absolute', top: 0, left: '20%', right: '20%', height: 2,
            background: 'linear-gradient(90deg, var(--accent-500) 0 33%, #16a34a 33% 66%, #1e40af 66% 100%)',
            borderRadius: '0 0 2px 2px', opacity: 0.6,
          }} />

          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'var(--success-500)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '4px auto 14px',
            boxShadow: '0 6px 20px color-mix(in oklab, var(--success-500) 35%, transparent)',
            animation: 'check-pop 480ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}>
            <Icon name="check" size={32} strokeWidth={3} />
          </div>

          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 4 }}>Sale complete</div>
          <div style={{ fontSize: 30, fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', lineHeight: 1.1 }} className="num">
            {fmt.tzs(receipt.total)}
          </div>
          {receipt.tendered > 0 && change > 0 && (
            <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, background: 'color-mix(in oklab, var(--accent-500) 12%, transparent)', color: 'var(--accent-700)', fontSize: 12.5, fontWeight: 600 }}>
              <Icon name="wallet" size={13} />Change due: <span className="num">{fmt.tzs(change)}</span>
            </div>
          )}
        </div>

        {/* Scrollable details */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {/* Meta */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)', fontWeight: 500 }}>{receipt.id}</div>
              <div style={{ fontSize: 11.5, marginTop: 2 }}>{receipt.date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {receipt.customer && <div style={{ color: 'var(--text)', fontWeight: 500 }}>{receipt.customer}</div>}
              <div style={{ fontSize: 11.5 }}>{receipt.method}</div>
            </div>
          </div>

          {/* TRA stamp */}
          <div style={{
            padding: '10px 12px', borderRadius: 'var(--radius-md)',
            background: 'color-mix(in oklab, var(--success-500) 8%, var(--surface-2))',
            border: '1px solid color-mix(in oklab, var(--success-500) 20%, var(--border))',
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
          }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--success-500)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
              <Icon name="tra" size={16} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--success-700)' }}>Verified by TRA</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>EFD: 02TZ100…2841 · Z: 0118</div>
            </div>
            <Icon name="check" size={16} style={{ color: 'var(--success-600)' }} />
          </div>

          {/* Items */}
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: 8 }}>
            Items ({receipt.items.length})
          </div>
          <div style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', overflow: 'hidden', marginBottom: 14 }}>
            {receipt.items.map((it, i) => (
              <div key={it.id || i} style={{
                padding: '12px 14px',
                borderBottom: i < receipt.items.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                display: 'flex', alignItems: 'center', gap: 10,
                background: i % 2 ? 'var(--surface-2)' : 'var(--surface)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                    {it.qty} × {fmt.tzs(it.price)}
                  </div>
                </div>
                <div className="num" style={{ fontSize: 14, fontWeight: 600 }}>{fmt.tzs(it.qty * it.price)}</div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13.5, marginBottom: 12 }}>
            <Row label="Subtotal" value={fmt.tzs(receipt.subtotal)} />
            {receipt.discount > 0 && <Row label="Discount" value={'−' + fmt.tzs(receipt.discount)} accent="success" />}
            <Row label={`VAT (${receipt.taxRate || 18}%)`} value={fmt.tzs(receipt.tax)} muted />
            <div style={{ height: 1, background: 'var(--border-subtle)', margin: '6px 0' }} />
            <Row label="Total" value={fmt.tzs(receipt.total)} bold large />
            {receipt.tendered > 0 && (
              <>
                <Row label={`Tendered (${receipt.method})`} value={fmt.tzs(receipt.tendered)} muted />
                {change > 0 && <Row label="Change" value={fmt.tzs(change)} accent="accent" />}
              </>
            )}
          </div>
        </div>

        {/* Actions — stacked vertically */}
        <div style={{
          flex: '0 0 auto',
          padding: '12px 16px 16px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex', flexDirection: 'column', gap: 8,
          background: 'var(--bg-elev)',
        }}>
          {/* Primary: WhatsApp (in this market it's the most-used share) */}
          <button
            className="btn btn-whatsapp"
            style={{ width: '100%', height: 52, fontSize: 15, fontWeight: 600, borderRadius: 12 }}
            onClick={() => pushToast?.({ kind: 'success', msg: 'Sharing receipt via WhatsApp…' })}
          >
            <Icon name="phone" size={18} />Share via WhatsApp
          </button>

          {/* Secondary row: Download / Print */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button
              className="btn btn-outline"
              style={{ height: 48, fontSize: 14, fontWeight: 500, borderRadius: 12 }}
              onClick={() => pushToast?.({ kind: 'success', msg: 'Receipt PDF downloaded' })}
            >
              <Icon name="download" size={16} />PDF
            </button>
            <button
              className="btn btn-outline"
              style={{ height: 48, fontSize: 14, fontWeight: 500, borderRadius: 12 }}
              onClick={() => pushToast?.({ kind: 'info', msg: 'Sending to thermal printer…' })}
            >
              <Icon name="print" size={16} />Print
            </button>
          </div>

          {/* Tertiary: SMS / email */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button className="btn btn-ghost" style={{ height: 44, fontSize: 13, borderRadius: 10 }}>
              <Icon name="phone" size={14} />SMS
            </button>
            <button className="btn btn-ghost" style={{ height: 44, fontSize: 13, borderRadius: 10 }}>
              <Icon name="mail" size={14} />Email
            </button>
          </div>

          {/* Primary continue */}
          <button
            className="btn btn-primary"
            style={{ width: '100%', height: 52, fontSize: 15, fontWeight: 600, borderRadius: 12, marginTop: 4 }}
            onClick={() => { close(); setTimeout(() => onNewSale?.(), 220); }}
          >
            <Icon name="plus" size={16} />New sale
          </button>
        </div>
      </div>

      <style>{`
        @keyframes sheet-in { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes sheet-out { from { transform: translateY(0); } to { transform: translateY(100%); } }
        @keyframes fade-out { from { opacity: 1; } to { opacity: 0; } }
        @keyframes check-pop { 0% { transform: scale(0); opacity: 0; } 60% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
};

const Row = ({ label, value, muted, bold, large, accent }) => {
  const colors = { success: 'var(--success-700)', accent: 'var(--accent-700)' };
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
      <span style={{ color: muted ? 'var(--text-muted)' : 'var(--text)', fontWeight: bold ? 600 : 400, fontSize: large ? 16 : 13.5 }}>{label}</span>
      <span className="num" style={{
        fontWeight: bold ? 700 : 500,
        fontSize: large ? 22 : 14,
        fontFamily: large ? 'var(--font-display)' : 'var(--font-mono)',
        letterSpacing: large ? '-0.01em' : 'normal',
        color: colors[accent] || (muted ? 'var(--text-muted)' : 'var(--text)'),
      }}>{value}</span>
    </div>
  );
};

Object.assign(window, { ReceiptSheet });
