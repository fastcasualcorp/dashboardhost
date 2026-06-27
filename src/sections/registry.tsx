import type { ComponentType } from 'react'
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
import MapaIncidencia from './MapaIncidencia'
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
  if (C) return <C />
  const item = itemById(id)
  return <SectionPreview id={id} title={item?.t || id} desc={item?.desc || ''} />
}
