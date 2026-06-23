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
// ── Voz de cada bestia (síntesis procedural, SIN assets) ──
// No es el sonido literal del animal (difícil de sintetizar bien) sino una FIRMA
// sonora premium que evoca su carácter: el león grave y regio, el zorro brillante
// y travieso, el búho con su "hoo-hoo"… Se construye al vuelo con osciladores,
// filtro y un poco de ruido; entra por el masterGain (respeta volumen y mute).
type ToneSpec = {
  freq: number
  type: OscillatorType
  delay?: number // s desde el inicio (para secuencias tipo búho)
  dur: number
  glide?: number // multiplicador de freq al final (envolvente de tono)
  cutoff?: number // lowpass; sin valor = sin filtro
  q?: number
  vol?: number
  tremolo?: number // Hz de AM → growl/purr; 0/sin valor = nada
}
type BeastVoice = { tones: ToneSpec[]; noise?: number }

const VOICES: Record<string, BeastVoice> = {
  // grave, potente, regio; un punto de "growl" (tremolo) + ráfaga de ruido al atacar
  lion: { tones: [{ freq: 96, type: 'sawtooth', dur: 0.5, glide: 1.16, cutoff: 900, q: 2, tremolo: 26, vol: 0.95 }], noise: 0.5 },
  // suave, redondo, amable; un "boop" cálido que sube un poco
  panda: { tones: [{ freq: 232, type: 'triangle', dur: 0.32, glide: 1.22, cutoff: 1700, vol: 0.72 }] },
  // brillante, listo, travieso; chirrido corto que sube rápido
  fox: { tones: [{ freq: 520, type: 'triangle', dur: 0.22, glide: 1.5, cutoff: 3200, vol: 0.55 }], noise: 0.12 },
  // sedoso, oscuro, felino; tono aterciopelado que baja, con purr (tremolo lento)
  panther: { tones: [{ freq: 150, type: 'sawtooth', dur: 0.5, glide: 0.9, cutoff: 700, q: 3, tremolo: 18, vol: 0.82 }] },
  // fiero, enérgico; rugido que cae de tono + grit de ruido
  tiger: { tones: [{ freq: 142, type: 'sawtooth', dur: 0.42, glide: 0.7, cutoff: 1150, q: 1.5, tremolo: 32, vol: 0.88 }], noise: 0.45 },
  // sabio, etéreo; doble nota hueca "hoo-hoo" con un soplo de aire
  owl: {
    tones: [
      { freq: 360, type: 'sine', dur: 0.17, glide: 0.9, cutoff: 1200, q: 6, vol: 0.5 },
      { freq: 342, type: 'sine', delay: 0.25, dur: 0.26, glide: 0.85, cutoff: 1100, q: 6, vol: 0.56 },
    ],
    noise: 0.06,
  },
}

export function playBeast(beast: string, vol = 0.7) {
  if (!enabled) return
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') c.resume().catch(() => {})
  const v = VOICES[beast] || VOICES.lion
  const out = masterGain ?? c.destination
  const t0 = c.currentTime
  try {
    for (const tn of v.tones) {
      const start = t0 + (tn.delay || 0)
      const osc = c.createOscillator()
      osc.type = tn.type
      osc.frequency.setValueAtTime(tn.freq, start)
      if (tn.glide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, tn.freq * tn.glide), start + tn.dur)
      let node: AudioNode = osc
      if (tn.cutoff) {
        const f = c.createBiquadFilter()
        f.type = 'lowpass'
        f.frequency.value = tn.cutoff
        f.Q.value = tn.q ?? 0.7
        osc.connect(f)
        node = f
      }
      const g = c.createGain()
      const peak = (tn.vol ?? 0.7) * vol
      g.gain.setValueAtTime(0.0001, start)
      g.gain.exponentialRampToValueAtTime(peak, start + 0.022)
      g.gain.exponentialRampToValueAtTime(0.0001, start + tn.dur)
      node.connect(g).connect(out)
      if (tn.tremolo) {
        // growl/purr: un LFO modula la ganancia alrededor de la envolvente
        const lfo = c.createOscillator()
        lfo.frequency.value = tn.tremolo
        const lg = c.createGain()
        lg.gain.value = peak * 0.4
        lfo.connect(lg).connect(g.gain)
        lfo.start(start)
        lfo.stop(start + tn.dur)
      }
      osc.start(start)
      osc.stop(start + tn.dur + 0.03)
    }
    if (v.noise) {
      // ráfaga de ruido decreciente en el ataque (rugido/grit/soplo)
      const dur = 0.12
      const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
      const src = c.createBufferSource()
      src.buffer = buf
      const nf = c.createBiquadFilter()
      nf.type = 'bandpass'
      nf.frequency.value = 700
      nf.Q.value = 0.8
      const ng = c.createGain()
      ng.gain.value = v.noise * vol * 0.5
      src.connect(nf).connect(ng).connect(out)
      src.start(t0)
    }
  } catch {
    /* ignora errores puntuales de reproducción */
  }
}

/* Recompensa "crispy/crunchy" tipo Candy Crush (SIN assets): arpegio brillante
   ascendente con una chispa de alta frecuencia por nota → satisfactorio y adictivo,
   nada del "pedo" de antes. Se usa al cerrar caja cuadrada. Respeta volumen/mute. */
export function playReward(vol = 0.8) {
  if (!enabled) return
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') c.resume().catch(() => {})
  const out = masterGain ?? c.destination
  const t0 = c.currentTime
  const notes = [880, 1108.7, 1318.5, 1760] // A5 · C#6 · E6 · A6 — acorde mayor brillante
  try {
    notes.forEach((f, i) => {
      const start = t0 + i * 0.058
      // cuerpo: triangle con micro-bend (pluck dulce)
      const osc = c.createOscillator()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(f, start)
      osc.frequency.exponentialRampToValueAtTime(f * 1.012, start + 0.08)
      const g = c.createGain()
      const peak = 0.5 * vol
      g.gain.setValueAtTime(0.0001, start)
      g.gain.exponentialRampToValueAtTime(peak, start + 0.006) // ataque instantáneo = crispy
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.14)
      osc.connect(g).connect(out)
      osc.start(start)
      osc.stop(start + 0.17)
      // chispa: armónico agudo cortísimo = el "crunch" cristalino
      const sp = c.createOscillator()
      sp.type = 'square'
      sp.frequency.value = f * 3
      const sg = c.createGain()
      sg.gain.setValueAtTime(0.0001, start)
      sg.gain.exponentialRampToValueAtTime(peak * 0.13, start + 0.004)
      sg.gain.exponentialRampToValueAtTime(0.0001, start + 0.045)
      sp.connect(sg).connect(out)
      sp.start(start)
      sp.stop(start + 0.05)
    })
  } catch {
    /* ignora errores puntuales de reproducción */
  }
}

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
