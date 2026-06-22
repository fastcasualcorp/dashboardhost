/* Sonidos diseñados en ElevenLabs (assets locales en /public/sfx, sin claves en el cliente).

   Robusto para Safari/iOS: el navegador bloquea el audio hasta que hay un gesto
   real del usuario. Por eso (1) "desbloqueamos" todos los sonidos en el primer
   clic/tecla (play+pause en mute) y (2) usamos un POOL de voces por sonido que
   reutilizamos en round-robin — así los pops rápidos del TPV se solapan bien y no
   dependemos de clonar elementos que Safari considera "no activados". */
export type SfxName = 'tap' | 'toggle' | 'success' | 'error' | 'nav' | 'pop'

const NAMES: SfxName[] = ['tap', 'toggle', 'success', 'error', 'nav', 'pop']
const POOL = 4

const pools: Partial<Record<SfxName, HTMLAudioElement[]>> = {}
const idx: Partial<Record<SfxName, number>> = {}

let enabled = true
export const setAudio = (on: boolean) => {
  enabled = on
}

let armed = false
let unlocked = false

function armUnlock() {
  if (armed || typeof window === 'undefined') return
  armed = true
  const go = () => {
    if (unlocked) return
    unlocked = true
    for (const n of NAMES) {
      for (const a of pools[n] ?? []) {
        const v = a.volume
        a.muted = true
        a.play()
          .then(() => {
            a.pause()
            a.currentTime = 0
            a.muted = false
            a.volume = v
          })
          .catch(() => {
            a.muted = false
          })
      }
    }
    window.removeEventListener('pointerdown', go)
    window.removeEventListener('keydown', go)
    window.removeEventListener('touchstart', go)
  }
  window.addEventListener('pointerdown', go, { passive: true })
  window.addEventListener('keydown', go)
  window.addEventListener('touchstart', go, { passive: true })
}

export function preloadSfx() {
  if (typeof Audio === 'undefined') return
  for (const n of NAMES) {
    if (!pools[n]) {
      pools[n] = Array.from({ length: POOL }, () => {
        const a = new Audio(`/sfx/${n}.mp3`)
        a.preload = 'auto'
        return a
      })
      idx[n] = 0
    }
  }
  armUnlock()
}

// rate: variación de tono opcional. Para disparos rápidos (TPV pop), pasar
// p.ej. rate:[0.94,1.06] hace que cada toque suene un pelín distinto y no canse.
export function play(name: SfxName, vol = 0.55, rate?: number | [number, number]) {
  if (!enabled) return
  const pool = pools[name]
  if (!pool || !pool.length) return
  const i = ((idx[name] ?? 0) + 1) % pool.length
  idx[name] = i
  const a = pool[i]
  try {
    a.currentTime = 0
    a.volume = vol
    if (Array.isArray(rate)) a.playbackRate = rate[0] + Math.random() * (rate[1] - rate[0])
    else if (rate) a.playbackRate = rate
    a.play().catch(() => {})
  } catch {
    /* ignora bloqueos de autoplay */
  }
}
