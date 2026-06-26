/* Motor de sonido sobre la Web Audio API (assets en /public/sfx, sin claves en el cliente).

   Por qué Web Audio y no <audio>: Safari/iOS es muy poco fiable reproduciendo
   HTMLAudioElement para efectos (suena uno suelto y luego nada). Con Web Audio
   creamos UN contexto, decodificamos cada mp3 a un AudioBuffer una vez, y cada
   disparo es un BufferSource de usar-y-tirar → solapado ilimitado, volumen y tono
   por nota. Solo hace falta resume() del contexto en el primer gesto (Safari). */
export type SfxName = 'tap' | 'toggle' | 'success' | 'error' | 'nav' | 'pop' | 'count' | 'scan' | 'glitch'

const NAMES: SfxName[] = ['tap', 'toggle', 'success', 'error', 'nav', 'pop', 'count', 'scan', 'glitch']

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

// ── Volumen POR SONIDO (mezclador del "cuarto de diseño"/Canon): multiplica el vol de cada disparo. Persistido. ──
export const SFX_LIST: { name: SfxName; label: string }[] = [
  { name: 'glitch', label: 'Glitch mapa' },
  { name: 'scan', label: 'Boom escaneo' },
  { name: 'pop', label: 'Pop / clic' },
  { name: 'count', label: 'Números (count-up)' },
  { name: 'success', label: 'Éxito' },
  { name: 'error', label: 'Error' },
  { name: 'nav', label: 'Navegación' },
  { name: 'tap', label: 'Toque' },
  { name: 'toggle', label: 'Interruptor' },
]
const DEFAULT_SFXVOL: Record<SfxName, number> = { tap: 1, toggle: 1, success: 1, error: 1, nav: 1, pop: 1, count: 1, scan: 1, glitch: 1 }
const sfxVol: Record<SfxName, number> = (() => {
  try { const raw = localStorage.getItem('rebell-sfxvol'); if (raw) return { ...DEFAULT_SFXVOL, ...(JSON.parse(raw) as Partial<Record<SfxName, number>>) } } catch { /* sin localStorage */ }
  return { ...DEFAULT_SFXVOL }
})()
export const getSfxVolume = (n: SfxName) => sfxVol[n] ?? 1
export const setSfxVolume = (n: SfxName, v: number) => {
  sfxVol[n] = Math.max(0, Math.min(2, v)) // 0–200%
  try { localStorage.setItem('rebell-sfxvol', JSON.stringify(sfxVol)) } catch { /* sin localStorage */ }
}

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

// Impulso de reverb sintético (ruido con caída exponencial) → cola corta tipo FL Studio.
function makeImpulse(ac: AudioContext, dur = 0.55, decay = 2.6): AudioBuffer {
  const len = Math.max(1, Math.floor(ac.sampleRate * dur))
  const buf = ac.createBuffer(2, len, ac.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
  }
  return buf
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    masterGain = ctx.createGain()
    masterGain.gain.value = master * peak
    masterGain.connect(ctx.destination) // señal seca
    // Envío de REVERB (cola sutil): masterGain → convolver → wet → destino, en paralelo a la seca.
    try {
      const conv = ctx.createConvolver()
      conv.buffer = makeImpulse(ctx, 0.55, 2.6)
      const wet = ctx.createGain()
      wet.gain.value = 0.18 // mezcla baja → solo una cola, no un eco exagerado
      masterGain.connect(conv)
      conv.connect(wet)
      wet.connect(ctx.destination)
    } catch {
      /* sin reverb si el navegador no soporta convolver */
    }
  }
  return ctx
}

