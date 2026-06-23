// ─────────────────────────────────────────────────────────────────────────────
// CryptoQuant Engine — factor scoring, regime detection, walk-forward backtest
// ─────────────────────────────────────────────────────────────────────────────

export const STABLES = new Set([
  'USDT','USDC','DAI','FDUSD','TUSD','USDE','PYUSD',
  'USDD','FRAX','USDP','GUSD','BUSD','LUSD','SUSD',
])

export const WEIGHTS = {
  vol_zscore       : 0.18,
  vol_price_div    : 0.17,
  momentum_7d      : 0.14,
  momentum_30d     : 0.10,
  atr_momentum     : 0.12,
  turnover_ratio   : 0.10,
  fdv_discount     : 0.11,
  realised_vol_inv : 0.08,
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface OHLCVRow {
  t: number   // timestamp ms
  o: number; h: number; l: number; c: number; v: number
}

export interface CoinFactors {
  sym            : string
  name           : string
  rank           : number
  close          : number
  atr            : number
  vol_zscore     : number
  vol_price_div  : number
  momentum_7d    : number
  momentum_30d   : number
  atr_momentum   : number
  turnover_ratio : number
  fdv_discount   : number
  realised_vol_inv: number
  rv             : number
  vol_chg        : number
  p7d            : number
  p30d           : number
  score          : number
  signal_key     : string
  signal_label   : string
  reading        : string
  mcap           : number
  fdv            : number
}

export interface RegimeState {
  score    : number   // 0=bear+vol, 1=bear, 2=vol-bull, 3=bull
  label    : string
  is_bull  : boolean
  btc_price: number
  btc_ret7d: number
  btc_rv7d : number
  sma50    : number
  sma200   : number
}

export interface Trade {
  sym        : string
  entry_day  : number
  exit_day   : number
  entry_price: number
  exit_price : number
  size       : number
  stop       : number
  target     : number
  pnl        : number
  pnl_pct    : number
  hold_days  : number
  status     : 'sl' | 'tp' | 'timeout'
  regime     : string
}

export interface BTStats {
  equity_curve   : number[]
  dd_series      : number[]
  regime_series  : number[]
  trades         : Trade[]
  total_return   : number
  sharpe         : number
  sortino        : number
  calmar         : number
  max_drawdown   : number
  win_rate       : number
  avg_win        : number
  avg_loss       : number
  profit_factor  : number
  expectancy     : number
  n_trades       : number
  n_wins         : number
  n_losses       : number
  avg_hold_days  : number
  best_trade     : number
  worst_trade    : number
  mc_p95_mdd     : number
  mc_p95_return  : number
  final_equity   : number
}

// ── Math helpers ─────────────────────────────────────────────────────────────

function mean(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
}

function std(arr: number[]): number {
  if (arr.length < 2) return 0
  const m = mean(arr)
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length)
}

function clip(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x))
}

// ── ATR ──────────────────────────────────────────────────────────────────────

export function computeATR(rows: OHLCVRow[], period = 14): number[] {
  const tr: number[] = []
  for (let i = 0; i < rows.length; i++) {
    const h = rows[i].h, l = rows[i].l, pc = i > 0 ? rows[i - 1].c : rows[i].c
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)))
  }
  const atr: number[] = new Array(rows.length).fill(0)
  for (let i = period - 1; i < rows.length; i++) {
    atr[i] = mean(tr.slice(i - period + 1, i + 1))
  }
  return atr
}

// ── Factor computation ───────────────────────────────────────────────────────

