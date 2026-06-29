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

/* ── ESCUDO demo↔real: demo y real NUNCA comparten "cajón" (localStorage) ──
   Al cambiar de modo vaciamos solo las claves de DATOS del negocio. Así no quedan
   migajas de un modo en el otro (p.ej. caja/mesas de cuando trasteabas en demo).
   En REAL Supabase rehidrata; en DEMO las semillas se regeneran solas → seguro.
   Los AJUSTES (tokens de diseño, sonido, plan, ahorro, KDS, perfil, caché de
   sitios) NO se tocan: son preferencias, no datos, y deben sobrevivir al cambio. */
const DATA_KEYS = [
  'rebell-caja-dia-v1', // wallet (caja del día)
  'rebell-caja-estado-v1', // caja abierta/cerrada
  'rebell-ticket-seq-v1', // nº de ticket
  'rebell-ventas-v1', // ventas
  'rebell-ventas-ovr-v1', // ajustes manuales de Ventas
  'rebell-compras-v1', // albaranes
  'rebell-gastos-v1', // gastos fijos
  'rebell-escandallo-v1', // food cost (platos)
  'rebell-escandallo-ing-v1', // food cost (ingredientes)
  'rebell-cuentas-v1', // cuentas de mesa
  'rebell-cierres-v1', // arqueos Z
  'rebell-equipo-v1', // plantilla
  'rebell-cliente-v1', // cliente
  'rebell-local-v1', // local
]
const DATA_PREFIXES = ['rebell-salon-v1'] // plano de mesas (scopeado por local)

/** Borra solo los datos del negocio (deja intactos los ajustes). */
function clearBusinessData(): void {
  try {
    for (const k of DATA_KEYS) localStorage.removeItem(k)
    // claves scopeadas (salón por local): barrido por prefijo
    const scoped: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && DATA_PREFIXES.some((p) => k.startsWith(p))) scoped.push(k)
    }
    for (const k of scoped) localStorage.removeItem(k)
  } catch {
    /* sin localStorage → nada que limpiar */
  }
}

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
    clearBusinessData() // escudo: el modo nuevo arranca sin migajas del anterior
    if (on) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {
    /* sin localStorage → no se puede recordar el modo */
  }
  if (typeof location !== 'undefined') location.reload()
}