// Sample REAL del rugido del león, si Juan lo suelta en public/sfx/lion.mp3 (o .wav). Si no existe,
// playBeast('lion') cae al rugido sintetizado. Esta es la vía buena para un león de verdad.
let lionBuf: AudioBuffer | null = null

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
  // león real (opcional): probamos mp3 y wav; si no hay (404) se ignora y queda el sintetizado.
  if (!lionBuf) {
    for (const ext of ['mp3', 'wav']) {
      try {
        const res = await fetch(`/sfx/lion.${ext}`)
        if (!res.ok) continue
        lionBuf = await c.decodeAudioData(await res.arrayBuffer())
        break
      } catch {
        /* sin sample real de león: se usa el sintetizado */
      }
    }
  }
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
  // león SUTIL y premium: cuerpo grave cálido (sub) + textura de growl suave, ambos
  // CAEN de tono (los rugidos descienden), filtro cálido que quita el buzz, soplo leve.
  lion: {
    tones: [
      { freq: 62, type: 'triangle', dur: 0.66, glide: 0.8, cutoff: 420, q: 1, tremolo: 20, vol: 0.5 },
      { freq: 116, type: 'sawtooth', dur: 0.52, glide: 0.78, cutoff: 520, q: 1.2, tremolo: 23, vol: 0.26 },
    ],
    noise: 0.09,
  },
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

// Rugido de león POTENTE y sintetizado (fallback si no hay sample real). Cuerpo saw+sub con contorno
// de tono (sube al clímax y cae), GROWL por modulación de amplitud (~26Hz rugosidad + ~5Hz "huh-huh"),
// rasp de ruido filtrado, y formante que abre/cierra. ~1.5s, con cuerpo de verdad (no el zumbido sutil).
function playLionRoar(c: AudioContext, out: AudioNode, t0: number, vol: number) {
  const dur = 1.5
  const peak = 0.95 * vol
  // cuerpo: sawtooth (rico en armónicos) + sub seno
  const body = c.createOscillator()
  body.type = 'sawtooth'
  body.frequency.setValueAtTime(98, t0)
  body.frequency.linearRampToValueAtTime(172, t0 + 0.32) // build/rugido sube
  body.frequency.linearRampToValueAtTime(150, t0 + 0.7)
  body.frequency.exponentialRampToValueAtTime(78, t0 + dur) // y cae
  const sub = c.createOscillator()
  sub.type = 'sine'
  sub.frequency.setValueAtTime(58, t0)
  sub.frequency.exponentialRampToValueAtTime(40, t0 + dur)
  // formante cálido que se abre en el clímax y se cierra al final
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.Q.value = 2.2
  lp.frequency.setValueAtTime(280, t0)
  lp.frequency.linearRampToValueAtTime(1500, t0 + 0.32)
  lp.frequency.exponentialRampToValueAtTime(320, t0 + dur)
  // envolvente principal (ataque medio → clímax potente → decay largo)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(peak * 0.55, t0 + 0.09)
  g.gain.linearRampToValueAtTime(peak, t0 + 0.42)
  g.gain.setValueAtTime(peak, t0 + 0.85)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  body.connect(lp)
  sub.connect(lp)
  lp.connect(g).connect(out)
  // GROWL: dos LFO modulan la ganancia → rugosidad (26Hz) + pulsos "huh-huh" (4.5→7Hz)
  const lfo1 = c.createOscillator()
  lfo1.frequency.value = 26
  const lg1 = c.createGain()
  lg1.gain.value = peak * 0.38
  lfo1.connect(lg1).connect(g.gain)
  const lfo2 = c.createOscillator()
  lfo2.frequency.setValueAtTime(4.5, t0)
  lfo2.frequency.linearRampToValueAtTime(7, t0 + dur)
  const lg2 = c.createGain()
  lg2.gain.value = peak * 0.24
  lfo2.connect(lg2).connect(g.gain)
  // RASP: ruido bandpass que sube/baja con el rugido, modulado por el growl
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  const ns = c.createBufferSource()
  ns.buffer = buf
  const nf = c.createBiquadFilter()
  nf.type = 'bandpass'
  nf.Q.value = 0.9
  nf.frequency.setValueAtTime(650, t0)
  nf.frequency.linearRampToValueAtTime(1150, t0 + 0.32)
  nf.frequency.exponentialRampToValueAtTime(480, t0 + dur)
  const ng = c.createGain()
  ng.gain.setValueAtTime(0.0001, t0)
  ng.gain.exponentialRampToValueAtTime(peak * 0.3, t0 + 0.12)
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  const nlfo = c.createOscillator()
  nlfo.frequency.value = 26
  const nlg = c.createGain()
  nlg.gain.value = peak * 0.14
  nlfo.connect(nlg).connect(ng.gain)
  ns.connect(nf).connect(ng).connect(out)
  const end = t0 + dur + 0.05
  for (const o of [body, sub, lfo1, lfo2, nlfo]) o.start(t0)
  ns.start(t0)
  for (const o of [body, sub, lfo1, lfo2, nlfo]) o.stop(end)
}

