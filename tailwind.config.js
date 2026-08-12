/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        destak: {
          orange: '#ff7900',
          purple: '#5741c7',
        }
      }
    },
  },
  plugins: [],
}
