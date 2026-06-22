/* Registro del Modo Diseño v2 ("Zonas REBELL").
   Cada zona editable lleva data-ds="<id>" en el JSX; aquí mapeamos ese id a su
   SELECTOR CSS real (verificado en index.css), su nombre humano y qué props se
   pueden tocar. Editas el MOLDE (la clase), no la instancia → el override cuelga
   del selector, sobrevive al re-render de React y se exporta 1:1 al código. */

export type PropKey =
  | 'width' | 'height' | 'border-radius' | 'padding'
  | 'font-size' | 'font-weight' | 'letter-spacing' | 'stroke-width' | 'color'

export type PropMeta = { label: string; min?: number; max?: number; step?: number; unit?: string; type?: 'num' | 'color' }

export const PROP_META: Record<PropKey, PropMeta> = {
  'width': { label: 'Ancho', min: 120, max: 880, step: 2, unit: 'px' },
  'height': { label: 'Alto', min: 120, max: 880, step: 2, unit: 'px' },
  'border-radius': { label: 'Esquinas', min: 0, max: 48, step: 1, unit: 'px' },
  'padding': { label: 'Relleno', min: 0, max: 60, step: 1, unit: 'px' },
  'font-size': { label: 'Tamaño', min: 8, max: 130, step: 1, unit: 'px' },
  'font-weight': { label: 'Grosor', min: 300, max: 900, step: 50, unit: '' },
  'letter-spacing': { label: 'Interletra', min: -4, max: 6, step: 0.5, unit: 'px' },
  'stroke-width': { label: 'Grosor', min: 4, max: 26, step: 1, unit: 'px' },
  'color': { label: 'Color', type: 'color' },
}

export type Zone = {
  id: string
  selector: string
  label: string
  seccion: string
  props: PropKey[]
  resize?: boolean // muestra tiradores de tamaño
  text?: boolean // editable por doble-clic
}

export const ZONES: Zone[] = [
  { id: 'carta.card', selector: '.carta-card', label: 'Tarjeta de plato', seccion: 'Carta', resize: true, props: ['width', 'height', 'border-radius'] },
  { id: 'carta.name', selector: '.cc-name', label: 'Nombre del plato', seccion: 'Carta', text: true, props: ['font-size', 'font-weight', 'letter-spacing', 'color'] },
  { id: 'carta.price', selector: '.cc-price', label: 'Precio', seccion: 'Carta', props: ['font-size', 'font-weight', 'color'] },
  { id: 'carta.balnum', selector: '.cc-bal-num', label: 'Ventas / mes', seccion: 'Carta', props: ['font-size', 'color'] },
  { id: 'caja.heronum', selector: '.hero-gauge .odo', label: 'Número del día', seccion: 'Caja', props: ['font-size'] },
  { id: 'caja.gauge', selector: '.gauge-track, .gauge-fill', label: 'Anillo del medidor', seccion: 'Caja', props: ['stroke-width'] },
]

export const zoneById = (id?: string | null): Zone | undefined => ZONES.find((z) => z.id === id)

/* Tokens de marca para el picker de color (token-first, como pide el sistema). */
export const COLOR_TOKENS: { name: string; value: string }[] = [
  { name: 'Oro', value: '#ffbf10' },
  { name: 'Tinta', value: '#f5f5f7' },
  { name: 'Apagado', value: 'rgba(255,255,255,.54)' },
  { name: 'Blanco', value: '#ffffff' },
  { name: 'Verde', value: '#34d399' },
  { name: 'Azul', value: '#4aa3ff' },
]
