import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#2EA8FF',
          dark: '#1A8FE3',
          glow: 'rgba(46,168,255,0.35)',
          subtle: 'rgba(46,168,255,0.15)',
        },
      },
      boxShadow: {
        'glow-sm': '0 0 12px rgba(46,168,255,0.35), 0 0 4px rgba(46,168,255,0.2)',
        'glow': '0 0 20px rgba(46,168,255,0.4), 0 0 8px rgba(46,168,255,0.25)',
        'glow-lg': '0 0 32px rgba(46,168,255,0.45), 0 0 16px rgba(46,168,255,0.25)',
        'glow-inset': 'inset 0 0 20px rgba(46,168,255,0.08)',
      },
      backgroundImage: {
        'radial-glow': 'radial-gradient(ellipse at top, rgba(46,168,255,0.08) 0%, transparent 60%)',
      },
    },
  },
  plugins: [],
}

export default config
