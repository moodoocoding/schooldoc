import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { TeacherAuthProvider } from './auth/TeacherAuthProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <TeacherAuthProvider>
        <App />
      </TeacherAuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
