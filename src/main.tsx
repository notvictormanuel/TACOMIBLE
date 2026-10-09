import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { aplicarTema, leerTema } from './vistas/Turno'
import { AvisosProvider } from './componentes/ui'
import './estilos.css'

aplicarTema(leerTema())
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => aplicarTema(leerTema()))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AvisosProvider>
      <App />
    </AvisosProvider>
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
