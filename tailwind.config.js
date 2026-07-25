/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FFF5F3',
          100: '#FFEBE6',
          200: '#FFCDCA',
          300: '#FFA59D',
          400: '#FF7060',
          500: '#FF4D30', // main brand red-orange
          600: '#E6391E',
          700: '#CC2B12',
          800: '#A6210C',
          900: '#7F1807',
          orange: '#FF7A00',
        }
      },
      fontFamily: {
        sans: ['Pretendard', 'Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
