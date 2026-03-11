export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { secret, payment_intent } = req.body || {};
  const ADMIN_SECRET = process.env.BRIEFINTEL_ADMIN_SECRET;
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) return res.status(404).json({ error: 'Not found' });
  if (!payment_intent) return res.status(400).json({ error: 'payment_intent required' });

  const reportsUrl = process.env.BRIEFINTEL_REPORTS_DELIVER_URL || 'https://reports.getbriefintel.com/deliver-test';
  const reportsAdminKey = process.env.BRIEFINTEL_REPORTS_ADMIN_KEY || process.env.BRIEFINTEL_ADMIN_KEY || ADMIN_SECRET;

  try {
    const r = await fetch(reportsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': reportsAdminKey,
      },
      body: JSON.stringify({ payment_intent }),
    });

    const text = await r.text();
    let data = {};
    try { data = JSON.parse(text || '{}'); } catch { data = { raw: text }; }

    if (!r.ok) return res.status(r.status).json({ error: data.error || 'deliver failed', details: data });
    return res.status(200).json({ ok: true, ...data });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'deliver proxy failed' });
  }
}
