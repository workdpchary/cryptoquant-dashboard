# CryptoQuant — Personal Trading Dashboard

Live crypto screener · Real-data walk-forward backtest · Portfolio tracker  
Built with Next.js 14 · Deploys to Vercel in 5 minutes.

---

## Deploy in 5 minutes

### Prerequisites
- Node.js 18+
- A [Vercel account](https://vercel.com) (free)
- A [CoinMarketCap API key](https://coinmarketcap.com/api/) (free Basic tier)

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and add your key
cp .env.example .env.local
# Edit .env.local: set CMC_API_KEY=your_key_here

# 3. Run locally
npm run dev
# → http://localhost:3000

# 4. Deploy to Vercel
npm install -g vercel
vercel                          # first deploy (follow prompts)
vercel env add CMC_API_KEY      # paste your CMC key when prompted
vercel --prod                   # production deploy
```

### Optional: persistent portfolio (Vercel KV)

Without KV, portfolio positions survive only while the serverless function
is warm (~30 min). With KV they persist forever:

1. Open your project in the Vercel dashboard
2. Storage → Create Database → KV (Redis)
3. Connect it to your project
4. `vercel --prod` — Vercel auto-injects `KV_REST_API_URL` + `KV_REST_API_TOKEN`

---

## Architecture

```
app/
  page.tsx              ← Screener (live CMC + Binance signals)
  backtest/page.tsx     ← Walk-forward backtest
  portfolio/page.tsx    ← Position tracker with live P&L
  api/
    screen/route.ts     ← GET /api/screen
    backtest/route.ts   ← POST /api/backtest
    portfolio/route.ts  ← GET/POST/DELETE /api/portfolio
lib/
  engine.ts             ← All quant logic (factors, regime, backtest)
  data.ts               ← CMC + Binance fetchers
```

## Strategy

**8 factors, cross-sectional z-scored:**

| Factor | Weight | What it measures |
|--------|--------|-----------------|
| vol_zscore | 18% | Volume vs 30-day average |
| vol_price_div | 17% | Vol spike ÷ price move (accumulation proxy) |
| momentum_7d | 14% | 7-day return rank |
| momentum_30d | 10% | 30-day trend confirmation |
| atr_momentum | 12% | Price move ÷ ATR (quality of move) |
| turnover_ratio | 10% | Vol ÷ market cap |
| fdv_discount | 11% | Penalises high FDV/float (unlock risk) |
| realised_vol_inv | 8% | Prefers lower-vol coins at entry |

**Risk rules:**
- Stop: Entry − 2×ATR(14) · Target: Entry + 5×ATR(14) → ~2.5R
- Max position: 8% of portfolio · Risk/trade: 1.5%
- Max open: 8 simultaneous · Drawdown kill: 20%
- Regime gate: BTC SMA50 > SMA200 required

**Backtest:** Real Binance OHLCV (free) · 240d IS / 125d OOS split ·
0.1% fees + 0.3% slippage + 0.03%/day funding carry · Monte Carlo on trade sequence

---

## Disclaimer

Personal research tool. Not financial advice. Crypto has significant wash-trading,
manipulation, and tail risk. Never risk what you cannot afford to lose.
