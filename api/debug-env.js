export default async function handler(req, res) {
  const token = process.env.TELEGRAM_BOT_TOKEN || '';
  const chatId = process.env.TELEGRAM_CHAT_ID || '';
  const topicId = process.env.TELEGRAM_TOPIC_ID || '';

  // Try sending telegram from Vercel directly
  let tgResult = 'not tried';
  try {
    const body = JSON.stringify({
      chat_id: chatId,
      message_thread_id: parseInt(topicId),
      text: '🧪 Test desde Vercel — si ves esto, Telegram funciona desde el servidor',
      parse_mode: 'Markdown'
    });
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const data = await resp.json();
    tgResult = data.ok ? `OK msg_id=${data.result?.message_id}` : `ERR: ${data.description}`;
  } catch(e) {
    tgResult = `EXCEPTION: ${e.message}`;
  }

  res.status(200).json({
    token_prefix: token.substring(0, 15) + '...',
    chat_id: chatId,
    topic_id: topicId,
    telegram: tgResult,
    body: req.body,
  });
}
