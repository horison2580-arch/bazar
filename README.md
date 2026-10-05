# Catatan Pesanan (Next.js + Neon Postgres)

## Deploy ke Vercel (gratis)
1. Upload folder ini ke GitHub, lalu **Import** repo di vercel.com.
2. Di project Vercel: tab **Storage** (atau Marketplace) -> **Neon Postgres** -> pilih plan **Free** -> hubungkan ke project.
   Vercel otomatis mengisi env `DATABASE_URL`.
3. (Disarankan) Settings -> Environment Variables -> tambah `APP_PASSWORD` (password untuk membuka web).
4. Redeploy. Tabel dibuat otomatis saat web pertama kali dibuka.

## Jalan lokal
npm install
vercel link && vercel env pull .env.local
npm run dev
