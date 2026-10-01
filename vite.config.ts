import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === 'portable' ? './' : '/',
  envDir: mode === 'portable' ? false : undefined,
  build: { outDir: mode === 'portable' ? 'dist-portable' : 'dist' },
  plugins: [react()],
}))
