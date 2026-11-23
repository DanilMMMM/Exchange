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
          primary: '#0E1117',     // Sleek pure midnight dark (Bybit / Binance Pro)
          secondary: '#161922',   // Clean sub-panels & toolbars
          card: '#1A1D28',        // Distinct clean cards & widgets
          panel: '#222634',       // Inputs & inner containers
          hover: '#2B3042',       // Crisp high-contrast hover
        },
        border: {
          subtle: '#232736',
          DEFAULT: '#232736',     // Crisp dark slate border without murky tones
          focus: '#3C445C',
        },
        text: {
          primary: '#F2F4F8',     // High-contrast clean white
          secondary: '#929AA5',   // Crisp slate secondary (Bybit standard)
          muted: '#5E6673',       // De-emphasized labels
        },
        trade: {
          buy: '#0ECB81',         // Clean emerald green
          'buy-hover': '#00B272',
          'buy-subtle': 'rgba(14, 203, 129, 0.15)',
          sell: '#F6465D',        // Crisp crimson red
          'sell-hover': '#E0364C',
          'sell-subtle': 'rgba(246, 70, 93, 0.15)',
        },
        accent: {
          gold: '#F0B90B',        // Premium Binance/Bybit VIP gold
          'gold-hover': '#FCD535',
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
