/* Catálogo de "bestias" REBELL — el avatar de cada local.
   Fuente única: Login, barra lateral y el selector de bestia tiran de aquí.
   Imágenes generadas en Magnific con el MISMO prompt-plantilla (ancla tigre
   xgCOGcvjfW) + modelo Nano Banana Pro, para que TODAS casen de estilo. */
export type Beast = { id: string; name: string; img: string; color: string; accent: string; video?: string }

export const BEASTS: Beast[] = [
  { id: 'lion', name: 'León', img: '/img/avatars/lion.png', color: '#ffbf10', accent: 'gold', video: '/video/lion.mp4' },
  { id: 'panda', name: 'Panda', img: '/img/avatars/panda.png', color: '#c8c8d0', accent: 'mono', video: '/video/panda.mp4' },
  { id: 'fox', name: 'Zorro', img: '/img/avatars/fox.png', color: '#e0457a', accent: 'rosa' },
  { id: 'panther', name: 'Pantera', img: '/img/avatars/panther.png', color: '#8b6df0', accent: 'violeta' },
  { id: 'tiger', name: 'Tigre', img: '/img/avatars/tiger.png', color: '#ff7a3d', accent: 'atardecer' },
  { id: 'owl', name: 'Búho', img: '/img/avatars/owl.png', color: '#22d3ee', accent: 'aurora' },
]

export const beastById = (id?: string | null): Beast => BEASTS.find((b) => b.id === id) ?? BEASTS[0]
