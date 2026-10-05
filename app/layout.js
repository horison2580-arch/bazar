import './globals.css';

export const metadata = { title: 'Bazar', description: 'Pencatatan pesanan & laporan penjualan' };

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
