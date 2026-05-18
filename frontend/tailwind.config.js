/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // ── Typography ──────────────────────────────────────────
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
      },

      // ── Color tokens ────────────────────────────────────────
      colors: {
        primary: '#B5838D',   // Mauve Rose  · buttons, active states
        accent: '#6D6875',   // Muted Purple · secondary UI
        background: '#FFF4F4',   // Light Pink   · page background
        surface: '#FFFFFF',   // White        · card background
        positive: '#81B29A',   // Sage Green   · sentimen positif
        negative: '#E07A5F',   // Coral        · sentimen negatif
        'neutral-s': '#C9B8BD',   // Neutral      · sentimen netral
        border: '#E8CECE',   // Pink border
        'text-main': '#3D2C30',   // Dark rose-brown · body text
        'text-muted': '#8C7177',   // Muted rose-gray · secondary text
      },
    },
  },
  plugins: [],
}