// Voces de bestia (león/panda/zorro…) DESACTIVADAS por decisión de Juan (23-jun): "eso fuera".
// Si algún día se quieren reactivar, quitar este return (y, mejor, un sample real en /sfx/lion.mp3).
const BEAST_VOICES_ENABLED = false

export function playBeast(beast: string, vol = 0.7) {
  if (!BEAST_VOICES_ENABLED) return
  if (!enabled) return
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') c.resume().catch(() => {})
  const out = masterGain ?? c.destination
  const t0 = c.currentTime
  // LEÓN: si hay sample real cargado, ese; si no, el rugido potente sintetizado.
  if (beast === 'lion') {
    try {
      if (lionBuf) {
        const src = c.createBufferSource()
        src.buffer = lionBuf
        const g = c.createGain()
        g.gain.value = Math.min(1, vol)
        src.connect(g).connect(out)
        src.start(t0)
      } else {
        playLionRoar(c, out, t0, vol)
      }
    } catch {
      /* ignora errores puntuales de reproducción */
    }
    return
  }
  const v = VOICES[beast] || VOICES.lion
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

/* MONEDA "crispy/crunchy" estilo Candy Crush (SIN assets): un CRUNCH cortísimo de ruido brillante + un
   DING de dos tonos cristalinos con su chispa aguda. El tono SUBE con `i` (combo de monedas seguidas) →
   adictivo. Se dispara una vez por cada monedita que aterriza en la cartera. Respeta volumen/mute. */
export function playCoin(vol = 0.6, i = 0) {
  if (!enabled) return
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') c.resume().catch(() => {})
  const out = masterGain ?? c.destination
  const t0 = c.currentTime
  const step = Math.pow(2, ((i % 8) * 1.5) / 12) // +1,5 semitonos por moneda (combo ascendente)
  try {
    // CRUNCH: ráfaga de ruido muy corta, bandpass agudo → el "crisp" seco
    const dur = 0.05
    const nb = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate)
    const nd = nb.getChannelData(0)
    for (let k = 0; k < nd.length; k++) nd[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / nd.length, 1.5)
    const ns = c.createBufferSource()
    ns.buffer = nb
    const nf = c.createBiquadFilter()
    nf.type = 'bandpass'
    nf.frequency.value = 4200 * step
    nf.Q.value = 0.9
    const ng = c.createGain()
    ng.gain.setValueAtTime(0.0001, t0)
    ng.gain.exponentialRampToValueAtTime(0.2 * vol, t0 + 0.003)
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    ns.connect(nf).connect(ng).connect(out)
    ns.start(t0)
    ns.stop(t0 + dur + 0.02)
    // DING: dos tonos brillantes (recogida de moneda), el 2º un pelín más agudo, cada uno con su chispa cuadrada
    const tones = [1318.5 * step, 1975.5 * step] // ~E6 · ~B6
    tones.forEach((f, j) => {
      const start = t0 + j * 0.045
      const osc = c.createOscillator()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(f, start)
      osc.frequency.exponentialRampToValueAtTime(f * 1.01, start + 0.06)
      const g = c.createGain()
      const peak = 0.32 * vol
      g.gain.setValueAtTime(0.0001, start)
      g.gain.exponentialRampToValueAtTime(peak, start + 0.005) // ataque instantáneo = crispy
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.13)
      osc.connect(g).connect(out)
      osc.start(start)
      osc.stop(start + 0.16)
      const sp = c.createOscillator()
      sp.type = 'square'
      sp.frequency.value = f * 2
      const sg = c.createGain()
      sg.gain.setValueAtTime(0.0001, start)
      sg.gain.exponentialRampToValueAtTime(peak * 0.1, start + 0.003)
      sg.gain.exponentialRampToValueAtTime(0.0001, start + 0.04)
      sp.connect(sg).connect(out)
      sp.start(start)
      sp.stop(start + 0.05)
    })
  } catch {
    /* ignora errores puntuales de reproducción */
  }
}

