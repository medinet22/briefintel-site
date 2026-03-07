import { appendOpsEvent } from './_lib.js';

const STARS = ['', '⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'];

async function notifyDani({ token, rating, utility, comment }) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const topicId = process.env.TELEGRAM_TOPIC_ID;
  if (!botToken || !chatId) return;

  const text = `📋 *Nuevo feedback BriefIntel*\n\n` +
    `${STARS[rating] || '?'} *Valoración:* ${rating || '?'}/5\n` +
    `✅ *Utilidad:* ${utility || '—'}\n` +
    (comment ? `💬 *Comentario:* ${comment}\n` : '') +
    `🔑 *Token:* ${String(token).substring(0, 12)}...`;

  const body = { chat_id: chatId, text, parse_mode: 'Markdown' };
  if (topicId) body.message_thread_id = parseInt(topicId);

  const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!data.ok) console.error('Telegram error:', JSON.stringify(data));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // req.body is parsed automatically by Vercel (same as brief.js)
  const body = req.body || {};
  const { token, rating, utility, comment } = body;

  console.log('Feedback received:', JSON.stringify({ token, rating, utility, comment }));

  await appendOpsEvent({
    type: 'feedback_received',
    severity: 'info',
    summary: `token=${token} | rating=${rating}/5 | utility=${utility}`,
    payload: { token, rating, utility, comment, at: new Date().toISOString() },
  }).catch(e => console.error('ops error:', e.message));

  await notifyDani({ token, rating, utility, comment })
    .catch(e => console.error('Telegram error:', e.message));

  res.status(200).json({ ok: true });
}
