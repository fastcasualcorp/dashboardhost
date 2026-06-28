import { useState } from 'react'
import { motion } from 'motion/react'
import { BEASTS } from '../lib/beasts'
import { supabase, isCentral } from '../lib/supabase'
import { usePower, setSaverManual } from '../lib/power'
import { isDemoMode, setDemoMode } from '../lib/demo'

// Clash Display = única tipografía oficial (Juan, 29-jun). FontKey se conserva por compatibilidad de tipos.
export type FontKey = 'clash'
export type AccentKey = 'lima' | 'gold' | 'azul' | 'verde' | 'rosa' | 'violeta' | 'atardecer' | 'aurora' | 'mono'

export const ACCENTS: { key: AccentKey; name: string; css: string; premium?: boolean }[] = [
  { key: 'lima', name: 'Lima', css: 'linear-gradient(135deg,#dbff63,#9ad400)' },
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
  accent,
  onAccent,
  beast,
  onBeast,
  comments,
  onComments,
  onCanon,
}: {
  accent: AccentKey
  onAccent: (a: AccentKey) => void
  beast: string
  onBeast: (id: string) => void
  comments: boolean
  onComments: () => void
  onCanon: () => void
}) {
  const [pwOpen, setPwOpen] = useState(false)
  const { saver, manual: saverManual } = usePower()

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
        {/* El cambio de plan se hace desde la PASTILLA de plan de la cabecera (siempre visible). Aquí solo info. */}
        <div className="sp-field">
          <span className="sp-k">Plan</span>
          <span className="sp-v gold">FAT SMASH Pro</span>
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
        <button className={'sp-comments' + (saver ? ' on' : '')} onClick={() => setSaverManual(!saver)}>
          <span className="spc-ic">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" />
            </svg>
          </span>
          <span className="spc-txt">
            <b>Salón frío · ahorro</b>
            <small>{saver ? 'Activo · menos calor y batería (decorados y vídeo en pausa)' : saverManual === null ? 'Auto · se enciende solo con batería' : 'Apagado · efectos al máximo'}</small>
          </span>
          <span className="spc-sw" aria-hidden="true">
            <span className="spc-knob" />
          </span>
        </button>
      </div>

      <div className="sp-section">
        <button className="sp-comments" onClick={() => window.dispatchEvent(new Event('rebell:play-intro'))}>
          <span className="spc-ic">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 5.5v13l11-6.5-11-6.5Z" />
            </svg>
          </span>
          <span className="spc-txt">
            <b>Ver intro</b>
            <small>Reproduce la animación de bienvenida sin cerrar sesión</small>
          </span>
          <span className="spc-go" aria-hidden="true">▶</span>
        </button>
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
            <small>{comments ? 'Activo · deja notas por la página' : 'Deja notas ancladas sobre el panel para revisarlas luego'}</small>
          </span>
          <span className="spc-sw" aria-hidden="true">
            <span className="spc-knob" />
          </span>
        </button>
      </div>

      {/* MODO ESCAPARATE (datos de ejemplo bonitos) — SOLO rol central: un negocio real NO debe poder activar
          datos falsos sobre los suyos. Un clic y el panel se llena para enseñar a un prospecto, sin tocar
          jamás un local real (demo = nunca escribe en la nube). (Juan, 28-jun) */}
      {isCentral() && (
        <div className="sp-section">
          <button className={'sp-comments' + (isDemoMode() ? ' on' : '')} onClick={() => setDemoMode(!isDemoMode())}>
            <span className="spc-ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="13" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
            </span>
            <span className="spc-txt">
              <b>Modo escaparate {isDemoMode() && <span className="sp-plan-tag">●</span>}</b>
              <small>{isDemoMode() ? 'Activo · datos de EJEMPLO para vender (no toca ningún local real)' : 'Llena el panel de datos bonitos de un clic para enseñar a un prospecto'}</small>
            </span>
            <span className="spc-sw" aria-hidden="true">
              <span className="spc-knob" />
            </span>
          </button>
        </div>
      )}

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
        <button className="sp-action sp-canon" onClick={onCanon}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l2.4 5 5.6.6-4.2 3.7 1.3 5.5L12 20.7 6.9 17.8l1.3-5.5L4 8.6 9.6 8z" />
          </svg>
          Sistema de diseño · Canon
          <span className="sp-canon-tag">interna</span>
        </button>
      </div>

      <div className="sp-section">
        <button
          className="sp-action"
          onClick={async () => {
            try {
              await supabase?.auth.signOut()
            } catch {
              /* sin sesión */
            }
            // SEGURIDAD (auditoría 28-jun · fuga entre negocios): al cerrar sesión se borran TODOS los datos
            // de negocio cacheados (ventas, cuentas, comandas, empleados…) y el perfil. Así un tablet de barra
            // COMPARTIDO no enseña los datos del local anterior al siguiente. Solo se conservan las preferencias
            // de DISEÑO del dispositivo (no son sensibles y son por-aparato).
            try {
              const KEEP = new Set([
                'rebell-theme', 'rebell-accent', 'rebell-density', 'rebell-logo', 'rebell-comments-on',
                'rebell-typescale-v1', 'rebell-buttons-v1', 'rebell-radius-v1', 'rebell-fontwide-v1',
                'rebell-fonttrack-v1', 'rebell-numweight-v1', 'rebell-titleweight-v1', 'rebell-barh-v1',
              ])
              Object.keys(localStorage)
                .filter((k) => k.startsWith('rebell-') && !KEEP.has(k))
                .forEach((k) => localStorage.removeItem(k))
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
