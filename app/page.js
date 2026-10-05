'use client';
import { useEffect, useMemo, useState } from 'react';

const rp = (n) => 'Rp ' + Number(n).toLocaleString('id-ID');
const todayStr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const fmtTime = (t) => new Date(t).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'short', timeStyle: 'short' });

async function api(url, opts = {}) {
  const r = await fetch(url, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Terjadi kesalahan');
  return d;
}

export default function Home() {
  const [tab, setTab] = useState('order');
  const [menu, setMenu] = useState([]);
  const [msg, setMsg] = useState('');

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 3500); };
  const reload = async () => {
    try { setMenu(await api('/api/menu')); } catch (e) { flash(e.message); }
  };
  useEffect(() => { reload(); }, []);

  return (
    <main>
      <h1>🧾 Catatan Pesanan</h1>
      <nav>
        {[['order', 'Pesanan'], ['menu', 'Menu'], ['report', 'Laporan']].map(([k, label]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>
        ))}
      </nav>
      {msg && <div className="msg">{msg}</div>}
      {tab === 'order' && <Order menu={menu} flash={flash} />}
      {tab === 'menu' && <MenuManager menu={menu} reload={reload} flash={flash} />}
      {tab === 'report' && <Report flash={flash} />}
    </main>
  );
}

function Order({ menu, flash }) {
  const [cart, setCart] = useState({});
  const [customer, setCustomer] = useState('');
  const [busy, setBusy] = useState(false);

  const change = (id, d) => setCart((c) => {
    const q = (c[id] || 0) + d;
    const n = { ...c };
    if (q <= 0) delete n[id]; else n[id] = q;
    return n;
  });
  const total = useMemo(
    () => menu.reduce((s, m) => s + m.price * (cart[m.id] || 0), 0), [menu, cart]);

  const save = async () => {
    const items = Object.entries(cart).map(([id, qty]) => ({ id: Number(id), qty }));
    if (!items.length) return flash('Pilih menu terlebih dahulu');
    setBusy(true);
    try {
      await api('/api/orders', { method: 'POST', body: { customer, items } });
      setCart({}); setCustomer('');
      flash('Pesanan tersimpan ✔');
    } catch (e) { flash(e.message); }
    setBusy(false);
  };

  if (!menu.length) return <p className="muted">Belum ada menu. Tambahkan dulu di tab Menu.</p>;
  return (
    <div>
      <div className="grid">
        {menu.map((m) => (
          <div className="card row" key={m.id}>
            <div><b>{m.name}</b><div className="muted">{rp(m.price)}</div></div>
            <div className="row">
              <button onClick={() => change(m.id, -1)}>−</button>
              <b style={{ minWidth: 24, textAlign: 'center' }}>{cart[m.id] || 0}</b>
              <button onClick={() => change(m.id, 1)}>+</button>
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <input placeholder="Nama pelanggan / meja (opsional)" value={customer}
          onChange={(e) => setCustomer(e.target.value)} />
        <div className="row" style={{ marginTop: 10 }}>
          <b>Total: {rp(total)}</b>
          <button className="primary" disabled={busy} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan Pesanan'}</button>
        </div>
      </div>
    </div>
  );
}

function MenuManager({ menu, reload, flash }) {
  const empty = { id: null, name: '', price: '' };
  const [f, setF] = useState(empty);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const body = { name: f.name, price: Number(f.price) };
      if (f.id) await api('/api/menu/' + f.id, { method: 'PUT', body });
      else await api('/api/menu', { method: 'POST', body });
      setF(empty); await reload();
      flash(f.id ? 'Menu diperbarui ✔' : 'Menu ditambahkan ✔');
    } catch (err) { flash(err.message); }
  };
  const del = async (m) => {
    if (!confirm(`Hapus "${m.name}"? (Laporan lama tetap aman)`)) return;
    try { await api('/api/menu/' + m.id, { method: 'DELETE' }); await reload(); flash('Menu dihapus'); }
    catch (err) { flash(err.message); }
  };

  return (
    <div>
      <form className="form" onSubmit={submit}>
        <input placeholder="Nama menu" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        <input placeholder="Harga" type="number" min="0" step="1" inputMode="numeric" value={f.price}
          onChange={(e) => setF({ ...f, price: e.target.value })} required />
        <button className="primary" type="submit">{f.id ? 'Simpan' : 'Tambah'}</button>
      </form>
      {f.id && <button style={{ marginBottom: 10 }} onClick={() => setF(empty)}>Batal edit</button>}
      {menu.map((m) => (
        <div className="card row" key={m.id}>
          <div><b>{m.name}</b><div className="muted">{rp(m.price)}</div></div>
          <div className="row">
            <button onClick={() => setF({ id: m.id, name: m.name, price: String(m.price) })}>Edit</button>
            <button className="danger" onClick={() => del(m)}>Hapus</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Report({ flash }) {
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [orders, setOrders] = useState(null);

  const load = async () => {
    try { setOrders(await api(`/api/orders?from=${from}&to=${to}`)); } catch (e) { flash(e.message); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

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

  const removeOrder = async (id) => {
    if (!confirm('Hapus pesanan ini?')) return;
    try { await api('/api/orders?id=' + id, { method: 'DELETE' }); await load(); } catch (e) { flash(e.message); }
  };

  const pdf = async () => {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Laporan Penjualan', 14, 16);
    doc.setFontSize(10); doc.text(`Periode: ${from} s/d ${to}`, 14, 23);
    autoTable(doc, {
      startY: 28,
      head: [['Menu', 'Jumlah', 'Subtotal']],
      body: summary.map((s) => [s.name, s.qty, rp(s.sub)]),
      foot: [['TOTAL', summary.reduce((a, s) => a + s.qty, 0), rp(grand)]],
      headStyles: { fillColor: [31, 111, 74] }, footStyles: { fillColor: [230, 230, 230], textColor: 0 },
    });
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Waktu', 'Pelanggan', 'Rincian', 'Total']],
      body: orders.map((o) => [fmtTime(o.created_at), o.customer || '-',
        o.items.map((l) => `${l.qty}x ${l.name}`).join(', '), rp(o.total)]),
      headStyles: { fillColor: [31, 111, 74] },
    });
    doc.save(`laporan-${from}_${to}.pdf`);
  };

  return (
    <div>
      <div className="card">
        <div className="row">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <button onClick={load}>Tampilkan</button>
        </div>
      </div>
      {orders === null ? <p className="muted">Memuat…</p> : (
        <>
          <div className="card">
            <div className="row"><b>Total penjualan</b><b>{rp(grand)}</b></div>
            <div className="muted">{orders.length} pesanan</div>
            <table>
              <thead><tr><th>Menu</th><th className="r">Jml</th><th className="r">Subtotal</th></tr></thead>
              <tbody>{summary.map((s) => (
                <tr key={s.name}><td>{s.name}</td><td className="r">{s.qty}</td><td className="r">{rp(s.sub)}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <button className="primary" disabled={!orders.length} onClick={pdf} style={{ marginBottom: 12 }}>📄 Cetak / Unduh PDF</button>
          {orders.map((o) => (
            <div className="card" key={o.id}>
              <div className="row"><b>{fmtTime(o.created_at)}{o.customer ? ' · ' + o.customer : ''}</b><b>{rp(o.total)}</b></div>
              <div className="muted">{o.items.map((l) => `${l.qty}x ${l.name}`).join(', ')}</div>
              <button className="danger" style={{ marginTop: 6, padding: '4px 10px' }} onClick={() => removeOrder(o.id)}>Hapus</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
