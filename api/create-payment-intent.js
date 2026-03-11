import Stripe from 'stripe';
import { readBriefs } from './_lib.js';

const REPORT_CONFIG = {
  'competitor-intel': { name: 'Competitor Intel', price: 3500 },
  'market-entry':     { name: 'Market Entry Brief', price: 4900 },
  'talent-market':    { name: 'Talent Market Intel', price: 1900 },
  'buyer-intel':      { name: 'Buyer Intel · M&A', price: 5900 },
  'pack':             { name: 'Pack Estratégico Completo', price: 11900 },
};

function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(payload));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://getbriefintel.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method not allowed' });

  const { brief_id, verify, payment_intent } = req.query || {};

  // Verify mode: just return the publishable key for frontend status check
  if (verify === '1') {
    return json(res, 200, {
      ok: true,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
      payment_intent: payment_intent || null,
    });
  }

  if (!brief_id) return json(res, 400, { ok: false, error: 'brief_id requerido' });

  try {
    // Try to load brief from storage; fall back to URL params (serverless /tmp not shared)
    let brief = null;
    try {
      const briefs = await readBriefs();
      brief = briefs.find(b => b.id === brief_id) || null;
    } catch (_) {}

    // Fallback: reconstruct minimal brief from query params
    if (!brief) {
      const { tipo, empresa, web, email, sujeto, decision, preguntas } = req.query || {};
      if (!tipo || !empresa) return json(res, 404, { ok: false, error: 'Brief no encontrado' });
      brief = { id: brief_id, tipo_reporte: tipo, empresa_nombre: empresa, empresa_web: web || '', email: email || '', sujeto_nombre: sujeto || '', decision: decision || '', preguntas_clave: preguntas || '' };
    }

    const config = REPORT_CONFIG[brief.tipo_reporte];
    if (!config) return json(res, 400, { ok: false, error: 'Tipo de reporte inválido' });

    if (!process.env.STRIPE_SECRET_KEY) {
      return json(res, 500, { ok: false, error: 'Stripe no configurado' });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: config.price,
      currency: 'eur',
      receipt_email: brief.email,
      description: `BriefIntel — ${config.name} · ${brief.empresa_nombre}`,
      metadata: {
        source: 'briefintel-payment-elements-v1',
        brief_id: brief.id,
        tipo: brief.tipo_reporte,
        empresa: brief.empresa_nombre,
        web: (brief.empresa_web || '').slice(0, 500),
        sujeto: (brief.sujeto_nombre || '').slice(0, 500),
        email: brief.email,
        decision: (brief.decision || '').slice(0, 500),
        preguntas: (brief.preguntas_clave || '').slice(0, 500),
      },
      automatic_payment_methods: { enabled: true },
    });

    return json(res, 200, {
      ok: true,
      clientSecret: paymentIntent.client_secret,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
      amount: config.price,
      reportName: config.name,
      empresa: brief.empresa_nombre,
      tipo: brief.tipo_reporte,
      email: brief.email,
    });
  } catch (err) {
    console.error('create-payment-intent error:', err?.message || err);
    return json(res, 500, { ok: false, error: 'Error al crear sesión de pago. Intenta de nuevo.' });
  }
}
