import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Sin StrictMode: en desarrollo provocaba doble montaje (doble "recarga"
// visible en las animaciones de entrada). El build de producción no lo usa.
createRoot(document.getElementById('root')!).render(<App />)

// Modo offline: registramos el service worker SOLO en producción (en dev rompería
// el hot-reload de Vite cacheando módulos). Tras la 1ª carga, la app abre sin red.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* sin SW: la app sigue funcionando, solo sin caché offline */
    })
  })
}
