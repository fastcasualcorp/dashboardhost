import { Component, type ReactNode } from 'react'

/* Pantalla ANTI-CRASH (bloqueante de la auditoría): si una sección lanza un error, en vez de tumbar TODA
   la app a pantalla en blanco (catastrófico en un TPV cobrando), mostramos un aviso contenido con botón de
   reintento. El resto de la app (menú, cabecera) sigue viva. Los error boundaries deben ser class component. */

type Props = { children: ReactNode; section?: string }
type State = { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidUpdate(prev: Props) {
    // Al cambiar de sección, se limpia el error → la siguiente sección se intenta renderizar limpia.
    if (prev.section !== this.props.section && this.state.error) this.setState({ error: null })
  }

  componentDidCatch(error: Error) {
    // Punto único para enganchar telemetría de errores en el futuro (Sentry, etc.).
    console.error('[ErrorBoundary]', this.props.section, error)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="err-boundary" role="alert">
          <div className="err-card">
            <span className="err-emo" aria-hidden="true">⚠️</span>
            <h2>Algo falló en esta pantalla</h2>
            <p>El resto del panel sigue funcionando. Puedes reintentar o cambiar de sección desde el menú.</p>
            <button className="err-retry" onClick={() => this.setState({ error: null })}>Reintentar</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
