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
          main: '#F5F6F2',
          surface: '#FFFFFF',
          sidebar: '#F0F2ED',
          subtle: '#E8F0EA',
          muted: '#ECEEE8',
        },
        border: {
          subtle: '#E7ECE5',
          DEFAULT: '#DFE4DD',
          strong: '#C2CDC0',
        },
        text: {
          main: '#202925',
          secondary: '#68736C',
          muted: '#85918A',
        },
        accent: {
          DEFAULT: '#246B52',
          hover: '#1B5440',
          subtle: '#E8F0EA',
          border: '#D1E1D5',
        },
        status: {
          healthy: '#368363',
          warning: '#B98232',
          critical: '#B74747',
          info: '#2B6E8A',
        }
      },
      fontFamily: {
        heading: ['"Plus Jakarta Sans"', 'Inter', '-apple-system', 'sans-serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      }
    },
  },
  plugins: [],
}
