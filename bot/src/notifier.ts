import { CONFIG } from "./config.js";

// In-memory debounce cache to avoid duplicate alert spam
const lastAlertTimestamps = new Map<string, number>();
const DEBOUNCE_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes per unique alert key

export type AlertSeverity = "info" | "warning" | "danger" | "success";

const SEVERITY_COLORS: Record<AlertSeverity, number> = {
  info: 3447003, // Blue
  warning: 16763904, // Yellow/Orange
  danger: 15158332, // Red
  success: 3066993, // Green
};

export async function sendAlert(
  title: string,
  message: string,
  severity: AlertSeverity = "info",
  debounceKey?: string,
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

  // 1. Try Discord Webhook
  const hasDiscord =
    CONFIG.discordWebhookUrl &&
    (CONFIG.discordWebhookUrl.includes("/api/webhooks/") ||
      CONFIG.discordWebhookUrl.includes("discord.com/api/webhooks/") ||
      CONFIG.discordWebhookUrl.includes("discordapp.com/api/webhooks/")) &&
    !CONFIG.discordWebhookUrl.includes("YOUR_DISCORD_WEBHOOK");

  if (hasDiscord) {
    try {
      const res = await fetch(CONFIG.discordWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "Spend Keeper Watchdog",
          avatar_url:
            "https://explorer.test.mezo.org/assets/configs/network_icon.png",
          embeds: [
            {
              title: `[SPEND] ${title}`,
              description: message,
              color: SEVERITY_COLORS[severity],
              footer: {
                text: `Mezo Testnet (ChainId: ${CONFIG.chainId}) | Spend Protocol`,
              },
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });

      if (!res.ok) {
        console.error(
          `[Discord] Webhook error: ${res.status} ${await res.text()}`,
        );
      } else {
        console.log(`[Discord] Alert delivered: "${title}"`);
      }
    } catch (err: any) {
      console.error(`[Discord] Failed to send webhook:`, err?.message || err);
    }
  }

  // 2. Try Telegram if configured
  const hasTelegram =
    CONFIG.telegramBotToken &&
    !CONFIG.telegramBotToken.includes("YOUR_") &&
    CONFIG.telegramChatId &&
    !CONFIG.telegramChatId.includes("YOUR_");

  if (hasTelegram) {
    try {
      const formattedText = `*[SPEND ALERT - ${title}]*\n\n${message}\n\n_Time: ${timestamp} UTC_`;
      const url = `https://api.telegram.org/bot${CONFIG.telegramBotToken}/sendMessage`;
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CONFIG.telegramChatId,
          text: formattedText,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        }),
      });
    } catch (err: any) {
      console.error(`[Telegram] Error:`, err?.message || err);
    }
  }

  // 3. Fallback to Console Card if neither is configured
  if (!hasDiscord && !hasTelegram) {
    console.log(
      `\n================== [WATCHDOG ALERT: ${title}] ==================`,
    );
    console.log(`Severity: ${severity.toUpperCase()}`);
    console.log(`Message:  ${message}`);
    console.log(`Time:     ${timestamp} UTC`);
    console.log(
      `Tip:      Set DISCORD_WEBHOOK_URL in .env to receive instant Discord notifications`,
    );
    console.log(
      `========================================================================\n`,
    );
  }
}
