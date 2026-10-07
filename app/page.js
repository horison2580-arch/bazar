function Report({ flash }) {
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [orders, setOrders] = useState(null);
  const [capital, setCapital] = useState([]);
  const [known, setKnown] = useState({});
  const [m, setM] = useState({ name: '', price: '', qty: 1, date: todayStr() });

  const load = async () => {
    try {
      const [o, c] = await Promise.all([
        api(`/api/orders?from=${from}&to=${to}`),
        api(`/api/capital?from=${from}&to=${to}`),
      ]);
      setOrders(o); setCapital(c);
    } catch (e) { flash(e.message); }
  };
  useEffect(() => {
    try { setKnown(JSON.parse(localStorage.getItem('modal-prices') || '{}')); } catch {}
    load();
  }, []); // eslint-disable-line

  const { summary, grand } = useMemo(() => {
    const map = {};
    let grand = 0;
    for (const o of orders || []) {
      grand += o.total;
      for (const l of o.items) {
        map[l.name] ||= { name: l.name, qty: 0, sub: 0 };
        map[l.name].qty += l.qty;
        map[l.name].sub += l.qty * l.price;
      }
    }
    return { summary: Object.values(map).sort((a, b) => b.sub - a.sub), grand };
  }, [orders]);

  const modalTotal = useMemo(() => capital.reduce((s, c) => s + c.total, 0), [capital]);
  const profit = grand - modalTotal;
  const totalQty = summary.reduce((a, s) => a + s.qty, 0);
  const names = useMemo(
    () => [...new Set([...Object.keys(known), ...capital.map((c) => c.name)])], [known, capital]);
  const dmy = (s) => s.split('-').reverse().join('/');

  const setName = (name) => setM((p) => ({
    ...p, name, price: known[name] !== undefined ? String(known[name]) : p.price,
  }));

  const addCapital = async (e) => {
    e.preventDefault();
    try {
      const unit_price = Number(m.price);
      await api('/api/capital', { method: 'POST', body: { name: m.name, unit_price, qty: m.qty, spent_on: m.date } });
      const k = { ...known, [m.name.trim()]: unit_price };
      setKnown(k);
      try { localStorage.setItem('modal-prices', JSON.stringify(k)); } catch {}
      setM({ ...m, name: '', price: '', qty: 1 });
      await load();
      flash('Modal ditambahkan ✔');
    } catch (err) { flash(err.message); }
  };

  const removeCapital = async (c) => {
    if (!confirm(`Hapus modal "${c.name}"?`)) return;
    try { await api('/api/capital?id=' + c.id, { method: 'DELETE' }); await load(); } catch (e) { flash(e.message); }
  };

  const removeOrder = async (id) => {
    if (!confirm('Hapus pesanan ini?')) return;
    try { await api('/api/orders?id=' + id, { method: 'DELETE' }); await load(); } catch (e) { flash(e.message); }
  };

  const makeDoc = async (title) => {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text(title, 14, 16);
    doc.setFontSize(10); doc.text(`Periode: ${from} s/d ${to}`, 14, 23);
    return { doc, autoTable };
  };
  const GREEN = [31, 111, 74];
  const FOOT = { fillColor: [230, 230, 230], textColor: 0 };

  // PDF penghasilan: TIDAK dikurangi modal
  const pdfIncome = async () => {
    const { doc, autoTable } = await makeDoc('Laporan Penjualan');
    autoTable(doc, {
      startY: 28,
      head: [['Menu', 'Jumlah', 'Subtotal']],
      body: summary.map((s) => [s.name, s.qty, rp(s.sub)]),
      foot: [['TOTAL', totalQty, rp(grand)]],
      headStyles: { fillColor: GREEN }, footStyles: FOOT,
    });
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Waktu', 'Pelanggan', 'Rincian', 'Total']],
      body: orders.map((o) => [fmtTime(o.created_at), o.customer || '-',
        o.items.map((l) => `${l.qty}x ${l.name}`).join(', '), rp(o.total)]),
      headStyles: { fillColor: GREEN },
    });
    doc.save(`penghasilan-${from}_${to}.pdf`);
  };

  const pdfModal = async () => {
    const { doc, autoTable } = await makeDoc('Laporan Modal');
    autoTable(doc, {
      startY: 28,
      head: [['Tanggal', 'Nama', 'Harga Satuan', 'Jumlah', 'Total']],
      body: capital.map((c) => [dmy(c.spent_on), c.name, rp(c.unit_price), c.qty, rp(c.total)]),
      foot: [['', '', '', 'TOTAL', rp(modalTotal)]],
      headStyles: { fillColor: GREEN }, footStyles: FOOT,
    });
    doc.save(`modal-${from}_${to}.pdf`);
  };

  const pdfProfit = async () => {
    const { doc, autoTable } = await makeDoc('Laporan Laba / Rugi');
    autoTable(doc, {
      startY: 28,
      head: [['Keterangan', 'Jumlah']],
      body: [['Total Penghasilan', rp(grand)], ['Total Modal', rp(modalTotal)]],
      foot: [[profit >= 0 ? 'LABA BERSIH' : 'RUGI', rp(Math.abs(profit))]],
      headStyles: { fillColor: GREEN }, footStyles: FOOT,
    });
    doc.save(`laba-rugi-${from}_${to}.pdf`);
  };

  return (
    <div>
      <div className="card">
        <div className="lbl">Periode laporan</div>
        <div className="row filter">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="muted">s/d</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <button className="primary" onClick={load}>Tampilkan</button>
        </div>
      </div>

      {orders === null ? <p className="muted">Memuat…</p> : (
        <>
          <div className="stats">
            <div className="stat"><span>Penghasilan</span><b>{rp(grand)}</b></div>
            <div className="stat"><span>Modal</span><b>{rp(modalTotal)}</b></div>
            <div className={'stat ' + (profit >= 0 ? 'pos' : 'neg')}>
              <span>{profit >= 0 ? 'Laba' : 'Rugi'}</span><b>{rp(Math.abs(profit))}</b>
            </div>
          </div>

          <div className="sec"><h2>💰 Penghasilan</h2><span>{orders.length} pesanan</span></div>
          <div className="card">
            {summary.length === 0 ? <p className="empty">Belum ada penjualan pada periode ini.</p> : (
              <table>
                <thead><tr><th>Menu</th><th className="r">Jml</th><th className="r">Subtotal</th></tr></thead>
                <tbody>{summary.map((s) => (
                  <tr key={s.name}><td>{s.name}</td><td className="r">{s.qty}</td><td className="r">{rp(s.sub)}</td></tr>
                ))}</tbody>
                <tfoot><tr><td>Total</td><td className="r">{totalQty}</td><td className="r">{rp(grand)}</td></tr></tfoot>
              </table>
            )}
          </div>
          <button className="primary wide" disabled={!orders.length} onClick={pdfIncome}>📄 Cetak PDF Penghasilan</button>

          <div className="sec"><h2>🧾 Daftar Pesanan</h2><span>{orders.length} pesanan</span></div>
          {orders.length === 0 && <div className="card"><p className="empty">Belum ada pesanan.</p></div>}
          {orders.map((o) => (
            <div className="card" key={o.id}>
              <div className="row">
                <div>
                  <b>{fmtTime(o.created_at)}</b>
                  {o.customer ? <div className="muted">👤 {o.customer}</div> : null}
                </div>
                <b>{rp(o.total)}</b>
              </div>
              <div className="chips">
                {o.items.map((l, i) => <span className="chip" key={i}>{l.qty}× {l.name}</span>)}
              </div>
              <button className="danger sm" onClick={() => removeOrder(o.id)}>Hapus</button>
            </div>
          ))}

          <div className="sec"><h2>🛒 Modal</h2><span>{capital.length} catatan</span></div>
          <form className="mform card" onSubmit={addCapital}>
            <div>
              <div className="lbl">Nama modal</div>
              <input list="modal-names" placeholder="mis. Puding, Ikan mas" value={m.name}
                onChange={(e) => setName(e.target.value)} required />
              <datalist id="modal-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
            </div>
            <div>
              <div className="lbl">Harga modal per satuan (Rp)</div>
              <input placeholder="mis. 6500" type="number" min="0" step="1" inputMode="numeric"
                value={m.price} onChange={(e) => setM({ ...m, price: e.target.value })} required />
            </div>
            <div className="row2">
              <div>
                <div className="lbl">Jumlah</div>
                <div className="stepper">
                  <button type="button" onClick={() => setM((p) => ({ ...p, qty: Math.max(1, p.qty - 1) }))}>−</button>
                  <input type="number" min="1" step="1" inputMode="numeric" value={m.qty} style={{ textAlign: 'center' }}
                    onChange={(e) => setM((p) => ({ ...p, qty: Math.max(1, parseInt(e.target.value) || 1) }))} />
                  <button type="button" onClick={() => setM((p) => ({ ...p, qty: p.qty + 1 }))}>+</button>
                </div>
              </div>
              <div>
                <div className="lbl">Tanggal</div>
                <input type="date" value={m.date} onChange={(e) => setM({ ...m, date: e.target.value })} />
              </div>
            </div>
            <div className="row">
              <b>Total: {rp((Number(m.price) || 0) * m.qty)}</b>
              <button className="primary" type="submit">Tambah Modal</button>
            </div>
          </form>
          {capital.length === 0 && <div className="card"><p className="empty">Belum ada modal pada periode ini.</p></div>}
          {capital.map((c) => (
            <div className="card row" key={c.id}>
              <div>
                <b>{c.name}</b>
                <div className="muted">{c.qty} × {rp(c.unit_price)} · {dmy(c.spent_on)}</div>
              </div>
              <div className="row">
                <b>{rp(c.total)}</b>
                <button className="danger sm" onClick={() => removeCapital(c)}>Hapus</button>
              </div>
            </div>
          ))}
          <div className="card row total"><b>Total modal</b><b>{rp(modalTotal)}</b></div>
          <button className="primary wide" disabled={!capital.length} onClick={pdfModal}>📄 Cetak PDF Modal</button>

          <div className="sec"><h2>📊 Laba / Rugi</h2></div>
          <div className="card">
            <div className="row"><span>Penghasilan</span><span>{rp(grand)}</span></div>
            <div className="row"><span>Modal</span><span>− {rp(modalTotal)}</span></div>
            <div className={'row result ' + (profit >= 0 ? 'pos' : 'neg')}>
              <b>{profit >= 0 ? 'Laba bersih' : 'Rugi'}</b><b>{rp(Math.abs(profit))}</b>
            </div>
          </div>
          <button className="primary wide" onClick={pdfProfit}>📄 Cetak PDF Laba/Rugi</button>
        </>
      )}
    </div>
  );
}
