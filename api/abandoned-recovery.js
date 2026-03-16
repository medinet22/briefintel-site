import { json, readBriefs, readJobs, updateBrief } from './_lib.js';
import { Resend } from 'resend';

const REPORT_CONFIG = {
  'competitor-intel': { name: 'Competitor Intel', price: 35 },
  'market-entry': { name: 'Market Entry Brief', price: 49 },
  'talent-market': { name: 'Talent Market Intel', price: 19 },
  'buyer-intel': { name: 'Buyer Intel · M&A', price: 59 },
  'pack': { name: 'Pack Estratégico Completo', price: 119 },
};

function getAbandonedBriefs(briefs, jobs) {
  const paidBriefIds = new Set(jobs.map(j => j.brief_id).filter(Boolean));
  const now = Date.now();
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;

  return briefs
    .filter(b => {
      if (!b.email || !b.id) return false;
      if (paidBriefIds.has(b.id)) return false;
      const createdMs = new Date(b.createdAt).getTime();
      const age = now - createdMs;
      return age > TWO_HOURS && age < FORTY_EIGHT_HOURS;
    })
    .map(b => {
      const config = REPORT_CONFIG[b.tipo_reporte] || { name: b.tipo_reporte, price: 35 };
      const createdMs = new Date(b.createdAt).getTime();
      const ageMs = now - createdMs;
      const ageHours = Math.floor(ageMs / (60 * 60 * 1000));
      return {
        ...b,
        report_name: config.name,
        price: config.price,
        age_hours: ageHours,
        age_display: ageHours < 24 ? `hace ${ageHours}h` : `hace ${Math.floor(ageHours / 24)}d`,
        recovery_sent: Boolean(b.recovery_sent_at),
      };
    });
}

