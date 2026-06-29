/* ════════════════════════════════════════════════════════════════════════════
   SEMÁFORO DE ONBOARDING — "pon tu local a punto".
   En MODO REAL un local nuevo arranca vacío (el escudo demo↔real lo garantiza, y el
   test real-cero.test.ts lo vigila). Esta es la otra cara: en vez de un panel mudo,
   le decimos al cliente QUÉ tiene y QUÉ le falta, y lo llevamos al sitio para rellenarlo.

   FUENTE ÚNICA: lee los MISMOS getters que comprueba el guardrail "real = 0" → lo que
   el test exige a 0 es justo lo que aquí aparece como "pendiente". Un solo concepto, un
   solo origen (regla de componente único). La pantalla PrimerosPasos y el menú (Shell)
   beben de aquí: nunca pueden divergir.
   ════════════════════════════════════════════════════════════════════════════ */
import { getGastos } from './gastos'
import { loadSalon } from './salon'
import { getRoster } from './equipo'
import { fichaFoodCost } from './foodcost'
import { getAlmacenes } from './almacen'

export type PasoOnb = {
  sec: string // sección destino (rebell:goto)
  emoji: string
  titulo: string
  n: number // cuántos lleva el cliente
  unidad: [string, string] // [singular, plural] para el contador
  falta: string // copy-guía en lenguaje llano cuando va a 0
  hecho: boolean
}

/** Los pasos del onboarding con su recuento ACTUAL (se recalcula en cada render). */
export function pasosOnboarding(): PasoOnb[] {
  const def: Omit<PasoOnb, 'hecho'>[] = [
    { sec: 'gastos', emoji: '🧾', titulo: 'Tus gastos fijos', n: getGastos().length, unidad: ['gasto', 'gastos'], falta: 'Mete el alquiler, la luz, los seguros…' },
    { sec: 'salon', emoji: '🪑', titulo: 'El plano de tu sala', n: loadSalon().length, unidad: ['mesa', 'mesas'], falta: 'Coloca tus mesas en el plano' },
    { sec: 'empleados', emoji: '👥', titulo: 'Tu equipo', n: getRoster().length, unidad: ['persona', 'personas'], falta: 'Da de alta a tu plantilla' },
    { sec: 'foodcost', emoji: '🍔', titulo: 'El coste de tus platos', n: fichaFoodCost().length, unidad: ['plato', 'platos'], falta: 'Apunta lo que te cuesta cada plato' },
    { sec: 'stock', emoji: '📦', titulo: 'Tu almacén', n: getAlmacenes().length, unidad: ['almacén', 'almacenes'], falta: 'Crea tus almacenes y su stock' },
  ]
  return def.map((d) => ({ ...d, hecho: d.n > 0 }))
}

export const onboardingTotal = () => 5 // pasos del semáforo (mantener sincronizado con pasosOnboarding)
export const onboardingHechos = () => pasosOnboarding().filter((p) => p.hecho).length
export const onboardingPct = () => Math.round((onboardingHechos() / onboardingTotal()) * 100)
export const onboardingPendientes = () => onboardingTotal() - onboardingHechos()
export const onboardingComplete = () => onboardingPendientes() === 0
