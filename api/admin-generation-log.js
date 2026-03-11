const PIPELINE_URL = process.env.BRIEFINTEL_REPORTS_PIPELINE_ORDERS_URL || 'https://reports.getbriefintel.com/pipeline/orders';

export default async function handler(req, res) {
  const secret = (req.query && req.query.secret) || (req.body && req.body.secret);
  const ADMIN_SECRET = process.env.BRIEFINTEL_ADMIN_SECRET;
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) return res.status(404).json({ error: 'Not found' });

  const reportsAdminKey = process.env.BRIEFINTEL_REPORTS_ADMIN_KEY || process.env.BRIEFINTEL_ADMIN_KEY || ADMIN_SECRET;

  try {
    const r = await fetch(PIPELINE_URL, { headers: { 'x-admin-key': reportsAdminKey } });
    const text = await r.text();
    let data = {};
    try { data = JSON.parse(text || '{}'); } catch { data = {}; }
    if (!r.ok) return res.status(r.status).json({ error: data.error || 'pipeline fetch failed' });

    const orders = Array.isArray(data.orders) ? data.orders : [];
    const rows = orders.map((o) => ({
      payment_intent: o.payment_intent || null,
      brief_id: o.brief_id || null,
      empresa_nombre: o.empresa_nombre || null,
      empresa_web: o.empresa_web || null,
      customer_email: o.customer_email || null,
      tipo_reporte: o.tipo_reporte || null,
      queued_at: o.queued_at || null,
      generated_at: o.generated_at || null,
      qa_passed_at: o.qa_passed_at || null,
      sent_at: o.sent_at || null,
      pipeline_state: o.pipeline_state || null,
      generation_error: o.generation_error || null,
      report_token: o.report_token || null,
      report_url: o.report_token ? `https://reports.getbriefintel.com/r/${encodeURIComponent(o.report_token)}` : null,
      generation_events: Array.isArray(o.generation_events) ? o.generation_events : [],
    })).sort((a,b)=> new Date(b.queued_at||0) - new Date(a.queued_at||0));

    return res.status(200).json({ ok: true, rows });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'internal error' });
  }
}
