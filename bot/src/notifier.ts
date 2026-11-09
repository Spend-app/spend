import { CONFIG } from "./config.js";

// In-memory debounce cache to avoid duplicate alert spam
const lastAlertTimestamps = new Map<string, number>();
const DEBOUNCE_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes per unique alert key

export async function sendTelegramAlert(
  title: string,
  message: string,
  debounceKey?: string
): Promise<void> {
  const now = Date.now();
  if (debounceKey) {
    const lastTime = lastAlertTimestamps.get(debounceKey);
    if (lastTime && now - lastTime < DEBOUNCE_INTERVAL_MS) {
      return; // Skip throttled alert
    }
    lastAlertTimestamps.set(debounceKey, now);
  }

  const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19);
  const formattedText = `*[SPEND PROTOCOL ALERT]*\n*${title}*\n\n${message}\n\n_Time: ${timestamp} UTC_`;

  // Check if Telegram is configured with real credentials
  const hasToken =
    CONFIG.telegramBotToken &&
    !CONFIG.telegramBotToken.includes("YOUR_TELEGRAM_BOT_TOKEN") &&
    CONFIG.telegramBotToken.trim().length > 10;
  const hasChatId =
    CONFIG.telegramChatId &&
    !CONFIG.telegramChatId.includes("YOUR_TELEGRAM_CHAT_ID") &&
    CONFIG.telegramChatId.trim().length > 0;

  if (!hasToken || !hasChatId) {
    console.log(`\n================== [TELEGRAM ALERT (PLACEHOLDER MODE)] ==================`);
    console.log(`Title: ${title}`);
    console.log(`Body:  ${message}`);
    console.log(`Time:  ${timestamp} UTC`);
    console.log(`Note:  Set real TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env to receive push alerts`);
    console.log(`========================================================================\n`);
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${CONFIG.telegramBotToken}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CONFIG.telegramChatId,
        text: formattedText,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[Telegram] Failed to send alert: ${res.status} ${err}`);
    } else {
      console.log(`[Telegram] Alert delivered successfully: "${title}"`);
    }
  } catch (err: any) {
    console.error(`[Telegram] Network error sending alert:`, err?.message || err);
  }
}
