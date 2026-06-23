import { useState } from 'react'
import { motion } from 'motion/react'
import { BEASTS } from '../lib/beasts'

export type FontKey = 'clash' | 'inter' | 'roundo'
export type AccentKey = 'gold' | 'azul' | 'verde' | 'rosa' | 'violeta' | 'atardecer' | 'aurora' | 'mono'

const FONTS: { key: FontKey; name: string; meta: string; stack: string }[] = [
  { key: 'clash', name: 'Clash Grotesk', meta: 'grotesca · principal', stack: "'Clash Grotesk', sans-serif" },
  { key: 'inter', name: 'Inter', meta: 'neutra · legible', stack: "'Inter', sans-serif" },
  { key: 'roundo', name: 'Roundo', meta: 'redondeada · amable', stack: "'Roundo', sans-serif" },
]

const ACCENTS: { key: AccentKey; name: string; css: string; premium?: boolean }[] = [
  { key: 'gold', name: 'Oro', css: 'linear-gradient(135deg,#ffd45e,#e8ab0c)' },
  { key: 'azul', name: 'Azul', css: 'linear-gradient(135deg,#7dc0ff,#2b86e0)' },
  { key: 'verde', name: 'Verde', css: 'linear-gradient(135deg,#6ee7b7,#10b981)' },
  { key: 'rosa', name: 'Rosa', css: 'linear-gradient(135deg,#ff8fae,#e0457a)' },
  { key: 'violeta', name: 'Violeta', css: 'linear-gradient(135deg,#c4b5fd,#8b6df0)' },
  { key: 'atardecer', name: 'Atardecer', css: 'linear-gradient(135deg,#ff9a3d,#ff5c8a)', premium: true },
  { key: 'aurora', name: 'Aurora', css: 'linear-gradient(135deg,#22d3ee,#a78bfa)', premium: true },
  { key: 'mono', name: 'Mono · blanco y negro', css: 'linear-gradient(135deg,#e8e8ee,#15151a)' },
]

const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 13l4 4L19 7" />
  </svg>
)

