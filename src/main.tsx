import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { TeacherAuthProvider } from './auth/TeacherAuthProvider.tsx'
import { AppearanceProvider } from './features/settings/AppearanceProvider.tsx'
import { applyAppearanceSettings, loadAppearanceSettings } from './features/settings/appearanceSettings.ts'

const initialAppearanceSettings = loadAppearanceSettings()
applyAppearanceSettings(initialAppearanceSettings)

// 일렉트론 포터블 로컬 환경(file:// 프로토콜)에서는 HashRouter를 사용하여 화면 전환을 완벽히 보장함
const isElectronEnv = typeof window !== 'undefined' && (
  Boolean(window.electronAPI?.isElectron) || window.location.protocol === 'file:'
)
const Router = isElectronEnv ? HashRouter : BrowserRouter

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <AppearanceProvider initialSettings={initialAppearanceSettings}>
        <TeacherAuthProvider>
          <App />
        </TeacherAuthProvider>
      </AppearanceProvider>
    </Router>
  </StrictMode>,
)
