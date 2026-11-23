/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0B0E14',     // Deep obsidian black (Binance/Bybit Pro)
          secondary: '#11151F',   // Sub-panels & toolbars
          card: '#161B26',        // Elevated cards & widgets
          panel: '#1C2230',       // Inputs & inner containers
          hover: '#242C3D',       // High-contrast clean hover
        },
        border: {
          subtle: '#222938',
          DEFAULT: '#222938',     // High-tech crisp dark slate borders
          focus: '#364156',
        },
        text: {
          primary: '#F0F3F8',     // High-contrast clean white
          secondary: '#8C96A8',   // Crisp slate secondary
          muted: '#5A6475',       // De-emphasized labels
        },
        trade: {
          buy: '#0ECB81',         // Vibrant emerald green
          'buy-hover': '#00B272',
          'buy-subtle': 'rgba(14, 203, 129, 0.15)',
          sell: '#F6465D',        // Punchy crimson red
          'sell-hover': '#E0364C',
          'sell-subtle': 'rgba(246, 70, 93, 0.15)',
        },
        accent: {
          gold: '#F0B90B',        // Premium Binance/Bybit VIP gold
          'gold-hover': '#D9A407',
          'gold-subtle': 'rgba(240, 185, 11, 0.15)',
          white: '#FFFFFF',
          cyan: '#00D8F6',
          purple: '#9B51E0',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Roboto Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
