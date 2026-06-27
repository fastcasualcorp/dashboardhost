import { useMemo, useState } from 'react'
import { SectionHeader, Card, Badge, DataTable, Stat, StatRow, type Column, type Tone } from '../components/ui'
import { play } from '../lib/sound'
import { useAccesos, type Acceso, type Evento } from '../lib/acceso'

/* Accesos — el REGISTRO DE SEGURIDAD del local (estilo "historial de login de tu
   banco"): quién inició sesión, abrió o cerró caja, desde qué IP y dispositivo.
   La IP la captura el servidor (Edge Function). Solo la gerencia lo ve (RLS).
   Reusa el lenguaje de los libros (cabecera-héroe + DataTable + filtro). */

const fmtFecha = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
const fmtHora = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const EV: Record<Evento, { t: string; tone: Tone }> = {
  login: { t: 'Inició sesión', tone: 'blue' },
  abrir_caja: { t: 'Abrió caja', tone: 'green' },
  cerrar_caja: { t: 'Cerró caja', tone: 'gold' },
}
const FILTROS: { k: 'todo' | Evento; t: string }[] = [
  { k: 'todo', t: 'Todo' },
  { k: 'login', t: 'Sesiones' },
  { k: 'abrir_caja', t: 'Aperturas' },
  { k: 'cerrar_caja', t: 'Cierres' },
]
// Nombre corto del usuario (antes de la @) para no llenar de email.
const corto = (u: string) => u.split('@')[0]

export default function Accesos() {
  const accesos = useAccesos() // FUENTE ÚNICA: cada acceso entra aquí en vivo (RLS: solo gerencia)
  const [filtro, setFiltro] = useState<'todo' | Evento>('todo')

  const visibles = useMemo(() => (filtro === 'todo' ? accesos : accesos.filter((a) => a.evento === filtro)), [accesos, filtro])

  // Cifras de cabecera (del registro completo).
  const hoy = useMemo(() => {
    const t = new Date()
    const k = (d: Date) => d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate()
    return accesos.filter((a) => k(new Date(a.ts))).length
  }, [accesos])
  const usuarios = useMemo(() => new Set(accesos.map((a) => a.usuario)).size, [accesos])
  const ips = useMemo(() => new Set(accesos.filter((a) => a.ip).map((a) => a.ip)).size, [accesos])
  const aperturas = accesos.filter((a) => a.evento === 'abrir_caja').length

  const columns: Column[] = [
    { key: 'cuando', label: 'Cuándo' },
    { key: 'usuario', label: 'Usuario' },
    { key: 'evento', label: 'Evento' },
    { key: 'ip', label: 'IP', align: 'left' },
    { key: 'disp', label: 'Dispositivo', align: 'left' },
  ]

  const rows = visibles.map((a: Acceso) => {
    const d = new Date(a.ts)
    const ev = EV[a.evento]
    return {
      cuando: (
        <span className="acc-when">
          <b className="tnum">{fmtHora(d)}</b>
          <span className="acc-date">{DOW[d.getDay()]} {fmtFecha(d)}</span>
        </span>
      ),
      usuario: <span className="acc-user">{corto(a.usuario)}</span>,
      evento: <Badge tone={ev.tone}>{ev.t}</Badge>,
      ip: <span className="tnum acc-ip">{a.ip || '—'}</span>,
      disp: <span className="acc-disp">{a.dispositivo || '—'}</span>,
    }
  })

  return (
    <div className="section">
      <SectionHeader
        title="Accesos"
        subtitle="Registro de seguridad · quién, cuándo y desde dónde"
        right={
          <div className="vtpv-period">
            {FILTROS.map((f) => (
              <button key={f.k} className={'vtpv-pk' + (filtro === f.k ? ' on' : '')} onClick={() => { setFiltro(f.k); play('tap') }}>
                {f.t}
              </button>
            ))}
          </div>
        }
      />

      {/* ── CABECERA-HÉROE: nº de accesos hoy + métricas ── */}
      <Card className="vtpv-hero">
        <div className="vtpv-hero-main">
          <div className="vtpv-kick">Accesos · hoy</div>
          <div className="vtpv-bignum tnum">{hoy}<i>hoy</i></div>
          <StatRow className="vtpv-hero-stats">
            <Stat value={String(accesos.length)} label="Registrados" count={false} />
            <Stat value={String(usuarios)} label="Usuarios" count={false} />
            <Stat value={String(ips)} label="IPs distintas" count={false} />
            <Stat value={String(aperturas)} label="Aperturas de caja" count={false} />
          </StatRow>
        </div>
        <div className="vtpv-hero-chart acc-legend">
          <div className="vtpv-chart-lab">Leyenda</div>
          <div className="acc-legend-row"><Badge tone="blue">Inició sesión</Badge></div>
          <div className="acc-legend-row"><Badge tone="green">Abrió caja</Badge></div>
          <div className="acc-legend-row"><Badge tone="gold">Cerró caja</Badge></div>
        </div>
      </Card>

      {/* ── REGISTRO ── */}
      <Card>
        {rows.length ? (
          <DataTable columns={columns} rows={rows} />
        ) : (
          <div className="vtpv-empty">Sin accesos en este filtro.</div>
        )}
      </Card>

      <p className="acc-foot">🔒 La IP la registra el servidor (no se puede falsear). Solo la gerencia ve este registro.</p>
    </div>
  )
}
