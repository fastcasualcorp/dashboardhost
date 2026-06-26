import { useState, type CSSProperties } from 'react'
import { Card, SectionHeader, KpiTile, DataTable, Badge, Grid } from '../components/ui'
import { play } from '../lib/sound'

/* Empleados — vista FICHAS (mismo lenguaje que la Carta): foto héroe como SILUETA (tipo "personaje sin
   desbloquear" de videojuego) + panel glossy con muesca + stat con glow + color por rol. Cada ficha FLIPa
   en 3D para editar sus datos (sueldo, cargo, horario, jornada). Toggle a la TABLA clásica. Pedido Juan (24-jun).
   Avatares genéricos por género (Nano Banana, persona única con pelo); en silueta no se distingue la cara. */

type Role = 'encargado' | 'cocina' | 'sala' | 'reparto'
const ROLE_META: Record<Role, { label: string; color: string; emoji: string; tone: 'gold' | 'amber' | 'blue' | 'green' }> = {
  encargado: { label: 'Encargado/a', color: '#ffbf10', emoji: '👑', tone: 'gold' },
  cocina: { label: 'Cocina', color: '#f5a524', emoji: '🍳', tone: 'amber' },
  sala: { label: 'Sala', color: '#3a86ff', emoji: '🪑', tone: 'blue' },
  reparto: { label: 'Reparto', color: '#34d399', emoji: '🛵', tone: 'green' },
}
const ROLE_KEYS = Object.keys(ROLE_META) as Role[]

type Emp = { id: string; nombre: string; role: Role; jornada: 'Completa' | 'Parcial'; liquido: number; coste: number; antig: string; horario: string; sexo: 'h' | 'm' }
const EMP0: Emp[] = [
  { id: 'e1', nombre: 'Marta Fernández', role: 'encargado', jornada: 'Completa', liquido: 1420, coste: 1990, antig: '4 años', horario: 'L-V 9:00–17:00', sexo: 'm' },
  { id: 'e2', nombre: 'Carlos Rodríguez', role: 'encargado', jornada: 'Completa', liquido: 1380, coste: 1930, antig: '3 años', horario: 'L-V 13:00–21:00', sexo: 'h' },
  { id: 'e3', nombre: 'Lucía Gómez', role: 'cocina', jornada: 'Completa', liquido: 1140, coste: 1600, antig: '2 años', horario: 'M-S 12:00–20:00', sexo: 'm' },
  { id: 'e4', nombre: 'Iván Martínez', role: 'cocina', jornada: 'Completa', liquido: 1140, coste: 1600, antig: '1 año', horario: 'M-S 16:00–00:00', sexo: 'h' },
  { id: 'e5', nombre: 'Sofía Castro', role: 'sala', jornada: 'Completa', liquido: 1080, coste: 1520, antig: '2 años', horario: 'X-D 13:00–21:00', sexo: 'm' },
  { id: 'e6', nombre: 'Diego López', role: 'sala', jornada: 'Parcial', liquido: 640, coste: 900, antig: '1 año', horario: 'V-D 19:00–00:00', sexo: 'h' },
  { id: 'e7', nombre: 'Elena Sánchez', role: 'reparto', jornada: 'Parcial', liquido: 680, coste: 950, antig: '8 meses', horario: 'J-D 20:00–00:00', sexo: 'm' },
  { id: 'e8', nombre: 'Pablo Vidal', role: 'reparto', jornada: 'Parcial', liquido: 640, coste: 910, antig: '6 meses', horario: 'V-D 13:00–17:00', sexo: 'h' },
]

const e0 = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 0 })
const avatar = (e: Emp) => (e.sexo === 'h' ? '/img/staff-man.jpg' : '/img/staff-woman.jpg')

const columnas = [
  { key: 'nombre', label: 'Empleado' },
  { key: 'categoria', label: 'Categoría' },
  { key: 'jornada', label: 'Jornada' },
  { key: 'liquido', label: 'Salario líquido', align: 'right' as const },
  { key: 'coste', label: 'Coste empresa', align: 'right' as const },
]

const Pencil = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
)
const Xmark = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

type Draft = { nombre: string; role: Role; liquido: string; horario: string; jornada: 'Completa' | 'Parcial' }

