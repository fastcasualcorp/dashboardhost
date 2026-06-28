/* ════════════════════════════════════════════════════════════
   Componentes base del panel REBELL.
   Todas las secciones se construyen con estos bloques para que
   el panel entero comparta el lenguaje visual de la Caja.
   Marca: dorado #ffbf10 sobre casi-negro. Sombras neutras.
   ════════════════════════════════════════════════════════════ */
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { playCount } from '../lib/sound'

export type Tone = 'gold' | 'green' | 'blue' | 'amber' | 'red' | 'muted'

/* Count-up "de videojuego": el número sube de 0 al valor al aparecer (como el cierre
   de Caja). Funciona con valores ya formateados en es-ES ("30.556", "21,28", "65")
   sin tocar las llamadas: parsea el número, anima, y CLAVA el texto original al final.
   Si el valor no es numérico (un nodo JSX) lo pinta tal cual. Respeta reduced-motion. */
export function CountValue({ value }: { value: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null)
  const raw = typeof value === 'string' || typeof value === 'number' ? String(value) : null
  useEffect(() => {
    const el = ref.current
    if (!el || raw == null) return
    const tok = raw.match(/-?[\d.,]+/)
    if (!tok) {
      el.textContent = raw
      return
    }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = raw
      return
    }
    const numStr = tok[0]
    const hasComma = numStr.includes(',')
    const norm = hasComma ? numStr.replace(/\./g, '').replace(',', '.') : numStr.replace(/\.(?=\d{3}(\D|$))/g, '')
    const target = parseFloat(norm)
    if (isNaN(target)) {
      el.textContent = raw
      return
    }
    const decimals = hasComma ? numStr.split(',')[1]?.length ?? 0 : 0
    const prefix = raw.slice(0, tok.index ?? 0)
    const suffix = raw.slice((tok.index ?? 0) + numStr.length)
    const fmt = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    let start: number | null = null
    let rafId = 0
    const dur = 900
    const step = (t: number) => {
      if (start == null) start = t
      const p = Math.min(1, (t - start) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      if (p < 1) {
        el.textContent = prefix + fmt(target * eased) + suffix
        rafId = requestAnimationFrame(step)
      } else {
        el.textContent = raw // clava el original exacto al terminar
      }
    }
    playCount() // sonido suave de "números cargando" (throttled → 1 vez por tanda)
    rafId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafId)
  }, [raw])
  if (raw == null) return <>{value}</>
  return <span ref={ref}>{raw}</span>
}

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
          <CountValue value={value} />
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

/* ────────────────────────────────────────────────────────────────
   Stat — EL CRITERIO ÚNICO de cifra del dashboard (una sola fuente de
   verdad). Valor grande + unidad pequeña dorada + etiqueta. Cambiar el
   look aquí lo cambia en TODO el panel → imposible que se descuadre.
   Pedido de Juan (24-jun): "para de una vez con ese problema".
   ──────────────────────────────────────────────────────────────── */
export function Stat({
  value,
  unit,
  label,
  tone = 'gold',
  count = true,
}: {
  value: ReactNode
  unit?: string
  label: string
  tone?: 'gold' | 'green'
  count?: boolean
}) {
  return (
    <div className="rstat">
      <b className={'rstat-val' + (tone === 'green' ? ' g' : '')}>
        {count ? <CountValue value={value} /> : value}
        {unit && <i>{unit}</i>}
      </b>
      <span className="rstat-lbl">{label}</span>
    </div>
  )
}

/* Fila de Stats con separadores finos verticales (el patrón del hero de la Caja). */
export function StatRow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rstat-row ${className}`}>{children}</div>
}

/* Fila con barra de proporción (efectivo/tarjeta/categorías…). */
export function BarRow({
  label,
  value,
  max,
  color = 'gold',
  amount,
}: {
  label: ReactNode
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
  // El color SALE del token (clase → var), no de un hex fijo → el anillo sigue al tema (data-accent).
  return (
    <div className="donut-wrap">
      <div className="donut">
        <svg viewBox="0 0 84 84">
          <circle cx="42" cy="42" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="8" />
          <circle className={`donut-arc dt-${tone}`} cx="42" cy="42" r={r} fill="none" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 42 42)" />
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
