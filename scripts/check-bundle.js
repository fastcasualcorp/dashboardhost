// PRESUPUESTO DE BUNDLE (portero de velocidad · auditoría 28-jun). Igual que el stylelint anti-deriva pero
// para el peso: tras el build, mide el gzip del bundle INICIAL (index-*.js) y FALLA si supera el límite.
// Así nadie vuelve a engordar el arranque sin querer (p.ej. importando algo pesado en una pantalla diaria).
import { readdirSync, readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const LIMIT_KB = 320 // gzip. Actual ~263KB. Si lo superas a propósito, sube este número CONSCIENTEMENTE.
const dir = 'dist/assets'

let files
try {
  files = readdirSync(dir).filter((f) => /^index-.*\.js$/.test(f))
} catch {
  console.error('[bundle] No hay dist/assets — ¿corriste vite build antes?')
  process.exit(1)
}
if (!files.length) {
  console.error('[bundle] No se encontró el bundle inicial index-*.js en', dir)
  process.exit(1)
}

let worst = 0
for (const f of files) {
  const gz = gzipSync(readFileSync(`${dir}/${f}`)).length / 1024
  worst = Math.max(worst, gz)
  console.log(`[bundle] ${f}: ${gz.toFixed(1)} KB gzip`)
}

if (worst > LIMIT_KB) {
  console.error(
    `\n❌ [bundle] El bundle inicial (${worst.toFixed(1)} KB gzip) supera el presupuesto de ${LIMIT_KB} KB.\n` +
      `   Algo pesado entró al arranque. Hazlo LAZY (import dinámico) o sube el límite en scripts/check-bundle.js a conciencia.`
  )
  process.exit(1)
}
console.log(`✅ [bundle] Bundle inicial dentro de presupuesto (${worst.toFixed(1)} / ${LIMIT_KB} KB gzip).`)
