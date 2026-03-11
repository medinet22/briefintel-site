// Admin PDF preview proxy — serves PDF without triggering client download tracking
// Requires admin secret; proxies to reports server /admin-preview/:token

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret');
  const token = url.searchParams.get('token');

  if (!secret || secret !== process.env.BRIEFINTEL_ADMIN_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!token) return new Response('Missing token', { status: 400 });

  const reportsUrl = `${process.env.BRIEFINTEL_REPORTS_API_URL}/admin-preview/${encodeURIComponent(token)}`;
  const upstream = await fetch(reportsUrl, {
    headers: { 'x-admin-key': process.env.BRIEFINTEL_REPORTS_ADMIN_KEY },
  });

  if (!upstream.ok) return new Response('Report not found', { status: 404 });

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="preview.pdf"',
      'Cache-Control': 'no-store',
    },
  });
}
