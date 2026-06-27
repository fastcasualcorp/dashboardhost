/* ════════════════════════════════════════════════════════════════════
   GESTOR DE ENERGÍA / RENDIMIENTO — fuente única para bajar calor y batería.
   Dos palancas:
   • data-hidden: cuando la pestaña NO se ve (Page Visibility) → se pausa TODO (animaciones CSS por
     gate global + vídeos). Cero gasto en segundo plano. Seguro: nadie lo está mirando.
   • data-saver ("Salón frío"): modo ahorro → corta los decorados en BUCLE, pausa vídeos y baja el mapa
     a versión ligera. Se ENCIENDE solo cuando vas con BATERÍA (donde el navegador lo permite, p.ej.
     Chromium; Safari no expone batería y se queda en manual) o a mano desde Ajustes.
   Escribe `data-saver` / `data-hidden` en <html>; los leen el CSS (gates) y los bucles JS (rAF del Mapa).
   ════════════════════════════════════════════════════════════════════ */
import { useEffect, useState } from 'react'

type Listener = () => void
const listeners = new Set<Listener>()

let saverManual: boolean | null = readManual() // null = automático (según batería)
let onBattery = false
let hidden = typeof document !== 'undefined' ? document.hidden : false
let inited = false

function readManual(): boolean | null {
  try {
    const v = localStorage.getItem('rebell-saver')
    return v === '1' ? true : v === '0' ? false : null
  } catch {
    return null
  }
}

/** ¿Está el modo ahorro activo ahora mismo? (manual si se fijó; si no, automático según batería) */
export function saverActive(): boolean {
  return saverManual !== null ? saverManual : onBattery
}

/** ¿La pestaña está oculta? (segundo plano) */
export function isHidden(): boolean {
  return hidden
}

/** Estado del interruptor manual: true/false fijado por el usuario, o null = automático. */
export function saverManualState(): boolean | null {
  return saverManual
}

function apply() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const saver = saverActive()
  root.dataset.saver = saver ? '1' : '0'
  root.dataset.hidden = hidden ? '1' : '0'
  // Vídeos: pausar en ahorro o en segundo plano; reanudar los que van en bucle al volver.
  document.querySelectorAll('video').forEach((v) => {
    if (saver || hidden) {
      try { v.pause() } catch { /* ignore */ }
    } else if (v.loop && v.dataset.noresume !== '1') {
      v.play().catch(() => { /* el navegador puede bloquear autoplay hasta un gesto */ })
    }
  })
  listeners.forEach((l) => l())
}

/** Arranca el gestor (idempotente). Llamar una vez al montar la app. */
export function initPower() {
  if (inited || typeof window === 'undefined') return
  inited = true
  document.addEventListener('visibilitychange', () => {
    hidden = document.hidden
    apply()
  })
  // Batería (solo donde exista — Chromium). En Safari/Firefox no está → queda en manual/auto=false.
  const nav = navigator as Navigator & { getBattery?: () => Promise<{ charging: boolean; addEventListener: (e: string, cb: () => void) => void }> }
  if (typeof nav.getBattery === 'function') {
    nav
      .getBattery()
      .then((b) => {
        const upd = () => {
          onBattery = !b.charging
          apply()
        }
        b.addEventListener('chargingchange', upd)
        upd()
      })
      .catch(() => { /* sin API de batería */ })
  }
  apply()
}

/** Fija el modo ahorro a mano (true/false), o null para volver a automático. */
export function setSaverManual(v: boolean | null) {
  saverManual = v
  try {
    if (v === null) localStorage.removeItem('rebell-saver')
    else localStorage.setItem('rebell-saver', v ? '1' : '0')
  } catch { /* sin localStorage */ }
  apply()
}

/** Suscripción para que la UI reaccione a cambios de energía. */
export function subscribePower(l: Listener): () => void {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

/** Hook: re-renderiza cuando cambia el estado de ahorro/visibilidad. */
export function usePower(): { saver: boolean; hidden: boolean; manual: boolean | null } {
  const [, force] = useState(0)
  useEffect(() => subscribePower(() => force((n) => n + 1)), [])
  return { saver: saverActive(), hidden, manual: saverManual }
}
