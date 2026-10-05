import { sql, init, fail, parseMenu } from '@/lib/db';
export const dynamic = 'force-dynamic';

export async function PUT(req, { params }) {
  try {
    await init();
    const { name, price } = parseMenu(await req.json());
    const rows = await sql`UPDATE menu SET name = ${name}, price = ${price} WHERE id = ${Number(params.id)} RETURNING id, name, price`;
    if (!rows.length) return fail('Menu tidak ditemukan', 404);
    return Response.json(rows[0]);
  } catch (e) { return fail(e, 400); }
}

export async function DELETE(_req, { params }) {
  try {
    await init();
    await sql`DELETE FROM menu WHERE id = ${Number(params.id)}`;
    return Response.json({ ok: true });
  } catch (e) { return fail(e); }
}
