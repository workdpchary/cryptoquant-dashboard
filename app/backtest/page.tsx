'use client'
import { useState } from 'react'
import { Play } from 'lucide-react'
import clsx from 'clsx'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import {
  StatCard, SectionHeader, Skeleton, ErrorBox
} from '@/app/components/ui'

const DEFAULT_COINS = 'ETH,SOL,BNB,AVAX,LINK,DOT,NEAR,APT,OP,ARB,INJ,FET,GRT,LDO,AAVE,RNDR,TIA,WIF,PEPE,JUP,SUI,SEI,BONK,FLOKI'

const REGIME_COLORS: Record<number,string> = {0:'#FF4D6D',1:'#6B7F96',2:'#F5A623',3:'#00C896'}

function grade(s: any): string {
  if (!s) return '—'
  if (s.sharpe > 1.5 && s.max_drawdown < 12) return 'A+'
  if (s.sharpe > 1.2 && s.max_drawdown < 18) return 'A'
  if (s.sharpe > 0.7) return 'B'
  if (s.sharpe > 0.2) return 'C'
  return 'D'
}
const gradeColor: Record<string,string> = {
  'A+':'text-green', A:'text-green', B:'text-amber', C:'text-subtle', D:'text-red'
}

export default function BacktestPage() {
  const [result,  setResult]  = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string|null>(null)
  const [coins,   setCoins]   = useState(DEFAULT_COINS)
  const [cap,     setCap]     = useState('100000')
  const [days,    setDays]    = useState('365')
  const [tab,     setTab]     = useState<'oos'|'is'>('oos')

  async function run() {
    setLoading(true); setError(null); setResult(null)
    try {
      const syms = coins.split(/[\s,]+/).map(s=>s.trim().toUpperCase()).filter(Boolean)
      const res  = await fetch('/api/backtest', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ coins: syms, days: +days, initial_cap: +cap }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || res.statusText)
      setResult(json)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const bt = result?.[tab]

  const eqData    = bt?.equity_curve?.map((v:number,i:number)=>({i,v})) ?? []
  const ddData    = bt?.dd_series?.map((v:number,i:number)=>({i,v:-Math.abs(v)})) ?? []
  const regData   = bt?.regime_series?.map((v:number,i:number)=>({i,v})) ?? []

  // PnL distribution buckets
  const distData = (() => {
    if (!bt?.trades?.length) return []
    const counts: Record<number,number> = {}
    for (const t of bt.trades) {
      const b = Math.round((t.pnl_pct ?? 0) / 5) * 5
      counts[b] = (counts[b] ?? 0) + 1
    }
    return Object.entries(counts).map(([k,v])=>({ pct:+k, count:v })).sort((a,b)=>a.pct-b.pct)
  })()

  const tickStyle = { fill:'#6B7F96', fontSize:9, fontFamily:'JetBrains Mono' }
  const gridStyle = { stroke:'#1E2A3A' }
  const ttStyle   = { background:'#0F1520', border:'1px solid #1E2A3A', borderRadius:6, fontSize:11 }

  return (
    <div className="pt-6 space-y-5 animate-fade-in">
      <SectionHeader title="Walk-Forward Backtest"
        sub="Real Binance OHLCV · ATR stops · IS/OOS split · Monte Carlo" />

      {/* Config */}
      <div className="bg-panel border border-border rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-subtle uppercase tracking-wider block">Initial Capital ($)</label>
            <input value={cap} onChange={e=>setCap(e.target.value)} placeholder="100000"
              className="w-full bg-ink border border-border rounded-lg px-3 py-2 text-sm font-mono
                         text-bright focus:outline-none focus:border-amber/50" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-subtle uppercase tracking-wider block">Lookback</label>
            <select value={days} onChange={e=>setDays(e.target.value)}
              className="w-full bg-ink border border-border rounded-lg px-3 py-2 text-sm font-mono
                         text-bright focus:outline-none focus:border-amber/50">
              <option value="180">180 days</option>
              <option value="365">365 days</option>
              <option value="500">500 days</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={run} disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5
                         bg-amber text-ink font-mono font-bold text-sm rounded-lg
                         hover:bg-amber/90 transition-all disabled:opacity-40">
              <Play size={14} className={loading ? 'animate-spin-slow' : ''} />
              {loading ? 'Running…' : 'Run Backtest'}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono text-subtle uppercase tracking-wider block">Coin Universe (comma-separated)</label>
          <textarea value={coins} onChange={e=>setCoins(e.target.value)} rows={2}
            className="w-full bg-ink border border-border rounded-lg px-3 py-2 text-xs font-mono
                       text-bright focus:outline-none focus:border-amber/50 resize-none" />
        </div>
        <p className="text-[10px] text-subtle font-mono">
          Strategy: 8-factor cross-sectional score · ATR(14) stops 2× & targets 5× · BTC regime gate ·
          1.5% risk / trade · max 8 open positions · 0.1% maker + 0.3% slippage + 0.03%/day funding
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 bg-panel border border-amber/20 rounded-xl px-4 py-3">
            <div className="w-2 h-2 rounded-full bg-amber animate-pulse-dot" />
            <span className="text-xs font-mono text-amber">
              Fetching Binance OHLCV + running walk-forward simulation…
              <span className="text-subtle ml-2">(30–90 seconds)</span>
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({length:8}).map((_,i)=><Skeleton key={i} className="h-20"/>)}
          </div>
          <Skeleton className="h-60" />
        </div>
      )}

      {error && !loading && <ErrorBox msg={error} />}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-5 animate-slide-up">

          {/* IS / OOS tabs */}
          <div className="flex gap-1 bg-panel border border-border rounded-xl p-1 w-fit">
            {(['oos','is'] as const).map(t => (
              <button key={t} onClick={()=>setTab(t)}
                className={clsx('px-4 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all',
                  tab===t ? 'bg-amber/15 text-amber' : 'text-subtle hover:text-body')}>
                {t==='oos' ? `Out-of-sample (${result.split.oos_days}d) ← honest` : `In-sample (${result.split.is_days}d)`}
              </button>
            ))}
          </div>

          {bt && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Total Return"
                  value={`${bt.total_return > 0 ? '+' : ''}${bt.total_return}%`}
                  color={bt.total_return > 0 ? 'green' : 'red'} size="lg" glow />
                <StatCard label="Sharpe Ratio" value={bt.sharpe}
                  color={bt.sharpe > 1 ? 'green' : bt.sharpe > 0 ? 'amber' : 'red'}
                  sub=">1.0 good  >1.5 strong" />
                <StatCard label="Max Drawdown" value={`${bt.max_drawdown}%`}
                  color={bt.max_drawdown < 15 ? 'green' : bt.max_drawdown < 25 ? 'amber' : 'red'} />
                <div className="bg-panel border border-border rounded-xl p-4">
                  <span className="text-[10px] text-subtle uppercase tracking-widest font-mono block mb-1">Grade</span>
                  <span className={clsx('font-["Syne"] font-bold text-5xl', gradeColor[grade(bt)])}>{grade(bt)}</span>
                </div>
                <StatCard label="Profit Factor" value={bt.profit_factor}
                  color={bt.profit_factor > 1.5 ? 'green' : bt.profit_factor > 1 ? 'amber' : 'red'}
                  sub=">1.5 edge  >2.0 strong" />
                <StatCard label="Win Rate" value={`${bt.win_rate}%`}
                  sub={`${bt.n_wins}W / ${bt.n_losses}L`} />
                <StatCard label="Sortino" value={bt.sortino}
                  color={bt.sortino > 1 ? 'green' : 'amber'} sub="downside-adjusted" />
                <StatCard label="Expectancy / trade"
                  value={`$${Math.round(bt.expectancy).toLocaleString()}`}
                  color={bt.expectancy > 0 ? 'green' : 'red'} />
              </div>

              {/* MC strip */}
              <div className="bg-panel border border-border rounded-xl px-4 py-3 flex flex-wrap gap-4 text-[11px] font-mono">
                <span className="text-subtle">Monte Carlo (100 paths on OOS trades):</span>
                <span>95th-pct MDD: <span className={bt.mc_p95_mdd > 30 ? 'text-red' : 'text-amber'}>{bt.mc_p95_mdd}%</span></span>
                <span>95th-pct Return: <span className={bt.mc_p95_return > 0 ? 'text-green' : 'text-red'}>{bt.mc_p95_return > 0 ? '+' : ''}{bt.mc_p95_return}%</span></span>
                <span>Best: <span className="text-green">{bt.best_trade > 0 ? '+' : ''}{bt.best_trade}%</span></span>
                <span>Worst: <span className="text-red">{bt.worst_trade}%</span></span>
                <span>Avg hold: {bt.avg_hold_days}d</span>
              </div>

              {/* Charts */}
              <div className="bg-panel border border-border rounded-xl p-4">
                <p className="text-[10px] font-mono text-subtle uppercase tracking-widest mb-3">Equity Curve</p>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={eqData}>
                    <defs>
                      <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#00C896" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#00C896" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E2A3A"/>
                    <XAxis dataKey="i" tick={tickStyle}/>
                    <YAxis tick={tickStyle} width={60}
                           tickFormatter={v=>`$${Math.round(v/1000)}k`}/>
                    <Tooltip formatter={(v:any)=>[`$${Number(v).toLocaleString()}`,'Equity']}
                             contentStyle={ttStyle} labelStyle={{color:'#6B7F96'}} itemStyle={{color:'#00C896'}}/>
                    <ReferenceLine y={+cap} stroke="#3A4A5C" strokeDasharray="3 3"/>
                    <Area type="monotone" dataKey="v" stroke="#00C896" strokeWidth={2}
                          fill="url(#eq)" isAnimationActive={false}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-panel border border-border rounded-xl p-4">
                  <p className="text-[10px] font-mono text-subtle uppercase tracking-widest mb-3">Drawdown (%)</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={ddData}>
                      <defs>
                        <linearGradient id="dd" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#FF4D6D" stopOpacity={0.35}/>
                          <stop offset="95%" stopColor="#FF4D6D" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E2A3A"/>
                      <XAxis dataKey="i" tick={tickStyle}/>
                      <YAxis tick={tickStyle} tickFormatter={v=>`${v.toFixed(0)}%`} width={36}/>
                      <Tooltip formatter={(v:any)=>[`${Math.abs(Number(v)).toFixed(2)}%`,'DD']}
                               contentStyle={ttStyle} labelStyle={{color:'#6B7F96'}} itemStyle={{color:'#FF4D6D'}}/>
                      <Area type="monotone" dataKey="v" stroke="#FF4D6D" strokeWidth={1.5}
                            fill="url(#dd)" isAnimationActive={false}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-panel border border-border rounded-xl p-4">
                  <p className="text-[10px] font-mono text-subtle uppercase tracking-widest mb-3">BTC Regime</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={regData} barSize={3}>
                      <XAxis dataKey="i" tick={tickStyle}/>
                      <YAxis ticks={[0,1,2,3]} tick={tickStyle} width={20}/>
                      <Bar dataKey="v" isAnimationActive={false}
                           fill="#6B7F96"
                           label={false}
                           shape={(props:any)=><rect {...props} fill={REGIME_COLORS[props.value]??'#6B7F96'} opacity={0.8}/>}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-panel border border-border rounded-xl p-4">
                  <p className="text-[10px] font-mono text-subtle uppercase tracking-widest mb-3">Trade P&L Dist.</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={distData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E2A3A"/>
                      <XAxis dataKey="pct" tick={tickStyle} tickFormatter={v=>`${v}%`}/>
                      <YAxis tick={tickStyle} width={24}/>
                      <Tooltip formatter={(v:any)=>[v,'trades']}
                               contentStyle={ttStyle} labelStyle={{color:'#6B7F96'}}/>
                      <ReferenceLine x={0} stroke="#3A4A5C"/>
                      <Bar dataKey="count" isAnimationActive={false}
                           shape={(props:any)=><rect {...props} fill={props.pct>=0?'#00C896':'#FF4D6D'} opacity={0.75} rx={2}/>}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Trade log */}
              <TradeLog trades={bt.trades ?? []}/>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function TradeLog({ trades }: { trades: any[] }) {
  const [open, setOpen] = useState(false)
  const recent = [...trades].reverse().slice(0, 80)
  return (
    <div className="bg-panel border border-border rounded-xl overflow-hidden">
      <button onClick={()=>setOpen(o=>!o)}
        className="w-full flex items-center justify-between px-4 py-3
                   text-xs font-mono text-subtle hover:text-body transition-colors">
        <span>Trade Log ({trades.length} trades)</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full text-[10px] font-mono">
            <thead>
              <tr className="text-subtle border-b border-border">
                {['Coin','Entry day','Exit day','Entry $','Exit $','PnL $','PnL %','Hold','Status'].map(h=>(
                  <th key={h} className="px-3 py-2 text-left font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map((t,i)=>(
                <tr key={i} className="border-b border-border/30 hover:bg-ink/40">
                  <td className="px-3 py-1.5 text-bright">{t.sym}</td>
                  <td className="px-3 py-1.5 text-subtle">d{t.entry_day}</td>
                  <td className="px-3 py-1.5 text-subtle">d{t.exit_day}</td>
                  <td className="px-3 py-1.5">${t.entry_price?.toFixed(4)}</td>
                  <td className="px-3 py-1.5">${t.exit_price?.toFixed(4)}</td>
                  <td className={clsx('px-3 py-1.5', t.pnl>0?'text-green':'text-red')}>
                    {t.pnl>0?'+':''}${Math.round(t.pnl).toLocaleString()}
                  </td>
                  <td className={clsx('px-3 py-1.5', t.pnl_pct>0?'text-green':'text-red')}>
                    {t.pnl_pct>0?'+':''}{t.pnl_pct?.toFixed(2)}%
                  </td>
                  <td className="px-3 py-1.5 text-subtle">{t.hold_days}d</td>
                  <td className="px-3 py-1.5">
                    <span className={clsx('px-1.5 py-0.5 rounded text-[9px]',
                      t.status==='tp'?'bg-green/15 text-green':
                      t.status==='sl'?'bg-red/15 text-red':
                      'bg-muted/20 text-subtle')}>
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
