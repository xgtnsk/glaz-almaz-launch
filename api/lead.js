function readBody(req) {
  if (!req.body) {
    return {};
  }

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return req.body;
}

function sanitize(value, limit = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    res.status(500).json({ ok: false, error: "missing_env" });
    return;
  }

  const body = readBody(req);
  const name = sanitize(body.name, 80);
  const phone = sanitize(body.phone, 32);
  const message = sanitize(body.message, 500) || "Без комментария";
  const page = sanitize(body.page, 300) || "Не указана";
  const source = sanitize(body.source, 80) || "site";

  if (!name || !phone) {
    res.status(400).json({ ok: false, error: "invalid_payload" });
    return;
  }

  const text = [
    "Новая заявка с сайта ГЛАЗ-АЛМАЗ",
    "",
    `Имя: ${name}`,
    `Телефон: ${phone}`,
    `Запрос: ${message}`,
    `Источник: ${source}`,
    `Страница: ${page}`,
  ].join("\n");

  try {
    const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    });

    if (!telegramResponse.ok) {
      const telegramError = await telegramResponse.text();
      res.status(502).json({ ok: false, error: "telegram_failed", details: telegramError });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(502).json({ ok: false, error: "network_failed" });
  }
};
