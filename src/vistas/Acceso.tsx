import { useState } from 'react'
import { useTienda } from '../estado/tienda'

type Modo = 'entrar' | 'registrar' | 'recuperar'

export function Acceso() {
  const { entrar, registrar, pedirRecuperacion } = useTienda()
  const [modo, setModo] = useState<Modo>('entrar')
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setAviso(null)
    setOcupado(true)
    try {
      if (modo === 'entrar') {
        await entrar(correo, clave)
      } else if (modo === 'registrar') {
        const mensaje = await registrar(correo, clave)
        if (mensaje) setAviso(mensaje)
      } else {
        await pedirRecuperacion(correo)
        setAviso('Te mandamos un enlace al correo para poner una contrasena nueva.')
      }
    } catch (problema) {
      setError(problema instanceof Error ? problema.message : 'Algo salio mal.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="pantalla-acceso">
      <form className="caja-acceso" onSubmit={enviar}>
        <div className="acceso-marca">
          <div className="marca-logo" style={{ width: 46, height: 46, fontSize: 18 }}>
            AV
          </div>
          <div>
            <h1 style={{ fontSize: '1.3rem' }}>AdminVUrslef</h1>
            <p className="mini tenue">Tus negocios, cada uno con su propia caja</p>
          </div>
        </div>

        <div className="segmentado" style={{ width: '100%' }}>
          <button
            type="button"
            style={{ flex: 1 }}
            className={modo === 'entrar' ? 'activo' : ''}
            onClick={() => {
              setModo('entrar')
              setError(null)
              setAviso(null)
            }}
          >
            Entrar
          </button>
          <button
            type="button"
            style={{ flex: 1 }}
            className={modo === 'registrar' ? 'activo' : ''}
            onClick={() => {
              setModo('registrar')
              setError(null)
              setAviso(null)
            }}
          >
            Crear cuenta
          </button>
        </div>

        <div className="campo">
          <label htmlFor="ac-correo">Correo</label>
          <input
            id="ac-correo"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            required
            placeholder="tucorreo@ejemplo.com"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
          />
        </div>

        {modo !== 'recuperar' && (
          <div className="campo">
            <label htmlFor="ac-clave">Contrasena</label>
            <div style={{ position: 'relative' }}>
              <input
                id="ac-clave"
                type={verClave ? 'text' : 'password'}
                autoComplete={modo === 'registrar' ? 'new-password' : 'current-password'}
                required
                minLength={6}
                placeholder={modo === 'registrar' ? 'Minimo 6 caracteres' : '••••••••'}
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                style={{ paddingRight: 62 }}
              />
              <button
                type="button"
                className="btn chico fantasma"
                style={{ position: 'absolute', right: 4, top: 4 }}
                onClick={() => setVerClave((v) => !v)}
              >
                {verClave ? 'ocultar' : 'ver'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="alerta peligro">
            <span className="alerta-icono">⚠️</span>
            <div className="alerta-titulo">{error}</div>
          </div>
        )}
        {aviso && (
          <div className="alerta bien">
            <span className="alerta-icono">📬</span>
            <div className="alerta-titulo">{aviso}</div>
          </div>
        )}

        <button className="btn primario bloque" type="submit" disabled={ocupado}>
          {ocupado
            ? 'Un momento…'
            : modo === 'entrar'
              ? 'Entrar'
              : modo === 'registrar'
                ? 'Crear mi cuenta'
                : 'Mandar enlace'}
        </button>

        {modo === 'entrar' && (
          <button
            type="button"
            className="btn fantasma bloque"
            onClick={() => {
              setModo('recuperar')
              setError(null)
              setAviso(null)
            }}
          >
            Se me olvido la contrasena
          </button>
        )}
        {modo === 'recuperar' && (
          <button
            type="button"
            className="btn fantasma bloque"
            onClick={() => {
              setModo('entrar')
              setError(null)
              setAviso(null)
            }}
          >
            Volver
          </button>
        )}

        <p className="mini tenue-2 centro">
          Tus datos quedan guardados en tu cuenta. Puedes cerrar la app, cambiar de telefono o
          quedarte sin internet: al volver a entrar sigue todo ahi.
        </p>
      </form>
    </div>
  )
}

export function NuevaClave() {
  const { cambiarClave } = useTienda()
  const [clave, setClave] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setOcupado(true)
    setError(null)
    try {
      await cambiarClave(clave)
    } catch (problema) {
      setError(problema instanceof Error ? problema.message : 'No se pudo cambiar.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="pantalla-acceso">
      <form className="caja-acceso" onSubmit={enviar}>
        <h1 style={{ fontSize: '1.2rem' }}>Pon una contrasena nueva</h1>
        <div className="campo">
          <label htmlFor="nc-clave">Contrasena nueva</label>
          <input
            id="nc-clave"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
        </div>
        {error && (
          <div className="alerta peligro">
            <span className="alerta-icono">⚠️</span>
            <div className="alerta-titulo">{error}</div>
          </div>
        )}
        <button className="btn primario bloque" type="submit" disabled={ocupado}>
          {ocupado ? 'Guardando…' : 'Guardar y entrar'}
        </button>
      </form>
    </div>
  )
}
