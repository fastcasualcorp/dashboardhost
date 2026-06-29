import { describe, it, expect } from 'vitest'
import { isDemoMode } from './demo'
import { getVentas, ventasHoyTotal, ventasHoyCount } from './ventas'
import { walletTotal, walletEntries, walletEntryCount } from './wallet'
import { getGastos, gastosOrdenados } from './gastos'
import { getCompras, comprasMes, pendienteMes } from './compras'
import { getRoster } from './equipo'
import { getCierres } from './cierres'
import { getIngredientes, costeMateriaMes, fichaFoodCost } from './foodcost'
import { getAlmacenes } from './almacen'
import { loadSalon } from './salon'
import { getAccesos } from './acceso'
import { cierreDia } from './cierre'
import { VENTAS_MES, salesForMonth, salesForDay } from './data'
import { cuentaTotal } from './cuentas'
import { onboardingPct, onboardingComplete, pasosOnboarding } from './onboarding'

/* ════════════════════════════════════════════════════════════════════════════
   ESCUDO "real = 0" — el guardrail anti-dato-falso (idea de Juan, 29-jun).
   Regla dura: en MODO REAL (demo OFF) un local NUEVO arranca VACÍO; los ejemplos
   viven SOLO en demo. Si alguien vuelve a sembrar datos en un panel sin gatear por
   isDemoMode(), ESTE test lo caza y rompe el build/CI antes de que llegue a un cliente.

   Por qué funciona sin montar nada: vitest corre en Node, donde `localStorage` no
   existe → isDemoMode() cae al catch y devuelve `false` = modo REAL automático.
   O sea, este archivo SE EJECUTA ya en modo real; solo tenemos que exigir el cero.
   ════════════════════════════════════════════════════════════════════════════ */

describe('modo real = sin datos falsos (un local nuevo arranca vacío)', () => {
  it('el entorno de test ES modo real (sin localStorage → demo OFF)', () => {
    expect(isDemoMode()).toBe(false)
  })

  it('Caja del día: 0 € y sin movimientos', () => {
    expect(walletTotal()).toBe(0)
    expect(walletEntries()).toEqual([])
    expect(walletEntryCount()).toBe(0)
  })

  it('Ventas: sin tickets ni total de hoy', () => {
    expect(getVentas()).toEqual([])
    expect(ventasHoyTotal()).toBe(0)
    expect(ventasHoyCount()).toBe(0)
  })

  it('Gastos fijos: lista vacía', () => {
    expect(getGastos()).toEqual([])
    expect(gastosOrdenados()).toEqual([])
  })

  it('Compras (albaranes): vacío y 0 € de gasto', () => {
    expect(getCompras()).toEqual([])
    expect(comprasMes()).toBe(0)
    expect(pendienteMes()).toBe(0)
  })

  it('Equipo: plantilla vacía', () => {
    expect(getRoster()).toEqual([])
  })

  it('Arqueos (cierres Z): libro vacío', () => {
    expect(getCierres()).toEqual([])
  })

  it('Food cost: sin escandallos ni coste de materia', () => {
    expect(getIngredientes()).toEqual([])
    expect(costeMateriaMes()).toBe(0)
    expect(fichaFoodCost()).toEqual([])
  })

  it('Almacén: sin existencias inventadas', () => {
    expect(getAlmacenes()).toEqual([])
  })

  it('Salón: lienzo de mesas vacío', () => {
    expect(loadSalon()).toEqual([])
  })

  it('Accesos: registro de seguridad vacío', () => {
    expect(getAccesos()).toEqual([])
  })

  it('Cierre del día (generador): todo a 0, sin RNG', () => {
    const c = cierreDia(new Date())
    expect(c.total).toBe(0)
    expect(c.tickets).toBe(0)
    expect(c.topPlatos).toEqual([])
    expect(c.alertas).toEqual([])
  })

  it('Agregados de ventas (data): mes y día a 0', () => {
    expect(VENTAS_MES).toBe(0)
    expect(salesForMonth(2026, 5).total).toBe(0)
    expect(salesForDay(2026, 5, 15)?.total).toBe(0)
  })

  it('Cuentas de mesa: cualquier mesa a 0 €', () => {
    expect(cuentaTotal('1')).toBe(0)
    expect(cuentaTotal('cualquiera')).toBe(0)
  })

  it('Onboarding: 0% y todos los pasos pendientes (coherente con "real=0")', () => {
    expect(onboardingPct()).toBe(0)
    expect(onboardingComplete()).toBe(false)
    expect(pasosOnboarding().every((p) => !p.hecho)).toBe(true)
  })
})
