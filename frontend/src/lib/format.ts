export const usd = (n: number, d = 2) =>
  n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })

export const num = (n: number, d = 2) =>
  n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

export const musd = (n: number, d = 2) => `${num(n, d)} MUSD`

export const btc = (n: number, d = 6) => `${n.toFixed(d)} BTC`

export const pct = (n: number, d = 0) => `${n.toFixed(d)}%`

export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