export default function Empleados() {
  const [vista, setVista] = useState<'fichas' | 'tabla'>('fichas')
  const [emps, setEmps] = useState<Emp[]>(EMP0)
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>({ nombre: '', role: 'sala', liquido: '', horario: '', jornada: 'Completa' })

  const filas = emps.map((e) => ({
    nombre: e.nombre,
    categoria: <Badge tone={ROLE_META[e.role].tone}>{ROLE_META[e.role].label}</Badge>,
    jornada: e.jornada,
    liquido: `${e0(e.liquido)},00 €`,
    coste: `${e0(e.coste)},00 €`,
  }))

  function cambiarVista(v: 'fichas' | 'tabla') {
    if (v === vista) return
    setVista(v)
    play('tap', 0.45)
  }
  function openEdit(e: Emp) {
    setDraft({ nombre: e.nombre, role: e.role, liquido: String(e.liquido), horario: e.horario, jornada: e.jornada })
    setEditId(e.id)
    play('tap', 0.45)
  }
  function cancelEdit() {
    setEditId(null)
    play('tap', 0.4)
  }
  function saveEdit(id: string) {
    const liq = parseInt(draft.liquido.replace(/[^\d]/g, ''), 10)
    setEmps((list) => list.map((e) => (e.id === id ? { ...e, nombre: draft.nombre.trim() || e.nombre, role: draft.role, liquido: isNaN(liq) ? e.liquido : liq, horario: draft.horario.trim() || e.horario, jornada: draft.jornada } : e)))
    setEditId(null)
    play('toggle', 0.5)
  }

  return (
    <div className="section">
      <SectionHeader title="Empleados" subtitle="Plantilla" right={<Badge tone="muted">8 activos</Badge>} />

      <Grid cols={3} className="kpi-grid">
        <KpiTile label="Empleados" value="8" unit="personas" delta="0" foot="plantilla actual" trend="flat" />
        <KpiTile label="Coste empresa / mes" value="12.400,00" unit="€" delta="+1,6%" foot="vs mes anterior" trend="down" />
        <KpiTile label="Salario medio neto" value="1.012,50" unit="€" delta="estable" foot="media plantilla" trend="flat" />
      </Grid>

      <div className="emp-bar">
        <span className="emp-bar-t">Plantilla completa</span>
        <div className="emp-seg" role="tablist" aria-label="Vista de plantilla">
          <button className={'emp-seg-b' + (vista === 'fichas' ? ' on' : '')} onClick={() => cambiarVista('fichas')} role="tab" aria-selected={vista === 'fichas'}>
            <span aria-hidden="true">▦</span> Fichas
          </button>
          <button className={'emp-seg-b' + (vista === 'tabla' ? ' on' : '')} onClick={() => cambiarVista('tabla')} role="tab" aria-selected={vista === 'tabla'}>
            <span aria-hidden="true">☰</span> Tabla
          </button>
          <span className={'emp-seg-ind ' + vista} aria-hidden="true" />
        </div>
      </div>

      {vista === 'fichas' ? (
        <div className="emp-grid">
          {emps.map((e, i) => {
            const rm = ROLE_META[e.role]
            const flipped = editId === e.id
            return (
              <article className={'emp-card' + (flipped ? ' flipped' : '')} key={e.id} style={{ ['--role' as string]: rm.color, ['--i' as string]: i } as CSSProperties}>
                <div className="emp-flipper">
                {/* ── CARA FRONTAL: silueta + datos ── */}
                <div className="emp-face emp-front">
                  <img className="emp-photo" src={avatar(e)} alt="" loading="lazy" draggable={false} />
                  <button className="emp-edit" onClick={() => openEdit(e)} aria-label={`Editar ${e.nombre}`}><Pencil /></button>
                  <span className="emp-id">#{String(i + 1).padStart(2, '0')}</span>
                  <span className="emp-stat">
                    <b className="emp-stat-num">{e0(e.liquido)}€</b>
                    <small>Líquido / mes</small>
                  </span>
                  <span className="emp-panel">
                    <span className="emp-tab">
                      <b className="emp-name">{e.nombre}</b>
                      <span className="emp-sub">{rm.emoji} {rm.label} · {e.jornada}</span>
                      <span className="emp-notch" aria-hidden="true" />
                    </span>
                    <span className="emp-foot">
                      <span className="emp-f"><b>{e0(e.coste)} €</b><i>Coste empresa</i></span>
                      <span className="emp-f right"><b>{e.antig}</b><i>Antigüedad</i></span>
                    </span>
                  </span>
                </div>

                {/* ── CARA TRASERA: edición ── */}
                <div className="emp-face emp-back" onClick={(ev) => ev.stopPropagation()}>
                  <div className="eb-head">
                    <b>Editar ficha</b>
                    <button className="eb-close" onClick={cancelEdit} aria-label="Cerrar"><Xmark /></button>
                  </div>
                  <div className="eb-body">
                    <label className="eb-field"><span>Nombre</span><input value={draft.nombre} onChange={(ev) => setDraft({ ...draft, nombre: ev.target.value })} /></label>
                    <label className="eb-field"><span>Cargo</span>
                      <select value={draft.role} onChange={(ev) => setDraft({ ...draft, role: ev.target.value as Role })}>
                        {ROLE_KEYS.map((k) => <option key={k} value={k}>{ROLE_META[k].label}</option>)}
                      </select>
                    </label>
                    <div className="eb-row">
                      <label className="eb-field"><span>Sueldo €</span><input inputMode="numeric" value={draft.liquido} onChange={(ev) => setDraft({ ...draft, liquido: ev.target.value })} /></label>
                      <label className="eb-field"><span>Jornada</span>
                        <select value={draft.jornada} onChange={(ev) => setDraft({ ...draft, jornada: ev.target.value as 'Completa' | 'Parcial' })}>
                          <option value="Completa">Completa</option>
                          <option value="Parcial">Parcial</option>
                        </select>
                      </label>
                    </div>
                    <label className="eb-field"><span>Horario</span><input value={draft.horario} onChange={(ev) => setDraft({ ...draft, horario: ev.target.value })} /></label>
                  </div>
                  <div className="eb-actions">
                    <button className="eb-btn ghost" onClick={cancelEdit}>Cancelar</button>
                    <button className="eb-btn primary" onClick={() => saveEdit(e.id)}>Guardar</button>
                  </div>
                </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <Card>
          <div className="card-head">
            <h3>Plantilla completa</h3>
            <Badge tone="muted">junio 2026</Badge>
          </div>
          <DataTable columns={columnas} rows={filas} />
        </Card>
      )}
    </div>
  )
}
