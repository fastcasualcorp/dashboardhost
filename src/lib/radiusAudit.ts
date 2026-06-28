/* MODO AUDITOR DE RADIOS (Juan 28-jun): "un clic → pinta cada elemento del color de su token de radio →
   ves de un vistazo si algo se salió del sistema". Dibuja un outline (no toca el layout) por elemento según
   su border-radius computado, mapeado al token canónico más cercano; lo que NO cuadra con ningún token sale
   en ROJO. Incluye leyenda flotante. Es herramienta interna (vive en Canon). Todo es reversible (stop()). */

type Bucket = { name: string; px: number; color: string }

const BUCKETS: Bucket[] = [
  { name: 'input · 10', px: 10, color: '#38bdf8' },
  { name: 'chip · 12', px: 12, color: '#818cf8' },
  { name: 'botón · 14', px: 14, color: '#a78bfa' },
  { name: 'panel · 18', px: 18, color: '#34d399' },
  { name: 'panel L · 22', px: 22, color: '#fbbf24' },
  { name: 'panel XL · 26', px: 26, color: '#f472b6' },
]
const PILL = { name: 'pastilla / círculo', color: '#22d3ee' }
const OFF = { name: 'FUERA DEL SISTEMA', color: '#ff3b30' }
const TOL = 1.6 // ±px de tolerancia para casar con un token

function colorFor(el: Element): string | null {
  const v = getComputedStyle(el).borderTopLeftRadius
  if (!v || v === '0px') return null
  if (v.includes('%')) return PILL.color // 50% → círculo
  const r = parseFloat(v)
  if (!r || r < 1) return null
  if (r >= 40) return PILL.color // 100px → pastilla
  const b = BUCKETS.find((x) => Math.abs(x.px - r) <= TOL)
  return b ? b.color : OFF.color
}

function paintEl(el: Element) {
  const c = colorFor(el)
  if (!c) return
  const s = (el as HTMLElement).style
  s.setProperty('outline', '1.5px solid ' + c, 'important')
  s.setProperty('outline-offset', '-1.5px', 'important')
  ;(el as HTMLElement).dataset.audR = '1'
}
function paintTree(root: Element) {
  paintEl(root)
  root.querySelectorAll('*').forEach(paintEl)
}

let observer: MutationObserver | null = null
let legend: HTMLElement | null = null

export function isAuditing() {
  return observer !== null
}

export function startAudit() {
  const app = document.querySelector('.app')
  if (!app || observer) return
  paintTree(app)
  // Re-pinta lo que se monte después (cambiar de sección, abrir modales…).
  observer = new MutationObserver((muts) => {
    for (const m of muts) {
      m.addedNodes.forEach((n) => {
        if (n.nodeType === 1) paintTree(n as Element)
      })
    }
  })
  observer.observe(app, { childList: true, subtree: true })

  legend = document.createElement('div')
  legend.className = 'aud-legend'
  legend.innerHTML =
    '<div class="aud-legend-h">Auditor de radios</div>' +
    BUCKETS.map((b) => `<div class="aud-legend-row"><i style="background:${b.color}"></i>${b.name}</div>`).join('') +
    `<div class="aud-legend-row"><i style="background:${PILL.color}"></i>${PILL.name}</div>` +
    `<div class="aud-legend-row off"><i style="background:${OFF.color}"></i>${OFF.name}</div>`
  document.body.appendChild(legend)
}

export function stopAudit() {
  observer?.disconnect()
  observer = null
  document.querySelectorAll('[data-aud-r]').forEach((el) => {
    const s = (el as HTMLElement).style
    s.removeProperty('outline')
    s.removeProperty('outline-offset')
    delete (el as HTMLElement).dataset.audR
  })
  legend?.remove()
  legend = null
}

export function toggleAudit(): boolean {
  if (observer) {
    stopAudit()
    return false
  }
  startAudit()
  return true
}
