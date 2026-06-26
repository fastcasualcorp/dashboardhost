/* ════════════════════════════════════════════════════════════════════
   SONIDO COMO TOKEN — capa semántica sobre el motor sound.ts.
   Igual que los colores salen de --brand y las cifras de <Stat>, los sonidos
   salen de un TOKEN de intención ('confirmar', 'recompensa', 'iman'…), no de
   una frecuencia a pelo. Así una sección dice sfx('recompensa') y, si mañana
   cambiamos el archivo (p.ej. la librería DONETTE de Juan), NO se toca el código
   de las secciones: solo este registro. Una sola fuente de verdad del audio.
   ════════════════════════════════════════════════════════════════════ */
import { play, playReward, playSweep, playPowerup, playLock, playTick } from './sound'

export type SfxToken =
  | 'toque' | 'interruptor' | 'confirmar' | 'recompensa' | 'error'
  | 'navegar' | 'anadir' | 'iman' | 'radar' | 'fijar' | 'encender'

export type SfxMeta = {
  token: SfxToken
  label: string
  desc: string
  emoji: string
  fire: (vol?: number) => void
}

/* El registro. Cada token = una INTENCIÓN + el disparo concreto (hoy con los sfx
   que ya trae /public/sfx). Cambiar el archivo aquí lo cambia en todo el panel. */
export const SFX: SfxMeta[] = [
  { token: 'toque',       label: 'Toque',       emoji: '👆', desc: 'Feedback ligero de pulsación.',           fire: (v = 0.55) => play('tap', v) },
  { token: 'interruptor', label: 'Interruptor', emoji: '🔁', desc: 'Activar / desactivar un modo.',            fire: (v = 0.5)  => play('toggle', v) },
  { token: 'confirmar',   label: 'Confirmar',   emoji: '✅', desc: 'Acción completada: cobrar, guardar.',     fire: (v = 0.6)  => play('success', v) },
  { token: 'recompensa',  label: 'Recompensa',  emoji: '🏆', desc: 'Logro grande: cerrar caja cuadrada.',      fire: (v = 0.8)  => playReward(v) },
  { token: 'error',       label: 'Error',       emoji: '⛔', desc: 'Algo va mal o está bloqueado.',            fire: (v = 0.5)  => play('error', v) },
  { token: 'navegar',     label: 'Navegar',     emoji: '🧭', desc: 'Cambio de sección (tono por zona).',       fire: (v = 0.42) => play('nav', v) },
  { token: 'anadir',      label: 'Añadir',      emoji: '➕', desc: 'Sumar al ticket (combo, tono variable).',  fire: (v = 0.5)  => play('pop', v, [0.94, 1.06]) },
  { token: 'iman',        label: 'Imán',        emoji: '🧲', desc: 'Dos cartas se imantan (mapa).',            fire: (v = 0.32) => playTick(v) },
  { token: 'radar',       label: 'Radar',       emoji: '📡', desc: 'Barrido de escaneo (mapa).',               fire: (v = 0.5)  => playSweep(v) },
  { token: 'fijar',       label: 'Fijar',       emoji: '🎯', desc: 'Lock-on de objetivo (mapa).',              fire: (v = 0.5)  => playLock(v) },
  { token: 'encender',    label: 'Encender',    emoji: '⚡', desc: 'Power-up al entrar (modo presentación).',  fire: (v = 0.5)  => playPowerup(v) },
]

const BY = Object.fromEntries(SFX.map((s) => [s.token, s])) as Record<SfxToken, SfxMeta>

/* Punto de entrada canónico: sfx('confirmar'). Si el token no existe, silencio. */
export function sfx(token: SfxToken, vol?: number) {
  BY[token]?.fire(vol)
}
