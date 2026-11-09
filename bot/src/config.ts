import { defineChain, createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import dotenv from "dotenv";

dotenv.config();

export const mezoTestnet = defineChain({
  id: Number(process.env.CHAIN_ID || 31611),
  name: "Mezo Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "Bitcoin",
    symbol: "BTC",
  },
  rpcUrls: {
    default: {
      http: [process.env.RPC_URL || "https://rpc.test.mezo.org"],
    },
  },
  blockExplorers: {
    default: { name: "MezoScan", url: "https://explorer.test.mezo.org" },
  },
});

export const CONFIG = {
  rpcUrl: process.env.RPC_URL || "https://rpc.test.mezo.org",
  chainId: Number(process.env.CHAIN_ID || 31611),
  spendContract: (process.env.SPEND_CONTRACT_ADDRESS || "0xdADB2C17199E2247C3FB65E75F62Db6bAFc4b7a0") as `0x${string}`,
  mezoTroveManager: (process.env.MEZO_TROVE_MANAGER || "0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0") as `0x${string}`,
  mezoPriceFeed: (process.env.MEZO_PRICE_FEED || "0x86bCF0841622a5dAC14A313a15f96A95421b9366") as `0x${string}`,
  mezoBorrowerOps: (process.env.MEZO_BORROWER_OPERATIONS || "0xCdF7028ceAB81fA0C6971208e83fa7872994beE5") as `0x${string}`,
  mezoMusd: (process.env.MEZO_MUSD || "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503") as `0x${string}`,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID || "",
  keeperPrivateKey: (process.env.KEEPER_PRIVATE_KEY || "") as `0x${string}`,
  masterIcrWarnThreshold: Number(process.env.MASTER_ICR_WARN_THRESHOLD || 230),
  bufferWarnThreshold: Number(process.env.BUFFER_WARN_THRESHOLD || 500),
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS || 15000),
};

export const publicClient = createPublicClient({
  chain: mezoTestnet,
  transport: http(CONFIG.rpcUrl),
});

export const keeperAccount = CONFIG.keeperPrivateKey && CONFIG.keeperPrivateKey.startsWith("0x")
  ? privateKeyToAccount(CONFIG.keeperPrivateKey)
  : null;

export const walletClient = keeperAccount
  ? createWalletClient({
      account: keeperAccount,
      chain: mezoTestnet,
      transport: http(CONFIG.rpcUrl),
    })
  : null;
