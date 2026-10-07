import { sql, init } from '@/lib/db';
export const dynamic = 'force-dynamic';

export async function GET(_req, { params }) {
  try {
    await init();
    const rows = await sql`SELECT image FROM menu WHERE id = ${Number(params.id)}`;
    const m = /^data:(image\/[\w.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(rows[0]?.image || '');
    if (!m) return new Response(null, { status: 404 });
    return new Response(Buffer.from(m[2], 'base64'), {
      headers: { 'Content-Type': m[1], 'Cache-Control': 'private, max-age=31536000, immutable' },
    });
  } catch { return new Response(null, { status: 500 }); }
}
