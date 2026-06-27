import { useEffect, useState, lazy, Suspense } from 'react'
import Shell from './components/Shell'
import Login, { type Profile, PROFILES } from './components/Login'
import BootIntro from './components/BootIntro'
import { beastById } from './lib/beasts'
import { reduceMotion } from './lib/data'
import { supabase, hasSupabase } from './lib/supabase'

// Página PÚBLICA de pedido por QR (cliente final, sin login). Va en su propio
// chunk (lazy) para no engordar el bundle del panel. Se resuelve por la URL del
// QR (/pedir?l=local&m=mesa) antes de montar nada del dashboard.
const Pedir = lazy(() => import('./sections/Pedir'))
const IS_PEDIR = typeof window !== 'undefined' && window.location.pathname.replace(/\/+$/, '') === '/pedir'

function readProfile(): string | null {
  try {
    return localStorage.getItem('rebell-profile')
  } catch {
    return null
  }
}

// Guarda en localStorage los datos de UI del local (nombre, bestia, acento).
function rememberProfile(id: string) {
  const p = PROFILES.find((x) => x.id === id)
  if (!p) return
  try {
    // ¿Es el MISMO local que ya estaba recordado? (recarga / re-login del mismo local)
    const sameLocal = localStorage.getItem('rebell-profile') === id
    const yaTieneBestia = !!localStorage.getItem('rebell-beast')
    localStorage.setItem('rebell-profile', p.id)
    localStorage.setItem('rebell-profile-name', p.name)
    // La bestia/acento POR DEFECTO solo se fijan la PRIMERA vez que se entra a este local. Si es el mismo
    // local (recarga) y el usuario ya eligió animal/color en la app, se RESPETA su elección — antes la
    // recarga restablecía la bestia del perfil y "cambiaba de animal" (bug reportado por Juan, 25-jun).
    if (!sameLocal || !yaTieneBestia) {
      const beast = beastById(p.beast)
      localStorage.setItem('rebell-beast', beast.id)
      localStorage.setItem('rebell-accent', beast.accent)
    }
  } catch {
    /* sin localStorage */
  }
}

// La intro de cocina viva se ve UNA vez por sesión (y nunca con reduce-motion).
function shouldBoot(): boolean {
  try {
    if (sessionStorage.getItem('rebell-booted')) return false
  } catch {
    /* sin sessionStorage */
  }
  return !reduceMotion()
}

export default function App() {
  // Ruta pública del QR: el cliente final entra aquí SIN login ni intro. Se decide
  // por la URL (constante durante la vida de la página) → no rompe el orden de hooks.
  if (IS_PEDIR) {
    return (
      <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg)' }} />}>
        <Pedir />
      </Suspense>
    )
  }
  // Con Supabase, el acceso depende de la SESIÓN real (no de localStorage). Sin
  // backend (modo demo) caemos al perfil guardado.
  const [profile, setProfile] = useState<string | null>(() => (hasSupabase ? null : readProfile()))
  const [authReady, setAuthReady] = useState<boolean>(!hasSupabase)
  const [booting, setBooting] = useState<boolean>(shouldBoot)

  useEffect(() => {
    if (!hasSupabase || !supabase) return
    supabase.auth.getSession().then(({ data }) => {
      const email = data.session?.user?.email
      if (email) {
        const id = email.split('@')[0]
        rememberProfile(id)
        setProfile(id)
      }
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) {
        setProfile(null)
        try {
          localStorage.removeItem('rebell-profile')
        } catch {
          /* sin localStorage */
        }
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // "Ver intro" desde el perfil (Ajustes) → re-reproduce el reveal SIN cerrar sesión.
  useEffect(() => {
    const replay = () => setBooting(true)
    window.addEventListener('rebell:play-intro', replay)
    return () => window.removeEventListener('rebell:play-intro', replay)
  }, [])

  const content = !profile ? (
    <Login
      onEnter={(p: Profile) => {
        rememberProfile(p.id)
        // Al INICIAR SESIÓN siempre se aterriza en Caja diaria (no en la última sección que quedó
        // guardada de la vez anterior). Se escribe ANTES de montar el Shell → su estado inicial lee 'caja'.
        try {
          localStorage.setItem('rebell-active', 'caja')
        } catch {
          /* sin localStorage */
        }
        setProfile(p.id)
      }}
    />
  ) : (
    <Shell />
  )

  return (
    <>
      {authReady && content}
      {booting && (
        <BootIntro
          onDone={() => {
            try {
              sessionStorage.setItem('rebell-booted', '1')
            } catch {
              /* sin sessionStorage */
            }
            setBooting(false)
          }}
        />
      )}
    </>
  )
}
