import { NextResponse } from 'next/server'
import { fetchBinanceOHLCV } from '@/lib/data'

export const runtime = 'nodejs'
export const maxDuration = 30

export interface Position {
  id         : string
  sym        : string
  entry_price: number
  size_usd   : number
  entry_date : string
  stop?      : number
  target?    : number
  notes      : string
  added_at   : string
  live_price?: number | null
  pnl_pct?: number | null
  pnl_usd?: number | null
  current_val?: number
}

// ── Storage: Vercel KV if available, else in-process map ─────────────────────

const _mem: Position[] = []   // fallback

async function loadPositions(): Promise<Position[]> {
  const url   = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) return [..._mem]

  try {
    const res  = await fetch(`${url}/get/portfolio:positions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const json = await res.json()
    return json.result ? JSON.parse(json.result) : []
  } catch { return [..._mem] }
}

async function savePositions(positions: Position[]): Promise<void> {
  const url   = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN

  // Always keep in-memory copy
  _mem.length = 0
  _mem.push(...positions)

  if (!url || !token) return

  try {
    const encoded = encodeURIComponent(JSON.stringify(positions))
    await fetch(`${url}/set/portfolio:positions/${encoded}?ex=${86400 * 365}`, {
      method : 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch { /* silently fall back to memory */ }
}

async function enrichPositions(positions: Position[]) {
  return Promise.all(positions.map(async p => {
    const rows = await fetchBinanceOHLCV(p.sym, 3)
    if (!rows || !rows.length) return { ...p, live_price: null, pnl_pct: null, pnl_usd: null }
    const live  = rows[rows.length - 1].c
    const pnlPct = (live / p.entry_price - 1) * 100
    const pnlUsd = p.size_usd * pnlPct / 100
    return {
      ...p,
      live_price : +live.toFixed(6),
      pnl_pct    : +pnlPct.toFixed(2),
      pnl_usd    : +pnlUsd.toFixed(2),
      current_val: +(p.size_usd + pnlUsd).toFixed(2),
      vs_stop    : p.stop   ? +((live / p.stop   - 1) * 100).toFixed(2) : null,
      vs_target  : p.target ? +((p.target / live - 1) * 100).toFixed(2) : null,
    }
  }))
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const positions = await loadPositions()
    const enriched  = await enrichPositions(positions)
    const totalDeployed = enriched.reduce((s, p) => s + p.size_usd, 0)
    const totalValue    = enriched.reduce((s, p) => s + (p.current_val ?? p.size_usd), 0)
    const totalPnlUsd   = totalValue - totalDeployed

    return NextResponse.json({
      positions: enriched,
      summary  : {
        n_positions   : enriched.length,
        total_deployed: +totalDeployed.toFixed(2),
        total_value   : +totalValue.toFixed(2),
        total_pnl_usd : +totalPnlUsd.toFixed(2),
        total_pnl_pct : totalDeployed > 0 ? +(totalPnlUsd / totalDeployed * 100).toFixed(2) : 0,
      },
      fetched_at: new Date().toISOString(),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.sym || !body.entry_price || !body.size_usd) {
      return NextResponse.json({ error: 'sym, entry_price, size_usd required' }, { status: 400 })
    }
    const positions = await loadPositions()
    const pos: Position = {
      id         : String(Date.now()),
      sym        : String(body.sym).toUpperCase().trim(),
      entry_price: +body.entry_price,
      size_usd   : +body.size_usd,
      entry_date : body.entry_date ?? new Date().toISOString().slice(0, 10),
      stop       : body.stop   ? +body.stop   : undefined,
      target     : body.target ? +body.target : undefined,
      notes      : body.notes  ?? '',
      added_at   : new Date().toISOString(),
    }
    positions.push(pos)
    await savePositions(positions)
    return NextResponse.json({ ok: true, position: pos }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: '?id= required' }, { status: 400 })
  try {
    const before    = await loadPositions()
    const after     = before.filter(p => p.id !== id)
    await savePositions(after)
    return NextResponse.json({ ok: true, removed: before.length - after.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
