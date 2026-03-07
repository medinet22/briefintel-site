const STARS = ['', '⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { token, rating, utility, comment } = req.body || {};
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const topicId = process.env.TELEGRAM_TOPIC_ID;

  const text = `📋 *Nuevo feedback BriefIntel*\n\n` +
    `${STARS[Number(rating)] || '?'} *Valoración:* ${rating || '?'}/5\n` +
    `✅ *Utilidad:* ${utility || '—'}\n` +
    (comment ? `💬 *Comentario:* ${comment}\n` : '') +
    `🔑 *Token:* ${String(token || '').substring(0, 12)}...`;

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_thread_id: parseInt(topicId),
        text,
        parse_mode: 'Markdown',
      }),
    });
  } catch(e) {
    console.error('Telegram failed:', e.message);
  }

  res.status(200).json({ ok: true });
}
