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
        {menu.map((m) =>
