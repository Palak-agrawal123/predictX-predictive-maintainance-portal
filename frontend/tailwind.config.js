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
          main: '#F4F6F3',
          sidebar: '#141E1A',
          panel: '#FFFFFF',
          elevated: '#F7FAF8',
        },
        border: {
          subtle: '#E5EBE6',
          DEFAULT: '#E0E6E0',
          active: '#B5C4BA',
        },
        text: {
          main: '#202A27',
          muted: '#68756F',
          dim: '#829189',
        },
        accent: {
          DEFAULT: '#176B52',
          hover: '#10543F',
          dim: '#E2EFEA',
        },
        status: {
          healthy: '#27845C',
          warning: '#D99A24',
          critical: '#B94040',
          blue: '#1E7598',
          purple: '#6E4BB6',
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
