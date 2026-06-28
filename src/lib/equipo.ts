/* ════════════════════════════════════════════════════════════════════
   FUENTE ÚNICA DEL EQUIPO (cimiento 0.1, 27-jun).
   UN solo roster del que derivan Empleados, Horarios y Coste personal.
   Antes había 3 plantillas distintas (personas diferentes) y el coste estaba
   clavado a mano → se contradecían. Ahora: editas el sueldo o un turno en un
   sitio y cambia EN LOS TRES a la vez.

   Patrón reactivo idéntico a lib/wallet.ts: estado en el módulo + evento
   'rebell:equipo' + hook useEquipo(). Persistido en localStorage (cuando esté
   Supabase, esto sube a la nube con RLS: son datos de PII → nunca en claro).

   CADENA DE COSTE (todo deriva, nada clavado):
     coste/hora = (líquido × FACTOR_EMPRESA) / horas contratadas del mes
     coste real = horas TRABAJADAS (turnos) × coste/hora
   → subir el sueldo en Empleados o un turno en Horarios mueve el coste en todo.

   CABLEADO A SUPABASE (Fase 1): si hay sesión, el roster (PII: nóminas) vive en
   la tabla `empleados`, con RLS que SOLO deja a la gerencia del local (M5). Sin
   sesión, demo en localStorage. Sin realtime (un editor por local).
   ════════════════════════════════════════════════════════════════════ */
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { isDemoMode } from './demo'

export type Role = 'encargado' | 'cocina' | 'sala' | 'reparto'
export type Turno = { m: boolean; t: boolean }
export type Emp = {
  id: string
  nombre: string
  role: Role
  jornada: 'Completa' | 'Parcial'
  liquidoMes: number // salario líquido al mes (€) — lo que cobra la persona
  antig: string
  sexo: 'h' | 'm'
  turnos: Turno[] // 7 días (Lun..Dom), cada uno con mañana/tarde
}

export const ROLE_META: Record<Role, { label: string; color: string; emoji: string; tone: 'gold' | 'amber' | 'blue' | 'green' }> = {
  encargado: { label: 'Encargado/a', color: '#ffbf10', emoji: '👑', tone: 'gold' },
  cocina: { label: 'Cocina', color: '#f5a524', emoji: '🍳', tone: 'amber' },
  sala: { label: 'Sala', color: '#3a86ff', emoji: '🪑', tone: 'blue' },
  reparto: { label: 'Reparto', color: '#34d399', emoji: '🛵', tone: 'green' },
}
export const ROLE_KEYS = Object.keys(ROLE_META) as Role[]

export const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
export const DIAS_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export const DIAS_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
export const HORAS_TURNO = 8 // h por turno (mañana 08–16, tarde 14–22)
export const SEMANAS_MES = 52 / 12 // ≈ 4,33 semanas/mes
const FACTOR_EMPRESA = 1.4 // coste para la empresa ≈ líquido × 1,4 (SS + retenciones)
const horasContratoSemana = (e: Emp) => (e.jornada === 'Completa' ? 40 : 24)

// patrón compacto → turnos: 'M' mañana · 'T' tarde · 'D' doble · 'L' libre
const pat = (s: string): Turno[] => s.split('').map((c) => ({ m: c === 'M' || c === 'D', t: c === 'T' || c === 'D' }))

// Roster semilla (8 personas).
const SEED: Emp[] = [
  { id: 'e1', nombre: 'Marta Fernández', role: 'encargado', jornada: 'Completa', liquidoMes: 1420, antig: '4 años', sexo: 'm', turnos: pat('MMMMMLL') },
  { id: 'e2', nombre: 'Carlos Rodríguez', role: 'encargado', jornada: 'Completa', liquidoMes: 1380, antig: '3 años', sexo: 'h', turnos: pat('TTTTTLL') },
  { id: 'e3', nombre: 'Lucía Gómez', role: 'cocina', jornada: 'Completa', liquidoMes: 1140, antig: '2 años', sexo: 'm', turnos: pat('LMMMMML') },
  { id: 'e4', nombre: 'Iván Martínez', role: 'cocina', jornada: 'Completa', liquidoMes: 1140, antig: '1 año', sexo: 'h', turnos: pat('LTTTTTL') },
  { id: 'e5', nombre: 'Sofía Castro', role: 'sala', jornada: 'Completa', liquidoMes: 1080, antig: '2 años', sexo: 'm', turnos: pat('LLTTTTT') },
  { id: 'e6', nombre: 'Diego López', role: 'sala', jornada: 'Parcial', liquidoMes: 640, antig: '1 año', sexo: 'h', turnos: pat('LLLLTTT') },
  { id: 'e7', nombre: 'Elena Sánchez', role: 'reparto', jornada: 'Parcial', liquidoMes: 680, antig: '8 meses', sexo: 'm', turnos: pat('LLLLTTT') },
  { id: 'e8', nombre: 'Pablo Vidal', role: 'reparto', jornada: 'Parcial', liquidoMes: 640, antig: '6 meses', sexo: 'h', turnos: pat('LLLLMMM') },
]

