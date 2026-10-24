/**
 * Live MUSD (Mezo USD) → USD price from CoinGecko's public API.
 *
 * CoinGecko lists the Mezo-issued stablecoin as "mezo-usd". The endpoint is
 * CORS-enabled and needs no API key for low-frequency requests.
 *
 * Returns a number > 0, or throws so the caller can keep the last known value.
 */
const MUSD_COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=mezo-usd&vs_currencies=usd";

export async function fetchMUSDPrice(): Promise<number> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(MUSD_COINGECKO_URL, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`CoinGecko returned HTTP ${res.status}`);
    }
    const data = (await res.json()) as { "mezo-usd"?: { usd?: unknown } };
    const usd = data["mezo-usd"]?.usd;
    if (typeof usd !== "number" || !Number.isFinite(usd) || usd <= 0) {
      throw new Error("MUSD price missing from CoinGecko response");
    }
    return usd;
  } finally {
    window.clearTimeout(timer);
  }
}
