/* Navegación del panel REBELL — 5 grupos, 15 secciones. */
import type { ReactNode } from 'react'

export type NavItem = { id: string; t: string; s: string; tag?: string; alert?: string; desc: string }
export type NavGroup = { g: string; items: NavItem[]; accent?: boolean }

export const NAV: NavGroup[] = [
  {
    g: 'Operación',
    items: [
      { id: 'caja', t: 'Caja diaria', s: 'Cierre del día', desc: 'El laboratorio de cierre del día: total, turnos, cuadre y la secuencia de recompensa al cerrar.' },
      { id: 'tpv', t: 'TPV', s: 'Punto de venta', desc: 'El punto de venta para sala y barra: catálogo, ticket en curso y cobro rápido.' },
      { id: 'salon', t: 'Salón', s: 'Plano de sala', desc: 'Diseña tu sala: coloca las mesas, ajusta su tamaño y plazas. Luego en el TPV eliges a qué mesa va cada comanda.' },
      { id: 'pedidos', t: 'Pedidos', s: 'Delivery · últimos', tag: '12', alert: 'gold', desc: 'Todos los pedidos de delivery (Glovo, Uber Eats, Just Eat) en una cola viva con su estado.' },
      { id: 'kds', t: 'Comandas', s: 'Cocina en vivo', alert: 'gold', desc: 'El tablero de cocina (KDS): comandas entrando en vivo, con su tiempo y estado, listas para preparar y servir.' },
      { id: 'online', t: 'Canal online', s: 'Pedido por QR', tag: 'NEW', alert: 'gold', desc: 'La carta que ven tus clientes al escanear el QR de su mesa: pide y paga sin camarero. Aquí la previsualizas en un móvil y generas el QR de cada mesa para imprimir.' },
    ],
  },
  {
    g: 'IA',
    accent: true,
    items: [
      { id: 'mapa', t: 'Mapa de rivales', s: 'Competencia en tu zona', alert: 'gold', desc: 'Rastrea a tu competencia en un mapa: rivales por radio, sus reseñas, redes y noticias, con un Radar IA que te resume la semana.' },
    ],
  },
  {
    g: 'Análisis',
    items: [
      { id: 'resumen', t: 'Resumen', s: 'KPIs + cuenta de resultados', desc: 'El puesto de mando del negocio: ventas, margen, pedidos y tendencias, con la cuenta de resultados completa (facturación − coste de personal − food cost − gastos fijos = resultado neto) integrada.' },
      { id: 'mensual', t: 'Resumen mensual', s: 'Histórico por meses', desc: 'El histórico de cada mes: ventas, compras, gastos, coste de personal y margen bruto, con la comparativa mes a mes (absorbe la antigua Estadísticas).' },
      { id: 'gastos', t: 'Gastos fijos', s: 'Costes recurrentes', desc: 'Alquiler, luz, seguros… todos tus gastos fijos con IVA, prorrateados al día para un cuadro de mando exacto.' },
      { id: 'ventas', t: 'Ventas', s: 'Calendario por día', desc: 'El año entero de un vistazo: 12 meses en calendario, cada día con su venta y el total de efectivo, tarjeta y mes.' },
      { id: 'ventastpv', t: 'Ventas TPV', s: 'Libro de ventas', desc: 'El libro de cada venta del TPV (ticket o factura): base, IVA, total, con buscador, filtro por periodo y exportación a Excel.' },
      { id: 'arqueos', t: 'Arqueos', s: 'Libro de cierres', desc: 'El libro auditable de cada cierre de caja (arqueo): fecha, total y desglose de efectivo, tarjeta y tickets de cada turno cerrado en el TPV. Exportable e imprimible.' },
      { id: 'accesos', t: 'Accesos', s: 'Registro de seguridad', desc: 'El historial de seguridad del local (como el de tu banco): quién inició sesión, abrió o cerró caja, desde qué IP y dispositivo. Solo lo ve la gerencia.' },
    ],
  },
  {
    g: 'Cocina',
    items: [
      { id: 'foodcost', t: 'Food cost', s: 'Ficha técnica', desc: 'Ficha técnica por plato: ingredientes, coste y % de food cost. Sabrás qué plato te da margen.' },
      { id: 'stock', t: 'Almacén', s: 'Stock por almacén', alert: 'amber', desc: 'Tus almacenes (obrador, cámara, congelados, seco) como fichas con foto; cada uno con su stock, niveles y alertas de umbral. Puedes crear varios.' },
      { id: 'platos', t: 'Carta', s: 'Catálogo y extras', desc: 'Tu catálogo del TPV con precios, IVA y modificadores (extras, salsas). Una sola fuente de verdad.' },
      { id: 'compras', t: 'Compras', s: 'Proveedores', desc: 'Calendario de compras por proveedor, concepto, base e IVA. Lo que entra, ordenado.' },
    ],
  },
  {
    g: 'Equipo',
    items: [
      { id: 'empleados', t: 'Empleados', s: 'Plantilla', desc: 'Tu plantilla con categoría, salario líquido y coste de empresa. La base del coste de personal.' },
      { id: 'horarios', t: 'Horarios', s: 'Turnos semanales', desc: 'Rejilla semanal por empleado para asignar turnos y horas. Se cruza con los salarios para el coste real.' },
      { id: 'coste', t: 'Coste personal', s: 'Análisis de coste', desc: 'Cuánto te cuesta el equipo al día, a la semana y al mes, cruzando horarios reales con salarios.' },
    ],
  },
]

