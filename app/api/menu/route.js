import { sql, init, fail, parseMenu } from '@/lib/db';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await init();
    return Response.json(await sql`SELECT id, name, price FROM menu ORDER BY name`);
  } catch (e) { return fail(e); }
}

export async function POST(req) {
  try {
    await init();
    const { name, price } = parseMenu(await req.json());
    const rows = await sql`INSERT INTO menu (name, price) VALUES (${name}, ${price}) RETURNING id, name, price`;
    return Response.json(rows[0], { status: 201 });
  } catch (e) { return fail(e, 400); }
}
