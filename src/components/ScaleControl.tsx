import { useEffect, useState } from 'react'
import { loadScale, setUiScale, autoFitScale, SCALE_MIN, SCALE_MAX } from '../lib/designTokens'

/* Mando flotante DISCRETO (abajo-derecha) para el TAMAÑO de la interfaz: siempre a la vista pero sin gritar
   (semitransparente hasta el hover). Incluye el botón "Ajustar a pantalla" que pone el % perfecto para que
   TODO entre en una vista. Sincronizado con el slider de Canon vía el evento `rebell:uiscale`. (Juan, 28-jun) */
export default function ScaleControl() {
  const [scale, setScale] = useState(() => loadScale())
  const [fitted, setFitted] = useState(false)

  useEffect(() => {
    const onEvt = (e: Event) => setScale((e as CustomEvent<number>).detail)
    window.addEventListener('rebell:uiscale', onEvt)
    return () => window.removeEventListener('rebell:uiscale', onEvt)
  }, [])

  const set = (v: number) => { setScale(v); setUiScale(v) }
  const fit = () => {
    const v = autoFitScale()
    set(v)
    setFitted(true)
    window.setTimeout(() => setFitted(false), 1100)
  }

  return (
    <div className="scalebar" role="group" aria-label="Tamaño de la interfaz">
      <button className={'scalebar-fit' + (fitted ? ' ok' : '')} onClick={fit} title="Ajustar el tamaño para que todo entre en tu pantalla">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 4H5a1 1 0 0 0-1 1v4M15 4h4a1 1 0 0 1 1 1v4M9 20H5a1 1 0 0 1-1-1v-4M15 20h4a1 1 0 0 0 1-1v-4" />
        </svg>
        <span>{fitted ? 'Ajustado' : 'Ajustar'}</span>
      </button>
      <span className="scalebar-sep" aria-hidden="true" />
      <input
        type="range" min={SCALE_MIN} max={SCALE_MAX} step={0.02} value={scale}
        onChange={(e) => set(parseFloat(e.target.value))}
        aria-label="Tamaño de la interfaz"
      />
      <span className="scalebar-pct tnum">{Math.round(scale * 100)}%</span>
    </div>
  )
}
