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
import {
  baseVacia,
  cargar,
  guardar,
  guardarMarcaSync,
  leerMarcaSync,
  leerUsuarioRecordado,
  olvidarCuenta,
  olvidarUsuario,
  recordarUsuario,
} from '../lib/almacen'
import { configurarFormato } from '../lib/formato'
import { nuevoId } from '../lib/id'
import {
  contarPendientes,
  hayNube,
  mezclar,
  nube,
  sincronizar,
  vaciarNube,
  type Session,
} from '../lib/nube'

export interface EstadoSync {
  enLinea: boolean
  sincronizando: boolean
  /** Cambios locales esperando a subir. */
  pendientes: number
  ultimaSync: string | null
  error: string | null
}

interface ValorTienda {
  db: BaseDatos
  sesion: Session | null
  /** Hay datos locales abiertos pero la sesion con el servidor ya no vale. */
  sesionExpirada: boolean
  correoUsuario: string
  autenticando: boolean
  recuperandoClave: boolean
  sync: EstadoSync
  errorGuardado: string | null
  vacio: boolean

  entrar: (correo: string, clave: string) => Promise<void>
  registrar: (correo: string, clave: string) => Promise<string | null>
  pedirRecuperacion: (correo: string) => Promise<void>
  cambiarClave: (nueva: string) => Promise<void>
  salir: () => Promise<void>
  sincronizarAhora: () => Promise<void>

  reemplazar: (db: BaseDatos, autoritativo?: boolean) => Promise<void>
  agregarOrigen: (datos: DatosOrigen) => Origen
  editarOrigen: (id: string, cambios: Partial<Origen>) => void
  borrarOrigen: (id: string) => void
  agregarMovimiento: (datos: DatosMovimiento) => Movimiento
  editarMovimiento: (id: string, cambios: Partial<Movimiento>) => void
  borrarMovimiento: (id: string) => void
  agregarCategoria: (nombre: string, ambito: Categoria['ambito'], inventario?: boolean) => Categoria
  editarCategoria: (id: string, cambios: Partial<Categoria>) => void
  borrarCategoria: (id: string) => void
  editarConfig: (cambios: Partial<BaseDatos['config']>) => void
}

type DatosOrigen = Omit<Origen, 'id' | 'creadoEn' | 'actualizadoEn' | 'borrado'>
type DatosMovimiento = Omit<Movimiento, 'id' | 'creadoEn' | 'actualizadoEn' | 'borrado'>

const Contexto = createContext<ValorTienda | null>(null)

const ahora = () => new Date().toISOString()
const vivos = <T extends { borrado?: boolean }>(xs: T[]) => xs.filter((x) => !x.borrado)