function buildRecoveryEmailHtml(brief) {
  const config = REPORT_CONFIG[brief.tipo_reporte] || { name: brief.tipo_reporte, price: 35 };
  const pagoUrl = `https://getbriefintel.com/pago?brief_id=${encodeURIComponent(brief.id)}`
    + `&tipo=${encodeURIComponent(brief.tipo_reporte)}`
    + `&empresa=${encodeURIComponent(brief.empresa_nombre)}`
    + `&web=${encodeURIComponent(brief.empresa_web || '')}`
    + `&email=${encodeURIComponent(brief.email)}`
    + `&recovery=1`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Tu análisis de ${brief.empresa_nombre} está listo</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:32px 32px 24px;border-bottom:1px solid #334155;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td><span style="color:#f59e0b;font-size:26px;font-weight:700;letter-spacing:-0.5px;">BriefIntel</span></td>
                <td align="right"><span style="color:#94a3b8;font-size:13px;">★★★★★ 4.7/5</span></td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Hero Section -->
        <tr>
          <td style="padding:40px 32px 24px;">
            <p style="margin:0 0 8px;font-size:14px;color:#f59e0b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">⏳ Tu análisis está en cola</p>
            <h1 style="margin:0 0 20px;font-size:28px;color:#f8fafc;font-weight:700;line-height:1.3;">
              Tu análisis de <span style="color:#f59e0b;">${brief.empresa_nombre}</span> está listo para generar
            </h1>
            <p style="margin:0;font-size:16px;color:#94a3b8;line-height:1.6;">
              Guardamos tu solicitud de reporte. Solo falta confirmar el pago para que nuestro sistema comience a investigar automáticamente.
            </p>
          </td>
        </tr>

        <!-- Order Summary -->
        <tr>
          <td style="padding:0 32px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:12px;border:1px solid #334155;">
              <tr>
                <td style="padding:20px;">
                  <p style="margin:0 0 16px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Tu pedido pendiente</p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:8px 0;border-bottom:1px solid #1e293b;">
                        <span style="color:#94a3b8;font-size:14px;">Reporte:</span>
                      </td>
                      <td align="right" style="padding:8px 0;border-bottom:1px solid #1e293b;">
                        <span style="color:#f8fafc;font-size:14px;font-weight:600;">${config.name}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;border-bottom:1px solid #1e293b;">
                        <span style="color:#94a3b8;font-size:14px;">Empresa analizada:</span>
                      </td>
                      <td align="right" style="padding:8px 0;border-bottom:1px solid #1e293b;">
                        <span style="color:#f8fafc;font-size:14px;font-weight:600;">${brief.empresa_nombre}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:12px 0 0;">
                        <span style="color:#f8fafc;font-size:16px;font-weight:700;">Total:</span>
                      </td>
                      <td align="right" style="padding:12px 0 0;">
                        <span style="color:#f59e0b;font-size:24px;font-weight:700;">${config.price}€</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA Button -->
        <tr>
          <td style="padding:0 32px 40px;" align="center">
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="background:#f59e0b;border-radius:10px;box-shadow:0 4px 14px rgba(245,158,11,0.4);">
                  <!--[if mso]>
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${pagoUrl}" style="height:56px;v-text-anchor:middle;width:300px;" arcsize="18%" strokecolor="#f59e0b" fillcolor="#f59e0b">
                    <w:anchorlock/>
                    <center style="color:#111827;font-size:18px;font-weight:bold;">Completar mi pedido →</center>
                  </v:roundrect>
                  <![endif]-->
                  <!--[if !mso]><!-->
                  <a href="${pagoUrl}" style="background:#f59e0b;color:#111827;text-decoration:none;padding:18px 40px;border-radius:10px;font-weight:700;font-size:18px;display:inline-block;">Completar mi pedido →</a>
                  <!--<![endif]-->
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- What you get -->
        <tr>
          <td style="padding:0 32px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:20px;background:#0f172a;border-radius:12px;border:1px solid #334155;">
                  <p style="margin:0 0 16px;font-size:14px;color:#f8fafc;font-weight:600;">¿Qué incluye tu reporte?</p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr><td style="padding:6px 0;color:#94a3b8;font-size:14px;">✓ Análisis de competencia detallado</td></tr>
                    <tr><td style="padding:6px 0;color:#94a3b8;font-size:14px;">✓ Datos verificados de múltiples fuentes</td></tr>
                    <tr><td style="padding:6px 0;color:#94a3b8;font-size:14px;">✓ Entrega en 24h por email</td></tr>
                    <tr><td style="padding:6px 0;color:#94a3b8;font-size:14px;">✓ PDF descargable de alta calidad</td></tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 32px;background:#0f172a;border-top:1px solid #334155;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0 0 8px;font-size:12px;color:#64748b;">
                    Este email se envió porque solicitaste un análisis en getbriefintel.com
                  </p>
                  <p style="margin:0;font-size:12px;color:#64748b;">
                    <a href="mailto:hola@getbriefintel.com?subject=Unsubscribe" style="color:#64748b;text-decoration:underline;">Darse de baja</a> · <a href="https://getbriefintel.com" style="color:#64748b;text-decoration:underline;">getbriefintel.com</a>
                  </p>
                </td>
                <td align="right" style="vertical-align:top;">
                  <span style="color:#f59e0b;font-size:16px;font-weight:700;">BriefIntel</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://getbriefintel.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { secret } = req.query;
  const ADMIN_SECRET = process.env.BRIEFINTEL_ADMIN_SECRET;
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return json(res, 404, { error: 'Not found' });
  }

  try {
    const briefs = await readBriefs();
    const jobs = await readJobs();
    const abandoned = getAbandonedBriefs(briefs, jobs);

    // GET: List abandoned briefs
    if (req.method === 'GET') {
      return json(res, 200, {
        ok: true,
        abandoned,
        total: abandoned.length,
        pending: abandoned.filter(b => !b.recovery_sent).length,
        sent: abandoned.filter(b => b.recovery_sent).length,
      });
    }

    // POST: Send recovery email
    if (req.method === 'POST') {
      const { brief_id, force } = req.body || {};

      if (!brief_id) {
        return json(res, 400, { ok: false, error: 'brief_id required' });
      }

      const brief = briefs.find(b => b.id === brief_id);
      if (!brief) {
        return json(res, 404, { ok: false, error: 'Brief not found' });
      }

      if (!brief.email) {
        return json(res, 400, { ok: false, error: 'Brief has no email' });
      }

      // Check if already paid
      const isPaid = jobs.some(j => j.brief_id === brief_id);
      if (isPaid) {
        return json(res, 400, { ok: false, error: 'Brief already paid' });
      }

      // Check if already sent (unless force=true)
      if (brief.recovery_sent_at && !force) {
        return json(res, 400, { ok: false, error: 'Recovery email already sent', sent_at: brief.recovery_sent_at });
      }

      // Send email via Resend
      if (!process.env.RESEND_API_KEY) {
        return json(res, 500, { ok: false, error: 'RESEND_API_KEY not configured' });
      }

      const resend = new Resend(process.env.RESEND_API_KEY);
      const config = REPORT_CONFIG[brief.tipo_reporte] || { name: brief.tipo_reporte, price: 35 };

      const emailResult = await resend.emails.send({
        from: 'BriefIntel <hola@getbriefintel.com>',
        to: [brief.email],
        subject: `Tu análisis de ${brief.empresa_nombre} está listo para generar`,
        html: buildRecoveryEmailHtml(brief),
      });

      if (emailResult.error) {
        console.error('Resend error:', emailResult.error);
        return json(res, 500, { ok: false, error: 'Failed to send email', detail: emailResult.error.message });
      }

      // Mark as sent
      await updateBrief(brief_id, { recovery_sent_at: new Date().toISOString() });

      return json(res, 200, {
        ok: true,
        message: 'Recovery email sent',
        email_id: emailResult.data?.id,
        to: brief.email,
        empresa: brief.empresa_nombre,
      });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    console.error('abandoned-recovery error:', error?.message || error);
    return json(res, 500, { ok: false, error: 'Internal error' });
  }
}
