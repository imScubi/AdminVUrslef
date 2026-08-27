import type { Rango } from './calculos'
import { finDeMes, hoy, inicioDeMes, sumarDias, sumarMeses } from './fechas'

export type IdRango = 'mes' | 'mesPasado' | 'trimestre' | 'anio' | 'todo' | 'personalizado'

export function construirRango(id: IdRango, desde?: string, hasta?: string): Rango {
  const h = hoy()
  switch (id) {
    case 'mes':
      return { id, etiqueta: 'Este mes', desde: inicioDeMes(h), hasta: h }
    case 'mesPasado': {
      const referencia = sumarMeses(inicioDeMes(h), -1)
      return {
        id,
        etiqueta: 'Mes pasado',
        desde: inicioDeMes(referencia),
        hasta: finDeMes(referencia),
      }
    }
    case 'trimestre':
      return {
        id,
        etiqueta: 'Ultimos 3 meses',
        desde: inicioDeMes(sumarMeses(h, -2)),
        hasta: h,
      }
    case 'anio':
      return { id, etiqueta: 'Este anio', desde: `${h.slice(0, 4)}-01-01`, hasta: h }
    case 'todo':
      return { id, etiqueta: 'Todo', desde: '1900-01-01', hasta: '2999-12-31' }
    case 'personalizado':
      return {
        id,
        etiqueta: 'Personalizado',
        desde: desde ?? sumarDias(h, -30),
        hasta: hasta ?? h,
      }
  }
}

export const OPCIONES_RANGO: Array<{ id: IdRango; etiqueta: string }> = [
  { id: 'mes', etiqueta: 'Este mes' },
  { id: 'mesPasado', etiqueta: 'Mes pasado' },
  { id: 'trimestre', etiqueta: '3 meses' },
  { id: 'anio', etiqueta: 'Este anio' },
  { id: 'todo', etiqueta: 'Todo' },
]