const clone = (list: Emp[]): Emp[] => list.map((e) => ({ ...e, turnos: e.turnos.map((t) => ({ ...t })) }))

// ── derivadas (la lógica de coste, en UN solo sitio) ──
export const turnosSemana = (e: Emp) => e.turnos.reduce((s, d) => s + (d.m ? 1 : 0) + (d.t ? 1 : 0), 0)
export const horasSemana = (e: Emp) => turnosSemana(e) * HORAS_TURNO
// coste para la empresa por HORA, derivado del salario y la jornada contratada
export const costeHora = (e: Emp) => (e.liquidoMes * FACTOR_EMPRESA) / (horasContratoSemana(e) * SEMANAS_MES)
export const costeSemana = (e: Emp) => Math.round(horasSemana(e) * costeHora(e))
export const costeMes = (e: Emp) => Math.round(costeSemana(e) * SEMANAS_MES)
// coste de UN día (índice Lun..Dom) para un empleado
export const costeDia = (e: Emp, di: number) => ((e.turnos[di]?.m ? HORAS_TURNO : 0) + (e.turnos[di]?.t ? HORAS_TURNO : 0)) * costeHora(e)

// ── store reactivo ──
const KEY = 'rebell-equipo-v1'
function load(): Emp[] {
  // REAL: la nube manda → plantilla VACÍA hasta que initSync hidrate desde Supabase.
  // Evita mezclar ventas reales (0) con plantilla de adorno (P&L con margen −∞). La SEED es solo DEMO.
  if (!isDemoMode()) return []
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const arr = JSON.parse(raw) as Emp[]
      if (Array.isArray(arr) && arr.length) return arr
    }
  } catch {
    /* sin localStorage o JSON corrupto → semilla */
  }
  return clone(SEED)
}
let roster: Emp[] = load()

function emit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(roster))
  } catch {
    /* almacenamiento lleno/privado */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('rebell:equipo'))
}

export const getRoster = () => roster

/* ── Cableado Supabase (empleados por local, PII; hidrata + siembra + escribe) ── */
type ERow = { id: string; nombre: string; role: Role; jornada: Emp['jornada']; liquido_mes: number; antig: string | null; sexo: Emp['sexo'] | null; turnos: Turno[] }
const fromRow = (r: ERow): Emp => ({ id: r.id, nombre: r.nombre, role: r.role, jornada: r.jornada, liquidoMes: Number(r.liquido_mes), antig: r.antig ?? '', sexo: r.sexo ?? 'h', turnos: r.turnos || [] })
function patchToDb(p: Partial<Emp>): Record<string, unknown> {
  const d: Record<string, unknown> = {}
  if (p.nombre !== undefined) d.nombre = p.nombre
  if (p.role !== undefined) d.role = p.role
  if (p.jornada !== undefined) d.jornada = p.jornada
  if (p.liquidoMes !== undefined) d.liquido_mes = p.liquidoMes
  if (p.antig !== undefined) d.antig = p.antig
  if (p.sexo !== undefined) d.sexo = p.sexo
  if (p.turnos !== undefined) d.turnos = p.turnos
  return d
}
let _syncStarted = false
let _live = false
async function initSync() {
  if (_syncStarted || !supabase) return
  if (isDemoMode()) return // INTERRUPTOR demo: datos de ejemplo, no sincroniza con la nube
  _syncStarted = true
  const { data } = await supabase.auth.getSession()
  const lid = (data.session?.user?.app_metadata as { local_id?: string })?.local_id
  if (!lid) return // demo → localStorage
  _live = true
  // REAL: NO se siembra la plantilla del cliente con empleados de ejemplo (ensuciaba su BD — auditoría 28-jun).
  // Empresa nueva = plantilla VACÍA. La SEED es solo para DEMO.
  const rows = (await supabase.from('empleados').select('*').eq('local_id', lid).order('creado_at')).data as ERow[] | null
  roster = (rows || []).map(fromRow)
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('rebell:equipo'))
}

export function updateEmp(id: string, patch: Partial<Emp>) {
  roster = roster.map((e) => (e.id === id ? { ...e, ...patch } : e))
  emit()
  if (_live && supabase) supabase.from('empleados').update(patchToDb(patch)).eq('id', id).then(() => {})
}
export function toggleTurno(id: string, dia: number, slot: 'm' | 't') {
  roster = roster.map((e) => (e.id !== id ? e : { ...e, turnos: e.turnos.map((d, j) => (j !== dia ? d : { ...d, [slot]: !d[slot] })) }))
  emit()
  if (_live && supabase) {
    const e = roster.find((x) => x.id === id)
    if (e) supabase.from('empleados').update({ turnos: e.turnos }).eq('id', id).then(() => {})
  }
}

/* Hook: devuelve el roster vivo y re-renderiza cuando cambia en CUALQUIER sección. */
export function useEquipo(): Emp[] {
  const [, force] = useState(0)
  useEffect(() => {
    void initSync()
    const on = () => force((n) => n + 1)
    window.addEventListener('rebell:equipo', on)
    return () => window.removeEventListener('rebell:equipo', on)
  }, [])
  return roster
}
