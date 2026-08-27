import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { BaseDatos, Categoria, Movimiento, Origen } from '../tipos'
import { baseVacia, cargar, guardar } from '../lib/almacen'
import { configurarFormato } from '../lib/formato'
import { nuevoId } from '../lib/id'

interface ValorTienda {
  db: BaseDatos
  errorGuardado: string | null
  /** true cuando aun no hay ni un origen creado. */
  vacio: boolean
  reemplazar: (db: BaseDatos) => void
  agregarOrigen: (datos: Omit<Origen, 'id' | 'creadoEn'>) => Origen
  editarOrigen: (id: string, cambios: Partial<Origen>) => void
  borrarOrigen: (id: string) => void
  agregarMovimiento: (datos: Omit<Movimiento, 'id' | 'creadoEn'>) => Movimiento
  editarMovimiento: (id: string, cambios: Partial<Movimiento>) => void
  borrarMovimiento: (id: string) => void
  agregarCategoria: (nombre: string, ambito: Categoria['ambito'], inventario?: boolean) => Categoria
  editarCategoria: (id: string, cambios: Partial<Categoria>) => void
  borrarCategoria: (id: string) => void
  editarConfig: (cambios: Partial<BaseDatos['config']>) => void
}

const Contexto = createContext<ValorTienda | null>(null)

export function ProveedorTienda({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<BaseDatos>(() => {
    const inicial = cargar() ?? baseVacia()
    configurarFormato(inicial.config.moneda, inicial.config.locale)
    return inicial
  })
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null)
  const primeraVez = useRef(true)

  // Persistencia: cada cambio se guarda solo.
  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false
      return
    }
    const resultado = guardar(db)
    setErrorGuardado(resultado.ok ? null : resultado.error)
  }, [db])

  const reemplazar = useCallback((nueva: BaseDatos) => {
    setDb(nueva)
    configurarFormato(nueva.config.moneda, nueva.config.locale)
  }, [])

  const agregarOrigen = useCallback((datos: Omit<Origen, 'id' | 'creadoEn'>) => {
    const origen: Origen = { ...datos, id: nuevoId(), creadoEn: new Date().toISOString() }
    setDb((prev) => ({ ...prev, origenes: [...prev.origenes, origen] }))
    return origen
  }, [])

  const editarOrigen = useCallback((id: string, cambios: Partial<Origen>) => {
    setDb((prev) => ({
      ...prev,
      origenes: prev.origenes.map((o) => (o.id === id ? { ...o, ...cambios } : o)),
    }))
  }, [])

  const borrarOrigen = useCallback((id: string) => {
    setDb((prev) => ({
      ...prev,
      origenes: prev.origenes.filter((o) => o.id !== id),
      movimientos: prev.movimientos.filter((m) => m.origenId !== id && m.destinoId !== id),
    }))
  }, [])

  const agregarMovimiento = useCallback((datos: Omit<Movimiento, 'id' | 'creadoEn'>) => {
    const mov: Movimiento = { ...datos, id: nuevoId(), creadoEn: new Date().toISOString() }
    setDb((prev) => ({ ...prev, movimientos: [...prev.movimientos, mov] }))
    return mov
  }, [])

  const editarMovimiento = useCallback((id: string, cambios: Partial<Movimiento>) => {
    setDb((prev) => ({
      ...prev,
      movimientos: prev.movimientos.map((m) => (m.id === id ? { ...m, ...cambios } : m)),
    }))
  }, [])

  const borrarMovimiento = useCallback((id: string) => {
    setDb((prev) => ({ ...prev, movimientos: prev.movimientos.filter((m) => m.id !== id) }))
  }, [])

  const agregarCategoria = useCallback(
    (nombre: string, ambito: Categoria['ambito'], inventario?: boolean) => {
      const cat: Categoria = { id: nuevoId(), nombre, ambito, ...(inventario ? { inventario: true } : {}) }
      setDb((prev) => ({ ...prev, categorias: [...prev.categorias, cat] }))
      return cat
    },
    [],
  )

  const editarCategoria = useCallback((id: string, cambios: Partial<Categoria>) => {
    setDb((prev) => ({
      ...prev,
      categorias: prev.categorias.map((c) => (c.id === id ? { ...c, ...cambios } : c)),
    }))
  }, [])

  const borrarCategoria = useCallback((id: string) => {
    setDb((prev) => ({
      ...prev,
      categorias: prev.categorias.filter((c) => c.id !== id),
      movimientos: prev.movimientos.map((m) =>
        m.categoria === id ? { ...m, categoria: undefined } : m,
      ),
    }))
  }, [])

  const editarConfig = useCallback((cambios: Partial<BaseDatos['config']>) => {
    setDb((prev) => {
      const config = { ...prev.config, ...cambios }
      configurarFormato(config.moneda, config.locale)
      return { ...prev, config }
    })
  }, [])

  const valor = useMemo<ValorTienda>(
    () => ({
      db,
      errorGuardado,
      vacio: db.origenes.length === 0,
      reemplazar,
      agregarOrigen,
      editarOrigen,
      borrarOrigen,
      agregarMovimiento,
      editarMovimiento,
      borrarMovimiento,
      agregarCategoria,
      editarCategoria,
      borrarCategoria,
      editarConfig,
    }),
    [
      db, errorGuardado, reemplazar, agregarOrigen, editarOrigen, borrarOrigen,
      agregarMovimiento, editarMovimiento, borrarMovimiento, agregarCategoria,
      editarCategoria, borrarCategoria, editarConfig,
    ],
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useTienda(): ValorTienda {
  const valor = useContext(Contexto)
  if (!valor) throw new Error('useTienda debe usarse dentro de <ProveedorTienda>')
  return valor
}
