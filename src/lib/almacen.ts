import type { BaseDatos, Categoria, Config } from '../tipos'
import { VERSION_DATOS } from '../tipos'
import { nuevoId } from './id'

const CLAVE_BASE = 'adminvurslef:datos'
const CLAVE_SYNC = 'adminvurslef:sincronizado'

/** Cada cuenta guarda su propia copia local, para no revolver datos. */
function claveDatos(usuarioId: string) {
  return `${CLAVE_BASE}:${usuarioId}`
}
function claveSync(usuarioId: string) {
  return `${CLAVE_SYNC}:${usuarioId}`
}

export const CONFIG_INICIAL: Config = {
  nombre: 'Mis negocios',
  moneda: 'MXN',
  locale: 'es-MX',
  margenObjetivo: 25,
  diasSinVentasAlerta: 30,
  tema: 'auto',
}

export function categoriasIniciales(): Categoria[] {
  const ahora = new Date().toISOString()
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
      actualizadoEn: ahora,
    })),
    ...retiros.map((nombre) => ({
      id: nuevoId(),
      nombre,
      ambito: 'retiro' as const,
      actualizadoEn: ahora,
    })),
  ]
}

export function baseVacia(conCategorias = true): BaseDatos {
  return {
    version: VERSION_DATOS,
    configActualizadaEn: new Date().toISOString(),
    origenes: [],
    movimientos: [],
    pedidos: [],
    categorias: conCategorias ? categoriasIniciales() : [],
    config: { ...CONFIG_INICIAL },
  }
}

/** Rellena huecos para que datos viejos o editados a mano no rompan la app. */
export function normalizar(entrada: unknown): BaseDatos {
  const base = baseVacia(false)
  const ahora = new Date().toISOString()
  if (!entrada || typeof entrada !== 'object') return baseVacia()
  const bruto = entrada as Partial<BaseDatos>

  const origenes = Array.isArray(bruto.origenes) ? bruto.origenes : []
  const movimientos = Array.isArray(bruto.movimientos) ? bruto.movimientos : []
  const pedidos = Array.isArray(bruto.pedidos) ? bruto.pedidos : []
  const categorias =
    Array.isArray(bruto.categorias) && bruto.categorias.length
      ? bruto.categorias
      : categoriasIniciales()

  return {
    version: VERSION_DATOS,
    configActualizadaEn: bruto.configActualizadaEn ?? ahora,
    origenes: origenes.map((o) => ({
      id: o.id ?? nuevoId(),
      nombre: o.nombre ?? 'Sin nombre',
      tipo: o.tipo ?? 'otro',
      color: o.color ?? '#6366f1',
      emoji: o.emoji ?? '',
      metaMensual: Number(o.metaMensual) || 0,
      notas: o.notas ?? '',
      ...(o.logo ? { logo: o.logo } : {}),
      ...(o.contacto ? { contacto: o.contacto } : {}),
      archivado: Boolean(o.archivado),
      creadoEn: o.creadoEn ?? ahora,
      actualizadoEn: o.actualizadoEn ?? ahora,
      ...(o.borrado ? { borrado: true } : {}),
    })),
    movimientos: movimientos
      .filter((m) => m && m.id && m.origenId)
      .map((m) => ({
        id: m.id,
        tipo: m.tipo ?? 'gasto',
        origenId: m.origenId,
        destinoId: m.destinoId,
        fecha: m.fecha ?? ahora.slice(0, 10),
        monto: Number(m.monto) || 0,
        costo: m.costo === undefined || m.costo === null ? undefined : Number(m.costo) || 0,
        retornoEsperado:
          m.retornoEsperado === undefined || m.retornoEsperado === null
            ? undefined
            : Number(m.retornoEsperado) || 0,
        concepto: m.concepto ?? '',
        categoria: m.categoria,
        nota: m.nota,
        pedidoId: m.pedidoId,
        metodo: m.metodo,
        folio: m.folio === undefined || m.folio === null ? undefined : Number(m.folio),
        articulos: Array.isArray(m.articulos)
          ? m.articulos.map((a) => ({
              id: a.id ?? nuevoId(),
              nombre: a.nombre ?? '',
              cantidad: Number(a.cantidad) || 0,
              costoUnitario: Number(a.costoUnitario) || 0,
              ...(a.precio === undefined || a.precio === null
                ? {}
                : { precio: Number(a.precio) || 0 }),
            }))
          : undefined,
        creadoEn: m.creadoEn ?? ahora,
        actualizadoEn: m.actualizadoEn ?? ahora,
        ...(m.borrado ? { borrado: true } : {}),
      })),
    pedidos: pedidos
      .filter((p) => p && p.id && p.origenId)
      .map((p) => ({
        id: p.id,
        origenId: p.origenId,
        tipo: p.tipo ?? 'venta',
        cliente: p.cliente ?? '',
        telefono: p.telefono ?? '',
        concepto: p.concepto ?? '',
        total: Number(p.total) || 0,
        fecha: p.fecha ?? ahora.slice(0, 10),
        estado: p.estado ?? 'abierto',
        notas: p.notas ?? '',
        lineas: Array.isArray(p.lineas)
          ? p.lineas.map((l) => ({
              articuloId: l.articuloId,
              nombre: l.nombre ?? '',
              cantidad: Number(l.cantidad) || 0,
              precioUnitario: Number(l.precioUnitario) || 0,
              costoUnitario: Number(l.costoUnitario) || 0,
            }))
          : undefined,
        creadoEn: p.creadoEn ?? ahora,
        actualizadoEn: p.actualizadoEn ?? ahora,
        ...(p.borrado ? { borrado: true } : {}),
      })),
    categorias: categorias.map((c) => ({
      id: c.id ?? nuevoId(),
      nombre: c.nombre ?? 'Sin nombre',
      ambito: c.ambito === 'retiro' ? 'retiro' : 'gasto',
      ...(c.inventario ? { inventario: true } : {}),
      actualizadoEn: c.actualizadoEn ?? ahora,
      ...(c.borrado ? { borrado: true } : {}),
    })),
    config: { ...base.config, ...(bruto.config ?? {}) },
  }
}

