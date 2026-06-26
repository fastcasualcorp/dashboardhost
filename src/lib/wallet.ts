/* CAJA DEL DÍA — ÚNICA fuente de verdad del dinero de hoy. La pintan IGUAL la cartera de la cabecera
   ("Hoy") y el "Ventas hoy" del TPV (mismo store + mismo evento → nunca divergen). Sube por DOS vías:
   cobrar una MESA (moneditas que vuelan) y cobrar un TICKET (botón Cobrar del TPV). Persiste por día y se
   reinicia al ABRIR caja (turno apertura→cierre). (Juan, 26-jun) */
import { useEffect, useRef, useState } from 'react'
import { reduceMotion } from './data'

const KEY = 'rebell-caja-dia-v1'
const SEED = 1787.4 // demo: "ya vendido hoy" → ambos marcadores arrancan poblados e IGUALES

const today = () => {
  try {
    return new Date().toISOString().slice(0, 10)
  } catch {
    return '0'
  }
}

// Cada cobro deja una ENTRADA (el "pedido" que hizo posible la cifra) → la cartera se puede abrir y ver el
// desglose, estilo videojuego. tipo: mesa (moneditas) o ticket (TPV). (Juan, 26-jun)
export type CajaEntry = { id: number; ts: number; amount: number; tipo: 'mesa' | 'ticket'; label: string }
type State = { fecha: string; total: number; entries: CajaEntry[] }

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw) as State
      if (s && s.fecha === today() && typeof s.total === 'number') return { fecha: s.fecha, total: s.total, entries: Array.isArray(s.entries) ? s.entries : [] }
    }
  } catch {
    /* sin localStorage */
  }
  return { fecha: today(), total: SEED, entries: [] }
}
let entrySeq = 0

let state = load()

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* sin localStorage */
  }
}
// avisa a TODOS los marcadores (cartera + Ventas hoy) → cuentan-arriba al MISMO valor a la vez
function emit() {
  window.dispatchEvent(new CustomEvent('rebell:caja'))
}

export const walletTotal = () => state.total

export const walletEntries = () => state.entries
// nº de PEDIDOS itemizados de hoy (los que se ven en el desglose; el SEED no cuenta como pedido)
export const walletEntryCount = () => state.entries.length
// "ventas anteriores" = lo que hay en el total y no está itemizado (el SEED/arrastre) → para que el desglose cuadre
export const walletBase = () => Math.round((state.total - state.entries.reduce((s, e) => s + e.amount, 0)) * 100) / 100

export function addWallet(amount: number): number {
  // anti-rollover: si la app cruzó la medianoche sin cerrar caja, NO sumamos sobre el total de ayer → día nuevo a 0
  if (state.fecha !== today()) state = { fecha: today(), total: 0, entries: [] }
  state = { ...state, total: Math.round((state.total + amount) * 100) / 100 }
  persist()
  emit()
  return state.total
}

// Apunta un cobro en el desglose (NO toca el total: el valor lo suma addWallet —directo en ticket, por moneda en mesa).
export function logCobro(amount: number, tipo: 'mesa' | 'ticket', label: string) {
  if (state.fecha !== today()) state = { fecha: today(), total: 0, entries: [] }
  const e: CajaEntry = { id: ++entrySeq, ts: Date.now(), amount: Math.round(amount * 100) / 100, tipo, label }
  state = { ...state, entries: [e, ...state.entries].slice(0, 60) }
  persist()
  emit()
}

// Reinicia la caja del día (turno nuevo) → se llama al ABRIR caja: arranca de 0 y acumula hasta el cierre.
export function resetWallet(): number {
  state = { fecha: today(), total: 0, entries: [] }
  persist()
  emit()
  return 0
}

// Detalle de un cobro de MESA: importe + origen (x,y en viewport, de donde salen las monedas) + nº de monedas.
export type CobroDetail = { amount: number; x: number; y: number; coins?: number }

// Dispara la "lluvia de monedas" hacia la cartera (solo el VUELO visual; el valor lo suma addWallet por moneda).
export function fireCobro(detail: CobroDetail) {
  window.dispatchEvent(new CustomEvent('rebell:cobro', { detail }))
}

// Hook ÚNICO de "caja del día": valor animado (count-up) que sigue al store. Lo usan la cartera y "Ventas hoy"
// → SIEMPRE muestran lo MISMO (misma fuente, mismo evento `rebell:caja`). (Juan, 26-jun)
export function useCajaDelDia(): number {
  const [shown, setShown] = useState(() => walletTotal())
  const shownRef = useRef(shown)
  shownRef.current = shown
  const raf = useRef(0)
  useEffect(() => {
    const onChange = () => {
      const to = walletTotal()
      const from = shownRef.current
      if (from === to) return
      if (reduceMotion()) {
        setShown(to)
        return
      }
      cancelAnimationFrame(raf.current)
      const start = performance.now()
      const dur = 650
      const tick = (t: number) => {
        const k = Math.min(1, (t - start) / dur)
        const e = 1 - Math.pow(1 - k, 3)
        setShown(from + (to - from) * e)
        if (k < 1) raf.current = requestAnimationFrame(tick)
      }
      raf.current = requestAnimationFrame(tick)
    }
    window.addEventListener('rebell:caja', onChange)
    onChange() // sincroniza si el total cambió antes de montar
    return () => {
      window.removeEventListener('rebell:caja', onChange)
      cancelAnimationFrame(raf.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return shown
}
