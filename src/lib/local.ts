/* ════════════════════════════════════════════════════════════════════
   EL LOCAL (tu negocio) — fuente ÚNICA de su ubicación e identidad.
   Antes el Mapa tenía las coordenadas y el nombre HARDCODEADOS → imposible
   multi-tenant (cada cliente vería el local de otro). Ahora salen de aquí:
   coords/datos persistidos (`rebell-local-v1`) y el nombre del perfil logueado
   (`rebell-profile-name`). El Mapa centra, dibuja el héroe y busca rivales con
   ESTO. (futuro: cargar lat/lng del perfil de Supabase del tenant). (audit · Mapa)
   ════════════════════════════════════════════════════════════════════ */

export type LocalCfg = { name: string; lat: number; lng: number; rating: number; reviews: number; precio: number; direccion?: string }

// Demo de partida (Bertamiráns). En multi-tenant esto vendrá del perfil del local.
const DEFAULT: LocalCfg = {
  name: 'REBELL · Homeburger',
  lat: 42.8576544,
  lng: -8.657097,
  rating: 4.2,
  reviews: 495,
  precio: 13.5,
  direccion: 'Avenida da Maía, 26, Bertamiráns',
}

const KEY = 'rebell-local-v1'

function readProfileName(): string | null {
  try {
    return localStorage.getItem('rebell-profile-name')
  } catch {
    return null
  }
}

function load(): LocalCfg {
  let cfg: LocalCfg = { ...DEFAULT }
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) cfg = { ...cfg, ...(JSON.parse(raw) as Partial<LocalCfg>) }
  } catch {
    /* sin localStorage */
  }
  // El nombre del local lo manda el perfil logueado (multi-tenant) si existe.
  const prof = readProfileName()
  if (prof && !cfg.name.includes(prof)) cfg.name = `REBELL · ${prof}`
  return cfg
}

// Fuente única que consume el Mapa. Se resuelve una vez al cargar el módulo (igual que antes el const LOCAL).
export const LOCAL: LocalCfg = load()

// Para cuando exista un editor de la ficha del local (multi-tenant): persiste y devuelve la nueva config.
export function setLocal(patch: Partial<LocalCfg>): LocalCfg {
  const next = { ...LOCAL, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* sin localStorage */
  }
  Object.assign(LOCAL, next)
  return LOCAL
}
