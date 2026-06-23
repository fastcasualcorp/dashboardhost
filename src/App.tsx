import { useState } from 'react'
import Shell from './components/Shell'
import Login, { type Profile } from './components/Login'
import BootIntro from './components/BootIntro'
import { beastById } from './lib/beasts'
import { reduceMotion } from './lib/data'

function readProfile(): string | null {
  try {
    return localStorage.getItem('rebell-profile')
  } catch {
    return null
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
  const [profile, setProfile] = useState<string | null>(readProfile)
  const [booting, setBooting] = useState<boolean>(shouldBoot)

  const content = !profile ? (
    <Login
      onEnter={(p: Profile) => {
        try {
          const beast = beastById(p.beast)
          localStorage.setItem('rebell-profile', p.id)
          localStorage.setItem('rebell-profile-name', p.name)
          localStorage.setItem('rebell-beast', beast.id)
          // cada local entra con el color de su bestia
          localStorage.setItem('rebell-accent', beast.accent)
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
      {content}
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
