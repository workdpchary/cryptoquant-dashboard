import { NextResponse } from 'next/server'
import { fetchUniverseOHLCV } from '@/lib/data'
import { runBacktest } from '@/lib/engine'

export const runtime = 'nodejs'
export const maxDuration = 58

const DEFAULT_UNIVERSE = [
  'ETH','SOL','BNB','AVAX','LINK','DOT','NEAR','APT',
  'OP','ARB','INJ','FET','GRT','LDO','AAVE','RNDR',
  'TIA','WIF','PEPE','JUP','SUI','SEI','BONK','FLOKI',
]

const IS_DAYS  = 240
const OOS_DAYS = 125

export async function POST(req: Request) {
  try {
    const body    = await req.json().catch(() => ({}))
    const coins   = (body.coins as string[] | undefined) ?? DEFAULT_UNIVERSE
    const days    = Math.min(Number(body.days ?? 365), 500)
    const initCap = Number(body.initial_cap ?? 100_000)

    const universe = ['BTC', ...coins.filter((s: string) => s !== 'BTC')].slice(0, 35)

    const ohlcv = await fetchUniverseOHLCV(universe, days)

    if (!ohlcv['BTC']) {
      return NextResponse.json({ error: 'Could not fetch BTC data from Binance' }, { status: 502 })
    }

    const btcRows  = ohlcv['BTC']
    const total    = btcRows.length
    const isStart  = Math.max(0, total - IS_DAYS - OOS_DAYS)
    const oosStart = isStart + IS_DAYS

    const [isResult, oosResult] = await Promise.all([
      Promise.resolve(runBacktest(ohlcv, btcRows, isStart,  IS_DAYS,  initCap)),
      Promise.resolve(runBacktest(ohlcv, btcRows, oosStart, OOS_DAYS, initCap)),
    ])

    return NextResponse.json({
      is   : isResult,
      oos  : oosResult,
      split: { is_days: IS_DAYS, oos_days: OOS_DAYS, total_days: total },
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
