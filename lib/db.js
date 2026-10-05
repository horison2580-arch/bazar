import { neon } from '@neondatabase/serverless';

export const sql = (...args) => neon(process.env.DATABASE_URL)(...args);

let ready;
export function init() {
  ready ||= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS menu (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL CHECK (price >= 0))`;
    await sql`ALTER TABLE menu ADD COLUMN IF NOT EXISTS image TEXT`;
    await sql`CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      customer TEXT,
      items JSONB NOT NULL,
      total INTEGER NOT NULL)`;
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

export const fail = (e, status = 500) =>
  Response.json({ error: e?.message || String(e) }, { status });

export function parseMenu(b) {
  const name = String(b?.name ?? '').trim();
  const price = Number(b?.price);
  let image = b?.image ?? null;
  if (!name || name.length > 100) throw new Error('Nama menu wajib diisi (maks 100 karakter)');
  if (!Number.isInteger(price) || price < 0) throw new Error('Harga harus bilangan bulat >= 0');
  if (image !== null && (typeof image !== 'string' || !image.startsWith('data:image/') || image.length > 300000))
    throw new Error('Gambar tidak valid atau terlalu besar');
  return { name, price, image };
}
