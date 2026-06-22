import { useState } from 'react'
import Shell from './components/Shell'
import Login, { type Profile } from './components/Login'
import { beastById } from './lib/beasts'

function readProfile(): string | null {
  try {
    return localStorage.getItem('rebell-profile')
  } catch {
    return null
  }
}

export default function App() {
  const [profile, setProfile] = useState<string | null>(readProfile)

  if (!profile) {
    return (
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
    )
  }
  return <Shell />
}
