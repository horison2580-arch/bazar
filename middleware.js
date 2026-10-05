import { NextResponse } from 'next/server';

// Opsional: jika env APP_PASSWORD diisi, seluruh web diminta password (username bebas)
export function middleware(req) {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return NextResponse.next();
  const b64 = (req.headers.get('authorization') || '').split(' ')[1];
  if (b64) {
    const decoded = atob(b64);
    if (decoded.slice(decoded.indexOf(':') + 1) === pw) return NextResponse.next();
  }
  return new Response('Login diperlukan', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Warung"' },
  });
}
