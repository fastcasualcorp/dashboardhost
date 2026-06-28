/* LOGO "FAT SMASH" — se pinta como MÁSCARA CSS sobre un <span> teñido con el color de
   acento (background: var(--brand)). Ventajas: pesa poco (SVG en /img), recolorea con el
   acento, admite efectos por CSS y se DIMENSIONA fiable (aspect-ratio en un span no sufre
   el bug de altura 0 de los <svg> inline en flex). Dos variantes vía data-logo:
     · 'a' → solo el lettering.
     · 'b' → lettering + dos barras (arriba/abajo), como el logo clásico. */
export type LogoVariant = 'a' | 'b'

export default function LogoMark({ variant = 'b', className }: { variant?: LogoVariant; className?: string }) {
  return <span className={className} data-logo={variant} role="img" aria-label="FAT SMASH" />
}
