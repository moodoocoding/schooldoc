/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: ['var(--sd-text-xs)', { lineHeight: 'var(--sd-leading-xs)' }],
        sm: ['var(--sd-text-sm)', { lineHeight: 'var(--sd-leading-sm)' }],
        base: ['var(--sd-text-base)', { lineHeight: 'var(--sd-leading-base)' }],
        lg: ['var(--sd-text-lg)', { lineHeight: 'var(--sd-leading-lg)' }],
        xl: ['var(--sd-text-xl)', { lineHeight: 'var(--sd-leading-xl)' }],
        '2xl': ['var(--sd-text-2xl)', { lineHeight: 'var(--sd-leading-2xl)' }],
        '3xl': ['var(--sd-text-3xl)', { lineHeight: 'var(--sd-leading-3xl)' }],
        '4xl': ['var(--sd-text-4xl)', { lineHeight: 'var(--sd-leading-4xl)' }],
        '5xl': ['var(--sd-text-5xl)', { lineHeight: 'var(--sd-leading-5xl)' }],
      },
    },
  },
  plugins: [],
}