export function computeFactors(
  sym: string, rows: OHLCVRow[],
  mcap = 0, fdv = 0, cmcData?: { p7d: number; p30d: number; name: string; rank: number }
): Partial<CoinFactors> | null {
  if (rows.length < 35) return null

  const close = rows.map(r => r.c)
  const vol   = rows.map(r => r.v)
  const atrs  = computeATR(rows)

  const n    = rows.length
  const last = close[n - 1]
  const atr  = atrs[n - 1] || 1e-9

  // returns
  const ret1d  = n >= 2  ? (close[n-1]/close[n-2]  - 1) * 100 : 0
  const ret7d  = n >= 8  ? (close[n-1]/close[n-8]  - 1) * 100 : 0
  const ret30d = n >= 31 ? (close[n-1]/close[n-31] - 1) * 100 : 0

  // volume z-score vs 30-day average
  const vol30 = vol.slice(Math.max(0, n-31), n-1)
  const volNow = vol[n-1]
  const vm = mean(vol30), vs = std(vol30) || 1e-9
  const vol_z = (volNow - vm) / vs

  // vol-price divergence
  const vol_price_div = vol_z > 0 ? vol_z / (Math.abs(ret1d) + 0.5) : 0

  // ATR momentum (5-day move / ATR)
  const move5d = n >= 6 ? last - close[n-6] : 0
  const atr_momentum = move5d / atr

  // turnover ratio
  const turnover = mcap > 0 ? (volNow * last / mcap) * 100 : 0

  // realised vol 21d
  const rets21 = close.slice(Math.max(0, n-22)).map((c, i, a) => i === 0 ? 0 : (c / a[i-1] - 1))
  const rv = std(rets21.slice(1)) * Math.sqrt(365) * 100

  // FDV discount
  const fdv_discount = mcap > 0 && fdv > 0 ? -Math.log(fdv / mcap + 1) : 0

  // vol change 24h
  const vol_chg = n >= 2 ? ((vol[n-1] / (vol[n-2] || 1e-9)) - 1) * 100 : 0

  return {
    sym, close: last, atr,
    vol_zscore: vol_z,
    vol_price_div,
    momentum_7d : ret7d,
    momentum_30d: ret30d,
    atr_momentum,
    turnover_ratio: Math.min(turnover, 200),
    fdv_discount,
    realised_vol_inv: -rv,
    rv, vol_chg, mcap, fdv,
    p7d : cmcData?.p7d  ?? ret7d,
    p30d: cmcData?.p30d ?? ret30d,
    name: cmcData?.name ?? sym,
    rank: cmcData?.rank ?? 999,
  }
}

// ── Cross-sectional normalisation ────────────────────────────────────────────

const FACTOR_KEYS = Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]

export function crossNormalise(coins: Partial<CoinFactors>[]): CoinFactors[] {
  for (const key of FACTOR_KEYS) {
    const vals = coins.map(c => (c as any)[key] as number || 0)
    const m = mean(vals), s = std(vals)
    const clipped = vals.map(v => s < 1e-9 ? 0 : clip((v - m) / s, -3, 3))
    const lo = Math.min(...clipped), hi = Math.max(...clipped)
    const range = hi - lo || 1e-9
    coins.forEach((c, i) => { (c as any)[key] = (clipped[i] - lo) / range })
  }
  for (const c of coins) {
    c.score = FACTOR_KEYS.reduce((s, k) => s + ((c as any)[k] || 0) * WEIGHTS[k], 0) * 100
    const [sk, sl, rd] = labelSignal(c as CoinFactors)
    c.signal_key = sk; c.signal_label = sl; c.reading = rd
  }
  return coins as CoinFactors[]
}

// ── Signal labeller ──────────────────────────────────────────────────────────

export function labelSignal(c: CoinFactors): [string, string, string] {
  const { vol_zscore: vz, vol_price_div: vpd, momentum_7d: m7, atr_momentum: am } = c
  if (m7 > 25 && vz > 2)                          return ['fomo',        '⚠ FOMO',        'Price already ran hard. High risk of being exit liquidity.']
  if (vpd > 1.5 && vz > 1 && Math.abs(m7) < 8)   return ['accumulation','✦ ACCUM',       'Volume building while price quiet — smart-money loading.']
  if (m7 > 8 && vz > 0.5 && am > 1.5)             return ['momentum',    '➤ MOMENTUM',    'Quality move with volume confirmation.']
  if (m7 < -15 && vz > 2)                          return ['distribution','⬇ DISTRIB',    'Heavy volume on falling price — likely distribution.']
  if (vz > 1.5 && Math.abs(m7) < 4)               return ['coiling',     '◈ COILING',     'Volume compressing on flat price. Watch for directional break.']
  return ['noise', '· NOISE', 'No high-conviction pattern.']
}

