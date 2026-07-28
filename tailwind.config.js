/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ops: {
          bg: '#0A0C10',
          sidebar: '#0E1117',
          card: '#141822',
          cardHover: '#1B202D',
          border: '#232938',
          borderSubtle: '#1C212E',
          muted: '#8A95A5',
          text: '#F0F4F8',
          subtext: '#9BA3AF',
        },
        cockroach: {
          red: '#FF3838',
          redHover: '#E02B2B',
          redDark: '#851616',
          redGlow: 'rgba(255, 56, 56, 0.25)',
          redSubtle: 'rgba(255, 56, 56, 0.12)',
        },
        sev: {
          0: '#FF2A2A', // SEV-0 Critical Red
          1: '#FF6B00', // SEV-1 High Orange
          2: '#EAB308', // SEV-2 Medium Yellow
          3: '#3B82F6', // SEV-3 Low Blue
        }
      },
      fontFamily: {
        sans: ['Inter', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'glow-red': '0 0 20px rgba(255, 56, 56, 0.35)',
        'glow-red-sm': '0 0 10px rgba(255, 56, 56, 0.2)',
        'card-dark': '0 4px 20px -2px rgba(0, 0, 0, 0.5)',
      },
      animation: {
        'pulse-fast': 'pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scanline': 'scanline 2s linear infinite',
      },
      keyframes: {
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(1000%)' },
        }
      }
    },
  },
  plugins: [],
}
