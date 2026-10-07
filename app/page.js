'use client';
import { useEffect, useMemo, useState } from 'react';

const rp = (n) => 'Rp ' + Number(n).toLocaleString('id-ID');
const todayStr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const fmtTime = (t) => new Date(t).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'short', timeStyle: 'short' });
const imgUrl = (m) => (m.has_image ? `/api/menu/${m.id}/image?v=${m.v}` : null);

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

function resizeImage(file, max = 400) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => reject(new Error('File bukan gambar yang valid'));
    img.src = url;
  });
}

const Thumb = ({ src }) =>
  src
    ? <img className="thumb" src={src} alt="" width="64" height="64" loading="lazy" decoding="async" />
    : <div className="thumb ph">🍽️</div>;

export default function Home() {
  const [tab, setTab] = useState('order');
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 3500); };
  const reload = async () => {
    try {
      const d = await api('/api/menu');
      setMenu(d);
      try { localStorage.setItem('menu-cache', JSON.stringify(d)); } catch {}
    } catch (e) { flash(e.message); }
    setLoading(false);
  };
  useEffect(() => {
    try {
      const c = localStorage.getItem('menu-cache');
      if (c) { setMenu(JSON.parse(c)); setLoading(false); }
    } catch {}
    reload();
  }, []); // eslint-disable-line

  return (
    <main>
      <h1>🧾 Catatan Pesanan</h1>
      <nav>
        {[['order', 'Pesanan'], ['menu', 'Menu'], ['report', 'Laporan']].map(([k, label]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>
        ))}
      </nav>
      {msg && <div className="msg">{msg}</div>}
      {tab === 'order' && <Order menu={menu} loading={loading} flash={flash} />}
      {tab === 'menu' && <MenuManager menu={menu} reload={reload} flash={flash} />}
      {tab === 'report' && <Report flash={flash} />}
    </main>
  );
}

