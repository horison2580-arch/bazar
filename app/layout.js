import './globals.css';

export const metadata = { title: 'Catatan Pesanan', description: 'Pencatatan pesanan & laporan penjualan' };

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
