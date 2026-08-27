import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import type { BaseDatos, Categoria, Movimiento, Origen, TipoMovimiento, TipoOrigen } from '../tipos'

/*
 * Estas dos constantes son PUBLICAS por diseno: viajan dentro del JavaScript
 * que corre en el navegador y no hay forma de esconderlas. Lo que protege los
 * datos no es ocultarlas, es Row Level Security: cada fila lleva un usuario_id
 * y Postgres solo devuelve las filas de la sesion que pregunta. Se pueden
 * sobreescribir con variables de entorno para apuntar a otro proyecto.
 */
const URL_POR_DEFECTO = 'https://vcqkjpuyloddqmajjump.supabase.co'
const LLAVE_POR_DEFECTO = 'sb_publishable_ZqUtvyYM7FuW7ITBaoWvUA_XDYW_O-Y'

const URL_NUBE = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || URL_POR_DEFECTO
const LLAVE_NUBE =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || LLAVE_POR_DEFECTO

export const hayNube = Boolean(URL_NUBE && LLAVE_NUBE)

export const nube: SupabaseClient | null = hayNube
  ? createClient(URL_NUBE!, LLAVE_NUBE!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'adminvurslef:sesion',
      },
    })
  : null

export type { Session }

/* ================================================================ */
/* Traduccion entre el modelo de la app y las columnas de Postgres   */
/* ================================================================ */

const EPOCA = '1970-01-01T00:00:00.000Z'

interface FilaOrigen {
  id: string
  usuario_id: string
  nombre: string
  tipo: string
  color: string
  emoji: string
  meta_mensual: number | string
  notas: string
  archivado: boolean
  creado_en: string
  actualizado_en: string
  borrado: boolean
}

interface FilaMovimiento {
  id: string
  usuario_id: string
  tipo: string
  origen_id: string
  destino_id: string | null
  fecha: string
  monto: number | string
  costo: number | string | null
  concepto: string
  categoria: string | null
  nota: string | null
  creado_en: string
  actualizado_en: string
  borrado: boolean
}

interface FilaCategoria {
  id: string
  usuario_id: string
  nombre: string
  ambito: string
  inventario: boolean
  actualizado_en: string
  borrado: boolean
}

function aFilaOrigen(o: Origen, usuarioId: string): FilaOrigen {
  return {
    id: o.id,
    usuario_id: usuarioId,
    nombre: o.nombre,
    tipo: o.tipo,
    color: o.color,
    emoji: o.emoji,
    meta_mensual: o.metaMensual,
    notas: o.notas,
    archivado: o.archivado,
    creado_en: o.creadoEn,
    actualizado_en: o.actualizadoEn,
    borrado: Boolean(o.borrado),
  }
}

function deFilaOrigen(f: FilaOrigen): Origen {
  return {
    id: f.id,
    nombre: f.nombre,
    tipo: f.tipo as TipoOrigen,
    color: f.color,
    emoji: f.emoji,
    metaMensual: Number(f.meta_mensual) || 0,
    notas: f.notas ?? '',
    archivado: Boolean(f.archivado),
    creadoEn: f.creado_en,
    actualizadoEn: f.actualizado_en,
    borrado: Boolean(f.borrado),
  }
}

function aFilaMovimiento(m: Movimiento, usuarioId: string): FilaMovimiento {
  return {
    id: m.id,
    usuario_id: usuarioId,
    tipo: m.tipo,
    origen_id: m.origenId,
    destino_id: m.destinoId ?? null,
    fecha: m.fecha,
    monto: m.monto,
    costo: m.costo ?? null,
    concepto: m.concepto,
    categoria: m.categoria ?? null,
    nota: m.nota ?? null,
    creado_en: m.creadoEn,
    actualizado_en: m.actualizadoEn,
    borrado: Boolean(m.borrado),
  }
}

function deFilaMovimiento(f: FilaMovimiento): Movimiento {
  return {
    id: f.id,
    tipo: f.tipo as TipoMovimiento,
    origenId: f.origen_id,
    destinoId: f.destino_id ?? undefined,
    fecha: f.fecha,
    monto: Number(f.monto) || 0,
    costo: f.costo === null ? undefined : Number(f.costo),
    concepto: f.concepto ?? '',
    categoria: f.categoria ?? undefined,
    nota: f.nota ?? undefined,
    creadoEn: f.creado_en,
    actualizadoEn: f.actualizado_en,
    borrado: Boolean(f.borrado),
  }
}

function aFilaCategoria(c: Categoria, usuarioId: string): FilaCategoria {
  return {
    id: c.id,
    usuario_id: usuarioId,
    nombre: c.nombre,
    ambito: c.ambito,
    inventario: Boolean(c.inventario),
    actualizado_en: c.actualizadoEn,
    borrado: Boolean(c.borrado),
  }
}

function deFilaCategoria(f: FilaCategoria): Categoria {
  return {
    id: f.id,
    nombre: f.nombre,
    ambito: f.ambito === 'retiro' ? 'retiro' : 'gasto',
    ...(f.inventario ? { inventario: true } : {}),
    actualizadoEn: f.actualizado_en,
    borrado: Boolean(f.borrado),
  }
}

/* ================================================================ */
/* Mezcla: gana la version mas reciente                              */
/* ================================================================ */

export function mezclar<T extends { id: string; actualizadoEn: string }>(
  locales: T[],
  remotos: T[],
): T[] {
  const por = new Map(locales.map((x) => [x.id, x]))
  for (const remoto of remotos) {
    const local = por.get(remoto.id)
    if (!local || remoto.actualizadoEn > local.actualizadoEn) por.set(remoto.id, remoto)
  }
  return [...por.values()]
}

