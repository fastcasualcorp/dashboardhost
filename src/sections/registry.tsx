import { lazy, Suspense, type ComponentType } from 'react'
import { itemById } from '../nav'
// EAGER = las pantallas de USO DIARIO (van en el bundle inicial → cero parpadeo al cambiar entre ellas).
import Caja from './Caja'
import Resumen from './Resumen'
import Pedidos from './Pedidos'
import Tpv from './Tpv'
import Salon from './Salon'
import Kds from './Kds'
import Online from './Online'
// LAZY = el resto (informes, gestión, mapa…). Cada una es su propio chunk → solo se descarga al abrirla.
// Baja muchísimo el bundle inicial (auditoría 28-jun). El Mapa (mapbox-gl) es el más pesado.
const MapaIncidencia = lazy(() => import('./MapaIncidencia'))
const Ventas = lazy(() => import('./Ventas'))
const VentasTpv = lazy(() => import('./VentasTpv'))
const Arqueos = lazy(() => import('./Arqueos'))
const Accesos = lazy(() => import('./Accesos'))
const Estadisticas = lazy(() => import('./Estadisticas'))
const Mensual = lazy(() => import('./Mensual'))
const Gastos = lazy(() => import('./Gastos'))
const Empleados = lazy(() => import('./Empleados'))
const Horarios = lazy(() => import('./Horarios'))
const Coste = lazy(() => import('./Coste'))
const FoodCost = lazy(() => import('./FoodCost'))
const Almacen = lazy(() => import('./Almacen'))
const Platos = lazy(() => import('./Platos'))
const Compras = lazy(() => import('./Compras'))
const PrepararManana = lazy(() => import('./PrepararManana'))
import SectionPreview from './SectionPreview'

// Fallback mientras se descarga un chunk lazy: fondo de marca (NO blanco) + pulso sutil. Respeta la regla
// "sin huecos en blanco al cargar". Para el Mapa, encima entra su propio arranque al montar.
function SectionLoading() {
  return (
    <div className="section-loading" aria-busy="true" aria-label="Cargando">
      <span className="sl-pulse" />
    </div>
  )
}

const MAP: Record<string, ComponentType> = {
  caja: Caja,
  resumen: Resumen,
  pedidos: Pedidos,
  tpv: Tpv,
  salon: Salon,
  kds: Kds,
  online: Online,
  cuadro: Resumen, // "Cuadro de mando" fusionado dentro de Resumen → cualquier enlace antiguo cae en el merge
  ventas: Ventas,
  ventastpv: VentasTpv,
  arqueos: Arqueos,
  accesos: Accesos,
  mapa: MapaIncidencia,
  estad: Estadisticas,
  mensual: Mensual,
  gastos: Gastos,
  empleados: Empleados,
  horarios: Horarios,
  coste: Coste,
  foodcost: FoodCost,
  stock: Almacen,
  platos: Platos,
  compras: Compras,
  preparar: PrepararManana,
}

export function renderSection(id: string) {
  const C = MAP[id]
  if (C) return <Suspense fallback={<SectionLoading />}><C /></Suspense>
  const item = itemById(id)
  return <SectionPreview id={id} title={item?.t || id} desc={item?.desc || ''} />
}
