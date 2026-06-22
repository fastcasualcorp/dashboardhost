/* Motor de sonido sobre la Web Audio API (assets en /public/sfx, sin claves en el cliente).

   Por qué Web Audio y no <audio>: Safari/iOS es muy poco fiable reproduciendo
   HTMLAudioElement para efectos (suena uno suelto y luego nada). Con Web Audio
   creamos UN contexto, decodificamos cada mp3 a un AudioBuffer una vez, y cada
   disparo es un BufferSource de usar-y-tirar → solapado ilimitado, volumen y tono
   por nota. Solo hace falta resume() del contexto en el primer gesto (Safari). */
export type SfxName = 'tap' | 'toggle' | 'success' | 'error' | 'nav' | 'pop'

const NAMES: SfxName[] = ['tap', 'toggle', 'success', 'error', 'nav', 'pop']

let enabled = true
export const setAudio = (on: boolean) => {
  enabled = on
}

let ctx: AudioContext | null = null
const buffers: Partial<Record<SfxName, AudioBuffer>> = {}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  return ctx
}

async function loadAll() {
  const c = getCtx()
  if (!c) return
  await Promise.all(
    NAMES.map(async (n) => {
      if (buffers[n]) return
      try {
        const res = await fetch(`/sfx/${n}.mp3`)
        const arr = await res.arrayBuffer()
        buffers[n] = await c.decodeAudioData(arr)
      } catch {
        /* archivo ausente o no decodificable: se ignora ese sonido */
      }
    }),
  )
}

export function preloadSfx() {
  const c = getCtx()
  if (!c) return
  loadAll()
  // Safari/iOS: el contexto nace "suspended"; hay que reanudarlo con un gesto real.
  const resume = () => {
    c.resume().catch(() => {})
    loadAll()
    window.removeEventListener('pointerdown', resume)
    window.removeEventListener('keydown', resume)
    window.removeEventListener('touchstart', resume)
  }
  window.addEventListener('pointerdown', resume, { passive: true })
  window.addEventListener('keydown', resume)
  window.addEventListener('touchstart', resume, { passive: true })
}

// rate: variación de tono opcional. Para disparos rápidos (TPV pop), pasar
// p.ej. rate:[0.94,1.06] hace que cada toque suene un pelín distinto y no canse.
export function play(name: SfxName, vol = 0.55, rate?: number | [number, number]) {
  if (!enabled) return
  const c = ctx
  const buf = buffers[name]
  if (!c || !buf) return
  if (c.state === 'suspended') c.resume().catch(() => {})
  try {
    const src = c.createBufferSource()
    src.buffer = buf
    if (Array.isArray(rate)) src.playbackRate.value = rate[0] + Math.random() * (rate[1] - rate[0])
    else if (rate) src.playbackRate.value = rate
    const g = c.createGain()
    g.gain.value = vol
    src.connect(g).connect(c.destination)
    src.start()
  } catch {
    /* ignora errores puntuales de reproducción */
  }
}
