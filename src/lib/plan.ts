/* ════════════════════════════════════════════════════════════════════
   PLAN de la cuenta (free · basic · pro) — FUENTE ÚNICA.
   Lo leen: la píldora de la cabecera (Pro = badge MORADO glossy · Free/Basic
   = botón "Mejorar" animado) y la pantalla de Planes. Persiste en localStorage;
   al cambiar emite 'rebell:plan' para que la UI se actualice SIN recargar.
   ════════════════════════════════════════════════════════════════════ */
export type Plan = 'free' | 'basic' | 'pro'
const KEY = 'rebell-plan'
const NAMES: Record<Plan, string> = { free: 'Free', basic: 'Basic', pro: 'Pro' }
/** Planes que NO necesitan upgrade (de momento solo Pro es "el completo"). */
const PAID: Plan[] = ['pro']

/** Plan actual de la cuenta (por defecto Pro, igual que el comportamiento previo). */
export function getPlan(): Plan {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'free' || v === 'basic' || v === 'pro') return v
  } catch {
    /* sin localStorage */
  }
  return 'pro'
}

/** Cambia el plan y avisa a la UI (sin recargar). */
export function setPlan(plan: Plan): void {
  try {
    localStorage.setItem(KEY, plan)
  } catch {
    /* sin localStorage → no se recuerda */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('rebell:plan', { detail: plan }))
}

/** Nombre bonito del plan ("Pro", "Basic", "Free"). */
export function planName(plan: Plan = getPlan()): string {
  return NAMES[plan]
}

/** ¿Este plan puede "Mejorar"? (free y basic sí; pro no). */
export function canUpgrade(plan: Plan = getPlan()): boolean {
  return !PAID.includes(plan)
}
