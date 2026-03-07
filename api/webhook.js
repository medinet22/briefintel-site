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

async function notifyTelegram(job) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const topicId = process.env.TELEGRAM_TOPIC_ID;
  if (!token || !chatId) return;

  const reportName = REPORT_NAMES[job.tipo_reporte] || job.tipo_reporte;
  const amount = job.amount_total ? `€${(job.amount_total / 100).toFixed(0)}` : '—';
  const text = `💰 *Nueva compra en BriefIntel*\n\n` +
    `🏢 *Empresa:* ${job.empresa_nombre || '—'}\n` +
    `📊 *Reporte:* ${reportName}\n` +
    `💶 *Importe:* ${amount}\n` +
    `📧 *Email:* ${job.customer_email || '—'}\n` +
    `🌐 *Web:* ${job.empresa_web || '—'}`;

  const body = { chat_id: chatId, text, parse_mode: 'Markdown' };
  if (topicId) body.message_thread_id = parseInt(topicId);

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function sendConfirmationEmail(job) {
  if (!process.env.RESEND_API_KEY || !job.customer_email) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const reportName = REPORT_NAMES[job.tipo_reporte] || job.tipo_reporte || 'Reporte BriefIntel';
  const companyName = job.empresa_nombre || job.empresa_web || 'tu empresa';
  await resend.emails.send({
    from: 'BriefIntel <hola@getbriefintel.com>',
    to: job.customer_email,
    subject: `✅ Pedido confirmado — ${reportName} para ${companyName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#0f172a;color:#f1f5f9;border-radius:12px;">
        <h1 style="color:#f59e0b;font-size:24px;margin-bottom:8px;">BriefIntel</h1>
        <h2 style="font-size:20px;margin-bottom:16px;">Pedido recibido ✅</h2>
        <p style="color:#94a3b8;margin-bottom:24px;">
          Hemos recibido tu pedido de <strong style="color:#f1f5f9;">${reportName}</strong> para <strong style="color:#f1f5f9;">${companyName}</strong>.
        </p>
        <div style="background:#1e293b;border-radius:8px;padding:20px;margin-bottom:24px;">
          <p style="margin:0 0 8px;color:#94a3b8;font-size:14px;">📋 Nº de pedido: <strong style="color:#f1f5f9;">${job.id?.slice(0,16) || 'N/A'}</strong></p>
          <p style="margin:0 0 8px;color:#94a3b8;font-size:14px;">📊 Reporte: <strong style="color:#f1f5f9;">${reportName}</strong></p>
          <p style="margin:0;color:#94a3b8;font-size:14px;">⏱️ Entrega estimada: <strong style="color:#f59e0b;">menos de 24 horas</strong></p>
        </div>
        <p style="color:#94a3b8;font-size:14px;">Recibirás el reporte en este email cuando esté listo. Si tienes alguna duda, responde a este email.</p>
        <p style="color:#fbbf24;font-size:13px;margin-top:12px;">⚠️ Si no ves nuestros correos, revisa también <strong>Spam / Promociones</strong> y marca este remitente como seguro.</p>
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
    if (process.env.TEST_MODE === 'true') {
      // Skip signature verification in test mode — parse body directly
      event = JSON.parse(rawBody.toString('utf8'));
    } else {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
      event = stripe.webhooks.constructEvent(rawBody, sig, secret);
    }
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
      status: 'paid',
      brief_id: meta.brief_id || null,
      tipo_reporte: meta.tipo || meta.tipo_reporte || null,
      empresa_nombre: meta.empresa || meta.empresa_nombre || null,
      empresa_web: meta.web || meta.empresa_web || null,
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
    await notifyTelegram(job).catch(e => console.error('Telegram notify failed:', e.message));

    // Notificación a Dani
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: 'BriefIntel <hola@getbriefintel.com>',
        to: 'd@negoia.com',
        subject: `🛒 Nuevo pedido — ${REPORT_NAMES[job.tipo_reporte] || job.tipo_reporte} · ${job.empresa_nombre}`,
        html: `<pre style="font-family:monospace">${JSON.stringify(job, null, 2)}</pre>`,
      }).catch(e => console.error('Email Dani failed:', e.message));
    }

    console.log('✅ Pago confirmado:', job.empresa_nombre, job.tipo_reporte);
  }

  res.status(200).json({ received: true });
}