// ── Regime detector ──────────────────────────────────────────────────────────

export function detectRegime(btc: OHLCVRow[]): RegimeState {
  if (btc.length < 205) {
    return { score: 1, label: 'INSUFFICIENT HISTORY', is_bull: false,
             btc_price: 0, btc_ret7d: 0, btc_rv7d: 0, sma50: 0, sma200: 0 }
  }
  const close = btc.map(r => r.c)
  const n = close.length
  const sma50  = mean(close.slice(n - 50))
  const sma200 = mean(close.slice(n - 200))
  const rets7  = close.slice(n - 8).map((c, i, a) => i === 0 ? 0 : c / a[i-1] - 1)
  const rv7d   = std(rets7.slice(1)) * Math.sqrt(365) * 100
  const ret7d  = n >= 8 ? (close[n-1] / close[n-8] - 1) * 100 : 0
  const is_bull  = sma50 > sma200 && ret7d > -5
  const is_danger = rv7d > 5

  let score: number, label: string
  if (is_bull && !is_danger)     { score = 3; label = 'BULL' }
  else if (is_bull && is_danger) { score = 2; label = 'VOLATILE BULL' }
  else if (!is_bull && !is_danger){ score = 1; label = 'BEAR' }
  else                            { score = 0; label = 'BEAR + HIGH VOL' }

  return { score, label, is_bull, btc_price: close[n-1],
           btc_ret7d: ret7d, btc_rv7d: rv7d, sma50, sma200 }
}

// ── Walk-forward backtest ────────────────────────────────────────────────────

const MAKER_FEE     = 0.001
const SLIPPAGE      = 0.003
const FUNDING_DAILY = 0.0003
const ATR_STOP_MULT = 2.0
const ATR_TP_MULT   = 5.0
const MAX_POS_PCT   = 0.08
const BASE_RISK_PCT = 0.015
const MAX_DD_KILL   = 0.20
const MAX_OPEN      = 8
const HOLD_MAX      = 21
const REBAL_FREQ    = 7

