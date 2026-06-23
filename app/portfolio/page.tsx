'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, RefreshCw, X } from 'lucide-react'
import clsx from 'clsx'
import { StatCard, SectionHeader, Skeleton, EmptyState, ErrorBox } from '@/app/components/ui'

interface Position {
  id: string; sym: string; entry_price: number; size_usd: number
  entry_date: string; stop?: number; target?: number; notes: string
  live_price?: number; pnl_pct?: number; pnl_usd?: number
  current_val?: number; vs_stop?: number; vs_target?: number
}

export default function PortfolioPage() {
  const [data,    setData]    = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string|null>(null)
  const [modal,   setModal]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res  = await fetch('/api/portfolio')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || res.statusText)
      setData(json)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function addPosition(body: any) {
    const res = await fetch('/api/portfolio', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Failed')
    await load()
  }

  async function remove(id: string) {
    if (!confirm('Remove this position?')) return
    await fetch(`/api/portfolio?id=${id}`, { method: 'DELETE' })
    await load()
  }

  const s  = data?.summary
  const ps = (data?.positions ?? []) as Position[]

  return (
    <div className="pt-6 space-y-5 animate-fade-in">
      {modal && <AddModal onClose={()=>setModal(false)} onAdd={addPosition} />}

      <div className="flex items-start justify-between gap-3">
        <SectionHeader title="Portfolio"
          sub={data ? `${ps.length} positions · ${new Date(data.fetched_at).toLocaleTimeString()}` : 'Loading…'} />
        <div className="flex gap-2">
          <button onClick={load} disabled={loading}
            className="p-2 bg-panel border border-border rounded-lg text-subtle hover:text-amber transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin-slow' : ''} />
          </button>
          <button onClick={()=>setModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber/10 border border-amber/25
                       text-amber text-xs font-mono rounded-lg hover:bg-amber/20 transition-all">
            <Plus size={13}/> Add position
          </button>
        </div>
      </div>

      {s && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Open Positions" value={s.n_positions} />
          <StatCard label="Deployed"       value={`$${Math.round(s.total_deployed).toLocaleString()}`} />
          <StatCard label="Total Value"
            value={`$${Math.round(s.total_value).toLocaleString()}`}
            color={s.total_pnl_usd >= 0 ? 'green' : 'red'} glow />
          <StatCard label="Unrealised P&L"
            value={`${s.total_pnl_usd >= 0 ? '+' : ''}$${Math.round(s.total_pnl_usd).toLocaleString()}`}
            sub={`${s.total_pnl_pct >= 0 ? '+' : ''}${s.total_pnl_pct}%`}
            color={s.total_pnl_usd >= 0 ? 'green' : 'red'} size="lg" />
        </div>
      )}

      {error && <ErrorBox msg={error} />}

      {loading && !data && (
        <div className="space-y-2">{Array.from({length:3}).map((_,i)=><Skeleton key={i} className="h-28"/>)}</div>
      )}

      {!loading && ps.length === 0 && <EmptyState msg="No open positions. Add one to start tracking." />}

      <div className="space-y-3">
        {ps.map(p => <PosCard key={p.id} pos={p} onRemove={()=>remove(p.id)} />)}
      </div>

      <div className="bg-panel border border-border rounded-xl px-4 py-3 text-[10px] font-mono text-subtle space-y-0.5">
        <p className="text-muted font-medium">RISK REMINDER</p>
        <p>Prices live from Binance. P&L is unrealised. Always honour your pre-defined stop — moving stops wider after entry is a risk management failure.</p>
      </div>
    </div>
  )
}

