import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 시험 비교용 임시 설정: 이 브랜치의 Vercel 미리보기만 시험 함수(neis-helper-next)를 쓴다. 병합 전에 제거한다.
const neisPreviewFunction = process.env.VERCEL_GIT_COMMIT_REF === 'claude/neis-achievement-notes' ? 'neis-helper-next' : ''

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === 'portable' ? './' : '/',
  envDir: mode === 'portable' ? false : undefined,
  build: { outDir: mode === 'portable' ? 'dist-portable' : 'dist' },
  plugins: [react()],
  ...(neisPreviewFunction ? { define: { 'import.meta.env.VITE_NEIS_FUNCTION': JSON.stringify(neisPreviewFunction) } } : {}),
}))