/* Barrido de escaneo. Si está cargado el SAMPLE real de Juan (/sfx/scan.mp3 = "boom efecto escaneo"),
   suena ESE (cortado con un fundido a ~2,6s para casar con el pulso violeta del mapa, que dura ~2,2s;
   el sample crudo dura 7s). Si no está, cae al "whoosh" de sonar sintetizado. Respeta volumen/mute. */
export function playSweep(vol = 0.5) {
  if (!enabled) return
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') c.resume().catch(() => {})
  const out = masterGain ?? c.destination
  const t0 = c.currentTime
  // sample REAL "boom efecto escaneo" si ya está decodificado → si no, sintetizado abajo
  const sbuf = buffers['scan']
  if (sbuf) {
    try {
      const src = c.createBufferSource()
      src.buffer = sbuf
      const g = c.createGain()
      const sdur = 2.6 // boom + cola corta, al ritmo del pulso (el mp3 dura 7s)
      const peak = Math.min(1, vol * getSfxVolume('scan'))
      g.gain.setValueAtTime(peak, t0)
      g.gain.setValueAtTime(peak, t0 + Math.max(0.1, sdur - 0.7))
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + sdur) // se funde, no se corta seco
      src.connect(g).connect(out)
      src.start(t0)
      src.stop(t0 + sdur + 0.05)
    } catch {
      /* ignora errores puntuales */
    }
    return
  }
  const dur = 0.9
  try {
    const osc = c.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(220, t0)
    osc.frequency.exponentialRampToValueAtTime(900, t0 + dur)
    const f = c.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.setValueAtTime(300, t0)
    f.frequency.exponentialRampToValueAtTime(1600, t0 + dur)
    f.Q.value = 1.2
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(0.12 * vol, t0 + 0.12)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(f).connect(g).connect(out)
    osc.start(t0)
    osc.stop(t0 + dur + 0.03)
  } catch {
    /* ignora errores puntuales */
  }
}

/* GLITCH del mapa (sample "GLITCH MAPA" de Juan): suena BAJITO junto al boom del barrido, con una COLA de REVERB
   que sube al FINAL para "ese toque" (Juan 25-jun). Cola larga (convolver dedicado), wet creciente al acabar. */
export function playGlitch(vol = 0.3) {
  if (!enabled) return
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') c.resume().catch(() => {})
  const gbuf = buffers['glitch']
  if (!gbuf) return
  const t0 = c.currentTime
  const peak = Math.min(1, vol * getSfxVolume('glitch'))
  const dur = Math.min(gbuf.duration, 3.0) // ~3s del glitch (el sample dura 5,5s)
  try {
    const src = c.createBufferSource()
    src.buffer = gbuf
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.07) // entra rápido
    g.gain.setValueAtTime(peak, t0 + Math.max(0.12, dur - 0.9))
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur) // se funde, no se corta seco
    // REVERB al FINALIZAR: convolver con cola larga; el envío (wet) CRECE en el último tramo → estela al terminar.
    try {
      const conv = c.createConvolver()
      conv.buffer = makeImpulse(c, 1.5, 2.1)
      const wet = c.createGain()
      wet.gain.setValueAtTime(0.0001, t0)
      wet.gain.setValueAtTime(0.0001, t0 + Math.max(0.12, dur - 1.2))
      wet.gain.linearRampToValueAtTime(peak * 0.7, t0 + dur) // sube hacia el final
      g.connect(conv)
      conv.connect(wet)
      wet.connect(c.destination)
    } catch {
      /* sin reverb si no hay convolver */
    }
    src.connect(g).connect(masterGain ?? c.destination)
    src.start(t0)
    src.stop(t0 + dur + 1.8) // deja sonar la cola de reverb
  } catch {
    /* ignora errores puntuales */
  }
}

