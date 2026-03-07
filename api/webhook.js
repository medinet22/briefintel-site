import Stripe from 'stripe';
import { Resend } from 'resend';
import { appendOpsEvent, readBriefs, appendJob } from './_lib.js';

const REPORT_NAMES = {
  'competitor-intel': 'Competitor Intelligence',
  'market-entry': 'Market Entry',
  'buyer-intel': 'Buyer Intelligence',
  'talent-market': 'Talent Intelligence',
  'pack': 'Pack Estratégico Completo',
};

async function sendConfirmationEmail(job) {
  if (!process.env.RESEND_API_KEY || !job.customer_email) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const reportName = REPORT_NAMES[job.tipo_reporte] || job.tipo_reporte;
  await resend.emails.send({
    from: 'BriefIntel <d@negoia.com>',
    to: job.customer_email,
    subject: `✅ Pedido confirmado — ${reportName} para ${job.empresa_nombre}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#0f172a;color:#f1f5f9;border-radius:12px;">
        <h1 style="color:#f59e0b;font-size:24px;margin-bottom:8px;">BriefIntel</h1>
        <h2 style="font-size:20px;margin-bottom:16px;">Pedido recibido ✅</h2>
        <p style="color:#94a3b8;margin-bottom:24px;">
          Hemos recibido tu pedido de <strong style="color:#f1f5f9;">${reportName}</strong> para <strong style="color:#f1f5f9;">${job.empresa_nombre}</strong>.
        </p>
        <div style="background:#1e293b;border-radius:8px;padding:20px;margin-bottom:24px;">
          <p style="margin:0 0 8px;color:#94a3b8;font-size:14px;">📋 Nº de pedido: <strong style="color:#f1f5f9;">${job.id?.slice(0,16) || 'N/A'}</strong></p>
          <p style="margin:0 0 8px;color:#94a3b8;font-size:14px;">📊 Reporte: <strong style="color:#f1f5f9;">${reportName}</strong></p>
          <p style="margin:0;color:#94a3b8;font-size:14px;">⏱️ Entrega estimada: <strong style="color:#f59e0b;">menos de 24 horas</strong></p>
        </div>
        <p style="color:#94a3b8;font-size:14px;">Recibirás el reporte en este email cuando esté listo. Si tienes alguna duda, responde a este email.</p>
        <p style="color:#475569;font-size:12px;margin-top:32px;">BriefIntel · getbriefintel.com · Garantía de devolución 7 días</p>
      </div>
    `,
  });
}

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method not allowed');

  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    console.error('STRIPE_WEBHOOK_SECRET not set');
    return res.status(500).end('Webhook secret missing');
  }

  let event;
  try {
    const rawBody = await getRawBody(req);
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).end(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const meta = session.metadata || {};

    const job = {
      id: session.id,
      createdAt: new Date().toISOString(),
      status: 'queued',
      brief_id: meta.brief_id || null,
      tipo_reporte: meta.tipo || null,
      empresa_nombre: meta.empresa || null,
      empresa_web: meta.web || null,
      decision: meta.decision || null,
      preguntas: meta.preguntas || null,
      customer_email: session.customer_email || null,
      amount_total: session.amount_total,
      currency: session.currency,
      payment_intent: session.payment_intent,
    };

    await appendJob(job);

    await appendOpsEvent({
      type: 'payment_confirmed',
      severity: 'info',
      summary: `brief_id=${job.brief_id} | empresa=${job.empresa_nombre} | tipo=${job.tipo_reporte} | €${(job.amount_total / 100).toFixed(2)}`,
      payload: job,
    });

    // Email de confirmación al cliente
    await sendConfirmationEmail(job).catch(e => console.error('Email cliente failed:', e.message));

    // Notificación a Dani
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: 'BriefIntel <d@negoia.com>',
        to: 'd@negoia.com',
        subject: `🛒 Nuevo pedido — ${REPORT_NAMES[job.tipo_reporte] || job.tipo_reporte} · ${job.empresa_nombre}`,
        html: `<pre style="font-family:monospace">${JSON.stringify(job, null, 2)}</pre>`,
      }).catch(e => console.error('Email Dani failed:', e.message));
    }

    console.log('✅ Pago confirmado:', job.empresa_nombre, job.tipo_reporte);
  }

  res.status(200).json({ received: true });
}
