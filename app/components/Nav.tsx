'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, Zap, BarChart2, Briefcase } from 'lucide-react'
import clsx from 'clsx'

const NAV = [
  { href: '/',          label: 'Screen',    Icon: Zap },
  { href: '/backtest',  label: 'Backtest',  Icon: BarChart2 },
  { href: '/portfolio', label: 'Portfolio', Icon: Briefcase },
]

export default function Nav() {
  const path = usePathname()
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-ink/85 backdrop-blur-md">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <Activity size={17} className="text-amber" />
          <span className="font-['Syne'] text-bright font-bold text-sm tracking-tight">
            CRYPTO<span className="text-amber">QUANT</span>
          </span>
        </div>

        <nav className="flex items-center gap-1">
          {NAV.map(({ href, label, Icon }) => (
            <Link key={href} href={href}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                path === href
                  ? 'bg-amber/10 text-amber border border-amber/25'
                  : 'text-subtle hover:text-body hover:bg-panel'
              )}>
              <Icon size={12} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 text-[10px] text-subtle font-mono shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse-dot" />
          LIVE
        </div>
      </div>
    </header>
  )
}
