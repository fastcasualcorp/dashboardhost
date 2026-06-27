import { useMemo, useState, type CSSProperties } from 'react'
import { Card, SectionHeader, KpiTile, DataTable, Badge, Grid } from '../components/ui'
import { play } from '../lib/sound'
import { useEquipo, updateEmp, costeMes, ROLE_META, ROLE_KEYS, type Emp, type Role } from '../lib/equipo'

/* Empleados — vista FICHAS (mismo lenguaje que la Carta): foto héroe como SILUETA (tipo "personaje sin
   desbloquear" de videojuego) + panel glossy con muesca + stat con glow + color por rol. Cada ficha FLIPa
   en 3D para editar sus datos (sueldo, cargo, jornada). Toggle a la TABLA clásica.
   DATOS desde la FUENTE ÚNICA `lib/equipo` → el sueldo y el coste/mes que se editan aquí cambian a la vez
   en Horarios y Coste personal. El coste/mes se DERIVA del horario real (no un número clavado). */

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

type Draft = { nombre: string; role: Role; liquido: string; jornada: 'Completa' | 'Parcial' }

export default function Empleados() {
  const emps = useEquipo()
  const [vista, setVista] = useState<'fichas' | 'tabla'>('fichas')
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>({ nombre: '', role: 'sala', liquido: '', jornada: 'Completa' })

  // KPIs DERIVADOS en vivo (antes eran números clavados que no se movían al editar).
  const kpi = useMemo(() => {
    const n = emps.length
    const costeEmp = emps.reduce((s, e) => s + costeMes(e), 0)
    const medio = n ? Math.round(emps.reduce((s, e) => s + e.liquidoMes, 0) / n) : 0
    return { n, costeEmp, medio }
  }, [emps])

  const filas = emps.map((e) => ({
    nombre: e.nombre,
    categoria: <Badge tone={ROLE_META[e.role].tone}>{ROLE_META[e.role].label}</Badge>,
    jornada: e.jornada,
    liquido: `${e0(e.liquidoMes)},00 €`,
    coste: `${e0(costeMes(e))} €`,
  }))

  function cambiarVista(v: 'fichas' | 'tabla') {
    if (v === vista) return
    setVista(v)
    play('tap', 0.45)
  }
  function openEdit(e: Emp) {
    setDraft({ nombre: e.nombre, role: e.role, liquido: String(e.liquidoMes), jornada: e.jornada })
    setEditId(e.id)
    play('tap', 0.45)
  }
  function cancelEdit() {
    setEditId(null)
    play('tap', 0.4)
  }
  function saveEdit(id: string) {
    const liq = parseInt(draft.liquido.replace(/[^\d]/g, ''), 10)
    updateEmp(id, {
      nombre: draft.nombre.trim() || undefined,
      role: draft.role,
      liquidoMes: isNaN(liq) ? undefined : liq,
      jornada: draft.jornada,
    })
    setEditId(null)
    play('toggle', 0.5)
  }

  return (
    <div className="section">
      <SectionHeader title="Empleados" subtitle="Plantilla" right={<Badge tone="muted">{kpi.n} activos</Badge>} />

      <Grid cols={3} className="kpi-grid">
        <KpiTile label="Empleados" value={String(kpi.n)} unit="personas" delta="0" foot="plantilla actual" trend="flat" />
        <KpiTile label="Coste empresa / mes" value={kpi.costeEmp.toLocaleString('es-ES')} unit="€" delta="real" foot="horas × coste/hora" trend="flat" />
        <KpiTile label="Salario medio neto" value={kpi.medio.toLocaleString('es-ES')} unit="€" delta="media" foot="líquido plantilla" trend="flat" />
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
                    <b className="emp-stat-num">{e0(e.liquidoMes)}€</b>
                    <small>Líquido / mes</small>
                  </span>
                  <span className="emp-panel">
                    <span className="emp-tab">
                      <b className="emp-name">{e.nombre}</b>
                      <span className="emp-sub">{rm.emoji} {rm.label} · {e.jornada}</span>
                      <span className="emp-notch" aria-hidden="true" />
                    </span>
                    <span className="emp-foot">
                      <span className="emp-f"><b>{e0(costeMes(e))} €</b><i>Coste empresa</i></span>
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
                    <p className="eb-note">El horario y el coste real se ajustan en <b>Horarios</b> y <b>Coste personal</b>.</p>
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
