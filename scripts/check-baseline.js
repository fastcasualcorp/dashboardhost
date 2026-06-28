// PORTERO ANTI-DESCUADRE (Juan, 28-jun). Las cifras-héroe (número + símbolo €/%/h) DEBEN verse con el
// símbolo APOYADO en la base del número, ni flotando a media altura ni como un superíndice diminuto.
// Dos fallos reales que se han dado:
//   1) el contenedor usa `align-items: center` → el símbolo flota a media altura. (debe ser baseline)
//   2) el símbolo es DEMASIADO PEQUEÑO (font-size < .62em) → aunque esté en la base, parece un superíndice.
// Este check estático recorre src/index.css y FALLA si encuentra cualquiera de los dos. Corre en
// `npm run build` y suelto con `npm run check:baseline`.
import { readFileSync } from 'node:fs'

// Contenedores de "número + unidad". Su align-items DEBE ser baseline (nunca center).
const FIGURE_SELECTORS = [
  '.rstat-val', '.money', '.ck-total', '.turno-sub', '.ckc-hero',
  '.vtpv-bignum', '.fg-val', '.wh-val', '.alm-ie-pct b', '.day-donut-c b',
]

// Símbolos de MONEDA (€): TODOS deben verse IGUALES entre sí (mismo tamaño y mismo color de acento) o se
// nota el descuadre (Juan: "el € de 1512 y el de 1787 no son iguales, uno blanco otro verde"). Canon = .82em
// + color de acento (var(--brand)/--gold). Cualquiera que se salga → FALLA.
const CANON_EM = 0.82
const CURRENCY_UNITS = [
  '.rstat-val i', '.money-u', '.ck-total .u', '.ckc-hero i', '.vtpv-bignum i', '.fg-val i', '.wh-val i',
]
// Símbolos de % / h en gauges: tamaño MÍNIMO (no superíndice diminuto), el color puede ser neutro.
const MIN_UNIT_EM = 0.62
const PERCENT_UNITS = ['.alm-ie-pct b i', '.day-donut-c b i']
const ACCENT_COLORS = ['var(--brand)', 'var(--gold)', 'var(--brand-soft)', 'var(--ok)']

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')

const rules = []
const re = /([^{}]+)\{([^{}]*)\}/g
let m
while ((m = re.exec(css))) rules.push({ selector: m[1].trim().replace(/\s+/g, ' '), decls: m[2] })

const norm = (s) => s.replace(/\s+/g, ' ')
const violations = []

// 1) align-items / vertical-align de los contenedores de cifra
for (const rule of rules) {
  const sel = rule.selector
  if (sel.startsWith('@')) continue
  const fig = FIGURE_SELECTORS.find((f) => norm(sel).includes(f))
  if (!fig) continue
  const ai = /align-items\s*:\s*([a-z-]+)/i.exec(rule.decls)
  if (ai && ai[1].toLowerCase() === 'center')
    violations.push({ selector: sel, problem: 'align-items: center (debe ser baseline) — el símbolo flota a media altura' })
  const va = /vertical-align\s*:\s*(super|sub|middle|text-top|text-bottom)/i.exec(rule.decls)
  if (va) violations.push({ selector: sel, problem: `vertical-align: ${va[1]} en una cifra — usa baseline` })
}

// helpers: última declaración que gana para un selector exacto
const lastDecl = (selector, prop) => {
  let val = null
  for (const rule of rules) {
    const sels = norm(rule.selector).split(',').map((s) => s.trim())
    if (!sels.includes(selector)) continue
    const re2 = new RegExp(prop + '\\s*:\\s*([^;]+)', 'i')
    const mm = re2.exec(rule.decls)
    if (mm) val = mm[1].trim()
  }
  return val
}
const emOf = (selector) => {
  const fs = lastDecl(selector, 'font-size')
  const mm = fs && /(\d*\.?\d+)em/.exec(fs)
  return mm ? parseFloat(mm[1]) : null
}

// 2a) MONEDA: mismo tamaño (canon .82em) y color de acento → todos los € iguales
for (const unit of CURRENCY_UNITS) {
  const em = emOf(unit)
  if (em != null && em !== CANON_EM)
    violations.push({ selector: unit, problem: `€ a ${em}em — debe ser ${CANON_EM}em como el resto (si no, un € se ve más grande que otro)` })
  const color = lastDecl(unit, 'color')
  if (color && !ACCENT_COLORS.some((c) => color.includes(c)))
    violations.push({ selector: unit, problem: `€ en color "${color}" — debe ser de acento (var(--brand)) como el resto (si no, uno blanco y otro verde)` })
}
// 2b) % / h: solo tamaño mínimo (no superíndice)
for (const unit of PERCENT_UNITS) {
  const em = emOf(unit)
  if (em != null && em < MIN_UNIT_EM)
    violations.push({ selector: unit, problem: `símbolo a ${em}em — demasiado pequeño (parece superíndice). Mínimo ${MIN_UNIT_EM}em` })
}

if (violations.length) {
  console.error(`\n[baseline] ❌ ${violations.length} cifra(s) MAL — el €/% no se apoya bien en la base:`)
  for (const v of violations) console.error(`  · ${v.selector}\n      → ${v.problem}`)
  console.error(`\nArréglalo: align-items: baseline + símbolo ≥ ${MIN_UNIT_EM}em (canon .rstat-val / .money), o usa <Money>/<Stat>.\n`)
  process.exit(1)
}

console.log(`[baseline] ✓ ${FIGURE_SELECTORS.length} contenedores + ${CURRENCY_UNITS.length} € (mismo tamaño/color) + ${PERCENT_UNITS.length} % revisados — todos a la base e IGUALES entre sí.`)
