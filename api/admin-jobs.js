import Stripe from 'stripe';
import { readJobs } from './_lib.js';

const REPORTS_API_URL = process.env.BRIEFINTEL_REPORTS_API_URL || 'https://reports.getbriefintel.com/reports';
const REPORTS_ORDERS_URL = process.env.BRIEFINTEL_REPORTS_ORDERS_URL || 'https://reports.getbriefintel.com/pipeline/orders';
const REPORTS_IGNORED_URL = process.env.BRIEFINTEL_REPORTS_IGNORED_URL || 'https://reports.getbriefintel.com/pipeline/ignored';

async function fetchJson(url, adminKey) {
  try {
    const r = await fetch(url, { headers: { 'x-admin-key': adminKey } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

function normFromPi(pi) {
  const m = pi.metadata || {};
  return {
    id: pi.id,
    createdAt: new Date((pi.created || 0) * 1000).toISOString(),
    paid_at: new Date((pi.created || 0) * 1000).toISOString(),
    status: pi.status === 'succeeded' ? 'paid' : pi.status,
    brief_id: m.brief_id || null,
    tipo_reporte: m.tipo || null,
    empresa_nombre: m.empresa || null,
    empresa_web: m.web || null,
    customer_email: m.email || pi.receipt_email || null,
    amount_total: pi.amount_received || pi.amount || 0,
    currency: pi.currency || 'eur',
    payment_intent: pi.id,
  };
}

export default async function handler(req, res) {
  const { secret } = req.query;
  const ADMIN_SECRET = process.env.BRIEFINTEL_ADMIN_SECRET;
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) return res.status(404).json({ error: 'Not found' });

  try {
    const localJobs = await readJobs();
    let stripeJobs = [];

    if (process.env.STRIPE_SECRET_KEY) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
      const pis = await stripe.paymentIntents.list({ limit: 100 });
      stripeJobs = (pis.data || [])
        .filter((pi) => {
          if (pi.status !== 'succeeded') return false;
          if (!String((pi.metadata || {}).source || '').startsWith('briefintel')) return false;
          const sinceIso = process.env.BRIEFINTEL_DASHBOARD_SINCE_ISO;
          if (sinceIso) {
            const sinceTs = new Date(sinceIso).getTime();
            const piTs = (pi.created || 0) * 1000;
            if (piTs < sinceTs) return false;
          }
          return true;
        })
        .map(normFromPi);
    }

    const reportsAdminKey = process.env.BRIEFINTEL_REPORTS_ADMIN_KEY || process.env.BRIEFINTEL_ADMIN_KEY || ADMIN_SECRET;
    const reportsPayload = await fetchJson(REPORTS_API_URL, reportsAdminKey);
    const ordersPayload = await fetchJson(REPORTS_ORDERS_URL, reportsAdminKey);
    const ignoredPayload = await fetchJson(REPORTS_IGNORED_URL, reportsAdminKey);
    const reports = Array.isArray(reportsPayload?.reports) ? reportsPayload.reports : [];
    const orders = Array.isArray(ordersPayload?.orders) ? ordersPayload.orders : [];
    const ignoredPIs = Array.isArray(ignoredPayload?.ignoredPIs) ? ignoredPayload.ignoredPIs : [];
    const ignoreBeforeDate = ignoredPayload?.ignoreBeforeDate ? new Date(ignoredPayload.ignoreBeforeDate).getTime() : null;

    // Filter out ignored PIs (by list or by date)
    stripeJobs = stripeJobs.filter((j) => {
      if (ignoredPIs.includes(j.payment_intent)) return false;
      if (ignoreBeforeDate && new Date(j.paid_at || j.createdAt || 0).getTime() < ignoreBeforeDate) return false;
      return true;
    });

    const map = new Map();
    for (const j of localJobs || []) map.set(j.payment_intent || j.id, j);
    for (const j of stripeJobs || []) map.set(j.payment_intent || j.id, { ...(map.get(j.payment_intent || j.id) || {}), ...j });

    let jobs = Array.from(map.values()).map((j) => {
      const key = j.payment_intent || j.id;
      const r = reports.find((x) => (x.payment_intent && x.payment_intent === key) || (x.brief_id && j.brief_id && x.brief_id === j.brief_id));
      const o = orders.find((x) => x.payment_intent === key);

      const pipeline_state = o?.pipeline_state
        || (r?.feedbackAt ? 'feedback' : null)
        || (r?.firstDownloadAt ? 'downloaded' : null)
        || (r?.deliveredAt ? 'sent' : null)
        || 'waiting_generation';

      return {
        ...j,
        ...(o || {}),
        delivered_at: o?.sent_at || r?.deliveredAt || null,
        downloaded_at: o?.downloaded_at || r?.firstDownloadAt || null,
        feedback_at: o?.feedback_at || r?.feedbackAt || null,
        feedback: r?.feedback || null,
        pipeline_state,
        can_send_test_now: Boolean(o?.generated_at && !o?.sent_at),
        pack_tokens: o?.pack_tokens || null,
      };
    });

    jobs.sort((a, b) => new Date(b.paid_at || b.createdAt || 0) - new Date(a.paid_at || a.createdAt || 0));
    return res.status(200).json({ jobs });
  } catch {
    return res.status(500).json({ error: 'Internal error' });
  }
}