function PosCard({ pos: p, onRemove }: { pos: Position; onRemove: ()=>void }) {
  const profit = (p.pnl_usd ?? 0) >= 0
  const pnlUsd = p.pnl_usd ?? 0

  return (
    <div className={clsx('bg-panel border rounded-xl p-4 flex items-start justify-between gap-4',
      profit ? 'border-green/20' : 'border-red/20')}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono font-medium text-bright">{p.sym}</span>
          {p.pnl_pct !== undefined && (
            <span className={clsx('text-[10px] px-1.5 py-0.5 rounded font-mono',
              profit ? 'bg-green/10 text-green' : 'bg-red/10 text-red')}>
              {profit ? '+' : ''}{p.pnl_pct?.toFixed(2)}%
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] font-mono text-subtle">
          <span>Entry: ${p.entry_price?.toLocaleString(undefined,{maximumFractionDigits:6})}</span>
          {p.live_price && <span>Now: ${p.live_price?.toLocaleString(undefined,{maximumFractionDigits:6})}</span>}
          <span>Size: ${p.size_usd?.toLocaleString()}</span>
          <span>Since: {p.entry_date}</span>
        </div>
        {p.stop && p.target && p.live_price && (
          <RiskBar entry={p.entry_price} stop={p.stop} target={p.target} live={p.live_price}/>
        )}
        {p.notes && <p className="mt-1.5 text-[10px] text-subtle italic truncate">{p.notes}</p>}
      </div>
      <div className="text-right shrink-0">
        <div className={clsx('font-["Syne"] font-bold text-xl',
          profit ? 'text-green' : 'text-red')}>
          {pnlUsd >= 0 ? '+' : ''}${Math.round(pnlUsd).toLocaleString()}
        </div>
        {p.current_val && (
          <div className="text-[10px] font-mono text-subtle mt-0.5">
            ${p.current_val?.toLocaleString(undefined,{maximumFractionDigits:0})} value
          </div>
        )}
        <button onClick={onRemove}
          className="mt-3 p-1.5 text-muted hover:text-red transition-colors rounded-lg hover:bg-red/10">
          <Trash2 size={12}/>
        </button>
      </div>
    </div>
  )
}

function RiskBar({ entry, stop, target, live }:{entry:number;stop:number;target:number;live:number}) {
  const range   = target - stop || 1e-9
  const livePct = Math.min(Math.max((live - stop) / range * 100, 0), 100)
  const entPct  = Math.min(Math.max((entry - stop) / range * 100, 0), 100)
  const toStop   = ((live - stop)   / live * 100).toFixed(1)
  const toTarget = ((target - live) / live * 100).toFixed(1)
  return (
    <div className="mt-2 space-y-1">
      <div className="relative h-1.5 bg-border rounded-full">
        <div className="absolute inset-y-0 left-0 bg-red/30 rounded-l-full"
             style={{width:`${entPct}%`}}/>
        <div className="absolute inset-y-0 bg-green/25 rounded-r-full"
             style={{left:`${entPct}%`,right:`${100-Math.max(livePct,entPct)}%`}}/>
        <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-amber rounded-full border border-ink"
             style={{left:`calc(${entPct}% - 4px)`}}/>
        <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-bright rounded-full border-2 border-ink"
             style={{left:`calc(${livePct}% - 5px)`}}/>
      </div>
      <div className="flex justify-between text-[9px] font-mono">
        <span className="text-red">SL ${stop?.toLocaleString(undefined,{maximumFractionDigits:4})} (−{toStop}%)</span>
        <span className="text-green">TP ${target?.toLocaleString(undefined,{maximumFractionDigits:4})} (+{toTarget}%)</span>
      </div>
    </div>
  )
}

function AddModal({ onClose, onAdd }:{ onClose:()=>void; onAdd:(d:any)=>Promise<void> }) {
  const [f, setF] = useState({sym:'',entry_price:'',size_usd:'',stop:'',target:'',notes:'',entry_date:''})
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const set = (k:string)=>(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>setF(p=>({...p,[k]:e.target.value}))

  async function submit() {
    if (!f.sym||!f.entry_price||!f.size_usd){setErr('Coin, entry price and size required');return}
    setSaving(true);setErr('')
    try {
      await onAdd({...f, entry_price:+f.entry_price, size_usd:+f.size_usd,
        stop:f.stop?+f.stop:undefined, target:f.target?+f.target:undefined})
      onClose()
    } catch(e:any){setErr(e.message)}
    finally{setSaving(false)}
  }

  return (
    <div className="fixed inset-0 bg-ink/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-panel border border-border rounded-2xl w-full max-w-md p-6 space-y-4 animate-slide-up">
        <div className="flex items-center justify-between">
          <h3 className="font-['Syne'] text-bright font-bold">Add Position</h3>
          <button onClick={onClose} className="text-subtle hover:text-body"><X size={18}/></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            {label:'Coin', k:'sym', ph:'SOL'},
            {label:'Entry Price $', k:'entry_price', ph:'147.00'},
            {label:'Position Size $', k:'size_usd', ph:'5000'},
            {label:'Entry Date', k:'entry_date', ph:'', type:'date'},
            {label:'Stop Loss $', k:'stop', ph:'Optional'},
            {label:'Take Profit $', k:'target', ph:'Optional'},
          ].map(({label,k,ph,type})=>(
            <div key={k} className="space-y-1">
              <label className="text-[10px] font-mono text-subtle uppercase tracking-wider block">{label}</label>
              <input value={(f as any)[k]} onChange={set(k)} placeholder={ph} type={type??'text'}
                className="w-full bg-ink border border-border rounded-lg px-3 py-2 text-sm font-mono
                           text-bright focus:outline-none focus:border-amber/50"/>
            </div>
          ))}
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-mono text-subtle uppercase tracking-wider block">Notes</label>
          <textarea value={f.notes} onChange={set('notes')} rows={2} placeholder="Why you're in this trade…"
            className="w-full bg-ink border border-border rounded-lg px-3 py-2 text-xs font-mono
                       text-bright focus:outline-none focus:border-amber/50 resize-none"/>
        </div>
        {err && <p className="text-red text-xs font-mono">{err}</p>}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2 border border-border rounded-lg text-subtle text-sm font-mono hover:border-muted transition-colors">
            Cancel
          </button>
          <button onClick={submit} disabled={saving}
            className="flex-1 py-2 bg-amber text-ink font-mono font-bold text-sm rounded-lg
                       hover:bg-amber/90 transition-all disabled:opacity-40">
            {saving ? 'Adding…' : 'Add Position'}
          </button>
        </div>
      </div>
    </div>
  )
}
