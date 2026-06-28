import { describe, it, expect } from 'vitest'
import { eur, eur0 } from './data'
import { fmtTicket } from './caja'

/* Tests de la lógica de DINERO (auditoría 28-jun: "cero tests en algo que maneja dinero").
   eur/eur0 se usan en CADA cifra del dashboard → un bug aquí = dinero mal mostrado en TODA la app.
   NOTA: el separador de miles lo pone la plataforma (Intl). En el navegador agrupa ("1.787,40"); en
   algunos Node de CI no. Por eso testamos NUESTRA lógica (entero vs 2 decimales, redondeo, signo),
   no el separador de la plataforma. En es-ES el separador DECIMAL es la coma. */

describe('eur — decide enteros vs 2 decimales y redondea', () => {
  it('enteros: SIN parte decimal (sin coma)', () => {
    expect(eur(0)).toBe('0')
    expect(eur(1787)).not.toContain(',')
    expect(eur(1000000)).not.toContain(',')
  })
  it('no enteros: SIEMPRE 2 decimales tras la coma', () => {
    expect(eur(1787.4)).toMatch(/,40$/)
    expect(eur(9.9)).toMatch(/^9,90$/)
    expect(eur(24.5)).toMatch(/,50$/)
  })
  it('redondea a 2 antes de decidir (sin falsos decimales por float)', () => {
    expect(eur(1787.001)).not.toContain(',') // 1787.00 → entero
    expect(eur(2.005)).toMatch(/^2(,0[01])?$/) // borde de float: no peta
  })
  it('conserva el signo', () => {
    expect(eur(-5.5)).toMatch(/^-5,50$/)
  })
})

describe('eur0 — siempre entero (redondeado)', () => {
  it('redondea al entero y nunca muestra decimales', () => {
    expect(eur0(1787.4)).not.toContain(',')
    expect(eur0(1787.4)).toMatch(/787$/)
    expect(eur0(1787.6)).toMatch(/788$/)
    expect(eur0(0)).toBe('0')
  })
})

describe('fmtTicket — número de ticket', () => {
  it('rellena a 3 dígitos con prefijo T-', () => {
    expect(fmtTicket(5)).toBe('T-005')
    expect(fmtTicket(42)).toBe('T-042')
    expect(fmtTicket(123)).toBe('T-123')
  })
  it('no recorta si tiene más de 3 dígitos', () => {
    expect(fmtTicket(1234)).toBe('T-1234')
  })
})
