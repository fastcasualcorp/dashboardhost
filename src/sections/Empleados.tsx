import { Card, SectionHeader, KpiTile, DataTable, Badge, Grid } from '../components/ui'

const empleados = [
  { nombre: 'Marta Fernández',  categoria: <Badge tone="gold">Encargada</Badge>,   jornada: 'Completa', liquido: '1.420,00 €', coste: '1.990,00 €' },
  { nombre: 'Carlos Rodríguez', categoria: <Badge tone="gold">Encargado</Badge>,   jornada: 'Completa', liquido: '1.380,00 €', coste: '1.930,00 €' },
  { nombre: 'Lucía Gómez',      categoria: <Badge tone="amber">Cocina</Badge>,     jornada: 'Completa', liquido: '1.140,00 €', coste: '1.600,00 €' },
  { nombre: 'Iván Martínez',    categoria: <Badge tone="amber">Cocina</Badge>,     jornada: 'Completa', liquido: '1.140,00 €', coste: '1.600,00 €' },
  { nombre: 'Sofía Castro',     categoria: <Badge tone="blue">Sala</Badge>,        jornada: 'Completa', liquido: '1.080,00 €', coste: '1.520,00 €' },
  { nombre: 'Diego López',      categoria: <Badge tone="blue">Sala</Badge>,        jornada: 'Parcial',  liquido: '640,00 €',   coste: '900,00 €'   },
  { nombre: 'Elena Sánchez',    categoria: <Badge tone="green">Repartidora</Badge>,jornada: 'Parcial',  liquido: '680,00 €',   coste: '950,00 €'   },
  { nombre: 'Pablo Vidal',      categoria: <Badge tone="green">Repartidor</Badge>, jornada: 'Parcial',  liquido: '640,00 €',   coste: '910,00 €'   },
]

const columnas = [
  { key: 'nombre',   label: 'Empleado'       },
  { key: 'categoria',label: 'Categoría'      },
  { key: 'jornada',  label: 'Jornada'        },
  { key: 'liquido',  label: 'Salario líquido', align: 'right' as const },
  { key: 'coste',    label: 'Coste empresa',   align: 'right' as const },
]

export default function Empleados() {
  return (
    <div className="section">
      <SectionHeader
        title="Empleados"
        subtitle="Plantilla"
        right={<Badge tone="muted">8 activos</Badge>}
      />

      <Grid cols={3} className="kpi-grid">
        <KpiTile label="Empleados" value="8" unit="personas" delta="0" foot="plantilla actual" trend="flat" />
        <KpiTile label="Coste empresa / mes" value="12.400,00" unit="€" delta="+1,6%" foot="vs mes anterior" trend="down" />
        <KpiTile label="Salario medio neto" value="1.012,50" unit="€" delta="estable" foot="media plantilla" trend="flat" />
      </Grid>

      <Card>
        <div className="card-head">
          <h3>Plantilla completa</h3>
          <Badge tone="muted">junio 2026</Badge>
        </div>
        <DataTable columns={columnas} rows={empleados} />
      </Card>
    </div>
  )
}
