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
          primary: '#080A0D',
          secondary: '#0B0E11',
          card: '#111419',
          panel: '#151921',
          hover: '#1a1f29',
        },
        border: {
          subtle: '#1E232B',
          DEFAULT: '#1E232B',
          focus: '#2d3542',
        },
        text: {
          primary: '#EAECEF',
          secondary: '#7B8494',
          muted: '#4E5564',
        },
        trade: {
          buy: '#0ECB81',
          'buy-hover': '#0fb574',
          'buy-subtle': 'rgba(14, 203, 129, 0.12)',
          sell: '#F6465D',
          'sell-hover': '#dc3b50',
          'sell-subtle': 'rgba(246, 70, 93, 0.12)',
        },
        accent: {
          gold: '#F0B90B',
          'gold-hover': '#d9a70a',
          white: '#F8FAFC',
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
