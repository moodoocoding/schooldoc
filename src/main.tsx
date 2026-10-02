import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { isDesktop } from './utils/desktop'
import './index.css'
import App from './App.tsx'
import { TeacherAuthProvider } from './auth/TeacherAuthProvider.tsx'
import { AppearanceProvider } from './features/settings/AppearanceProvider.tsx'
import { applyAppearanceSettings, loadAppearanceSettings } from './features/settings/appearanceSettings.ts'

const initialAppearanceSettings = loadAppearanceSettings()
applyAppearanceSettings(initialAppearanceSettings)
const Router = isDesktop() ? HashRouter : BrowserRouter

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
