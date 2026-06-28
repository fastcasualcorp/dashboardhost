/* ════════════════════════════════════════════════════════════════════
   CANON · sistema de diseño VIVO (herramienta interna).
   Una sola pantalla con TODAS las piezas del sistema expuestas + los mandos
   maestros (tema, fuente, densidad) + la paleta de sonidos. Cambia un mando y
   se reviste TODO al instante → es mi espejo de verificación y el escaparate
   del selector de temas. v1 interna; lista para promocionar a "Kit de marca".
   ════════════════════════════════════════════════════════════════════ */
import { useState, useRef, useEffect } from 'react'
import { Card, SectionHeader, Stat, StatRow, KpiTile, BarRow, BarChart, Donut, Badge, Grid, DataTable } from '../components/ui'
import { ACCENTS, type AccentKey } from './../components/SettingsPanel'
import { SFX } from '../lib/sfx'
import { SFX_LIST, getSfxVolume, setSfxVolume, play, playSweep, playGlitch, type SfxName } from '../lib/sound'
import { TYPE_SCALE, TYPE_DEFAULTS, BTN_TOKENS, BTN_DEFAULTS, RADIUS_TOKENS, RADIUS_DEFAULTS, loadType, saveType, applyType, loadBtn, saveBtn, applyBtn, loadRadius, saveRadius, applyRadius, loadWide, saveWide, applyWide, WIDE_MIN, WIDE_MAX, WIDE_DEFAULT, loadTrack, saveTrack, applyTrack, TRACK_MIN, TRACK_MAX, TRACK_DEFAULT, loadNumW, saveNumW, applyNumW, NUMW_MIN, NUMW_MAX, NUMW_DEFAULT, loadTitleW, saveTitleW, applyTitleW, TITLEW_MIN, TITLEW_MAX, TITLEW_DEFAULT, loadBar, saveBar, applyBar, BAR_MIN, BAR_MAX, BAR_DEFAULT } from '../lib/designTokens'
import { toggleAudit, stopAudit, isAuditing } from '../lib/radiusAudit'

type Theme = 'dark' | 'light'

// Mezclador de VOLUMEN por sonido (Juan 25-jun: "poder modificar el volumen de los sonidos con un slider").
// Persiste en localStorage (setSfxVolume) → afecta a toda la app al instante. Pulsa ▶ para oír cada uno.
function SfxMixer() {
  const [, force] = useState(0)
  const preview = (n: SfxName) => { if (n === 'scan') playSweep(0.5); else if (n === 'glitch') playGlitch(0.5); else play(n, 0.6) }
  return (
    <div className="canon-mixer">
      {SFX_LIST.map(({ name, label }) => {
        const v = getSfxVolume(name)
        return (
          <div className="cmx-row" key={name}>
            <button className="cmx-play" onClick={() => preview(name)} title="Oír" aria-label={'Oír ' + label}>▶</button>
            <span className="cmx-label">{label}</span>
            <input className="cmx-slider" type="range" min={0} max={2} step={0.05} value={v}
              onChange={(e) => { setSfxVolume(name, parseFloat(e.target.value)); force((x) => x + 1) }}
              onMouseUp={() => preview(name)} onTouchEnd={() => preview(name)} />
            <span className="cmx-val">{Math.round(v * 100)}%</span>
          </div>
        )
      })}
    </div>
  )
}

// Fichas de color: usan var(--x) → recolorean en vivo al cambiar el tema.
const COLORS: { name: string; varName: string; hint: string }[] = [
  { name: 'Marca', varName: '--gold', hint: 'cambia con el tema' },
  { name: 'Tinta', varName: '--ink', hint: '#f5f5f7' },
  { name: 'Apagado', varName: '--muted', hint: 'texto 2º' },
  { name: 'Superficie', varName: '--surface', hint: '#141417' },
  { name: 'Línea', varName: '--line-strong', hint: 'bordes' },
  { name: 'OK', varName: '--ok', hint: 'verde' },
  { name: 'Aviso', varName: '--warn', hint: 'ámbar' },
  { name: 'Dato', varName: '--card', hint: 'azul' },
]