export function ProveedorTienda({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null)
  const [autenticando, setAutenticando] = useState(hayNube)
  const [recuperandoClave, setRecuperandoClave] = useState(false)
  /** Quien entro la ultima vez; permite usar la app sin senal. */
  const [usuarioLocal, setUsuarioLocal] = useState(() => leerUsuarioRecordado())
  const [crudo, setCrudo] = useState<BaseDatos>(() => baseVacia())
  const [marca, setMarca] = useState('')
  /**
   * Cuenta cuya copia local ya termino de cargarse. Sin esto, la primera
   * sincronizacion podia correr con el estado todavia vacio: no subia nada y
   * aun asi avanzaba la marca, dando por subido lo que seguia en el telefono.
   */
  const [cuentaCargada, setCuentaCargada] = useState('')
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null)
  const [sync, setSync] = useState<EstadoSync>({
    enLinea: typeof navigator === 'undefined' ? true : navigator.onLine,
    sincronizando: false,
    pendientes: 0,
    ultimaSync: null,
    error: null,
  })

  // Los pendientes se derivan del estado, no se guardan aparte: son
  // exactamente las filas cuya marca es mas nueva que la ultima subida.

  const usuarioId = sesion?.user.id ?? usuarioLocal?.id ?? ''
  /** Hay datos abiertos pero la sesion con el servidor ya no vale. */
  const sesionExpirada = !sesion && !!usuarioLocal
  const dbRef = useRef(crudo)
  const marcaRef = useRef('')
  const cuentaCargadaRef = useRef<string>('')
  const sesionRef = useRef<Session | null>(null)
  const enCurso = useRef(false)
  const saltarGuardado = useRef(true)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Espejos para que la sincronizacion (que corre en temporizadores y eventos)
  // siempre vea el estado mas reciente sin volver a crearse en cada cambio.
  useEffect(() => {
    dbRef.current = crudo
  }, [crudo])
  useEffect(() => {
    marcaRef.current = marca
  }, [marca])
  useEffect(() => {
    cuentaCargadaRef.current = cuentaCargada
  }, [cuentaCargada])
  useEffect(() => {
    sesionRef.current = sesion
  }, [sesion])

  /* ---------------------------------------------------------------- */
  /* Sesion                                                            */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (!nube) {
      setAutenticando(false)
      return
    }
    nube.auth.getSession().then(({ data }) => {
      setSesion(data.session)
      if (data.session) {
        recordarUsuario(data.session.user.id, data.session.user.email ?? '')
        setUsuarioLocal({ id: data.session.user.id, correo: data.session.user.email ?? '' })
      }
      setAutenticando(false)
    })
    const { data } = nube.auth.onAuthStateChange((evento, nueva) => {
      setSesion(nueva)
      setAutenticando(false)
      if (nueva) {
        recordarUsuario(nueva.user.id, nueva.user.email ?? '')
        setUsuarioLocal({ id: nueva.user.id, correo: nueva.user.email ?? '' })
      }
      // Un SIGNED_OUT sin internet casi siempre es un token que no se pudo
      // renovar, no una salida de verdad: no se olvida al usuario para que
      // pueda seguir capturando.
      if (evento === 'PASSWORD_RECOVERY') setRecuperandoClave(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  /* ---------------------------------------------------------------- */
  /* Copia local por cuenta                                            */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (!usuarioId) {
      setCrudo(baseVacia())
      setMarca('')
      setCuentaCargada('')
      return
    }
    const local = cargar(usuarioId) ?? baseVacia()
    configurarFormato(local.config.moneda, local.config.locale)
    saltarGuardado.current = true
    setCrudo(local)
    setMarca(leerMarcaSync(usuarioId))
    setCuentaCargada(usuarioId)
  }, [usuarioId])

  useEffect(() => {
    if (!usuarioId) return
    if (saltarGuardado.current) {
      saltarGuardado.current = false
      return
    }
    const resultado = guardar(usuarioId, crudo)
    setErrorGuardado(resultado.ok ? null : resultado.error)
  }, [crudo, usuarioId])

  /* ---------------------------------------------------------------- */
  /* Sincronizacion                                                    */
  /* ---------------------------------------------------------------- */

  const sincronizarAhora = useCallback(async () => {
    if (!nube || !usuarioId) return
    if (!sesionRef.current) return
    if (cuentaCargadaRef.current !== usuarioId) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    if (enCurso.current) return

    enCurso.current = true
    setSync((s) => ({ ...s, sincronizando: true, error: null }))
    try {
      const resultado = await sincronizar(dbRef.current, marcaRef.current, usuarioId)
      guardarMarcaSync(usuarioId, resultado.marca)
      setMarca(resultado.marca)
      // Se mezcla contra el estado ACTUAL, no contra la foto que se subio:
      // si capturaste algo mientras subia, ese cambio es mas nuevo y gana.
      setCrudo((prev) => ({
        ...prev,
        origenes: mezclar(prev.origenes, resultado.db.origenes),
        categorias: mezclar(prev.categorias, resultado.db.categorias),
        movimientos: mezclar(prev.movimientos, resultado.db.movimientos),
        config:
          resultado.db.configActualizadaEn > prev.configActualizadaEn
            ? resultado.db.config
            : prev.config,
        configActualizadaEn:
          resultado.db.configActualizadaEn > prev.configActualizadaEn
            ? resultado.db.configActualizadaEn
            : prev.configActualizadaEn,
      }))
      setSync((s) => ({ ...s, sincronizando: false, ultimaSync: ahora(), error: null }))
    } catch (error) {
      setSync((s) => ({
        ...s,
        sincronizando: false,
        error: error instanceof Error ? error.message : 'No se pudo sincronizar.',
      }))
    } finally {
      enCurso.current = false
    }
  }, [usuarioId])

  /** Tras cada cambio se espera un momento por si vienen mas capturas seguidas. */
  const programarSync = useCallback(() => {
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => {
      void sincronizarAhora()
    }, 1200)
  }, [sincronizarAhora])

  useEffect(() => {
    // Solo cuando la copia local de ESTA cuenta ya esta en memoria.
    if (!usuarioId || cuentaCargada !== usuarioId || !sesion) return
    void sincronizarAhora()

    const alVolver = () => {
      setSync((s) => ({ ...s, enLinea: true }))
      void sincronizarAhora()
    }
    const alCaerse = () => setSync((s) => ({ ...s, enLinea: false }))
    const alMirar = () => {
      if (document.visibilityState === 'visible') void sincronizarAhora()
    }
    window.addEventListener('online', alVolver)
    window.addEventListener('offline', alCaerse)
    document.addEventListener('visibilitychange', alMirar)
    const cada = setInterval(() => void sincronizarAhora(), 5 * 60 * 1000)

    return () => {
      window.removeEventListener('online', alVolver)
      window.removeEventListener('offline', alCaerse)
      document.removeEventListener('visibilitychange', alMirar)
      clearInterval(cada)
    }
  }, [usuarioId, cuentaCargada, sesion, sincronizarAhora])

  /* ---------------------------------------------------------------- */
  /* Autenticacion                                                     */
  /* ---------------------------------------------------------------- */

  const entrar = useCallback(async (correo: string, clave: string) => {
    if (!nube) throw new Error('La nube no esta configurada.')
    const { error } = await nube.auth.signInWithPassword({ email: correo.trim(), password: clave })
    if (error) throw new Error(traducirError(error.message))
  }, [])

  const registrar = useCallback(async (correo: string, clave: string) => {
    if (!nube) throw new Error('La nube no esta configurada.')
    const { data, error } = await nube.auth.signUp({ email: correo.trim(), password: clave })
    if (error) throw new Error(traducirError(error.message))
    if (data.session) return null
    return 'Te mandamos un correo para confirmar la cuenta. Abrelo y luego entra aqui.'
  }, [])

  const pedirRecuperacion = useCallback(async (correo: string) => {
    if (!nube) throw new Error('La nube no esta configurada.')
    const { error } = await nube.auth.resetPasswordForEmail(correo.trim(), {
      redirectTo: window.location.origin,
    })
    if (error) throw new Error(traducirError(error.message))
  }, [])

  const cambiarClave = useCallback(async (nueva: string) => {
    if (!nube) throw new Error('La nube no esta configurada.')
    const { error } = await nube.auth.updateUser({ password: nueva })
    if (error) throw new Error(traducirError(error.message))
    setRecuperandoClave(false)
  }, [])

  const salir = useCallback(async () => {
    if (!nube) return
    await sincronizarAhora()
    await nube.auth.signOut()
    olvidarUsuario()
    setUsuarioLocal(null)
    setSesion(null)
  }, [sincronizarAhora])

  /* ---------------------------------------------------------------- */
  /* Mutaciones (siempre sellan la fecha para poder sincronizar)       */
  /* ---------------------------------------------------------------- */

  const cambiar = useCallback(
    (receta: (prev: BaseDatos) => BaseDatos) => {
      setCrudo((prev) => receta(prev))
      programarSync()
    },
    [programarSync],
  )

  const agregarOrigen = useCallback(
    (datos: DatosOrigen) => {
      const origen: Origen = {
        ...datos,
        id: nuevoId(),
        creadoEn: ahora(),
        actualizadoEn: ahora(),
      }
      cambiar((prev) => ({ ...prev, origenes: [...prev.origenes, origen] }))
      return origen
    },
    [cambiar],
  )

  const editarOrigen = useCallback(
    (id: string, cambios: Partial<Origen>) => {
      cambiar((prev) => ({
        ...prev,
        origenes: prev.origenes.map((o) =>
          o.id === id ? { ...o, ...cambios, actualizadoEn: ahora() } : o,
        ),
      }))
    },
    [cambiar],
  )

  /** Borrado logico: si se borrara de verdad, la nube lo repondria. */
  const borrarOrigen = useCallback(
    (id: string) => {
      const sello = ahora()
      cambiar((prev) => ({
        ...prev,
        origenes: prev.origenes.map((o) =>
          o.id === id ? { ...o, borrado: true, actualizadoEn: sello } : o,
        ),
        movimientos: prev.movimientos.map((m) =>
          m.origenId === id || m.destinoId === id
            ? { ...m, borrado: true, actualizadoEn: sello }
            : m,
        ),
      }))
    },
    [cambiar],
  )

  const agregarMovimiento = useCallback(
    (datos: DatosMovimiento) => {
      const mov: Movimiento = {
        ...datos,
        id: nuevoId(),
        creadoEn: ahora(),
        actualizadoEn: ahora(),
      }
      cambiar((prev) => ({ ...prev, movimientos: [...prev.movimientos, mov] }))
      return mov
    },
    [cambiar],
  )

  const editarMovimiento = useCallback(
    (id: string, cambios: Partial<Movimiento>) => {
      cambiar((prev) => ({
        ...prev,
        movimientos: prev.movimientos.map((m) =>
          m.id === id ? { ...m, ...cambios, actualizadoEn: ahora() } : m,
        ),
      }))
    },
    [cambiar],
  )

  const borrarMovimiento = useCallback(
    (id: string) => {
      cambiar((prev) => ({
        ...prev,
        movimientos: prev.movimientos.map((m) =>
          m.id === id ? { ...m, borrado: true, actualizadoEn: ahora() } : m,
        ),
      }))
    },
    [cambiar],
  )

  const agregarCategoria = useCallback(
    (nombre: string, ambito: Categoria['ambito'], inventario?: boolean) => {
      const cat: Categoria = {
        id: nuevoId(),
        nombre,
        ambito,
        ...(inventario ? { inventario: true } : {}),
        actualizadoEn: ahora(),
      }
      cambiar((prev) => ({ ...prev, categorias: [...prev.categorias, cat] }))
      return cat
    },
    [cambiar],
  )

  const editarCategoria = useCallback(
    (id: string, cambios: Partial<Categoria>) => {
      cambiar((prev) => ({
        ...prev,
        categorias: prev.categorias.map((c) =>
          c.id === id ? { ...c, ...cambios, actualizadoEn: ahora() } : c,
        ),
      }))
    },
    [cambiar],
  )

  const borrarCategoria = useCallback(
    (id: string) => {
      const sello = ahora()
      cambiar((prev) => ({
        ...prev,
        categorias: prev.categorias.map((c) =>
          c.id === id ? { ...c, borrado: true, actualizadoEn: sello } : c,
        ),
        movimientos: prev.movimientos.map((m) =>
          m.categoria === id ? { ...m, categoria: undefined, actualizadoEn: sello } : m,
        ),
      }))
    },
    [cambiar],
  )

  const editarConfig = useCallback(
    (cambios: Partial<BaseDatos['config']>) => {
      cambiar((prev) => {
        const config = { ...prev.config, ...cambios }
        configurarFormato(config.moneda, config.locale)
        return { ...prev, config, configActualizadaEn: ahora() }
      })
    },
    [cambiar],
  )

  /**
   * Restaurar un respaldo o borrar todo son operaciones autoritativas: primero
   * se vacia la nube y luego se sube lo nuevo, para que no reaparezca nada de
   * lo anterior en la siguiente sincronizacion.
   */
  const reemplazar = useCallback(
    async (nueva: BaseDatos, autoritativo = true) => {
      const sello = ahora()
      const sellada: BaseDatos = {
        ...nueva,
        configActualizadaEn: sello,
        origenes: nueva.origenes.map((o) => ({ ...o, actualizadoEn: sello })),
        categorias: nueva.categorias.map((c) => ({ ...c, actualizadoEn: sello })),
        movimientos: nueva.movimientos.map((m) => ({ ...m, actualizadoEn: sello })),
      }
      if (autoritativo && usuarioId && nube && navigator.onLine) {
        setSync((s) => ({ ...s, sincronizando: true }))
        try {
          await vaciarNube(usuarioId)
        } catch (error) {
          setSync((s) => ({
            ...s,
            sincronizando: false,
            error: error instanceof Error ? error.message : 'No se pudo limpiar la nube.',
          }))
          return
        }
      }
      configurarFormato(sellada.config.moneda, sellada.config.locale)
      if (usuarioId) {
        guardarMarcaSync(usuarioId, '')
        setMarca('')
      }
      setCrudo(sellada)
      setSync((s) => ({ ...s, sincronizando: false }))
      programarSync()
    },
    [usuarioId, programarSync],
  )

  /* ---------------------------------------------------------------- */

  // Las vistas nunca ven filas borradas; el sincronizador si las necesita.
  const pendientes = useMemo(() => contarPendientes(crudo, marca), [crudo, marca])

  const db = useMemo<BaseDatos>(
    () => ({
      ...crudo,
      origenes: vivos(crudo.origenes),
      movimientos: vivos(crudo.movimientos),
      categorias: vivos(crudo.categorias),
    }),
    [crudo],
  )

  const valor = useMemo<ValorTienda>(
    () => ({
      db,
      sesion,
      sesionExpirada,
      correoUsuario: sesion?.user.email ?? usuarioLocal?.correo ?? '',
      autenticando,
      recuperandoClave,
      sync: { ...sync, pendientes },
      errorGuardado,
      vacio: db.origenes.length === 0,
      entrar,
      registrar,
      pedirRecuperacion,
      cambiarClave,
      salir,
      sincronizarAhora,
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
      db, sesion, sesionExpirada, usuarioLocal, autenticando, recuperandoClave, sync, pendientes,
      errorGuardado, entrar, registrar,
      pedirRecuperacion, cambiarClave, salir, sincronizarAhora, reemplazar, agregarOrigen,
      editarOrigen, borrarOrigen, agregarMovimiento, editarMovimiento, borrarMovimiento,
      agregarCategoria, editarCategoria, borrarCategoria, editarConfig,
    ],
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useTienda(): ValorTienda {
  const valor = useContext(Contexto)
  if (!valor) throw new Error('useTienda debe usarse dentro de <ProveedorTienda>')
  return valor
}

export { olvidarCuenta }

function traducirError(mensaje: string): string {
  const m = mensaje.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Correo o contrasena incorrectos.'
  if (m.includes('user already registered')) return 'Ese correo ya tiene cuenta. Entra en vez de registrarte.'
  if (m.includes('password should be at least')) return 'La contrasena debe tener al menos 6 caracteres.'
  if (m.includes('unable to validate email') || m.includes('invalid email'))
    return 'Ese correo no parece valido.'
  if (m.includes('email not confirmed')) return 'Falta confirmar el correo. Revisa tu bandeja.'
  if (m.includes('for security purposes') || m.includes('rate limit'))
    return 'Muchos intentos seguidos. Espera un minuto y vuelve a intentar.'
  if (m.includes('failed to fetch') || m.includes('network'))
    return 'Sin conexion con el servidor. Revisa tu internet.'
  return mensaje
}