// Power-up sutil del MODO PRESENTACIÓN: arpegio mayor ascendente (marcador "encendiéndose") al entrar en
// una sección. Triangle suave + brillo, corto. Respeta volumen/mute. Pedido de Juan (24-jun).
export function playPowerup(vol = 0.5) {
  if (!enabled) return
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') c.resume().catch(() => {})
  const out = masterGain ?? c.destination
  const t0 = c.currentTime
  try {
    const notes = [523.25, 659.25, 783.99, 1046.5] // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const start = t0 + i * 0.058
      for (const [type, mul, g0] of [['triangle', 1, 0.13], ['sine', 2, 0.04]] as const) {
        const osc = c.createOscillator()
        osc.type = type
        osc.frequency.value = freq * mul
        const g = c.createGain()
        g.gain.setValueAtTime(0.0001, start)
        g.gain.exponentialRampToValueAtTime(g0 * vol, start + 0.012)
        g.gain.exponentialRampToValueAtTime(0.0001, start + 0.26)
        osc.connect(g).connect(out)
        osc.start(start)
        osc.stop(start + 0.3)
      }
    })
  } catch {
    /* ignora */
  }
}

/* Lock-on (SIN assets): dos clicks agudos cortísimos = "tlk-tlk" de fijar objetivo. */
export function playLock(vol = 0.5) {
  if (!enabled) return
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') c.resume().catch(() => {})
  const out = masterGain ?? c.destination
  const t0 = c.currentTime
  try {
    for (const [i, freq] of [1180, 1620].entries()) {
      const start = t0 + i * 0.08
      const osc = c.createOscillator()
      osc.type = 'square'
      osc.frequency.value = freq
      const g = c.createGain()
      g.gain.setValueAtTime(0.0001, start)
      g.gain.exponentialRampToValueAtTime(0.16 * vol, start + 0.004)
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.04)
      osc.connect(g).connect(out)
      osc.start(start)
      osc.stop(start + 0.05)
    }
  } catch {
    /* ignora errores puntuales */
  }
}

// "Tick" magnético ultracorto: un blip agudo y suave cuando dos comparadores se imantan/separan en el mapa.
// Muy bajo, < 35 ms, sin cola → feedback físico sin molestar aunque salten varios.
export function playTick(vol = 0.32) {
  if (!enabled) return
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') c.resume().catch(() => {})
  const out = masterGain ?? c.destination
  const t0 = c.currentTime
  try {
    const osc = c.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(2100, t0)
    osc.frequency.exponentialRampToValueAtTime(2680, t0 + 0.018)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(0.09 * vol, t0 + 0.003)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.032)
    osc.connect(g).connect(out)
    osc.start(t0)
    osc.stop(t0 + 0.04)
  } catch {
    /* ignora errores puntuales */
  }
}

// Sonido de "números cargando" (sample CARGAR NUMEROS.mp3 de Juan). Volumen BAJO y suave. Throttle:
// una pantalla con muchos count-ups dispara UNA sola vez. CLAVE: se CORTA con un fundido justo cuando
// acaba la animación del número (dur ≈ 0.9s) → no sigue sonando después.
// El sonido de "números cargando" se silencia en contextos donde no pega (p.ej. el mapa de rivales).
let countMuted = false
export const setCountMuted = (v: boolean) => { countMuted = v }

let lastCountAt = 0
export function playCount(vol = 0.22, dur = 0.9) {
  if (!enabled || countMuted) return
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') c.resume().catch(() => {})
  const now = performance.now()
  if (now - lastCountAt < 350) return
  lastCountAt = now
  const buf = buffers['count']
  if (!buf) {
    loadAll() // aún decodificando; el siguiente sonará
    return
  }
  try {
    const src = c.createBufferSource()
    src.buffer = buf
    const g = c.createGain()
    const t0 = c.currentTime
    vol = vol * getSfxVolume('count') // mezclador por sonido
    g.gain.setValueAtTime(vol, t0)
    g.gain.setValueAtTime(vol, t0 + Math.max(0.05, dur - 0.14)) // se mantiene durante la animación…
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur) // …y se funde al terminar
    src.connect(g).connect(masterGain ?? c.destination)
    src.start(t0)
    src.stop(t0 + dur + 0.03) // corta el buffer aunque el mp3 sea más largo
  } catch {
    /* ignora errores puntuales */
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
    g.gain.value = vol * getSfxVolume(name) // mezclador por sonido
    src.connect(g).connect(masterGain ?? c.destination)
    src.start()
  } catch {
    /* ignora errores puntuales de reproducción */
  }
}
