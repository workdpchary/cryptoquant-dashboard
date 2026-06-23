'use client'
import clsx from 'clsx'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

/* ── StatCard ─────────────────────────────────────────────────────────── */
type Color = 'amber'|'green'|'red'|'blue'|'violet'|'default'

const textColor: Record<Color,string> = {
  amber:'text-amber', green:'text-green', red:'text-red',
  blue:'text-blue', violet:'text-violet', default:'text-bright',
}

export function StatCard({
  label, value, sub, color = 'default', size = 'md', glow = false
}: { label:string; value:string|number; sub?:string; color?:Color; size?:'sm'|'md'|'lg'; glow?:boolean }) {
  const sz = { sm:'text-xl', md:'text-2xl', lg:'text-4xl' }[size]
  return (
    <div className={clsx(
      'bg-panel border border-border rounded-xl p-4 flex flex-col gap-1',
      glow && color==='green' && 'shadow-[0_0_18px_rgba(0,200,150,0.1)]',
      glow && color==='red'   && 'shadow-[0_0_18px_rgba(255,77,109,0.1)]',
      glow && color==='amber' && 'shadow-[0_0_18px_rgba(245,166,35,0.1)]',
    )}>
      <span className="text-[10px] text-subtle uppercase tracking-widest font-mono">{label}</span>
      <span className={clsx('font-["Syne"] font-bold', sz, textColor[color])}>{value}</span>
      {sub && <span className="text-[10px] text-subtle">{sub}</span>}
    </div>
  )
}

/* ── PctChange ────────────────────────────────────────────────────────── */
export function PctChange({ value }: { value: number }) {
  const pos = value > 0.005, neg = value < -0.005
  return (
    <span className={clsx('inline-flex items-center gap-0.5 font-mono text-xs',
      pos ? 'text-green' : neg ? 'text-red' : 'text-subtle')}>
      {pos ? <TrendingUp size={10}/> : neg ? <TrendingDown size={10}/> : <Minus size={10}/>}
      {pos ? '+' : ''}{value.toFixed(2)}%
    </span>
  )
}

/* ── RegimeBar ────────────────────────────────────────────────────────── */
const REGIME_CFG = {
  0: { label:'BEAR + HIGH VOL', dot:'bg-red',    text:'text-red'    },
  1: { label:'BEAR',            dot:'bg-subtle', text:'text-subtle' },
  2: { label:'VOLATILE BULL',   dot:'bg-amber',  text:'text-amber'  },
  3: { label:'BULL',            dot:'bg-green',  text:'text-green'  },
}

export function RegimeBar({ regime }: { regime: any }) {
  if (!regime) return null
  const cfg = REGIME_CFG[regime.score as 0|1|2|3] ?? REGIME_CFG[1]
  return (
    <div className="bg-panel border border-border rounded-xl px-4 py-3 flex items-center gap-3">
      <div className={clsx('w-2 h-2 rounded-full shrink-0', cfg.dot,
        regime.score >= 2 && 'animate-pulse-dot')} />
      <div className="min-w-0">
        <span className={clsx('text-[11px] font-mono font-semibold tracking-wider', cfg.text)}>
          REGIME: {cfg.label}
        </span>
        <div className="flex flex-wrap gap-x-4 gap-y-0 mt-0.5 text-[10px] text-subtle font-mono">
          <span>BTC ${regime.btc_price?.toLocaleString(undefined,{maximumFractionDigits:0})}</span>
          <span>7d {regime.btc_ret7d > 0 ? '+' : ''}{regime.btc_ret7d?.toFixed(1)}%</span>
          <span>RV {regime.btc_rv7d?.toFixed(1)}%</span>
          <span>SMA50 ${regime.sma50?.toLocaleString(undefined,{maximumFractionDigits:0})}</span>
          <span>SMA200 ${regime.sma200?.toLocaleString(undefined,{maximumFractionDigits:0})}</span>
        </div>
      </div>
    </div>
  )
}

/* ── ScoreBar ─────────────────────────────────────────────────────────── */
export function ScoreBar({ value }: { value: number }) {
  const pct   = Math.min(Math.max(value, 0), 100)
  const color = pct > 70 ? '#00C896' : pct > 45 ? '#F5A623' : '#3A4A5C'
  return (
    <div className="flex items-center gap-2 justify-end">
      <span className="font-mono text-bright text-xs font-medium w-8 text-right">{value.toFixed(1)}</span>
      <div className="w-14 h-1.5 bg-border rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width:`${pct}%`, background:color }} />
      </div>
    </div>
  )
}

/* ── Skeleton ─────────────────────────────────────────────────────────── */
export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse bg-panel border border-border rounded-xl', className)} />
}

/* ── EmptyState ───────────────────────────────────────────────────────── */
export function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-subtle">
      <span className="text-3xl opacity-25">◈</span>
      <p className="text-sm">{msg}</p>
    </div>
  )
}

/* ── SectionHeader ────────────────────────────────────────────────────── */
export function SectionHeader({ title, sub }: { title:string; sub?:string }) {
  return (
    <div>
      <h2 className="font-['Syne'] text-bright font-bold text-lg tracking-tight">{title}</h2>
      {sub && <p className="text-[10px] text-subtle mt-0.5">{sub}</p>}
    </div>
  )
}

/* ── ErrorBox ─────────────────────────────────────────────────────────── */
export function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="bg-red/10 border border-red/25 text-red rounded-xl px-4 py-3 text-sm font-mono">
      ⚠ {msg}
    </div>
  )
}
