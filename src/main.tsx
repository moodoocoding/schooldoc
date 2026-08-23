import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { TeacherAuthProvider } from './auth/TeacherAuthProvider.tsx'
import { AppearanceProvider } from './features/settings/AppearanceProvider.tsx'
import { applyAppearanceSettings, loadAppearanceSettings } from './features/settings/appearanceSettings.ts'

const initialAppearanceSettings = loadAppearanceSettings()
applyAppearanceSettings(initialAppearanceSettings)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppearanceProvider initialSettings={initialAppearanceSettings}>
        <TeacherAuthProvider>
          <App />
        </TeacherAuthProvider>
      </AppearanceProvider>
    </BrowserRouter>
  </StrictMode>,
)
