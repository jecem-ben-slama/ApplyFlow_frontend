/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',

  content: [
    "./src/**/*.{html,ts}",
  ],

  theme: {
    extend: {
      colors: {

        // ─── Backgrounds & Surfaces ───────────────────────
        background: {
          DEFAULT: '#0f172a', // fallback for bare `bg-background` / `dark:bg-background`
          light: '#f1f5f9',   // Slate-100 — less bright than #f8fafc
          dark: '#0f172a',    // Slate-900
        },

        surface: {
          DEFAULT: '#1e293b', // fallback for bare `bg-surface` / `dark:bg-surface`
          light: '#ffffff',   // Cards / panels
          dark: '#1e293b',    // Slate-800
          muted: '#334155',   // Slate-700
        },

        // ─── Primary ──────────────────────────────────────
        primary: {
          DEFAULT: '#0d9488', // Teal-600
          hover: '#0f766e',   // Teal-700
          light: '#2dd4bf',   // Teal-400
        },

        // ─── Accent ──────────────────────────────────────
        accent: {
          DEFAULT: '#3b82f6', // Blue-500
          hover: '#2563eb',   // Blue-600
          light: '#60a5fa',   // Blue-400
        },

        // ─── Success ─────────────────────────────────────
        success: {
          DEFAULT: '#10b981',
          bgLight: '#ecfdf5',
          bgDark: '#064e3b',
          textLight: '#047857',
          textDark: '#34d399',
        },

        // ─── Danger ──────────────────────────────────────
        danger: {
          DEFAULT: '#f43f5e',
          bgLight: '#fff1f2',
          bgDark: '#881337',
          textLight: '#be123c',
          textDark: '#fb7185',
        },

        // ─── Warning ─────────────────────────────────────
        warning: {
          DEFAULT: '#f59e0b',
          bgLight: '#fffbeb',
          bgDark: '#78350f',
          textLight: '#b45309',
          textDark: '#fbbf24',
        },
      },

      // ─── Animations ─────────────────────────────────────
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-right': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.15s ease-out',
        'slide-right': 'slide-right 0.2s ease-out',
        'slide-up': 'slide-up 0.25s ease-out',
      },
    },
  },

  plugins: [],
};