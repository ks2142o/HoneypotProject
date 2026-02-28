/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg:     '#0a0e1a',
          card:   '#0f1629',
          card2:  '#060810',
          border: '#1d2d55',
          muted:  '#8b949e',
          text:   '#c9d1d9',
          bright: '#e6edf3',
          accent: '#00d4ff',
          green:  '#00ff9d',
          red:    '#ff4757',
          yellow: '#ffd32a',
          purple: '#a55eea',
          orange: '#ff6b35',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Courier New"', 'monospace'],
      },
      backgroundImage: {
        'gradient-header': 'linear-gradient(90deg, #0a0e1a 0%, #162040 50%, #0a0e1a 100%)',
        'gradient-card':   'linear-gradient(135deg, #0f1629 0%, #162040 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fadeIn':     'fadeIn 0.3s ease-in-out',
        'slideIn':    'slideIn 0.3s ease-in-out',
        'spin-slow':  'spin 2s linear infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slideIn: { from: { opacity: 0, transform: 'translateX(100%)' }, to: { opacity: 1, transform: 'translateX(0)' } },
      },
      boxShadow: {
        'cyber':    '0 0 20px rgba(0,212,255,0.08)',
        'cyber-lg': '0 0 40px rgba(0,212,255,0.15)',
        'glow-green': '0 0 12px rgba(0,255,157,0.3)',
        'glow-red':   '0 0 12px rgba(255,71,87,0.3)',
      },
    },
  },
  plugins: [],
}