/**
 * Lee la copia local de esta cuenta. Si no hay ninguna pero si existen datos
 * de la version anterior (cuando todo vivia solo en el navegador), los adopta
 * para que no se pierda nada al estrenar la cuenta.
 */
export function cargar(usuarioId: string): BaseDatos | null {
  try {
    const propio = localStorage.getItem(claveDatos(usuarioId))
    if (propio) return normalizar(JSON.parse(propio))

    const heredado = localStorage.getItem(CLAVE_BASE)
    if (heredado) {
      const db = normalizar(JSON.parse(heredado))
      // Se vuelve a sellar para que la primera sincronizacion lo suba todo.
      const ahora = new Date().toISOString()
      return {
        ...db,
        configActualizadaEn: ahora,
        origenes: db.origenes.map((o) => ({ ...o, actualizadoEn: ahora })),
        categorias: db.categorias.map((c) => ({ ...c, actualizadoEn: ahora })),
        movimientos: db.movimientos.map((m) => ({ ...m, actualizadoEn: ahora })),
        pedidos: db.pedidos.map((p) => ({ ...p, actualizadoEn: ahora })),
      }
    }
    return null
  } catch (error) {
    console.error('No se pudieron leer los datos guardados', error)
    return null
  }
}

export function guardar(
  usuarioId: string,
  db: BaseDatos,
): { ok: true } | { ok: false; error: string } {
  try {
    localStorage.setItem(claveDatos(usuarioId), JSON.stringify(db))
    return { ok: true }
  } catch (error) {
    const mensaje =
      error instanceof Error && error.name === 'QuotaExceededError'
        ? 'Se lleno el espacio del navegador. Exporta un respaldo y borra movimientos viejos.'
        : 'El navegador bloqueo el guardado local. Tus cambios si se estan mandando a la nube.'
    console.error('No se pudo guardar', error)
    return { ok: false, error: mensaje }
  }
}

export function leerMarcaSync(usuarioId: string): string {
  try {
    return localStorage.getItem(claveSync(usuarioId)) ?? ''
  } catch {
    return ''
  }
}

export function guardarMarcaSync(usuarioId: string, marca: string) {
  try {
    localStorage.setItem(claveSync(usuarioId), marca)
  } catch {
    /* sin almacenamiento local se sincroniza todo cada vez; no es grave */
  }
}

const CLAVE_USUARIO = 'adminvurslef:ultimo-usuario'

/**
 * Se guarda quien entro la ultima vez. Sirve para abrir la app sin senal:
 * el token de acceso dura una hora y sin internet no se puede renovar, asi
 * que sin esto el celular te mandaria a la pantalla de login justo cuando
 * mas necesitas capturar una venta.
 */
export function recordarUsuario(id: string, correo: string) {
  try {
    localStorage.setItem(CLAVE_USUARIO, JSON.stringify({ id, correo }))
  } catch {
    /* sin almacenamiento no hay modo sin senal, pero la app sigue */
  }
}

export function leerUsuarioRecordado(): { id: string; correo: string } | null {
  try {
    const crudo = localStorage.getItem(CLAVE_USUARIO)
    if (!crudo) return null
    const datos = JSON.parse(crudo)
    return datos?.id ? { id: datos.id, correo: datos.correo ?? '' } : null
  } catch {
    return null
  }
}

export function olvidarUsuario() {
  try {
    localStorage.removeItem(CLAVE_USUARIO)
  } catch {
    /* nada que hacer */
  }
}

export function olvidarCuenta(usuarioId: string) {
  try {
    localStorage.removeItem(claveDatos(usuarioId))
    localStorage.removeItem(claveSync(usuarioId))
  } catch {
    /* nada que hacer */
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