export default function SettingsPanel({
  font,
  onFont,
  accent,
  onAccent,
  beast,
  onBeast,
  density,
  onDensity,
  comments,
  onComments,
}: {
  font: FontKey
  onFont: (f: FontKey) => void
  accent: AccentKey
  onAccent: (a: AccentKey) => void
  beast: string
  onBeast: (id: string) => void
  density: number
  onDensity: (d: number) => void
  comments: boolean
  onComments: () => void
}) {
  const DENSITIES: { v: number; name: string }[] = [
    { v: 0.9, name: 'Compacto' },
    { v: 1, name: 'Normal' },
    { v: 1.15, name: 'Cómodo' },
  ]
  const [pwOpen, setPwOpen] = useState(false)

  return (
    <motion.div
      className="settings-pop"
      initial={{ opacity: 0, scale: 0.96, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: -8 }}
      transition={{ type: 'spring', stiffness: 460, damping: 30 }}
    >
      <div className="sp-head">
        <span className="ava">R</span>
        <div>
          <b>REBELL · Bertamiráns</b>
          <small>Cuenta y marca</small>
        </div>
      </div>

      <div className="sp-section">
        <div className="lab">Cuenta</div>
        <div className="sp-field">
          <span className="sp-k">Email</span>
          <span className="sp-v">rebell@bertamirans.com</span>
        </div>
        <div className="sp-field">
          <span className="sp-k">Plan</span>
          <span className="sp-v gold">REBELL Pro</span>
        </div>
        <button className={'sp-action' + (pwOpen ? ' on' : '')} onClick={() => setPwOpen((o) => !o)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          Cambiar contraseña
          <svg className="sp-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {pwOpen && (
          <div className="sp-pw">
            <input type="password" placeholder="Contraseña actual" autoComplete="current-password" />
            <input type="password" placeholder="Nueva contraseña" autoComplete="new-password" />
            <input type="password" placeholder="Repite la nueva" autoComplete="new-password" />
            <button className="sp-save" type="button">Guardar contraseña</button>
          </div>
        )}
      </div>

      <div className="sp-section">
        <button className={'sp-comments' + (comments ? ' on' : '')} onClick={onComments}>
          <span className="spc-ic">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.8-.9L3 21l1.9-5.2A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z" />
            </svg>
          </span>
          <span className="spc-txt">
            <b>Modo comentarios</b>
            <small>{comments ? 'Activo · deja notas por la página' : 'Deja notas ancladas para que Claude las clave'}</small>
          </span>
          <span className="spc-sw" aria-hidden="true">
            <span className="spc-knob" />
          </span>
        </button>
      </div>

      <div className="sp-section">
        <div className="lab">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="13.5" cy="6.5" r="2.5" />
            <circle cx="17.5" cy="12" r="2.5" />
            <circle cx="8.5" cy="7.5" r="2.5" />
            <circle cx="6.5" cy="13" r="2.5" />
            <path d="M12 22a10 10 0 1 1 0-20 8 8 0 0 1 0 16 2 2 0 0 0 0 4Z" />
          </svg>
          Color de énfasis
        </div>
        <div className="sp-accents">
          {ACCENTS.map((a) => (
            <button
              key={a.key}
              className={'acc-sw' + (accent === a.key ? ' on' : '') + (a.premium ? ' premium' : '')}
              style={{ background: a.css }}
              onClick={() => onAccent(a.key)}
              aria-label={a.name}
              title={a.name}
            >
              <span className="acc-check">
                <Check />
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="sp-section">
        <div className="lab">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 13c0 5 3 8 8 8s8-3 8-8c-2 2-4 3-5 3 1-1.5 1.5-3 1.5-4-2 2-3.5 2.5-4.5 2.5S6.5 9.5 4.5 7.5C4.5 8.5 5 10 6 11.5 5 11.5 3 10.5 1.5 8.5" />
          </svg>
          Bestia del local
        </div>
        <div className="sp-beasts">
          {BEASTS.map((b) => (
            <button
              key={b.id}
              className={'beast-sw' + (beast === b.id ? ' on' : '')}
              onClick={() => onBeast(b.id)}
              aria-label={b.name}
              title={b.name}
              style={{ ['--bc' as string]: b.color }}
            >
              <img src={b.img} alt={b.name} loading="lazy" />
            </button>
          ))}
        </div>
      </div>

      <div className="sp-section">
        <div className="lab">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
          Densidad
          <span className="lab-hint">se recuerda en esta pantalla</span>
        </div>
        <div className="sp-density">
          {DENSITIES.map((d) => (
            <button key={d.v} className={'den-opt' + (Math.abs(density - d.v) < 0.02 ? ' on' : '')} onClick={() => onDensity(d.v)}>
              {d.name}
            </button>
          ))}
        </div>
      </div>

      <div className="sp-section">
        <div className="lab">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 7V5h16v2M9 19h6M12 5v14" />
          </svg>
          Tipografía
        </div>
        {FONTS.map((f) => (
          <button key={f.key} className={'font-opt' + (font === f.key ? ' on' : '')} onClick={() => onFont(f.key)} style={{ fontFamily: f.stack }}>
            <span className="fo-l">
              <span className="fo-name">{f.name}</span>
              <span className="fo-meta">{f.meta}</span>
            </span>
            <span className="fo-right">
              <span className="fo-sample">1.787€</span>
              <span className="fo-check">
                <Check />
              </span>
            </span>
          </button>
        ))}
      </div>

      <div className="sp-section">
        <button
          className="sp-action"
          onClick={() => {
            try {
              localStorage.removeItem('rebell-profile')
            } catch {
              /* sin localStorage */
            }
            location.reload()
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          Cambiar de local
        </button>
      </div>
    </motion.div>
  )
}
