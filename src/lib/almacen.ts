import type { BaseDatos, Categoria, Config } from '../tipos'
import { VERSION_DATOS } from '../tipos'
import { nuevoId } from './id'

export const CLAVE_ALMACEN = 'adminvurslef:datos'
const CLAVE_RESPALDO = 'adminvurslef:respaldo-auto'

export const CONFIG_INICIAL: Config = {
  nombre: 'Mis negocios',
  moneda: 'MXN',
  locale: 'es-MX',
  margenObjetivo: 25,
  diasSinVentasAlerta: 30,
  tema: 'auto',
}

export function categoriasIniciales(): Categoria[] {
  const gastos: Array<[string, boolean?]> = [
    ['Compra de mercancia', true],
    ['Insumos y materiales', true],
    ['Envios y paqueteria'],
    ['Publicidad'],
    ['Comisiones y fees'],
    ['Herramientas y software'],
    ['Empaque'],
    ['Transporte'],
    ['Renta y servicios'],
    ['Impuestos'],
    ['Otro gasto'],
  ]
  const retiros = [
    'Gasto personal',
    'Ahorro',
    'Reinversion en otro negocio',
    'Emergencia',
    'Otro retiro',
  ]
  return [
    ...gastos.map(([nombre, inventario]) => ({
      id: nuevoId(),
      nombre,
      ambito: 'gasto' as const,
      ...(inventario ? { inventario: true } : {}),
    })),
    ...retiros.map((nombre) => ({ id: nuevoId(), nombre, ambito: 'retiro' as const })),
  ]
}

export function baseVacia(): BaseDatos {
  return {
    version: VERSION_DATOS,
    origenes: [],
    movimientos: [],
    categorias: categoriasIniciales(),
    config: { ...CONFIG_INICIAL },
  }
}

/** Rellena huecos para que datos viejos o editados a mano no rompan la app. */
export function normalizar(entrada: unknown): BaseDatos {
  const base = baseVacia()
  if (!entrada || typeof entrada !== 'object') return base
  const bruto = entrada as Partial<BaseDatos>

  const origenes = Array.isArray(bruto.origenes) ? bruto.origenes : []
  const movimientos = Array.isArray(bruto.movimientos) ? bruto.movimientos : []
  const categorias = Array.isArray(bruto.categorias) && bruto.categorias.length
    ? bruto.categorias
    : base.categorias

  return {
    version: VERSION_DATOS,
    origenes: origenes.map((o) => ({
      id: o.id ?? nuevoId(),
      nombre: o.nombre ?? 'Sin nombre',
      tipo: o.tipo ?? 'otro',
      color: o.color ?? '#6366f1',
      emoji: o.emoji ?? '💼',
      metaMensual: Number(o.metaMensual) || 0,
      notas: o.notas ?? '',
      archivado: Boolean(o.archivado),
      creadoEn: o.creadoEn ?? new Date().toISOString(),
    })),
    movimientos: movimientos
      .filter((m) => m && m.id && m.origenId)
      .map((m) => ({
        id: m.id,
        tipo: m.tipo ?? 'gasto',
        origenId: m.origenId,
        destinoId: m.destinoId,
        fecha: m.fecha ?? new Date().toISOString().slice(0, 10),
        monto: Number(m.monto) || 0,
        costo: m.costo === undefined || m.costo === null ? undefined : Number(m.costo) || 0,
        concepto: m.concepto ?? '',
        categoria: m.categoria,
        nota: m.nota,
        creadoEn: m.creadoEn ?? new Date().toISOString(),
      })),
    categorias: categorias.map((c) => ({
      id: c.id ?? nuevoId(),
      nombre: c.nombre ?? 'Sin nombre',
      ambito: c.ambito === 'retiro' ? 'retiro' : 'gasto',
      ...(c.inventario ? { inventario: true } : {}),
    })),
    config: { ...base.config, ...(bruto.config ?? {}) },
  }
}

export function cargar(): BaseDatos | null {
  try {
    const crudo = localStorage.getItem(CLAVE_ALMACEN)
    if (!crudo) return null
    return normalizar(JSON.parse(crudo))
  } catch (error) {
    console.error('No se pudieron leer los datos guardados', error)
    return null
  }
}

let ultimoRespaldo = 0

export function guardar(db: BaseDatos): { ok: true } | { ok: false; error: string } {
  try {
    const texto = JSON.stringify(db)
    // Antes de sobrescribir, deja una copia del estado anterior una vez por hora.
    const ahora = Date.now()
    if (ahora - ultimoRespaldo > 3600_000) {
      const previo = localStorage.getItem(CLAVE_ALMACEN)
      if (previo) localStorage.setItem(CLAVE_RESPALDO, previo)
      ultimoRespaldo = ahora
    }
    localStorage.setItem(CLAVE_ALMACEN, texto)
    return { ok: true }
  } catch (error) {
    const mensaje =
      error instanceof Error && error.name === 'QuotaExceededError'
        ? 'Se lleno el espacio del navegador. Exporta un respaldo y borra movimientos viejos.'
        : 'El navegador bloqueo el guardado (¿modo privado?). Exporta un respaldo para no perder nada.'
    console.error('No se pudo guardar', error)
    return { ok: false, error: mensaje }
  }
}

export function leerRespaldoAutomatico(): BaseDatos | null {
  try {
    const crudo = localStorage.getItem(CLAVE_RESPALDO)
    return crudo ? normalizar(JSON.parse(crudo)) : null
  } catch {
    return null
  }
}

export function nombreArchivoRespaldo(): string {
  const d = new Date()
  const sello = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`
  return `adminvurslef_respaldo_${sello}.json`
}

export function exportarArchivo(db: BaseDatos) {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreArchivoRespaldo()
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function leerArchivo(archivo: File): Promise<BaseDatos> {
  const texto = await archivo.text()
  const datos = JSON.parse(texto)
  if (!datos || typeof datos !== 'object' || !Array.isArray(datos.origenes)) {
    throw new Error('El archivo no tiene el formato de un respaldo de AdminVUrslef.')
  }
  return normalizar(datos)
}