const EASINGS: { name: string; val: string; use: string }[] = [
  { name: 'ease-out', val: 'cubic-bezier(.23,1,.32,1)', use: 'entradas, settle' },
  { name: 'spring', val: 'cubic-bezier(.34,1.56,.64,1)', use: 'press, pops, overshoot' },
  { name: 'in-out', val: 'cubic-bezier(.77,0,.175,1)', use: 'recorridos largos' },
]

// ── Editor del SISTEMA DE DISEÑO: tipografía + botones, con slider y "Aplicar" que entra en TODA la app ──
function DesignSystemEditor() {
  const [type, setType] = useState<Record<string, number>>(() => loadType())
  const [btn, setBtn] = useState<Record<string, number>>(() => loadBtn())
  const [wide, setWide] = useState<number>(() => loadWide())
  const [track, setTrack] = useState<number>(() => loadTrack())
  const [numW, setNumW] = useState<number>(() => loadNumW())
  const [titleW, setTitleW] = useState<number>(() => loadTitleW())
  const [barH, setBarH] = useState<number>(() => loadBar())
  const [rad, setRad] = useState<Record<string, number>>(() => loadRadius())
  const [audit, setAudit] = useState<boolean>(() => isAuditing())
  const [saved, setSaved] = useState(false)
  // refs "en vivo" → evitan closures viejos al aplicar al soltar
  const liveType = useRef(type)
  const liveBtn = useRef(btn)
  const liveWide = useRef(wide)
  const liveTrack = useRef(track)
  const liveNumW = useRef(numW)
  const liveTitleW = useRef(titleW)
  const liveBarH = useRef(barH)
  const liveRad = useRef(rad)
  const setBH = (v: number) => { liveBarH.current = v; setBarH(v); applyBar(v) }
  // Radios: en vivo (cambia --r-input/--r-chip/--card-r en .app → toda la app se redondea al instante).
  const setR = (k: string, v: number) => { const next = { ...liveRad.current, [k]: v }; liveRad.current = next; setRad(next); applyRadius(next) }
  // Modo auditor: pinta cada elemento del color de su token de radio (rojo = fuera del sistema). Se limpia al salir.
  const onAudit = () => { const on = toggleAudit(); setAudit(on); play(on ? 'toggle' : 'tap', 0.5) }
  useEffect(() => () => { stopAudit() }, [])
  // Anchura de fuente: en vivo (solo transform → cero reflow). Estira los números-héroe.
  const setW = (v: number) => { liveWide.current = v; setWide(v); applyWide(v) }
  // Tracking (espaciado entre cifras): en vivo, controla --num-spacing.
  const setTr = (v: number) => { liveTrack.current = v; setTrack(v); applyTrack(v) }
  // Peso de números y de títulos (por uso): en vivo.
  const setNW = (v: number) => { liveNumW.current = v; setNumW(v); applyNumW(v) }
  const setTW = (v: number) => { liveTitleW.current = v; setTitleW(v); applyTitleW(v) }
  // Tipografía: mientras ARRASTRAS solo se mueve la muestra (setType) → cero reflow de la app = fluido.
  // Al SOLTAR (commitType) entra en toda la app de una vez (un solo cambio, sin "golpes").
  const dragType = (k: string, v: number) => { const next = { ...liveType.current, [k]: v }; liveType.current = next; setType(next) }
  const commitType = () => applyType(liveType.current)
  // Botones: en vivo (en Canon no se ven CTAs reales → no salta nada, y el botón-demo cambia al momento).
  const setB = (k: string, v: number) => { const next = { ...liveBtn.current, [k]: v }; liveBtn.current = next; setBtn(next); applyBtn(next) }
  const aplicar = () => { applyType(liveType.current); saveType(liveType.current); saveBtn(liveBtn.current); saveRadius(liveRad.current); saveWide(liveWide.current); saveTrack(liveTrack.current); saveNumW(liveNumW.current); saveTitleW(liveTitleW.current); saveBar(liveBarH.current); play('success', 0.5, 1.1); setSaved(true); window.setTimeout(() => setSaved(false), 1700) }
  const reset = () => {
    liveType.current = { ...TYPE_DEFAULTS }; liveBtn.current = { ...BTN_DEFAULTS }; liveRad.current = { ...RADIUS_DEFAULTS }; liveWide.current = WIDE_DEFAULT; liveTrack.current = TRACK_DEFAULT; liveNumW.current = NUMW_DEFAULT; liveTitleW.current = TITLEW_DEFAULT; liveBarH.current = BAR_DEFAULT
    setType({ ...TYPE_DEFAULTS }); setBtn({ ...BTN_DEFAULTS }); setRad({ ...RADIUS_DEFAULTS }); setWide(WIDE_DEFAULT); setTrack(TRACK_DEFAULT); setNumW(NUMW_DEFAULT); setTitleW(TITLEW_DEFAULT); setBarH(BAR_DEFAULT)
    applyType(TYPE_DEFAULTS); applyBtn(BTN_DEFAULTS); applyRadius(RADIUS_DEFAULTS); applyWide(WIDE_DEFAULT); applyTrack(TRACK_DEFAULT); applyNumW(NUMW_DEFAULT); applyTitleW(TITLEW_DEFAULT); applyBar(BAR_DEFAULT); saveType(TYPE_DEFAULTS); saveBtn(BTN_DEFAULTS); saveRadius(RADIUS_DEFAULTS); saveWide(WIDE_DEFAULT); saveTrack(TRACK_DEFAULT); saveNumW(NUMW_DEFAULT); saveTitleW(TITLEW_DEFAULT); saveBar(BAR_DEFAULT)
    play('toggle', 0.5)
  }
  return (
    <Card className="ds-editor">
      <div className="ds-head">
        <div className="ds-htxt">
          <b>Tipografía</b>
          <small>Mueve un slider → cambia al instante en TODA la app. Pulsa <b>Aplicar</b> para guardarlo.</small>
        </div>
        <div className="ds-actions">
          <button className={'ds-audit' + (audit ? ' on' : '')} onClick={onAudit} title="Pinta cada elemento del color de su token de radio (rojo = fuera del sistema)">{audit ? '◉ Auditor ON' : '🔍 Auditor'}</button>
          <button className="ds-reset" onClick={reset}>Restablecer</button>
          <button className={'ds-apply' + (saved ? ' ok' : '')} onClick={aplicar}>{saved ? '✓ Guardado' : 'Aplicar cambios'}</button>
        </div>
      </div>
      <div className="ds-rows">
        {TYPE_SCALE.map((t) => (
          <div className="ds-row" key={t.key}>
            <div className="ds-meta">
              <b>{t.label}</b>
              <small>{t.role}</small>
            </div>
            <div className="ds-sample" style={{ fontSize: type[t.key] + 'px' }}>{t.sample}</div>
            <div className="ds-ctrl">
              <input
                type="range" min={t.min} max={t.max} step={0.5} value={type[t.key]}
                onChange={(e) => dragType(t.key, parseFloat(e.target.value))}
                onPointerUp={commitType}
                onTouchEnd={commitType}
                onKeyUp={commitType}
                aria-label={t.label}
              />
              <span className="ds-px tnum">{type[t.key]}px</span>
            </div>
          </div>
        ))}
      </div>

      <div className="ds-row ds-row-wide">
        <div className="ds-meta">
          <b>Anchura</b>
          <small>estira los números-héroe</small>
        </div>
        <div className="ds-sample" style={{ transform: `scaleX(${wide})`, transformOrigin: 'left' }}>1.787 €</div>
        <div className="ds-ctrl">
          <input
            type="range" min={WIDE_MIN} max={WIDE_MAX} step={0.005} value={wide}
            onChange={(e) => setW(parseFloat(e.target.value))}
            aria-label="Anchura de fuente"
          />
          <span className="ds-px tnum">{Math.round(wide * 100)}%</span>
        </div>
      </div>

      <div className="ds-row ds-row-wide">
        <div className="ds-meta">
          <b>Espaciado</b>
          <small>aire entre cifras (tracking)</small>
        </div>
        <div className="ds-sample" style={{ letterSpacing: track + 'px' }}>1.787 €</div>
        <div className="ds-ctrl">
          <input
            type="range" min={TRACK_MIN} max={TRACK_MAX} step={0.1} value={track}
            onChange={(e) => setTr(parseFloat(e.target.value))}
            aria-label="Espaciado entre caracteres"
          />
          <span className="ds-px tnum">{track > 0 ? '+' : ''}{track.toFixed(1)}px</span>
        </div>
      </div>

      <div className="ds-row ds-row-wide">
        <div className="ds-meta">
          <b>Peso números</b>
          <small>grosor de las cifras</small>
        </div>
        <div className="ds-sample" style={{ fontWeight: numW }}>1.787 €</div>
        <div className="ds-ctrl">
          <input type="range" min={NUMW_MIN} max={NUMW_MAX} step={100} value={numW}
            onChange={(e) => setNW(parseInt(e.target.value))} aria-label="Peso de números" />
          <span className="ds-px tnum">{numW}</span>
        </div>
      </div>

      <div className="ds-row ds-row-wide">
        <div className="ds-meta">
          <b>Peso títulos</b>
          <small>grosor de los títulos de panel</small>
        </div>
        <div className="ds-sample" style={{ fontWeight: titleW, fontFamily: 'var(--font-display)', fontSize: '26px', letterSpacing: '-.4px' }}>Resumen</div>
        <div className="ds-ctrl">
          <input type="range" min={TITLEW_MIN} max={TITLEW_MAX} step={100} value={titleW}
            onChange={(e) => setTW(parseInt(e.target.value))} aria-label="Peso de títulos" />
          <span className="ds-px tnum">{titleW}</span>
        </div>
      </div>

      <div className="ds-row ds-row-wide">
        <div className="ds-meta">
          <b>Grosor de barras</b>
          <small>gráficas de barras de todo el panel</small>
        </div>
        <div className="ds-sample" style={{ width: 120 }}>
          <span style={{ display: 'block', height: barH + 'px', borderRadius: 100, background: 'linear-gradient(90deg,var(--gold-deep),var(--gold))' }} />
        </div>
        <div className="ds-ctrl">
          <input type="range" min={BAR_MIN} max={BAR_MAX} step={1} value={barH}
            onChange={(e) => setBH(parseInt(e.target.value))} aria-label="Grosor de barras" />
          <span className="ds-px tnum">{barH}px</span>
        </div>
      </div>

      <div className="ds-head ds-head-btn">
        <div className="ds-htxt">
          <b>Redondeo</b>
          <small>El radio de campos, chips y paneles. Mueve un slider → toda la app se redondea en vivo. (El auditor de arriba marca lo que se salga.)</small>
        </div>
      </div>
      <div className="ds-radius">
        <div className="ds-radius-prev" aria-hidden="true">
          <div className="dsr-card" style={{ borderRadius: 'var(--card-r)' }}><span>Panel</span></div>
          <div className="dsr-chip" style={{ borderRadius: 'var(--r-chip)' }}>Chip</div>
          <div className="dsr-input" style={{ borderRadius: 'var(--r-input)' }}>Campo de texto</div>
        </div>
        <div className="ds-radius-sliders">
          {RADIUS_TOKENS.map((t) => (
            <label className="ds-bslider" key={t.key} title={t.role}>
              <span>{t.label}</span>
              <input type="range" min={t.min} max={t.max} step={1} value={rad[t.key]} onChange={(e) => setR(t.key, parseInt(e.target.value))} aria-label={t.label} />
              <b className="tnum">{rad[t.key]}px</b>
            </label>
          ))}
        </div>
      </div>

      <div className="ds-head ds-head-btn">
        <div className="ds-htxt">
          <b>Botones</b>
          <small>Tamaño, alto, ancho y redondeo de los botones principales — replicable en toda la app.</small>
        </div>
      </div>
      <div className="ds-btnbar">
        <div className="ds-btnprev">
          <button className="ds-demo-btn">Cobrar 24,50 €</button>
          <button className="ds-demo-btn ghost">Cancelar</button>
        </div>
        <div className="ds-btnsliders">
          {BTN_TOKENS.map((t) => (
            <label className="ds-bslider" key={t.key}>
              <span>{t.label}</span>
              <input type="range" min={t.min} max={t.max} step={1} value={btn[t.key]} onChange={(e) => setB(t.key, parseFloat(e.target.value))} aria-label={t.label} />
              <b className="tnum">{btn[t.key]}px</b>
            </label>
          ))}
        </div>
      </div>
    </Card>
  )
}

