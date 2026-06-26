/* Estado de la CAJA del local (abierta/cerrada) + numeración de tickets del día.
   Vive en el TPV: por la mañana (o tras cerrar) la caja arranca CERRADA → hay que ABRIRLA con el
   PIN del encargado; al final del turno se CIERRA (también con PIN) y dispara la recompensa.
   Frontend (localStorage) como caché instantánea; cuando haya Supabase se sincroniza por local. */

const CAJA_KEY = 'rebell-caja-estado-v1'
const SEQ_KEY = 'rebell-ticket-seq-v1'

// PIN del encargado (demo). En producción se valida server-side (Edge Function), nunca en el cliente.
export const GERENTE_PIN = '1234'

const hoyStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export type CajaEstado = { abierta: boolean; fecha: string; aperturaTs?: number }

// Lee el estado de caja. Si es un día nuevo (o no hay datos) → CERRADA (hay que abrirla por la mañana).
export function loadCaja(): CajaEstado {
  try {
    const raw = localStorage.getItem(CAJA_KEY)
    if (raw) {
      const c = JSON.parse(raw) as CajaEstado
      if (c.fecha === hoyStr()) return c // mismo día → respeta su estado real
    }
  } catch {
    /* sin localStorage */
  }
  return { abierta: false, fecha: hoyStr() }
}
function saveCaja(c: CajaEstado) {
  try {
    localStorage.setItem(CAJA_KEY, JSON.stringify(c))
  } catch {
    /* sin localStorage */
  }
}
export function abrirCaja(): CajaEstado {
  const c: CajaEstado = { abierta: true, fecha: hoyStr(), aperturaTs: Date.now() }
  saveCaja(c)
  return c
}
export function cerrarCaja(): CajaEstado {
  const c: CajaEstado = { abierta: false, fecha: hoyStr() }
  saveCaja(c)
  return c
}

// ── Numeración de tickets: secuencia diaria. Formato "T-013". El nº enlaza Ticket ↔ Comanda (trazabilidad). ──
type Seq = { fecha: string; n: number }
function readSeq(): Seq {
  try {
    const raw = localStorage.getItem(SEQ_KEY)
    if (raw) {
      const o = JSON.parse(raw) as Seq
      if (o.fecha === hoyStr()) return o
    }
  } catch {
    /* sin localStorage */
  }
  return { fecha: hoyStr(), n: 0 }
}
export const fmtTicket = (n: number) => 'T-' + String(n).padStart(3, '0')
// Reserva y devuelve el siguiente nº de ticket del día (lo persiste).
export function nextTicket(): string {
  const s = readSeq()
  const n = s.n + 1
  try {
    localStorage.setItem(SEQ_KEY, JSON.stringify({ fecha: hoyStr(), n }))
  } catch {
    /* sin localStorage */
  }
  return fmtTicket(n)
}
// Cuántos tickets se han emitido hoy (para el resumen de cierre).
export const ticketsHoy = () => readSeq().n