export const ALL_ITEMS: NavItem[] = NAV.flatMap((g) => g.items)
export const itemById = (id: string) => ALL_ITEMS.find((i) => i.id === id)

/* ── iconos (línea, 24×24, stroke currentColor) ── */
const PATHS: Record<string, ReactNode> = {
  caja: <><path d="M3 8h18M3 8l1.5-3h15L21 8M4 8v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8" /><path d="M9 12h6" /></>,
  resumen: <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>,
  pedidos: <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18M16 10a4 4 0 0 1-8 0" /></>,
  tpv: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
  salon: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="2" /><circle cx="15.5" cy="15.5" r="2" /></>,
  kds: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v5M16 4v5M7 14h4" /></>,
  online: <><rect x="7" y="2" width="10" height="20" rx="2.5" /><path d="M11 18h2" /><path d="M9.5 6.5h5M9.5 9.5h5M9.5 12.5h3" /></>,
  cuadro: <><path d="M21 12a9 9 0 1 1-9-9v9Z" /><path d="M21 12a9 9 0 0 0-9-9" /></>,
  estad: <><path d="M3 3v18h18" /><rect x="7" y="11" width="3" height="6" /><rect x="12" y="7" width="3" height="10" /><rect x="17" y="13" width="3" height="4" /></>,
  mensual: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></>,
  ventas: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /><circle cx="8" cy="14" r="1" /><circle cx="12" cy="14" r="1" /><circle cx="16" cy="14" r="1" /></>,
  ventastpv: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
  arqueos: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="11" cy="12" r="3" /><path d="M11 12h6M16 12h.01" /></>,
  accesos: <><path d="M12 3l7 3v5c0 4.6-3 7.6-7 9-4-1.4-7-4.4-7-9V6l7-3Z" /><path d="M9.2 12l1.9 1.9L15 10" /></>,
  mapa: <><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0Z" /><circle cx="12" cy="10" r="3" /></>,
  gastos: <><rect x="2" y="6" width="20" height="13" rx="2" /><path d="M2 10h20M17 15h.01" /></>,
  empleados: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M16 6a3 3 0 0 1 0 5M21 20a5 5 0 0 0-4-4.9" /></>,
  horarios: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  coste: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><circle cx="18.5" cy="8.5" r="2.5" /><path d="M18.5 13.5v6M16 16.5h5" /></>,
  foodcost: <><path d="M6 13.5V21h12v-7.5M4 13.5h16a6 6 0 0 0-16 0Z" /><path d="M12 7.5V4M9 5.5 12 4l3 1.5" /></>,
  stock: <><path d="M21 8 12 3 3 8l9 5 9-5ZM3 8v8l9 5 9-5V8M12 13v8" /></>,
  platos: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>,
  compras: <><circle cx="9" cy="20" r="1.4" /><circle cx="17" cy="20" r="1.4" /><path d="M2 3h3l2.4 12.5a2 2 0 0 0 2 1.5h7.7a2 2 0 0 0 2-1.6L23 7H6" /></>,
}

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {PATHS[name] || PATHS.resumen}
    </svg>
  )
}
