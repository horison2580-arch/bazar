import { sql, init, fail } from '@/lib/db';
export const dynamic = 'force-dynamic';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const todayWIB = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

// GET /api/orders?from=YYYY-MM-DD&to=YYYY-MM-DD  (default: hari ini, zona WIB)
export async function GET(req) {
  try {
    await init();
    const sp = new URL(req.url).searchParams;
    const from = sp.get('from') || todayWIB();
    const to = sp.get('to') || from;
    if (!DATE.test(from) || !DATE.test(to)) return fail('Format tanggal salah', 400);
    const rows = await sql`
      SELECT id, created_at, customer, items, total FROM orders
      WHERE (created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN ${from}::date AND ${to}::date
      ORDER BY created_at DESC`;
    return Response.json(rows);
  } catch (e) { return fail(e); }
}

// POST {customer, items:[{id, qty}]} -> harga diambil dari database (bukan dari klien)
export async function POST(req) {
  try {
    await init();
    const body = await req.json();
    const reqItems = Array.isArray(body.items) ? body.items : [];
    const ids = reqItems.map((i) => Number(i.id));
    if (!ids.length) return fail('Pesanan kosong', 400);
    const menu = await sql`SELECT id, name, price FROM menu WHERE id = ANY(${ids}::int[])`;
    const lines = [];
    for (const i of reqItems) {
      const m = menu.find((x) => x.id === Number(i.id));
      const qty = Number(i.qty);
      if (!m || !Number.isInteger(qty) || qty < 1) return fail('Item pesanan tidak valid', 400);
      lines.push({ name: m.name, price: m.price, qty });
    }
    const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
    const customer = String(body.customer || '').trim().slice(0, 100) || null;
    const rows = await sql`
      INSERT INTO orders (customer, items, total)
      VALUES (${customer}, ${JSON.stringify(lines)}::jsonb, ${total})
      RETURNING id, created_at, customer, items, total`;
    return Response.json(rows[0], { status: 201 });
  } catch (e) { return fail(e, 400); }
}

// DELETE /api/orders?id=123  (hapus pesanan yang salah catat)
export async function DELETE(req) {
  try {
    await init();
    const id = Number(new URL(req.url).searchParams.get('id'));
    if (!Number.isInteger(id)) return fail('ID tidak valid', 400);
    await sql`DELETE FROM orders WHERE id = ${id}`;
    return Response.json({ ok: true });
  } catch (e) { return fail(e); }
}
