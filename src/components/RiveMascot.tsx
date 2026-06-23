import { useRive } from '@rive-app/react-canvas'

/* Mascota Rive — reproduce un archivo .riv (animación interactiva en tiempo real,
   tipo videojuego) y lo deja conducir por código (estados, hover, datos). El
   .riv de NUESTRA bestia se diseña en el editor de Rive; este componente ya está
   listo para enchufarlo: <RiveMascot src="/rive/leon.riv" stateMachine="..." />. */
export default function RiveMascot({
  src = '/rive/demo.riv',
  stateMachine,
  artboard,
  className,
}: {
  src?: string
  stateMachine?: string
  artboard?: string
  className?: string
}) {
  const { RiveComponent, rive } = useRive({
    src,
    artboard,
    stateMachines: stateMachine,
    autoplay: true,
  })
  return (
    <div className={className} onPointerEnter={() => rive?.play()} role="img" aria-label="Mascota REBELL">
      <RiveComponent />
    </div>
  )
}
