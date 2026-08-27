import { useTienda } from '../estado/tienda'
import { hayNube } from '../lib/nube'

/** Chip que dice, sin ambiguedad, si lo que capturaste ya esta a salvo. */
export function EstadoNube() {
  const { sync, sincronizarAhora, sesionExpirada } = useTienda()
  if (!hayNube) return null

  const { enLinea, sincronizando, pendientes, error } = sync

  let clase = 'pill verde'
  let texto = 'Guardado'
  let icono = '☁️'

  if (sesionExpirada) {
    clase = 'pill ambar'
    texto = pendientes > 0 ? `${pendientes} sin subir` : 'Sesion caducada'
    icono = '🔒'
  } else if (sincronizando) {
    clase = 'pill azul'
    texto = 'Guardando…'
    icono = '⏳'
  } else if (error) {
    clase = 'pill rojo'
    texto = pendientes > 0 ? `${pendientes} sin subir` : 'Error al guardar'
    icono = '⚠️'
  } else if (!enLinea) {
    clase = 'pill ambar'
    texto = pendientes > 0 ? `${pendientes} en espera` : 'Sin conexion'
    icono = '📴'
  } else if (pendientes > 0) {
    clase = 'pill ambar'
    texto = `${pendientes} por subir`
    icono = '⏫'
  }

  return (
    <button
      className={clase}
      onClick={() => void sincronizarAhora()}
      title={
        sesionExpirada
          ? 'Tus cambios se estan guardando en el telefono. Entra otra vez para subirlos.'
          : error
          ? `${error} · Toca para reintentar`
          : !enLinea
            ? 'Lo que captures se guarda en el telefono y se sube solo cuando vuelva el internet.'
            : 'Todo esta guardado en tu cuenta. Toca para sincronizar ahora.'
      }
      style={{ border: 0, cursor: 'pointer' }}
    >
      <span>{icono}</span>
      <span className="solo-escritorio-en-linea">{texto}</span>
    </button>
  )
}
