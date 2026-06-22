/* Catálogo único de productos con foto (estudio, fondo negro, Nano Banana Pro).
   Fuente de verdad para el TPV y la sección Platos. */
export type Producto = {
  id: string
  name: string
  price: number
  cat: string
  img: string
  iva: number
  mods: string[]
}

export const CAT_ORDER = ['Burgers', 'Menús', 'Sides', 'Bebidas', 'Postres']

export const PRODUCTOS: Producto[] = [
  { id: 'classic', name: 'REBELL Classic', price: 11.0, cat: 'Burgers', img: '/img/products/classic.jpg', iva: 10, mods: ['Extra queso', 'Bacon'] },
  { id: 'doble', name: 'Doble Bacon', price: 13.0, cat: 'Burgers', img: '/img/products/doble.jpg', iva: 10, mods: ['Doble carne', 'Extra bacon'] },
  { id: 'crispy', name: 'Crispy Chicken', price: 12.0, cat: 'Burgers', img: '/img/products/crispy.jpg', iva: 10, mods: ['Picante'] },
  { id: 'veggie', name: 'Veggie Deluxe', price: 12.0, cat: 'Burgers', img: '/img/products/veggie.jpg', iva: 10, mods: ['Sin gluten', 'Vegano'] },
  { id: 'menu', name: 'Menú REBELL', price: 14.5, cat: 'Menús', img: '/img/products/menu.jpg', iva: 10, mods: ['Personalizable'] },
  { id: 'patatas', name: 'Patatas Rebell', price: 4.5, cat: 'Sides', img: '/img/products/patatas.jpg', iva: 10, mods: ['Con salsa'] },
  { id: 'nuggets', name: 'Nuggets x6', price: 5.5, cat: 'Sides', img: '/img/products/nuggets.jpg', iva: 10, mods: [] },
  { id: 'aros', name: 'Aros de cebolla', price: 4.0, cat: 'Sides', img: '/img/products/aros.jpg', iva: 10, mods: [] },
  { id: 'refresco', name: 'Refresco', price: 2.5, cat: 'Bebidas', img: '/img/products/refresco.jpg', iva: 10, mods: ['Sin azúcar'] },
  { id: 'cerveza', name: 'Cerveza', price: 3.0, cat: 'Bebidas', img: '/img/products/cerveza.jpg', iva: 10, mods: [] },
  { id: 'agua', name: 'Agua', price: 1.8, cat: 'Bebidas', img: '/img/products/agua.jpg', iva: 10, mods: [] },
  { id: 'brownie', name: 'Brownie', price: 4.5, cat: 'Postres', img: '/img/products/brownie.jpg', iva: 10, mods: ['Con helado'] },
]

/* Mapa nombre → foto, para reutilizar las imágenes del catálogo como miniaturas
   en Pedidos, Resumen, etc. (una sola fuente de verdad). */
const IMG_BY_NAME: Record<string, string> = Object.fromEntries(PRODUCTOS.map((p) => [p.name, p.img]))
export function imgFor(name: string): string | undefined {
  return IMG_BY_NAME[name]
}