export default function Canon({
  accent,
  onAccent,
  theme,
  onTheme,
}: {
  accent: AccentKey
  onAccent: (a: AccentKey) => void
  theme: Theme
  onTheme: () => void
}) {
  return (
    <div className="section canon">
      <SectionHeader
        title="Canon"
        subtitle="El sistema de diseño, vivo. Cambia un mando y mira cómo se reviste todo."
        right={<Badge tone="gold">interna</Badge>}
      />

      {/* ── SISTEMA DE DISEÑO: editor de tipografía + botones (slider → aplica a TODA la app) ── */}
      <h2 className="canon-h2">Sistema de diseño <span className="canon-h2-note">tipografía y botones · un slider cambia todo el dashboard</span></h2>
      <DesignSystemEditor />

      {/* ── MANDOS MAESTROS ── */}
      <Card className="canon-dials">
        <div className="canon-dial">
          <div className="canon-dlab">Color de marca</div>
          <div className="canon-swatches">
            {ACCENTS.map((a) => (
              <button
                key={a.key}
                className={'canon-sw' + (accent === a.key ? ' on' : '')}
                style={{ background: a.css }}
                onClick={() => onAccent(a.key)}
                title={a.name}
                aria-label={a.name}
              >
                <span className="canon-sw-chk">✓</span>
              </button>
            ))}
          </div>
        </div>

        <div className="canon-dial-row">
          <div className="canon-dial">
            <div className="canon-dlab">Tema</div>
            <button className="canon-seg-btn wide" onClick={onTheme}>
              {theme === 'dark' ? '🌙 Noche' : '☀️ Día'}
            </button>
          </div>
        </div>
      </Card>

      {/* ── TOKENS ── */}
      <h2 className="canon-h2">Tokens</h2>
      <Grid cols={2}>
        <Card>
          <div className="canon-block-lab">Color</div>
          <div className="canon-colors">
            {COLORS.map((c) => (
              <div className="canon-chip" key={c.varName}>
                <span className="canon-chip-sw" style={{ background: `var(${c.varName})` }} />
                <span className="canon-chip-tx">
                  <b>{c.name}</b>
                  <small>{c.hint}</small>
                </span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="canon-block-lab">Tipografía · escala</div>
          <div className="canon-type">
            <span className="canon-ty-display">REBELL</span>
            <span className="canon-ty-num tnum">1.787€</span>
            <span className="canon-ty-body">Cuerpo · texto de lectura del panel.</span>
            <span className="canon-ty-label">ETIQUETA · UPPERCASE</span>
          </div>
          <div className="canon-block-lab" style={{ marginTop: 18 }}>Easing</div>
          <div className="canon-eases">
            {EASINGS.map((e) => (
              <div className="canon-ease" key={e.name}>
                <b>{e.name}</b>
                <code>{e.val}</code>
                <small>{e.use}</small>
              </div>
            ))}
          </div>
          <div className="canon-block-lab" style={{ marginTop: 18 }}>Separador</div>
          <div className="canon-seps">
            <div className="canon-sep-v">
              <span className="canon-sepd" />
              <span className="canon-sepd" />
              <span className="canon-sepd" />
            </div>
            <span className="canon-sep-h" />
            <div className="canon-sep-meta">
              <code>var(--sep)</code>
              <small>hairline dorado · brilla en el centro, se desvanece en los extremos · sigue el acento</small>
            </div>
          </div>
        </Card>
      </Grid>

      {/* ── COMPONENTES ── */}
      <h2 className="canon-h2">Componentes</h2>

      <Card>
        <div className="canon-block-lab">Stat · el criterio único de cifra</div>
        <StatRow>
          <Stat value="1.787" unit="€" label="Ventas hoy" />
          <Stat value="64" label="Tickets" />
          <Stat value="27,9" unit="€" label="Ticket medio" tone="green" />
        </StatRow>
      </Card>

      <h3 className="canon-h3">KPI tiles</h3>
      <Grid cols={3}>
        <KpiTile label="Facturación" value="30.556" unit="€" delta="+12%" foot="vs mes pasado" trend="up" />
        <KpiTile label="Food cost" value="28,4" unit="%" delta="-1,2%" foot="objetivo 30%" trend="down" />
        <KpiTile label="Pedidos" value="1.204" delta="+8%" foot="delivery" trend="up" />
      </Grid>

      <Grid cols={2}>
        <Card>
          <div className="canon-block-lab">BarRow · proporción</div>
          <div className="bar-rows">
            <BarRow label="Efectivo" value={680} max={1787} color="gold" amount="680€" />
            <BarRow label="Tarjeta" value={820} max={1787} color="blue" amount="820€" />
            <BarRow label="Domicilio" value={287} max={1787} color="green" amount="287€" />
          </div>
        </Card>
        <Card>
          <div className="canon-block-lab">BarChart · semana</div>
          <BarChart
            data={[
              { label: 'L', value: 1240 },
              { label: 'M', value: 980 },
              { label: 'X', value: 1510 },
              { label: 'J', value: 1340 },
              { label: 'V', value: 2100 },
              { label: 'S', value: 2480 },
              { label: 'D', value: 1787 },
            ]}
          />
        </Card>
      </Grid>

      <Grid cols={2}>
        <Card>
          <div className="canon-block-lab">Donut + Badges</div>
          <div className="canon-donutrow">
            <Donut value={68} label="Ocupación" sub="sala llena" />
            <div className="canon-badges">
              <Badge tone="gold">Oro</Badge>
              <Badge tone="green">Cuadrada</Badge>
              <Badge tone="blue">Tarjeta</Badge>
              <Badge tone="amber">Aviso</Badge>
              <Badge tone="red">Crítico</Badge>
              <Badge tone="muted">Neutro</Badge>
            </div>
          </div>
        </Card>
        <Card>
          <div className="canon-block-lab">Botones</div>
          <div className="canon-btns">
            <button className="canon-btn-primary">Cobrar</button>
            <button className="canon-btn-ghost">Cancelar</button>
            <button className="canon-btn-pill">＋ Producto</button>
          </div>
        </Card>
      </Grid>

      <Card pad={false}>
        <div className="canon-block-lab" style={{ padding: '16px 18px 0' }}>DataTable · libro</div>
        <DataTable
          columns={[
            { key: 'n', label: 'Nº' },
            { key: 'art', label: 'Artículos' },
            { key: 'met', label: 'Método' },
            { key: 'tot', label: 'Total', align: 'right' },
          ]}
          rows={[
            { n: '#0481', art: '3', met: <Badge tone="gold">Efectivo</Badge>, tot: '24,50€' },
            { n: '#0482', art: '1', met: <Badge tone="blue">Tarjeta</Badge>, tot: '9,90€' },
            { n: '#0483', art: '5', met: <Badge tone="green">Domicilio</Badge>, tot: '41,20€' },
          ]}
        />
      </Card>

      {/* ── SONIDOS ── */}
      <h2 className="canon-h2">Sonidos <span className="canon-h2-note">tokens semánticos · pulsa para oír</span></h2>
      <Card>
        <div className="canon-sounds">
          {SFX.map((s) => (
            <button key={s.token} className="canon-snd" onClick={() => s.fire()}>
              <span className="canon-snd-emo">{s.emoji}</span>
              <span className="canon-snd-tx">
                <b>{s.label}</b>
                <small>{s.desc}</small>
              </span>
              <code className="canon-snd-tok">sfx('{s.token}')</code>
            </button>
          ))}
        </div>
        <p className="canon-foot">
          Hoy suenan con los 8 sfx que ya trae la app. Cuando llegue tu librería <b>DONETTE</b>, solo se cambian
          los archivos en <code>sfx.ts</code> — el código de las secciones no se toca.
        </p>
      </Card>

      {/* ── MEZCLADOR de volumen por sonido ── */}
      <h2 className="canon-h2">Mezclador <span className="canon-h2-note">volumen por sonido · se guarda y aplica a toda la app</span></h2>
      <Card>
        <SfxMixer />
        <p className="canon-foot">Mueve el slider y suena al soltar. 100% = volumen base; puedes subir hasta 200% o bajar a 0. Se guarda en este navegador.</p>
      </Card>
    </div>
  )
}
