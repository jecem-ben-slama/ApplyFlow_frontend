/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4f46e5', // indigo-600 — primary actions (light + dark)
          hover: '#6366f1',   // indigo-500
        },
        accent: {
          DEFAULT: '#8b5cf6', // violet-500 — decorative accents (modal top bar, etc.)
        },
        success: {
          DEFAULT: '#059669', // emerald-600
          bg: '#ecfdf5',      // emerald-50
          text: '#047857',    // emerald-700
        },
        danger: {
          DEFAULT: '#e11d48', // rose-600
          bg: '#fff1f2',      // rose-50
          text: '#be123c',    // rose-700
        },
      },
    },
  },
  plugins: [],
}