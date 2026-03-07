import { appendOpsEvent } from './_lib.js';

const REPORT_NAMES = {
  'competitor-intel': 'Competitor Intelligence',
  'market-entry': 'Market Entry',
  'buyer-intel': 'Buyer Intelligence',
  'talent-market': 'Talent Market',
  'pack': 'Pack Completo',
};

const STARS = ['', '⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'];

async function notifyDani({ token, rating, utility, comment }) {
  const token_bot = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const topicId = process.env.TELEGRAM_TOPIC_ID;
  if (!token_bot || !chatId) return;

  const text = `📋 *Nuevo feedback BriefIntel*\n\n` +
    `${STARS[rating]} *Valoración:* ${rating}/5\n` +
    `✅ *Utilidad:* ${utility || '—'}\n` +
    (comment ? `💬 *Comentario:* ${comment}\n` : '') +
    `🔑 *Token:* ${token.substring(0, 12)}...`;

  const body = { chat_id: chatId, text, parse_mode: 'Markdown' };
  if (topicId) body.message_thread_id = parseInt(topicId);

  await fetch(`https://api.telegram.org/bot${token_bot}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export const config = { api: { bodyParser: false } };

async function parseBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(data)); } catch { resolve({}); }
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { token, rating, utility, comment } = await parseBody(req);

  await appendOpsEvent({
    type: 'feedback_received',
    severity: 'info',
    summary: `token=${token} | rating=${rating}/5 | utility=${utility}`,
    payload: { token, rating, utility, comment, at: new Date().toISOString() },
  }).catch(() => {});

  await notifyDani({ token, rating, utility, comment }).catch(() => {});

  res.status(200).json({ ok: true });
}
