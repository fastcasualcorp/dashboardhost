import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Sin StrictMode: en desarrollo provocaba doble montaje (doble "recarga"
// visible en las animaciones de entrada). El build de producción no lo usa.
createRoot(document.getElementById('root')!).render(<App />)

// Modo offline: registramos el service worker SOLO en producción (en dev rompería
// el hot-reload de Vite cacheando módulos). Tras la 1ª carga, la app abre sin red.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // AUTO-ACTUALIZACIÓN: si ya había un SW controlando la página y entra uno NUEVO
  // (tras un deploy), recargamos UNA vez → el usuario ve la versión nueva sin tener
  // que limpiar caché a mano. En la 1ª visita (sin controlador previo) no recarga.
  if (navigator.serviceWorker.controller) {
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })
  }
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* sin SW: la app sigue funcionando, solo sin caché offline */
    })
  })
}
