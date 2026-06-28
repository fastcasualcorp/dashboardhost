/* ════════════════════════════════════════════════════════════════════
   INTERRUPTOR DEMO / REAL — un clic en el perfil pasa todo el panel de
   "datos REALES del local" (Supabase) a "datos de EJEMPLO" (escaparate para
   enseñar a un cliente) y al revés.
     · REAL  → cada store sincroniza con la nube (comportamiento normal).
     · DEMO  → los stores se quedan en su SEMILLA (memoria/localStorage) y NO
               escriben en la nube → puedes trastear sin tocar el negocio real.
   El cambio recarga la página para que cada store arranque limpio en el modo
   elegido (sin estados a medias). El flag persiste en localStorage.
   ════════════════════════════════════════════════════════════════════ */
const KEY = 'rebell-demo-mode'

/** ¿El panel está mostrando datos de ejemplo (escaparate) en vez de los reales? */
export function isDemoMode(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** Cambia entre datos de ejemplo y reales. Recarga para re-sincronizar sin mezclar. */
export function setDemoMode(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {
    /* sin localStorage → no se puede recordar el modo */
  }
  if (typeof location !== 'undefined') location.reload()
}