function Order({ menu, loading, flash }) {
  const [cart, setCart] = useState({});
  const [customer, setCustomer] = useState('');

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
    const backup = { cart, customer };
    setCart({}); setCustomer('');
    flash('Menyimpan…');
    try {
      await api('/api/orders', { method: 'POST', body: { customer: backup.customer, items } });
      flash('Pesanan tersimpan ✔');
    } catch (e) {
      setCart(backup.cart); setCustomer(backup.customer);
      flash('Gagal menyimpan: ' + e.message);
    }
  };

  if (!menu.length)
    return <p className="muted">{loading ? 'Memuat menu…' : 'Belum ada menu. Tambahkan dulu di tab Menu.'}</p>;
  return (
    <div>
      <div className="grid">
        {menu.map((m) => (
          <div className="card row" key={m.id}>
            <div className="row" style={{ justifyContent: 'flex-start' }}>
              <Thumb src={imgUrl(m)} />
              <div><b>{m.name}</b><div className="muted">{rp(m.price)}</div></div>
            </div>
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
          <button className="primary" onClick={save}>Simpan Pesanan</button>
        </div>
      </div>
    </div>
  );
}

function MenuManager({ menu, reload, flash }) {
  const empty = { id: null, name: '', price: '', image: null };
  const [f, setF] = useState(empty);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const image = await resizeImage(file);
      setF((p) => ({ ...p, image }));
    } catch (err) { flash(err.message); }
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      const body = { name: f.name, price: Number(f.price) };
      if (!f.image) body.image = null;                       // tanpa gambar / gambar dihapus
      else if (f.image.startsWith('data:')) body.image = f.image; // gambar baru
      // selain itu: gambar lama tidak diubah (tidak dikirim)
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
      <form className="mform card" onSubmit={submit}>
        <div className="row" style={{ justifyContent: 'flex-start' }}>
          <Thumb src={f.image} />
          <input type="file" accept="image/*" onChange={pick} />
          {f.image && <button type="button" className="danger" onClick={() => setF({ ...f, image: null })}>Hapus gambar</button>}
        </div>
        <input placeholder="Nama menu" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        <input placeholder="Harga" type="number" min="0" step="1" inputMode="numeric" value={f.price}
          onChange={(e) => setF({ ...f, price: e.target.value })} required />
        <div className="row">
          <button className="primary" type="submit" style={{ flex: 1 }}>{f.id ? 'Simpan perubahan' : 'Tambah menu'}</button>
          {f.id && <button type="button" onClick={() => setF(empty)}>Batal edit</button>}
        </div>
      </form>
      {menu.map((m) => (
        <div className="card row" key={m.id}>
          <div className="row" style={{ justifyContent: 'flex-start' }}>
            <Thumb src={imgUrl(m)} />
            <div><b>{m.name}</b><div className="muted">{rp(m.price)}</div></div>
          </div>
          <div className="row">
            <button onClick={() => { setF({ id: m.id, name: m.name, price: String(m.price), image: imgUrl(m) }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>
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
      foot: [['TOTAL', summary.reduce((a, s) => a + s.qty, 0), rp(grand)]],
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

  const h2 = { fontSize: 17, margin: '20px 2px 8px' };

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
          <h2 style={h2}>💰 Penghasilan</h2>
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
          <button className="primary" disabled={!orders.length} onClick={pdfIncome}>📄 Cetak PDF Penghasilan</button>

          <h2 style={h2}>🛒 Modal</h2>
          <form className="mform card" onSubmit={addCapital}>
            <input list="modal-names" placeholder="Nama modal (mis. Puding, Ikan mas)" value={m.name}
              onChange={(e) => setName(e.target.value)} required />
            <datalist id="modal-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
            <input placeholder="Harga modal per satuan" type="number" min="0" step="1" inputMode="numeric"
              value={m.price} onChange={(e) => setM({ ...m, price: e.target.value })} required />
            <div className="row">
              <div className="row">
                <button type="button" onClick={() => setM((p) => ({ ...p, qty: Math.max(1, p.qty - 1) }))}>−</button>
                <input type="number" min="1" step="1" inputMode="numeric" value={m.qty} style={{ width: 80, textAlign: 'center' }}
                  onChange={(e) => setM((p) => ({ ...p, qty: Math.max(1, parseInt(e.target.value) || 1) }))} />
                <button type="button" onClick={() => setM((p) => ({ ...p, qty: p.qty + 1 }))}>+</button>
              </div>
              <input type="date" value={m.date} style={{ width: 'auto' }} onChange={(e) => setM({ ...m, date: e.target.value })} />
            </div>
            <div className="row">
              <b>Total: {rp((Number(m.price) || 0) * m.qty)}</b>
              <button className="primary" type="submit">Tambah Modal</button>
            </div>
          </form>
          {capital.map((c) => (
            <div className="card row" key={c.id}>
              <div>
                <b>{c.name}</b>
                <div className="muted">{c.qty} × {rp(c.unit_price)} · {dmy(c.spent_on)}</div>
              </div>
              <div className="row">
                <b>{rp(c.total)}</b>
                <button className="danger" onClick={() => removeCapital(c)}>Hapus</button>
              </div>
            </div>
          ))}
          <div className="card row"><b>Total modal</b><b>{rp(modalTotal)}</b></div>
          <button className="primary" disabled={!capital.length} onClick={pdfModal}>📄 Cetak PDF Modal</button>

          <h2 style={h2}>📊 Laba / Rugi</h2>
          <div className="card">
            <div className="row"><span>Penghasilan</span><span>{rp(grand)}</span></div>
            <div className="row"><span>Modal</span><span>− {rp(modalTotal)}</span></div>
            <div className="row" style={{ marginTop: 8, color: profit >= 0 ? '#1f7a50' : '#c0392b' }}>
              <b>{profit >= 0 ? 'Laba bersih' : 'Rugi'}</b><b>{rp(Math.abs(profit))}</b>
            </div>
          </div>
          <button className="primary" onClick={pdfProfit}>📄 Cetak PDF Laba/Rugi</button>

          <h2 style={h2}>🧾 Daftar Pesanan</h2>
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
