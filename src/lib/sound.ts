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

// ── Volumen maestro (slider global) + mute inteligente (hora punta) ──
const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
let master = (() => {
  try {
    const v = localStorage.getItem('rebell-vol')
    if (v != null) return clamp01(parseFloat(v))
  } catch {
    /* sin localStorage */
  }
  return 0.8
})()
let peak = 1 // atenuación automática en hora punta (1 = normal)

let ctx: AudioContext | null = null
let masterGain: GainNode | null = null
const buffers: Partial<Record<SfxName, AudioBuffer>> = {}

function applyMaster() {
  if (masterGain) masterGain.gain.value = master * peak
}
export const setVolume = (v: number) => {
  master = clamp01(v)
  applyMaster()
  try {
    localStorage.setItem('rebell-vol', String(master))
  } catch {
    /* sin localStorage */
  }
}
export const getVolume = () => master

// Hora punta de hostelería (comida/cena) → baja el volumen para no saturar.
const isPeakHour = (h: number) => (h >= 13 && h < 16) || (h >= 20 && h < 23)
export function refreshPeak() {
  try {
    peak = isPeakHour(new Date().getHours()) ? 0.55 : 1
  } catch {
    peak = 1
  }
  applyMaster()
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    masterGain = ctx.createGain()
    masterGain.gain.value = master * peak
    masterGain.connect(ctx.destination)
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
  refreshPeak() // mute inteligente: baja el volumen en hora punta de servicio
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
  // Autocura: si el contexto o los buffers no están (p.ej. tras un hot-reload de
  // este módulo, donde preloadSfx no vuelve a correr), los inicializa al vuelo.
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') c.resume().catch(() => {})
  const buf = buffers[name]
  if (!buf) {
    loadAll() // dispara la decodificación; este disparo se pierde, los siguientes suenan
    return
  }
  try {
    const src = c.createBufferSource()
    src.buffer = buf
    if (Array.isArray(rate)) src.playbackRate.value = rate[0] + Math.random() * (rate[1] - rate[0])
    else if (rate) src.playbackRate.value = rate
    const g = c.createGain()
    g.gain.value = vol
    src.connect(g).connect(masterGain ?? c.destination)
    src.start()
  } catch {
    /* ignora errores puntuales de reproducción */
  }
}
