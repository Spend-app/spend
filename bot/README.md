# Spend Keeper & Alert Bot

Autonomous event-driven keeper and watchdog service for the [Spend](https://spend.build) micro-borrowing protocol on Mezo.

---

## 1. Responsibilities & Separation of Powers

The bot follows a strict protocol security model:

| Role | Actions Handled | Authority Level |
|---|---|---|
| **Core Keeper (Autonomous)** | Executes `liquidateUser(user)` on underwater borrowers (< 130% ICR), calls `enterWindDown()` if Mezo closes the master Trove. | **Permissionless.** Uses a low-balance keeper wallet for gas. Cannot spend protocol treasury funds. |
| **Protocol Watchdog (Alerts Only)** | Monitors Master Trove ICR (< 230%), Mezo System TCR (< 155%), and low cash buffer (< 500 MUSD). | **Zero Autonomous Spending.** Sends instant push alerts to Telegram (or console) with recommended actions. Team decides. |

---

## 2. Installation & Quick Start

### Prerequisites
- Node.js v18+ (v20+ recommended)

### 1. Install Dependencies
```bash
cd bot
npm install
```

### 2. Configure Environment (`.env`)
Copy the example file:
```bash
cp .env.example .env
```

Edit `.env`:
```ini
RPC_URL=https://rpc.test.mezo.org
SPEND_CONTRACT_ADDRESS=0xdADB2C17199E2247C3FB65E75F62Db6bAFc4b7a0

# Telegram Alert Credentials
TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN_HERE
TELEGRAM_CHAT_ID=YOUR_TELEGRAM_CHAT_ID_HERE

# Keeper Wallet (Optional: leave empty to run in simulation / alert-only mode)
KEEPER_PRIVATE_KEY=
```

### 3. Run the Bot

**Development / Local Mode:**
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```

---

## 3. How to Set Up Free Discord Webhook Alerts (15 Seconds)

1. Open your Discord server (or create a private one for your team).
2. Go to **Channel Settings** on your desired alert channel (e.g., `#spend-alerts`).
3. Click **Integrations** $\rightarrow$ **Webhooks** $\rightarrow$ **New Webhook**.
4. Name it `Spend Keeper Bot` and click **Copy Webhook URL**.
5. Paste it into `DISCORD_WEBHOOK_URL` in `bot/.env`:
   ```ini
   DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
   ```
6. Restart the bot. All alerts will appear as color-coded embed cards on desktop and mobile.

*(Optional: Telegram alerts are also supported via `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`.)*

---

## 4. Production Deployment (PM2)

To keep the bot running 24/7 in the background on a server:

```bash
npm install -g pm2
pm2 start "npm start" --name "spend-keeper-bot"
pm2 save
pm2 startup
```

To view live logs:
```bash
pm2 logs spend-keeper-bot
```
