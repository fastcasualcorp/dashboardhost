import { useEffect, useState } from 'react'

/* Revelar UNA VEZ por sesión. Devuelve true la PRIMERA vez que se monta una vista con esta `key` (para
   disparar la animación de entrada "de golpe") y false en visitas posteriores → la pantalla se queda
   ESTÁTICA al volver, sin re-animar (no satura, regla de Juan 29-jun). El registro vive en memoria del
   módulo: se reinicia al recargar la página = "la primera vez que el usuario entra" en esa sesión. */
const seen = new Set<string>()

export function useRevealOnce(key: string): boolean {
  const [animate] = useState(() => !seen.has(key))
  useEffect(() => {
    seen.add(key)
  }, [key])
  return animate
}
