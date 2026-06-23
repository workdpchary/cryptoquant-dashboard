import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink:    '#080C14',
        panel:  '#0F1520',
        border: '#1E2A3A',
        muted:  '#3A4A5C',
        subtle: '#6B7F96',
        body:   '#A8BBCC',
        bright: '#E2EBF0',
        amber:  '#F5A623',
        green:  '#00C896',
        red:    '#FF4D6D',
        blue:   '#4D9FFF',
        violet: '#9B7FFF',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      keyframes: {
        'fade-in':  { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'spin-slow':{ from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
        'pulse-dot':{ '0%,100%': { opacity: '1' }, '50%': { opacity: '0.3' } },
      },
      animation: {
        'fade-in':  'fade-in 0.35s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'spin-slow':'spin-slow 1s linear infinite',
        'pulse-dot':'pulse-dot 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
export default config
