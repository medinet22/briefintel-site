import fs from 'fs/promises';
import { randomUUID, createHash } from 'crypto';
import Stripe from 'stripe';
import { appendOpsEvent, readBriefs } from './_lib.js';

const BRIEFS_FILE = '/tmp/briefs.json';
const MAX_BRIEFS = 500;
const MAX_TEXT = 2000;

const REPORT_TYPES = new Set([
  'competitor-intel',
  'market-entry',
  'buyer-intel',
  'talent-market',
  'pack',
]);

const REPORT_CONFIG = {
  'competitor-intel': { name: 'Competitor Intel', price: 3500 },
  'market-entry': { name: 'Market Entry Brief', price: 4900 },
  'talent-market': { name: 'Talent Market Intel', price: 1900 },
  'buyer-intel': { name: 'Buyer Intel · M&A', price: 5900 },
  'pack': { name: 'Pack Estratégico Completo (4 reportes)', price: 11900 },
};

const REQUIRED_FIELDS = ['tipo_reporte', 'empresa_nombre', 'empresa_web', 'sector', 'decision', 'email'];

function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(payload));
}

function cleanText(value, max = 300) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanTextarea(value) {
  return String(value || '').trim().slice(0, MAX_TEXT);
}

function normalizeUrl(raw) {
  const val = String(raw || '').trim();
  if (!val) return '';
  const withProto = /^https?:\/\//i.test(val) ? val : `https://${val}`;
  try {
    const u = new URL(withProto);
    if (!['http:', 'https:'].includes(u.protocol)) return '';
    return u.toString().slice(0, 500);
  } catch {
    return '';
  }
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim().toLowerCase());
}

async function saveBrief(brief) {
  const current = await readBriefs();
  const next = [brief, ...current].slice(0, MAX_BRIEFS);
  const tmpFile = `${BRIEFS_FILE}.tmp`;
  await fs.writeFile(tmpFile, JSON.stringify(next, null, 2), 'utf8');
  await fs.rename(tmpFile, BRIEFS_FILE);
}

function buildBriefSummary(record) {
  return [
    `brief_id=${record.id}`,
    `tipo=${record.tipo_reporte}`,
    `empresa=${record.empresa_nombre}`,
    `sujeto=${record.sujeto_nombre}`,
    `decision=${record.decision.slice(0, 120)}`,
    `email_hash=${record.email_hash}`,
  ].join(' | ');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://getbriefintel.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });

  try {
    const body = req.body || {};

    const payload = {
      tipo_reporte: cleanText(body.tipo_reporte, 80),
      empresa_nombre: cleanText(body.empresa_nombre, 120),
      empresa_web: normalizeUrl(body.empresa_web),
      sector: cleanText(body.sector, 80),
      tamano: cleanText(body.tamano, 40),
      sujeto_nombre: cleanText(body.sujeto_nombre, 160),
      sujeto_web: normalizeUrl(body.sujeto_web),
      decision: cleanTextarea(body.decision),
      preguntas_clave: cleanTextarea(body.preguntas_clave),
      email: cleanText(body.email || body._replyto, 160).toLowerCase(),
      session_id: cleanText(body.session_id, 120),
      consent: Boolean(body.consent),
    };

    const missing = REQUIRED_FIELDS.filter((field) => !payload[field]);
    if (missing.length) {
      return json(res, 400, {
        ok: false,
        error: 'Faltan campos obligatorios para procesar el brief.',
        fields: missing,
      });
    }

    if (!REPORT_TYPES.has(payload.tipo_reporte)) {
      return json(res, 400, { ok: false, error: 'Tipo de reporte inválido.' });
    }

    if (!isEmail(payload.email)) {
      return json(res, 400, { ok: false, error: 'El email no tiene un formato válido.' });
    }

    const now = new Date().toISOString();
    const briefId = randomUUID();
    const emailHash = createHash('sha256').update(payload.email).digest('hex').slice(0, 16);

    const record = {
      id: briefId,
      createdAt: now,
      source: 'brief_form_v1',
      ...payload,
      email_hash: emailHash,
      ip_hint: cleanText(req.headers['x-forwarded-for'] || '', 80),
      ua: cleanText(req.headers['user-agent'] || '', 240),
    };

    await saveBrief(record);

    await appendOpsEvent({
      type: 'brief_received',
      severity: 'info',
      summary: buildBriefSummary(record),
      payload: {
        brief_id: record.id,
        tipo_reporte: record.tipo_reporte,
        empresa_nombre: record.empresa_nombre,
        sujeto_nombre: record.sujeto_nombre,
        email_hash: record.email_hash,
      },
    });

    let checkoutUrl = null;
    if (process.env.STRIPE_SECRET_KEY) {
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
        const config = REPORT_CONFIG[record.tipo_reporte];
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          mode: 'payment',
          line_items: [{
            price_data: {
              currency: 'eur',
              product_data: {
                name: `BriefIntel — ${config.name}`,
                description: `Brief #${record.id.slice(0, 8)} · ${record.empresa_nombre}`,
              },
              unit_amount: config.price,
            },
            quantity: 1,
          }],
          customer_email: record.email,
          metadata: {
            brief_id: record.id,
            tipo: record.tipo_reporte,
            empresa: record.empresa_nombre,
            web: record.empresa_web || '',
            sujeto: record.sujeto_nombre,
            decision: (record.decision || '').slice(0, 500),
            preguntas: (record.preguntas_clave || '').slice(0, 500),
          },
          invoice_creation: { enabled: true },
          success_url: `https://getbriefintel.com/gracias?session_id={CHECKOUT_SESSION_ID}&tipo=${encodeURIComponent(record.tipo_reporte)}`,
          cancel_url: `https://getbriefintel.com/brief?tipo=${encodeURIComponent(record.tipo_reporte)}`,
          locale: 'es',
        });
        checkoutUrl = session.url;
      } catch (stripeErr) {
        await appendOpsEvent({
          type: 'checkout_create_failed',
          severity: 'warn',
          summary: `brief_id=${record.id} | ${String(stripeErr?.message || stripeErr).slice(0, 180)}`,
          payload: { brief_id: record.id, tipo: record.tipo_reporte },
        });
      }
    }

    return json(res, 200, {
      ok: true,
      brief_id: briefId,
      message: checkoutUrl
        ? 'Brief recibido. Redirigiendo a pago seguro.'
        : 'Brief recibido correctamente. Te contactamos para completar el pago.',
      checkout_url: checkoutUrl,
      next: '/gracias',
    });
  } catch (error) {
    console.error('brief api error:', error?.message || error);
    return json(res, 500, {
      ok: false,
      error: 'No pudimos guardar el brief ahora mismo. Reintenta en 1 minuto o escribe a hello@getbriefintel.com.',
    });
  }
}
