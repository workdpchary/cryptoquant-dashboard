import type { OHLCVRow } from './engine'

const CMC_BASE = 'https://pro-api.coinmarketcap.com'
const BIN_BASE = 'https://api.binance.com'

// ── CMC ──────────────────────────────────────────────────────────────────────

export interface CMCCoin {
  sym   : string; name  : string; rank  : number
  mcap  : number; fdv   : number; vol24h: number
  p1h   : number; p24h  : number; p7d   : number; p30d: number
  vol_chg24h: number; price: number
}

export interface CMCGlobal {
  btc_dominance  : number
  total_mcap     : number
  total_vol_24h  : number
  mcap_change_24h: number
}

export async function fetchCMCListings(apiKey: string, limit = 250): Promise<CMCCoin[]> {
  const url = `${CMC_BASE}/v1/cryptocurrency/listings/latest`
  const params = new URLSearchParams({ start: '1', limit: String(limit), convert: 'USD', sort: 'market_cap', sort_dir: 'desc' })
  const res = await fetch(`${url}?${params}`, {
    headers: { 'X-CMC_PRO_API_KEY': apiKey, Accept: 'application/json' },
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`CMC listings error: ${res.status}`)
  const json = await res.json()
  return (json.data as any[]).map(c => {
    const q = c.quote.USD
    return {
      sym: c.symbol, name: c.name, rank: c.cmc_rank ?? 999,
      mcap : q.market_cap ?? 0, fdv: q.fully_diluted_market_cap ?? (q.market_cap ?? 0),
      vol24h: q.volume_24h ?? 0,
      p1h  : q.percent_change_1h  ?? 0, p24h: q.percent_change_24h ?? 0,
      p7d  : q.percent_change_7d  ?? 0, p30d: q.percent_change_30d ?? 0,
      vol_chg24h: q.volume_change_24h ?? 0, price: q.price ?? 0,
    }
  })
}

export async function fetchCMCGlobal(apiKey: string): Promise<CMCGlobal> {
  const res = await fetch(`${CMC_BASE}/v1/global-metrics/quotes/latest`, {
    headers: { 'X-CMC_PRO_API_KEY': apiKey, Accept: 'application/json' },
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`CMC global error: ${res.status}`)
  const json = await res.json()
  const d = json.data, q = d.quote.USD
  return {
    btc_dominance  : d.btc_dominance ?? 50,
    total_mcap     : q.total_market_cap ?? 0,
    total_vol_24h  : q.total_volume_24h ?? 0,
    mcap_change_24h: q.total_market_cap_yesterday_percentage_change ?? 0,
  }
}

// ── Binance ──────────────────────────────────────────────────────────────────

export async function fetchBinanceOHLCV(
  symbol: string, days = 365, interval = '1d'
): Promise<OHLCVRow[] | null> {
  const pair = `${symbol}USDT`
  const url  = `${BIN_BASE}/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${Math.min(days, 1000)}`
  try {
    const res = await fetch(url, { next: { revalidate: 0 } })
    if (res.status === 400) return null
    if (!res.ok) return null
    const raw: any[][] = await res.json()
    if (!raw.length) return null
    return raw.map(r => ({
      t: r[0], o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[5]
    }))
  } catch {
    return null
  }
}

export async function fetchUniverseOHLCV(
  symbols: string[], days = 365
): Promise<Record<string, OHLCVRow[]>> {
  const result: Record<string, OHLCVRow[]> = {}
  // Batch with small delay to be polite to Binance rate limits
  const chunks: string[][] = []
  for (let i = 0; i < symbols.length; i += 10) chunks.push(symbols.slice(i, i + 10))
  for (const chunk of chunks) {
    const settled = await Promise.allSettled(chunk.map(sym => fetchBinanceOHLCV(sym, days)))
    settled.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value && r.value.length >= 35) {
        result[chunk[i]] = r.value
      }
    })
    await new Promise(res => setTimeout(res, 50))
  }
  return result
}
