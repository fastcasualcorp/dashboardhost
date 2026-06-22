import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Sin StrictMode: en desarrollo provocaba doble montaje (doble "recarga"
// visible en las animaciones de entrada). El build de producción no lo usa.
createRoot(document.getElementById('root')!).render(<App />)
