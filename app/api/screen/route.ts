import { NextResponse } from 'next/server'
import { fetchCMCListings, fetchCMCGlobal, fetchBinanceOHLCV, fetchUniverseOHLCV } from '@/lib/data'
import { computeFactors, crossNormalise, detectRegime, STABLES } from '@/lib/engine'

export const runtime = 'nodejs'
export const maxDuration = 58

const MIN_MCAP  = 10_000_000
const MIN_VOL   = 2_000_000

// Simple in-memory cache — warm for ~30s on Vercel
let _cache: { data: any; ts: number } | null = null
const CACHE_TTL = 8 * 60 * 1000  // 8 min

export async function GET(req: Request) {
  const apiKey = process.env.CMC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'CMC_API_KEY not configured' }, { status: 500 })

  const { searchParams } = new URL(req.url)
  const forceRefresh = searchParams.get('refresh') === 'true'

  if (_cache && !forceRefresh && Date.now() - _cache.ts < CACHE_TTL) {
    return NextResponse.json({ ..._cache.data, source: 'cache', cache_age_s: Math.round((Date.now() - _cache.ts) / 1000) })
  }

  try {
    const [listings, global] = await Promise.all([
      fetchCMCListings(apiKey, 200),
      fetchCMCGlobal(apiKey),
    ])

    const candidates = listings.filter(c =>
      !STABLES.has(c.sym) && c.mcap >= MIN_MCAP && c.vol24h >= MIN_VOL
    ).slice(0, 100)

    const syms = [...new Set(['BTC', ...candidates.map(c => c.sym)])]
    const ohlcv = await fetchUniverseOHLCV(syms, 65)

    // Regime from BTC
    const btcRows = ohlcv['BTC']
    const regime  = btcRows ? detectRegime(btcRows) : null

    // Score coins
    const cmcMap = Object.fromEntries(candidates.map(c => [c.sym, c]))
    const rows = []
    for (const [sym, rows_] of Object.entries(ohlcv)) {
      if (sym === 'BTC') continue
      const cmc = cmcMap[sym]
      if (!cmc) continue
      const f = computeFactors(sym, rows_, cmc.mcap, cmc.fdv, {
        p7d: cmc.p7d, p30d: cmc.p30d, name: cmc.name, rank: cmc.rank,
      })
      if (f) rows.push(f)
    }

    const scored = crossNormalise(rows)
    scored.sort((a, b) => b.score - a.score)

    const data = {
      coins     : scored.slice(0, 60).map(c => ({ ...c, score: +c.score.toFixed(1) })),
      regime,
      global,
      cached_at : new Date().toISOString(),
      source    : 'live',
    }

    _cache = { data, ts: Date.now() }
    return NextResponse.json(data)

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
