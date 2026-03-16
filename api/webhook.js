import Stripe from 'stripe';
import { Resend } from 'resend';
import { appendOpsEvent, upsertJob } from './_lib.js';

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
  const orderId = (job.payment_intent || job.id || '').replace('pi_', '').slice(0, 20).toUpperCase();
  const webRow = job.empresa_web ? `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:14px;width:40%;">🌐 Web analizada</td>
            <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-size:14px;color:#1e293b;">${job.empresa_web}</td>
          </tr>` : '';
  const preguntasRow = job.preguntas ? `
          <tr>
            <td style="padding:10px 0;color:#64748b;font-size:14px;vertical-align:top;">💬 Preguntas</td>
            <td style="padding:10px 0;font-size:14px;color:#1e293b;">${job.preguntas}</td>
          </tr>` : '';

  await resend.emails.send({
    from: 'BriefIntel <hola@getbriefintel.com>',
    to: job.customer_email,
    subject: `✅ Pedido confirmado — ${reportName} para ${companyName}`,
    text: `BriefIntel — Pedido recibido ✅\n\nEstamos preparando tu ${reportName} para ${companyName}.\n\nDETALLE DEL PEDIDO\n📋 ID del pedido: ${orderId}\n📊 Tipo de reporte: ${reportName}\n🏢 Empresa: ${companyName}\n${job.empresa_web ? '🌐 Web analizada: ' + job.empresa_web + '\n' : ''}⏱️ Entrega estimada: menos de 24 horas\n\nRecibirás el reporte directamente en este email con un enlace de descarga personal.\n\n⚠️ Si no ves nuestros emails, revisa Spam / Promociones y márcanos como remitente seguro.\n\n¿Tienes algún problema? Escríbenos indicando tu ID de pedido: hola@getbriefintel.com\n\nBriefIntel · getbriefintel.com · Garantía de devolución 7 días`,
    html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#0f172a;padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td><span style="color:#f59e0b;font-size:22px;font-weight:700;letter-spacing:-0.5px;">BriefIntel</span></td>
                <td align="right"><span style="background:#22c55e;color:#ffffff;font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;">PEDIDO CONFIRMADO</span></td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Hero -->
        <tr>
          <td style="padding:32px 32px 24px;">
            <h1 style="margin:0 0 8px;font-size:24px;color:#0f172a;font-weight:700;">Pedido recibido ✅</h1>
            <p style="margin:0;font-size:16px;color:#475569;line-height:1.6;">
              Estamos preparando tu <strong style="color:#0f172a;">${reportName}</strong> para <strong style="color:#0f172a;">${companyName}</strong>.
            </p>
          </td>
        </tr>

        <!-- Order details -->
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;overflow:hidden;">
              <tr>
                <td colspan="2" style="padding:14px 20px;background:#f1f5f9;border-bottom:1px solid #e2e8f0;">
                  <span style="font-size:11px;font-weight:700;letter-spacing:1px;color:#64748b;text-transform:uppercase;">📋 Detalle del pedido</span>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:14px;width:40%;">ID del pedido</td>
                <td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;font-size:14px;font-weight:700;color:#0f172a;font-family:monospace;">${orderId}</td>
              </tr>
              <tr>
                <td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:14px;">📊 Tipo de reporte</td>
                <td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;font-size:14px;font-weight:700;color:#f59e0b;">${reportName}</td>
              </tr>
              <tr>
                <td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:14px;">🏢 Empresa</td>
                <td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;font-size:14px;font-weight:600;color:#0f172a;">${companyName}</td>
              </tr>
              ${webRow}
              <tr>
                <td style="padding:12px 20px;color:#64748b;font-size:14px;">⏱️ Entrega estimada</td>
                <td style="padding:12px 20px;font-size:14px;font-weight:700;color:#22c55e;">menos de 24 horas</td>
              </tr>
              ${preguntasRow}
            </table>
          </td>
        </tr>

        <!-- Info box -->
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0;font-size:14px;color:#78350f;line-height:1.6;">
                    📩 Recibirás el reporte directamente en este email con un <strong>enlace de descarga personal</strong>.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Spam warning -->
        <tr>
          <td style="padding:0 32px 32px;">
            <p style="margin:0 0 16px;font-size:13px;color:#ef4444;">
              ⚠️ Si no ves nuestros emails, revisa <strong>Spam / Promociones</strong> y márcanos como remitente seguro.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">¿Tienes algún problema? Escríbenos indicando tu ID de pedido:</p>
                  <a href="mailto:hola@getbriefintel.com?subject=Pedido%20${orderId}" style="color:#3b82f6;font-size:13px;font-weight:600;">hola@getbriefintel.com</a>
                </td>
              </tr>
              <tr>
                <td style="padding-top:16px;">
                  <p style="margin:0;font-size:11px;color:#cbd5e1;">BriefIntel · <a href="https://getbriefintel.com" style="color:#94a3b8;">getbriefintel.com</a> · Garantía de devolución 7 días</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

async function triggerPostPaymentPipeline(job, source) {
  const url = process.env.BRIEFINTEL_REPORTS_PIPELINE_URL || 'http://localhost:4242/pipeline/payment-succeeded';
  const adminKey = process.env.BRIEFINTEL_REPORTS_ADMIN_KEY || process.env.BRIEFINTEL_ADMIN_KEY || process.env.BRIEFINTEL_ADMIN_SECRET;
  if (!adminKey) return;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
    body: JSON.stringify({
      payment_intent: job.payment_intent || job.id,
      source,
      paid_at: new Date().toISOString(),
      brief_id: job.brief_id || null,
      tipo_reporte: job.tipo_reporte || null,
      empresa_nombre: job.empresa_nombre || null,
      empresa_web: job.empresa_web || null,
      customer_email: job.customer_email || null,
      preguntas: job.preguntas || null,
      decision: job.decision || null,
      amount_total: job.amount_total || null,
      currency: job.currency || null,
    }),
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
      event = JSON.parse(rawBody.toString('utf8'));
    } else {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
      event = stripe.webhooks.constructEvent(rawBody, sig, secret);
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).end(`Webhook Error: ${err.message}`);
  }

  // Handle payment_intent.succeeded (Payment Elements flow — primary)
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    const meta = pi.metadata || {};
    const source = meta.source || '';
    if (!String(source).startsWith('briefintel')) {
      console.log('Ignoring non-BriefIntel payment_intent:', pi.id, source);
      return res.status(200).json({ received: true, ignored: 'non-briefintel-pi' });
    }

    const job = {
      id: pi.id,
      createdAt: new Date().toISOString(),
      status: 'paid',
      brief_id: meta.brief_id || null,
      tipo_reporte: meta.tipo || null,
      empresa_nombre: meta.empresa || null,
      empresa_web: meta.web || null,
      sector: meta.sector || null,
      decision: meta.decision || null,
      preguntas: meta.preguntas || null,
      customer_email: meta.email || pi.receipt_email || null,
      amount_total: pi.amount,
      currency: pi.currency,
      payment_intent: pi.id,
    };

    await upsertJob(job).catch(e => console.error('upsertJob failed (non-critical):', e.message));
    await triggerPostPaymentPipeline(job, source).catch(e => console.error('Pipeline trigger failed:', e.message));

    await appendOpsEvent({
      type: 'payment_confirmed',
      severity: 'info',
      summary: `brief_id=${job.brief_id} | empresa=${job.empresa_nombre} | tipo=${job.tipo_reporte} | €${(job.amount_total / 100).toFixed(2)}`,
      payload: job,
    }).catch(() => {});

    await appendOpsEvent({
      type: 'delivery_pending',
      severity: 'info',
      summary: `brief_id=${job.brief_id} | pago_ok | esperando_entrega | ${job.customer_email || 'sin_email'}`,
      payload: {
        payment_intent: job.id,
        brief_id: job.brief_id,
        tipo_reporte: job.tipo_reporte,
        empresa_nombre: job.empresa_nombre,
        customer_email: job.customer_email,
      },
    }).catch(() => {});

    await sendConfirmationEmail(job).catch(e => console.error('Email cliente failed:', e.message));
    await notifyTelegram(job).catch(e => console.error('Telegram notify failed:', e.message));

    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const reportName = REPORT_NAMES[job.tipo_reporte] || job.tipo_reporte;
      const amount = job.amount_total ? `€${(job.amount_total / 100).toFixed(0)}` : '—';
      const dateStr = new Date().toLocaleString('es-ES', {timeZone:'Europe/Madrid'});
      await resend.emails.send({
        from: 'BriefIntel <hola@getbriefintel.com>',
        to: 'dani.medi.rod8@gmail.com',
        subject: `💰 Nueva compra — ${reportName} · ${job.empresa_nombre} · ${amount}`,
        text: `BriefIntel · Nueva compra\n\n${dateStr}\n\nEmpresa: ${job.empresa_nombre || '—'}\nWeb: ${job.empresa_web || '—'}\nReporte: ${reportName}\nImporte: ${amount}\nEmail cliente: ${job.customer_email || '—'}\n${job.preguntas ? '\nPreguntas del cliente:\n' + job.preguntas + '\n' : ''}\nPI: ${job.id} · Brief: ${job.brief_id || '—'}`,
        html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#0f172a;padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td><span style="color:#f59e0b;font-size:22px;font-weight:700;letter-spacing:-0.5px;">BriefIntel</span></td>
                <td align="right"><span style="background:#22c55e;color:#ffffff;font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;">💰 NUEVA COMPRA</span></td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Hero -->
        <tr>
          <td style="padding:32px 32px 16px;">
            <p style="margin:0;font-size:14px;color:#64748b;">${dateStr}</p>
          </td>
        </tr>

        <!-- Order details -->
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;overflow:hidden;">
              <tr>
                <td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:14px;width:40%;">🏢 Empresa</td>
                <td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;font-size:14px;font-weight:700;color:#0f172a;">${job.empresa_nombre || '—'}</td>
              </tr>
              <tr>
                <td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:14px;">🌐 Web</td>
                <td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f172a;">${job.empresa_web || '—'}</td>
              </tr>
              <tr>
                <td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:14px;">📊 Reporte</td>
                <td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;font-size:14px;font-weight:700;color:#f59e0b;">${reportName}</td>
              </tr>
              <tr>
                <td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:14px;">💶 Importe</td>
                <td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;font-size:16px;font-weight:700;color:#22c55e;">${amount}</td>
              </tr>
              <tr>
                <td style="padding:12px 20px;color:#64748b;font-size:14px;">📧 Email cliente</td>
                <td style="padding:12px 20px;font-size:14px;color:#0f172a;">${job.customer_email || '—'}</td>
              </tr>
            </table>
          </td>
        </tr>

        ${job.preguntas ? `
        <!-- Preguntas del cliente -->
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;">💬 Preguntas del cliente</p>
                  <p style="margin:0;font-size:14px;color:#78350f;line-height:1.5;">${job.preguntas}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        ` : ''}

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:11px;color:#94a3b8;">PI: ${job.id} · Brief: ${job.brief_id || '—'}</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
      }).catch(e => console.error('Email Dani failed:', e.message));
    }

    console.log('✅ PaymentIntent confirmado:', job.empresa_nombre, job.tipo_reporte);
  }

  // Keep backward compat: checkout.session.completed (legacy flow)
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const meta = session.metadata || {};
    const source = meta.source || '';
    if (!String(source).startsWith('briefintel')) {
      console.log('Ignoring non-BriefIntel checkout session:', session.id, source);
      return res.status(200).json({ received: true, ignored: 'non-briefintel-session' });
    }

    if (session.payment_status !== 'paid') {
      console.log('Ignoring non-paid checkout session:', session.id, session.payment_status);
      return res.status(200).json({ received: true, ignored: 'checkout-not-paid' });
    }

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

    await upsertJob(job);
    await triggerPostPaymentPipeline(job, source).catch(() => {});

    await appendOpsEvent({
      type: 'payment_confirmed',
      severity: 'info',
      summary: `brief_id=${job.brief_id} | empresa=${job.empresa_nombre} | tipo=${job.tipo_reporte} | €${(job.amount_total / 100).toFixed(2)}`,
      payload: job,
    });

    await appendOpsEvent({
      type: 'delivery_pending',
      severity: 'info',
      summary: `brief_id=${job.brief_id} | pago_ok | esperando_entrega | ${job.customer_email || 'sin_email'}`,
      payload: {
        session_id: job.id,
        brief_id: job.brief_id,
        tipo_reporte: job.tipo_reporte,
        empresa_nombre: job.empresa_nombre,
        customer_email: job.customer_email,
      },
    });

    await sendConfirmationEmail(job).catch(e => console.error('Email cliente failed:', e.message));
    await notifyTelegram(job).catch(e => console.error('Telegram notify failed:', e.message));

    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const reportName = REPORT_NAMES[job.tipo_reporte] || job.tipo_reporte;
      const amount = job.amount_total ? `€${(job.amount_total / 100).toFixed(0)}` : '—';
      const dateStr = new Date().toLocaleString('es-ES', {timeZone:'Europe/Madrid'});
      await resend.emails.send({
        from: 'BriefIntel <hola@getbriefintel.com>',
        to: 'dani.medi.rod8@gmail.com',
        subject: `💰 Nueva compra — ${reportName} · ${job.empresa_nombre} · ${amount}`,
        text: `BriefIntel · Nueva compra\n\n${dateStr}\n\nEmpresa: ${job.empresa_nombre || '—'}\nWeb: ${job.empresa_web || '—'}\nReporte: ${reportName}\nImporte: ${amount}\nEmail cliente: ${job.customer_email || '—'}\n${job.preguntas ? '\nPreguntas del cliente:\n' + job.preguntas + '\n' : ''}\nJob ID: ${job.id || '—'} · Brief ID: ${job.brief_id || '—'}`,
        html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#0f172a;padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td><span style="color:#f59e0b;font-size:22px;font-weight:700;letter-spacing:-0.5px;">BriefIntel</span></td>
                <td align="right"><span style="background:#22c55e;color:#ffffff;font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;">💰 NUEVA COMPRA</span></td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Hero -->
        <tr>
          <td style="padding:32px 32px 16px;">
            <p style="margin:0;font-size:14px;color:#64748b;">${dateStr}</p>
          </td>
        </tr>

        <!-- Order details -->
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;overflow:hidden;">
              <tr>
                <td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:14px;width:40%;">🏢 Empresa</td>
                <td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;font-size:14px;font-weight:700;color:#0f172a;">${job.empresa_nombre || '—'}</td>
              </tr>
              <tr>
                <td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:14px;">🌐 Web</td>
                <td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f172a;">${job.empresa_web || '—'}</td>
              </tr>
              <tr>
                <td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:14px;">📊 Reporte</td>
                <td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;font-size:14px;font-weight:700;color:#f59e0b;">${reportName}</td>
              </tr>
              <tr>
                <td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:14px;">💶 Importe</td>
                <td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;font-size:16px;font-weight:700;color:#22c55e;">${amount}</td>
              </tr>
              <tr>
                <td style="padding:12px 20px;color:#64748b;font-size:14px;">📧 Email cliente</td>
                <td style="padding:12px 20px;font-size:14px;color:#0f172a;">${job.customer_email || '—'}</td>
              </tr>
            </table>
          </td>
        </tr>

        ${job.preguntas ? `
        <!-- Preguntas del cliente -->
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;">💬 Preguntas del cliente</p>
                  <p style="margin:0;font-size:14px;color:#78350f;line-height:1.5;">${job.preguntas}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        ` : ''}

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:11px;color:#94a3b8;">Job ID: ${job.id || '—'} · Brief ID: ${job.brief_id || '—'}</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
      }).catch(e => console.error('Email Dani failed:', e.message));
    }

    console.log('✅ Pago confirmado:', job.empresa_nombre, job.tipo_reporte);
  }

  res.status(200).json({ received: true });
}
