/* ════════════════════════════════════════════════════════════
   Componentes base del panel REBELL.
   Todas las secciones se construyen con estos bloques para que
   el panel entero comparta el lenguaje visual de la Caja.
   Marca: dorado #ffbf10 sobre casi-negro. Sombras neutras.
   ════════════════════════════════════════════════════════════ */
import type { CSSProperties, ReactNode } from 'react'

export type Tone = 'gold' | 'green' | 'blue' | 'amber' | 'red' | 'muted'

/* Tarjeta base (superficie + borde + spotlight dorado al hover, como en la Caja). */
export function Card({
  children,
  className = '',
  pad = true,
  style,
}: {
  children: ReactNode
  className?: string
  pad?: boolean
  style?: CSSProperties
}) {
  return <div className={`panel-card${pad ? ' pad' : ''} ${className}`} style={style}>{children}</div>
}

/* Cabecera de sección: título grande + subtítulo + acciones a la derecha. */
export function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string
  subtitle?: string
  right?: ReactNode
}) {
  return (
    <div className="section-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {right && <div className="sh-right">{right}</div>}
    </div>
  )
}

/* Píldora/etiqueta de estado. */
export function Badge({ children, tone = 'muted' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`badge-pill t-${tone}`}>{children}</span>
}

/* KPI grande reutilizable: etiqueta, número, y pie con tendencia/objetivo. */
export function KpiTile({
  label,
  value,
  unit,
  delta,
  foot,
  trend = 'flat',
}: {
  label: string
  value: ReactNode
  unit?: string
  delta?: string
  foot?: string
  trend?: 'up' | 'down' | 'flat'
}) {
  return (
    <div className="panel-card pad kpi-tile">
      <div className="k">{label}</div>
      <div className="kpi-body">
        <div className="v tnum">
          {value}
          {unit && <small> {unit}</small>}
        </div>
        {(delta || foot) && (
          <div className={`kpi-foot ${trend === 'up' ? 'up' : trend === 'down' ? 'down' : ''}`}>
            {delta && (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  {trend === 'down' ? <path d="M7 7 17 17M15 17H7V9" /> : <path d="M7 17 17 7M9 7h8v8" />}
                </svg>
                {delta}
              </>
            )}
            {foot && <span className="kpi-obj">{foot}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

/* Fila con barra de proporción (efectivo/tarjeta/categorías…). */
export function BarRow({
  label,
  value,
  max,
  color = 'gold',
  amount,
}: {
  label: string
  value: number
  max: number
  color?: string
  amount?: ReactNode
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="bar-row">
      <span className="br-label">{label}</span>
      <span className="br-track">
        <span className={`br-fill c-${color}`} style={{ width: pct + '%' }} />
      </span>
      <span className="br-amt tnum">{amount ?? value}</span>
    </div>
  )
}

/* Gráfica de barras verticales (días, meses…). */
export function BarChart({
  data,
  height = 130,
  color = 'gold',
  highlightLast = true,
}: {
  data: { label: string; value: number }[]
  height?: number
  color?: string
  highlightLast?: boolean
}) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="bar-chart" style={{ height }}>
      {data.map((d, i) => {
        const hot = highlightLast && i === data.length - 1
        return (
          <div className="bc-col" key={i}>
            <span className="bc-val tnum">{d.value.toLocaleString('es-ES')}</span>
            <div className={`bc-bar c-${color}${hot ? ' hot' : ''}`} style={{ height: (d.value / max) * 100 + '%' }} />
            <span className="bc-x">{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

/* Tabla de datos estilizada. Las celdas aceptan texto o nodos (badges, etc.). */
export type Column = { key: string; label: string; align?: 'left' | 'right' | 'center' }
export function DataTable({ columns, rows }: { columns: Column[]; rows: Record<string, ReactNode>[] }) {
  return (
    <div className="dtable-wrap">
      <table className="dtable">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`a-${c.align || 'left'}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key} className={`a-${c.align || 'left'}`}>
                  {r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* Anillo de progreso (food cost %, ocupación…). */
export function Donut({ value, label, sub, tone = 'gold' }: { value: number; label?: string; sub?: string; tone?: Tone }) {
  const r = 34
  const c = 2 * Math.PI * r
  const off = c * (1 - Math.min(1, Math.max(0, value / 100)))
  const stroke = tone === 'green' ? '#34d399' : tone === 'red' ? '#f87171' : tone === 'amber' ? '#f5b341' : '#ffbf10'
  return (
    <div className="donut-wrap">
      <div className="donut">
        <svg viewBox="0 0 84 84">
          <circle cx="42" cy="42" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="8" />
          <circle cx="42" cy="42" r={r} fill="none" stroke={stroke} strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 42 42)" />
        </svg>
        <div className="donut-c">
          <b className="tnum">{value}%</b>
        </div>
      </div>
      {(label || sub) && (
        <div className="donut-cap">
          {label && <b>{label}</b>}
          {sub && <span>{sub}</span>}
        </div>
      )}
    </div>
  )
}

/* Grids de ayuda. */
export function Grid({ cols = 2, children, className = '' }: { cols?: number; children: ReactNode; className?: string }) {
  return (
    <div className={`p-grid ${className}`} style={{ ['--cols' as string]: cols }}>
      {children}
    </div>
  )
}