export function runBacktest(
  universe: Record<string, OHLCVRow[]>,
  btcRows : OHLCVRow[],
  startDay: number,
  nDays   : number,
  initCap = 100_000,
): BTStats {
  const endDay = Math.min(startDay + nDays, btcRows.length)
  let equity = initCap
  const equityCurve: number[] = [equity]
  const dailyRets: number[] = []
  const openTrades: (Omit<Trade, 'exit_day'|'exit_price'|'pnl'|'pnl_pct'|'hold_days'|'status'>)[] = []
  const allTrades: Trade[] = []
  const regimeSeries: number[] = []
  let peak = equity, halted = false

  const rebalDays = new Set<number>()
  for (let d = startDay; d < endDay; d += REBAL_FREQ) rebalDays.add(d)

  for (let day = startDay; day < endDay; day++) {
    const regime = detectRegime(btcRows.slice(0, day + 1))
    regimeSeries.push(regime.score)

    // close trades
    const remaining: typeof openTrades = []
    let dayPnL = 0
    for (const t of openTrades) {
      const sym = t.sym
      const rows = universe[sym]
      if (!rows || day >= rows.length) { remaining.push(t); continue }
      const px = rows[Math.min(day, rows.length - 1)].c
      const holdDays = day - t.entry_day
      const hitSL = px <= t.stop
      const hitTP = px >= t.target
      const timeout = holdDays >= HOLD_MAX
      if (hitSL || hitTP || timeout) {
        const exitPx = hitSL ? Math.min(px, t.stop) : px
        const fees   = (MAKER_FEE + SLIPPAGE) * t.size * 2
        const fund   = FUNDING_DAILY * holdDays * t.size
        const pnl    = t.size * (exitPx / t.entry_price - 1) - fees - fund
        dayPnL += pnl
        allTrades.push({ ...t, exit_day: day, exit_price: exitPx, pnl,
          pnl_pct: (exitPx / t.entry_price - 1) * 100, hold_days: holdDays,
          status: hitSL ? 'sl' : hitTP ? 'tp' : 'timeout' })
      } else { remaining.push(t) }
    }
    openTrades.length = 0
    openTrades.push(...remaining)
    equity += dayPnL
    peak = Math.max(peak, equity)
    halted = (peak - equity) / peak > MAX_DD_KILL

    // rebalance
    if (rebalDays.has(day) && !halted && regime.score > 0) {
      const rm = [0, 0.3, 0.6, 1.0][regime.score]
      const openSyms = new Set(openTrades.map(t => t.sym))
      const rows: Partial<CoinFactors>[] = []

      for (const [sym, symRows] of Object.entries(universe)) {
        if (sym === 'BTC' || openSyms.has(sym) || day >= symRows.length) continue
        const slice = symRows.slice(Math.max(0, day - 60), day + 1)
        if (slice.length < 35) continue
        const f = computeFactors(sym, slice)
        if (f) rows.push(f)
      }

      if (rows.length >= 3) {
        const scored = crossNormalise(rows)
        scored.sort((a, b) => b.score - a.score)
        for (const r of scored.slice(0, 5)) {
          if (openTrades.length >= MAX_OPEN) break
          if (openSyms.has(r.sym)) continue
          const entryPx = r.close
          const atr = r.atr
          if (atr <= 0 || entryPx <= 0) continue
          const stop   = entryPx - ATR_STOP_MULT * atr
          const target = entryPx + ATR_TP_MULT   * atr
          const stopDist = (entryPx - stop) / (entryPx + 1e-9)
          const rawSize  = equity * BASE_RISK_PCT / (stopDist + 1e-9)
          const size     = Math.min(rawSize * rm, equity * MAX_POS_PCT)
          if (size < 100) continue
          equity -= (MAKER_FEE + SLIPPAGE) * size
          openTrades.push({ sym: r.sym, entry_day: day, entry_price: entryPx,
                            size, stop, target, atr: r.atr, regime: regime.label })
          openSyms.add(r.sym)
        }
      }
    }

    equityCurve.push(equity)
    const prev = equityCurve[equityCurve.length - 2] || initCap
    dailyRets.push((equity - prev) / (prev + 1e-9))
  }

  // close remaining
  for (const t of openTrades) {
    const rows = universe[t.sym]
    if (!rows) continue
    const px  = rows[Math.min(endDay - 1, rows.length - 1)].c
    const fees = (MAKER_FEE + SLIPPAGE) * t.size * 2
    const fund = FUNDING_DAILY * (endDay - t.entry_day) * t.size
    const pnl  = t.size * (px / t.entry_price - 1) - fees - fund
    allTrades.push({ ...t, exit_day: endDay, exit_price: px, pnl,
      pnl_pct: (px / t.entry_price - 1) * 100, hold_days: endDay - t.entry_day,
      status: 'timeout' })
    equity += pnl
  }
  equityCurve.push(equity)
  dailyRets.push(0)

  return computeStats(equityCurve, dailyRets, allTrades, regimeSeries, initCap)
}

