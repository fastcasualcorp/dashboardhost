import { useState } from 'react'
import Shell from './components/Shell'
import Login, { type Profile } from './components/Login'

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
            localStorage.setItem('rebell-profile', p.id)
            localStorage.setItem('rebell-profile-name', p.name)
            // cada local entra con su color de acento
            localStorage.setItem('rebell-accent', p.accent)
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
