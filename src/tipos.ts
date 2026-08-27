/**
 * Modelo de datos de AdminVUrslef.
 *
 * Idea central: cada ORIGEN de ingreso es una caja separada, con su propio
 * dinero, su propia mercancia y sus propios numeros. Nada se mezcla salvo que
 * tu lo muevas a proposito con un traspaso.
 */

export type TipoOrigen = 'reventa' | 'servicio' | 'inversion' | 'fijo' | 'otro'

/**
 * Marca de sincronizacion que llevan todas las filas.
 *
 * `actualizadoEn` decide quien gana cuando el celular y la nube tienen
 * versiones distintas (gana la mas reciente). `borrado` es un borrado logico:
 * si se borrara la fila de verdad, el otro dispositivo la volveria a subir la
 * proxima vez que sincronice.
 */
export interface Sellado {
  actualizadoEn: string
  borrado?: boolean
}

export interface Origen extends Sellado {
  id: string
  nombre: string
  tipo: TipoOrigen
  color: string
  emoji: string
  /** Objetivo de ganancia neta mensual. 0 = sin meta. */
  metaMensual: number
  notas: string
  archivado: boolean
  creadoEn: string
}

/**
 * Los seis movimientos con los que se puede describir cualquier cosa que le
 * pase al dinero de un negocio:
 *
 * - venta     dinero que entra por vender algo (con su costo opcional)
 * - gasto     dinero que sale para operar (incluye comprar mercancia)
 * - aporte    capital tuyo que METES al origen desde fuera
 * - retiro    dinero que SACAS del origen para ti u otra cosa
 * - traspaso  dinero que pasa de un origen a otro
 * - ajuste    correccion manual del saldo (cuadre de caja)
 */
export type TipoMovimiento =
  | 'venta'
  | 'gasto'
  | 'aporte'
  | 'retiro'
  | 'traspaso'
  | 'ajuste'

export interface Movimiento extends Sellado {
  id: string
  tipo: TipoMovimiento
  /** Origen afectado. En un traspaso es el que ENVIA el dinero. */
  origenId: string
  /** Solo traspaso: origen que RECIBE el dinero. */
  destinoId?: string
  /** Fecha en formato YYYY-MM-DD (fecha local, sin zona horaria). */
  fecha: string
  /** Siempre positivo, salvo en 'ajuste' donde puede ser negativo. */
  monto: number
  /** Solo venta: cuanto te costo a ti lo que vendiste. Sirve para el margen. */
  costo?: number
  concepto: string
  /** Id de categoria (gastos y retiros). */
  categoria?: string
  nota?: string
  creadoEn: string
}

export interface Categoria extends Sellado {
  id: string
  nombre: string
  ambito: 'gasto' | 'retiro'
  /**
   * Marca las categorias que son compra de mercancia/insumos para revender.
   * Ese dinero no es un gasto perdido: se convierte en inventario y regresa
   * cuando vendes. Por eso no se resta dos veces de la ganancia.
   */
  inventario?: boolean
}

export interface Config {
  nombre: string
  moneda: string
  locale: string
  /** Margen bruto minimo que consideras sano (%). */
  margenObjetivo: number
  /** A los cuantos dias sin vender un origen se marca como dormido. */
  diasSinVentasAlerta: number
  tema: 'auto' | 'claro' | 'oscuro'
}

export interface BaseDatos {
  version: number
  /** Cambia cuando tocas las preferencias; se sincroniza como una sola fila. */
  configActualizadaEn: string
  origenes: Origen[]
  movimientos: Movimiento[]
  categorias: Categoria[]
  config: Config
}

export const VERSION_DATOS = 1

export const ETIQUETA_TIPO_ORIGEN: Record<TipoOrigen, string> = {
  reventa: 'Reventa de productos',
  servicio: 'Servicios / freelance',
  inversion: 'Inversion',
  fijo: 'Ingreso fijo',
  otro: 'Otro',
}

export const ETIQUETA_MOVIMIENTO: Record<TipoMovimiento, string> = {
  venta: 'Venta',
  gasto: 'Gasto',
  aporte: 'Aporte de capital',
  retiro: 'Retiro',
  traspaso: 'Traspaso',
  ajuste: 'Ajuste de caja',
}

/** Signo del movimiento sobre la caja del origen que lo registra. */
export const SIGNO_MOVIMIENTO: Record<TipoMovimiento, 1 | -1> = {
  venta: 1,
  gasto: -1,
  aporte: 1,
  retiro: -1,
  traspaso: -1,
  ajuste: 1,
}
