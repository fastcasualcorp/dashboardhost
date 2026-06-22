/* Sonidos diseñados en ElevenLabs (assets locales en /public/sfx, sin claves en el cliente). */
export type SfxName = 'tap' | 'toggle' | 'success' | 'error' | 'nav' | 'pop'

const cache: Partial<Record<SfxName, HTMLAudioElement>> = {}
const NAMES: SfxName[] = ['tap', 'toggle', 'success', 'error', 'nav', 'pop']

let enabled = true
export const setAudio = (on: boolean) => {
  enabled = on
}

export function preloadSfx() {
  if (typeof Audio === 'undefined') return
  for (const n of NAMES) {
    if (!cache[n]) {
      const a = new Audio(`/sfx/${n}.mp3`)
      a.preload = 'auto'
      cache[n] = a
    }
  }
}

// rate: variación de tono opcional. Para disparos rápidos (TPV pop), pasar
// p.ej. rate:[0.94,1.06] hace que cada toque suene un pelín distinto y no canse
// ni se solape mal (cada uno es un clon independiente que suena en paralelo).
export function play(name: SfxName, vol = 0.55, rate?: number | [number, number]) {
  if (!enabled) return
  const a = cache[name]
  if (!a) return
  try {
    const c = a.cloneNode() as HTMLAudioElement
    c.volume = vol
    if (Array.isArray(rate)) c.playbackRate = rate[0] + Math.random() * (rate[1] - rate[0])
    else if (rate) c.playbackRate = rate
    c.play().catch(() => {})
  } catch {
    /* ignora bloqueos de autoplay */
  }
}
