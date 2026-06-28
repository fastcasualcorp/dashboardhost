import { lazy, Suspense, type ComponentType } from 'react'
import { itemById } from '../nav'
import Caja from './Caja'
import Resumen from './Resumen'
import Pedidos from './Pedidos'
import Tpv from './Tpv'
import Salon from './Salon'
import Kds from './Kds'
import Online from './Online'
import Ventas from './Ventas'
import VentasTpv from './VentasTpv'
import Arqueos from './Arqueos'
import Accesos from './Accesos'
// El MAPA arrastra mapbox-gl (~62% del bundle). Se carga LAZY → solo descarga al abrir el Mapa, no al
// arrancar la Caja. Baja el bundle inicial de ~2,8MB a ~1,1MB (auditoría 28-jun). El resto de secciones
// son ligeras y se quedan eager (cero parpadeo en el uso diario).
const MapaIncidencia = lazy(() => import('./MapaIncidencia'))
import Estadisticas from './Estadisticas'
import Mensual from './Mensual'
import Gastos from './Gastos'
import Empleados from './Empleados'
import Horarios from './Horarios'
import Coste from './Coste'
import FoodCost from './FoodCost'
import Almacen from './Almacen'
import Platos from './Platos'
import Compras from './Compras'
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
}

export function renderSection(id: string) {
  const C = MAP[id]
  if (C) return <Suspense fallback={<SectionLoading />}><C /></Suspense>
  const item = itemById(id)
  return <SectionPreview id={id} title={item?.t || id} desc={item?.desc || ''} />
}