function computeStats(
  equityCurve: number[], dailyRets: number[], trades: Trade[],
  regimeSeries: number[], initCap: number
): BTStats {
  const totalRet = (equityCurve[equityCurve.length-1] - initCap) / initCap * 100
  const annRet   = totalRet / (equityCurve.length / 365)
  const m  = mean(dailyRets), s = std(dailyRets)
  const sharpe = s < 1e-9 ? 0 : (m / s) * Math.sqrt(365)
  const negRets = dailyRets.filter(r => r < 0)
  const sortino = negRets.length < 2 ? 0 : (m / std(negRets)) * Math.sqrt(365)

  // drawdown
  let peak = equityCurve[0], mdd = 0
  const ddSeries = equityCurve.map(e => {
    peak = Math.max(peak, e)
    const dd = (peak - e) / (peak + 1e-9) * 100
    mdd = Math.max(mdd, dd)
    return dd
  })
  const calmar = annRet / (mdd + 1e-9)

  const wins   = trades.filter(t => t.pnl > 0)
  const losses = trades.filter(t => t.pnl <= 0)
  const winRate = trades.length ? wins.length / trades.length * 100 : 0
  const avgWin  = wins.length   ? mean(wins.map(t => t.pnl))   : 0
  const avgLoss = losses.length ? mean(losses.map(t => t.pnl)) : 0
  const gw = wins.reduce((s, t) => s + t.pnl, 0)
  const gl = Math.abs(losses.reduce((s, t) => s + t.pnl, 0))
  const pf  = gl < 1e-9 ? (gw > 0 ? 99 : 1) : gw / gl
  const exp = (winRate / 100) * avgWin + (1 - winRate / 100) * avgLoss
  const avgHold = trades.length ? mean(trades.map(t => t.hold_days)) : 0
  const pnlPcts = trades.map(t => t.pnl_pct)

  // Monte Carlo (100 paths)
  const tradeRets = trades.map(t => t.pnl / initCap)
  const mcMdds: number[] = [], mcFinals: number[] = []
  for (let p = 0; p < 100; p++) {
    if (!tradeRets.length) break
    const perm = [...tradeRets].sort(() => Math.random() - 0.5)
    let cap = initCap, pk2 = initCap, mdd2 = 0
    for (const r of perm) {
      cap *= (1 + r)
      pk2  = Math.max(pk2, cap)
      mdd2 = Math.max(mdd2, (pk2 - cap) / pk2 * 100)
    }
    mcMdds.push(mdd2)
    mcFinals.push((cap / initCap - 1) * 100)
  }
  const pct = (arr: number[], p: number) => {
    if (!arr.length) return 0
    const s = [...arr].sort((a, b) => a - b)
    return s[Math.floor(s.length * p / 100)] ?? 0
  }

  return {
    equity_curve  : equityCurve.map(v => Math.round(v)),
    dd_series     : ddSeries.map(v => +v.toFixed(2)),
    regime_series : regimeSeries,
    trades        : trades.slice(-200),
    total_return  : +totalRet.toFixed(2),
    sharpe        : +sharpe.toFixed(2),
    sortino       : +sortino.toFixed(2),
    calmar        : +calmar.toFixed(2),
    max_drawdown  : +mdd.toFixed(2),
    win_rate      : +winRate.toFixed(1),
    avg_win       : +avgWin.toFixed(2),
    avg_loss      : +avgLoss.toFixed(2),
    profit_factor : +pf.toFixed(2),
    expectancy    : +exp.toFixed(2),
    n_trades      : trades.length,
    n_wins        : wins.length,
    n_losses      : losses.length,
    avg_hold_days : +avgHold.toFixed(1),
    best_trade    : pnlPcts.length ? +Math.max(...pnlPcts).toFixed(2) : 0,
    worst_trade   : pnlPcts.length ? +Math.min(...pnlPcts).toFixed(2) : 0,
    mc_p95_mdd    : +pct(mcMdds, 95).toFixed(2),
    mc_p95_return : +pct(mcFinals, 95).toFixed(2),
    final_equity  : Math.round(equityCurve[equityCurve.length - 1]),
  }
}
