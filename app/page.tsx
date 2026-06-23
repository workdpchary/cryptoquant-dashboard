'use client'
import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, ArrowUpDown, ChevronDown, ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import {
  StatCard, RegimeBar, ScoreBar, PctChange,
  SectionHeader, Skeleton, EmptyState, ErrorBox
} from '@/app/components/ui'

const FILTERS = ['all','accumulation','momentum','coiling','fomo','distribution','noise']
type SortKey  = 'score'|'vol_zscore'|'momentum_7d'|'atr_momentum'|'rv'

export default function ScreenPage() {
  const [data,     setData]     = useState<any>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string|null>(null)
  const [filter,   setFilter]   = useState('all')
  const [sortKey,  setSortKey]  = useState<SortKey>('score')
  const [sortDesc, setSortDesc] = useState(true)
  const [expanded, setExpanded] = useState<string|null>(null)

  const load = useCallback(async (refresh = false) => {
    setLoading(true); setError(null)
    try {
      const res  = await fetch(`/api/screen${refresh ? '?refresh=true' : ''}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || res.statusText)
      setData(json)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const coins   = (data?.coins ?? []) as any[]
  const filtered = coins
    .filter((c: any) => filter === 'all' || c.signal_key === filter)
    .sort((a: any, b: any) => sortDesc ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey])

  const global = data?.global

  return (
    <div className="pt-6 space-y-5 animate-fade-in">

      {/* Hero stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="BTC Dominance"
          value={global ? `${global.btc_dominance?.toFixed(1)}%` : '—'}
          color="amber" />
        <StatCard label="Total Market Cap"
          value={global ? `$${(global.total_mcap/1e12).toFixed(2)}T` : '—'}
          color={global?.mcap_change_24h > 0 ? 'green' : 'red'}
          sub={global ? `${global.mcap_change_24h > 0 ? '+' : ''}${global.mcap_change_24h?.toFixed(2)}% 24h` : undefined} />
        <StatCard label="Accum Signals"
          value={coins.filter((c:any)=>c.signal_key==='accumulation').length}
          color="green" glow />
        <StatCard label="Momentum Signals"
          value={coins.filter((c:any)=>c.signal_key==='momentum').length}
          color="blue" />
      </div>

      {/* Regime */}
      {data?.regime && <RegimeBar regime={data.regime} />}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader title="Live Signal Screen"
          sub={data
            ? `${filtered.length} coins · ${data.source==='cache' ? `cached ${data.cache_age_s}s ago` : 'live'} · ${new Date(data.cached_at).toLocaleTimeString()}`
            : 'Loading…'} />
        <div className="flex flex-wrap items-center gap-2">
          {/* Filters */}
          <div className="flex flex-wrap gap-1 bg-panel border border-border rounded-lg p-1">
            {FILTERS.map(f => (
              <button key={f} onClick={()=>setFilter(f)}
                className={clsx('px-2.5 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider transition-all',
                  filter===f ? 'bg-amber/15 text-amber' : 'text-subtle hover:text-body')}>
                {f}
              </button>
            ))}
          </div>
          {/* Sort */}
          <select value={sortKey} onChange={e=>setSortKey(e.target.value as SortKey)}
            className="bg-panel border border-border text-subtle text-xs rounded-lg px-2 py-2 font-mono">
            <option value="score">Score</option>
            <option value="vol_zscore">Vol Z</option>
            <option value="momentum_7d">Mom 7d</option>
            <option value="atr_momentum">ATR Mom</option>
            <option value="rv">Realised Vol</option>
          </select>
          <button onClick={()=>setSortDesc(d=>!d)}
            className="p-2 bg-panel border border-border rounded-lg text-subtle hover:text-amber transition-colors">
            <ArrowUpDown size={13}/>
          </button>
          {/* Refresh */}
          <button onClick={()=>load(true)} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber/10 border border-amber/25
                       text-amber text-xs font-mono rounded-lg hover:bg-amber/20 transition-all disabled:opacity-40">
            <RefreshCw size={12} className={loading ? 'animate-spin-slow' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {error && <ErrorBox msg={error} />}

      {/* Table */}
      {loading && !data ? (
        <div className="space-y-2">{Array.from({length:8}).map((_,i)=><Skeleton key={i} className="h-14"/>)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState msg="No coins match this filter right now" />
      ) : (
        <div className="bg-panel border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] text-subtle font-mono uppercase tracking-widest border-b border-border">
                  {['#','Coin','Score','Signal','Vol Z','VP-Div','Mom 7d','Mom 30d','ATR Mom','RV','Price'].map(h=>(
                    <th key={h} className={clsx('py-2.5 px-3 font-normal', h!=='#'&&h!=='Coin' ? 'text-right' : 'text-left')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c: any, i: number) => (
                  <>
                    <tr key={c.sym}
                      onClick={()=>setExpanded(e=>e===c.sym?null:c.sym)}
                      className="border-b border-border/40 hover:bg-muted/10 cursor-pointer transition-colors">
                      <td className="py-3 px-3 text-muted font-mono">{i+1}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1">
                          {expanded===c.sym ? <ChevronDown size={10} className="text-subtle"/> : <ChevronRight size={10} className="text-subtle"/>}
                          <div>
                            <div className="font-mono font-medium text-bright text-[11px]">{c.sym}</div>
                            <div className="text-[9px] text-subtle">{c.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right"><ScoreBar value={c.score}/></td>
                      <td className="py-3 px-3 text-right">
                        <span className={`badge badge-${c.signal_key}`}>{c.signal_label}</span>
                      </td>
                      <td className={clsx('py-3 px-3 text-right font-mono text-[11px]',
                        c.vol_zscore>1.5?'text-amber':c.vol_zscore>0.5?'text-body':'text-muted')}>
                        {c.vol_zscore?.toFixed(2)}σ
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-[11px] text-body">{c.vol_price_div?.toFixed(2)}</td>
                      <td className="py-3 px-3 text-right"><PctChange value={c.momentum_7d}/></td>
                      <td className="py-3 px-3 text-right"><PctChange value={c.momentum_30d}/></td>
                      <td className={clsx('py-3 px-3 text-right font-mono text-[11px]',
                        c.atr_momentum>1.5?'text-green':c.atr_momentum<-1?'text-red':'text-body')}>
                        {c.atr_momentum?.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-[11px] text-subtle">{c.rv?.toFixed(1)}%</td>
                      <td className="py-3 px-3 text-right font-mono text-[11px] text-bright">
                        ${c.close < 1 ? c.close?.toFixed(5) : c.close?.toLocaleString(undefined,{maximumFractionDigits:2})}
                      </td>
                    </tr>
                    {expanded===c.sym && (
                      <tr key={`${c.sym}-exp`} className="bg-panel/60 border-b border-border/40">
                        <td colSpan={11} className="px-6 py-3">
                          <p className="text-xs text-body mb-1.5">{c.reading}</p>
                          <div className="flex flex-wrap gap-4 text-[10px] text-subtle font-mono">
                            <span>Vol Δ24h: {c.vol_chg > 0 ? '+' : ''}{c.vol_chg?.toFixed(1)}%</span>
                            <span>Mom 30d: {c.momentum_30d > 0 ? '+' : ''}{c.momentum_30d?.toFixed(1)}%</span>
                            <span>FDV Disc: {c.fdv_discount?.toFixed(2)}</span>
                            <span>Turnover: {c.turnover_ratio?.toFixed(2)}%</span>
                            <span>CMC Rank: #{c.rank}</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="bg-panel border border-border rounded-xl px-4 py-3 text-[10px] font-mono text-subtle grid grid-cols-1 sm:grid-cols-2 gap-1">
        <span>✦ ACCUM — vol up, price quiet: smart-money loading</span>
        <span>➤ MOMENTUM — quality move with volume confirmation</span>
        <span>◈ COILING — vol compressing, watch for directional break</span>
        <span>⚠ FOMO — price ran hard, high risk of being exit liquidity</span>
      </div>
    </div>
  )
}