/* ================================================================ */
/* Sincronizacion                                                    */
/* ================================================================ */

export interface ResultadoSync {
  db: BaseDatos
  /** Marca hasta la que quedo sincronizado. Guardala para la proxima vez. */
  marca: string
  subidas: number
  bajadas: number
}

/**
 * Sube lo que cambio en el celular desde la ultima vez y baja lo que cambio en
 * la nube. Se toma la marca ANTES de subir, asi que si algo se edita a media
 * sincronizacion se vuelve a mandar la proxima vez: es preferible reenviar de
 * mas (el upsert es idempotente) a perder un movimiento.
 */
export async function sincronizar(
  db: BaseDatos,
  desde: string,
  usuarioId: string,
): Promise<ResultadoSync> {
  if (!nube) throw new Error('La nube no esta configurada.')
  const marca = new Date().toISOString()
  const corte = desde || EPOCA

  // ---- Subir ----
  const origenesNuevos = db.origenes.filter((o) => o.actualizadoEn > corte)
  const categoriasNuevas = db.categorias.filter((c) => c.actualizadoEn > corte)
  const movimientosNuevos = db.movimientos.filter((m) => m.actualizadoEn > corte)

  // Primero origenes y categorias: los movimientos apuntan a ellos.
  if (origenesNuevos.length) {
    const { error } = await nube
      .from('av_origenes')
      .upsert(origenesNuevos.map((o) => aFilaOrigen(o, usuarioId)))
    if (error) throw new Error(`No se pudieron subir los origenes: ${error.message}`)
  }
  if (categoriasNuevas.length) {
    const { error } = await nube
      .from('av_categorias')
      .upsert(categoriasNuevas.map((c) => aFilaCategoria(c, usuarioId)))
    if (error) throw new Error(`No se pudieron subir las categorias: ${error.message}`)
  }
  for (let i = 0; i < movimientosNuevos.length; i += 400) {
    const lote = movimientosNuevos.slice(i, i + 400)
    const { error } = await nube
      .from('av_movimientos')
      .upsert(lote.map((m) => aFilaMovimiento(m, usuarioId)))
    if (error) throw new Error(`No se pudieron subir los movimientos: ${error.message}`)
  }
  if (db.configActualizadaEn > corte) {
    const { error } = await nube.from('av_config').upsert({
      usuario_id: usuarioId,
      datos: db.config,
      actualizado_en: db.configActualizadaEn,
    })
    if (error) throw new Error(`No se pudo subir la configuracion: ${error.message}`)
  }

  // ---- Bajar ----
  const [resOrigenes, resCategorias, resMovimientos, resConfig] = await Promise.all([
    nube.from('av_origenes').select('*').gt('actualizado_en', corte),
    nube.from('av_categorias').select('*').gt('actualizado_en', corte),
    nube.from('av_movimientos').select('*').gt('actualizado_en', corte),
    nube.from('av_config').select('*').gt('actualizado_en', corte).maybeSingle(),
  ])

  for (const res of [resOrigenes, resCategorias, resMovimientos]) {
    if (res.error) throw new Error(`No se pudo bajar la informacion: ${res.error.message}`)
  }
  if (resConfig.error && resConfig.error.code !== 'PGRST116') {
    throw new Error(`No se pudo bajar la configuracion: ${resConfig.error.message}`)
  }

  const origenesRemotos = (resOrigenes.data ?? []).map(deFilaOrigen)
  const categoriasRemotas = (resCategorias.data ?? []).map(deFilaCategoria)
  const movimientosRemotos = (resMovimientos.data ?? []).map(deFilaMovimiento)

  const configRemota = resConfig.data as
    | { datos: BaseDatos['config']; actualizado_en: string }
    | null
  const usarConfigRemota =
    configRemota && configRemota.actualizado_en > db.configActualizadaEn

  return {
    db: {
      ...db,
      origenes: mezclar(db.origenes, origenesRemotos),
      categorias: mezclar(db.categorias, categoriasRemotas),
      movimientos: mezclar(db.movimientos, movimientosRemotos),
      config: usarConfigRemota ? { ...db.config, ...configRemota.datos } : db.config,
      configActualizadaEn: usarConfigRemota
        ? configRemota.actualizado_en
        : db.configActualizadaEn,
    },
    marca,
    subidas:
      origenesNuevos.length + categoriasNuevas.length + movimientosNuevos.length,
    bajadas:
      origenesRemotos.length + categoriasRemotas.length + movimientosRemotos.length,
  }
}

/** Cuantos cambios locales estan esperando a subir. */
export function contarPendientes(db: BaseDatos, desde: string): number {
  const corte = desde || EPOCA
  return (
    db.origenes.filter((o) => o.actualizadoEn > corte).length +
    db.categorias.filter((c) => c.actualizadoEn > corte).length +
    db.movimientos.filter((m) => m.actualizadoEn > corte).length +
    (db.configActualizadaEn > corte ? 1 : 0)
  )
}

/** Borra de la nube todo lo del usuario (para "empezar de cero"). */
export async function vaciarNube(usuarioId: string): Promise<void> {
  if (!nube) return
  for (const tabla of ['av_movimientos', 'av_origenes', 'av_categorias']) {
    const { error } = await nube.from(tabla).delete().eq('usuario_id', usuarioId)
    if (error) throw new Error(`No se pudo limpiar ${tabla}: ${error.message}`)
  }
  const { error } = await nube.from('av_config').delete().eq('usuario_id', usuarioId)
  if (error) throw new Error(`No se pudo limpiar la configuracion: ${error.message}`)
}
