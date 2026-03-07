export default function handler(req, res) {
  const token = process.env.TELEGRAM_BOT_TOKEN || '';
  const chatId = process.env.TELEGRAM_CHAT_ID || '';
  const topicId = process.env.TELEGRAM_TOPIC_ID || '';
  const testMode = process.env.TEST_MODE || '';
  res.status(200).json({
    token_prefix: token.substring(0, 15) + '...',
    token_len: token.length,
    chat_id: chatId,
    topic_id: topicId,
    test_mode: testMode,
  });
}
