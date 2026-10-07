import { sql, init, fail } from '@/lib/db';
export const dynamic = 'force-dynamic';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const todayWIB = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

export async function GET(req) {
  try {
    await init();
    const sp = new URL(req.url).searchParams;
    const from = sp.get('from') || todayWIB();
    const to = sp.get('to') || from;
    if (!DATE.test(from) || !DATE.test(to)) return fail('Format tanggal salah', 400);
    const rows = await sql`
      SELECT id, name, unit_price, qty, total, to_char(spent_on, 'YYYY-MM-DD') AS spent_on
      FROM capital
      WHERE spent_on BETWEEN ${from}::date AND ${to}::date
      ORDER BY spent_on DESC, id DESC`;
    return Response.json(rows);
  } catch (e) { return fail(e); }
}

export async function POST(req) {
  try {
    await init();
    const b = await req.json();
    const name = String(b.name ?? '').trim();
    const unit = Number(b.unit_price);
    const qty = Number(b.qty);
    const date = DATE.test(b.spent_on) ? b.spent_on : todayWIB();
    if (!name || name.length > 100) throw new Error('Nama modal wajib diisi (maks 100 karakter)');
    if (!Number.isInteger(unit) || unit < 0) throw new Error('Harga modal harus bilangan bulat >= 0');
    if (!Number.isInteger(qty) || qty < 1) throw new Error('Jumlah minimal 1');
    if (unit * qty > 2000000000) throw new Error('Total terlalu besar');
    const rows = await sql`
      INSERT INTO capital (name, unit_price, qty, total, spent_on)
      VALUES (${name}, ${unit}, ${qty}, ${unit * qty}, ${date}::date)
      RETURNING id`;
    return Response.json(rows[0], { status: 201 });
  } catch (e) { return fail(e, 400); }
}

export async function DELETE(req) {
  try {
    await init();
    const id = Number(new URL(req.url).searchParams.get('id'));
    if (!Number.isInteger(id)) return fail('ID tidak valid', 400);
    await sql`DELETE FROM capital WHERE id = ${id}`;
    return Response.json({ ok: true });
  } catch (e) { return fail(e); }
}
