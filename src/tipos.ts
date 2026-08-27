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
  /** Logo del negocio (data URI). Sale impreso en los recibos. */
  logo?: string
  /** Telefono o redes que aparecen al pie del recibo. */
  contacto?: string
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
  /**
   * Solo gastos de mercancia: en cuanto esperas vender lo que compraste.
   * Con esto se puede estimar cuanta ganancia sigue guardada en el inventario
   * y comparar despues lo que planeaste contra lo que realmente pasó.
   */
  retornoEsperado?: number
  concepto: string
  /** Id de categoria (gastos y retiros). */
  categoria?: string
  /**
   * Si este movimiento es el abono de un pedido, cual. Varios abonos del mismo
   * pedido cuentan como UNA venta para el ticket promedio.
   */
  pedidoId?: string
  /** Como te pagaron este abono. */
  metodo?: MetodoPago
  /** Folio consecutivo del recibo dentro del origen. */
  folio?: number
  /** Solo gastos de mercancia: en que se repartio el dinero de esa compra. */
  articulos?: Articulo[]
  nota?: string
  creadoEn: string
}

/**
 * Un producto concreto dentro de una compra de mercancia. Si gastaste $2,400
 * en un lote, aqui dices cuanto de ese dinero fue a cada cosa y cuantas
 * unidades trajiste, para saber despues que te queda y a que costo.
 */
export interface Articulo {
  id: string
  nombre: string
  cantidad: number
  costoUnitario: number
  /** A cuanto esperas venderlo, por unidad. */
  precio?: number
}

/**
 * Un renglon de lo que se lleva un pedido. El nombre y el costo se copian al
 * momento de venderlo: si despues corriges la compra original, el recibo que
 * ya le diste al cliente y el margen de esa venta no cambian solos.
 */
export interface LineaPedido {
  /** Articulo del inventario del que salio, si vino de ahi. */
  articuloId?: string
  nombre: string
  cantidad: number
  precioUnitario: number
  costoUnitario: number
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

/**
 * Pedido: una venta que puede pagarse en partes.
 *
 * - venta       se paga y se entrega en el momento
 * - separacion  el cliente aparta y va abonando hasta liquidar
 * - pedido      se encarga, se pide anticipo y se paga al entregar
 *
 * El dinero no vive aqui: cada abono es un Movimiento de tipo venta con
 * `pedidoId`. Este registro solo guarda a quien, que y cuanto se acordo.
 */
export type TipoPedido = 'venta' | 'separacion' | 'pedido'
export type EstadoPedido = 'abierto' | 'liquidado' | 'cancelado'
export type MetodoPago = 'efectivo' | 'transferencia' | 'tarjeta' | 'deposito' | 'otro'

export interface Pedido extends Sellado {
  id: string
  origenId: string
  tipo: TipoPedido
  cliente: string
  telefono: string
  /** Que lleva el cliente, en texto libre. */
  concepto: string
  total: number
  fecha: string
  estado: EstadoPedido
  notas: string
  /** Productos que se lleva. Si esta vacio, vale el texto de `concepto`. */
  lineas?: LineaPedido[]
  creadoEn: string
}

export const ETIQUETA_TIPO_PEDIDO: Record<TipoPedido, string> = {
  venta: 'Venta',
  separacion: 'Separacion',
  pedido: 'Pedido',
}

export const ETIQUETA_ESTADO_PEDIDO: Record<EstadoPedido, string> = {
  abierto: 'Abierto',
  liquidado: 'Liquidado',
  cancelado: 'Cancelado',
}

export const ETIQUETA_METODO: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  deposito: 'Deposito',
  otro: 'Otro',
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
  pedidos: Pedido[]
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
