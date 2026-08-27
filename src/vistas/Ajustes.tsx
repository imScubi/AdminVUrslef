import { useRef, useState } from 'react'
import { useTienda } from '../estado/tienda'
import { baseVacia, exportarArchivo, leerArchivo } from '../lib/almacen'
import { datosDeEjemplo } from '../lib/demo'
import { hayNube } from '../lib/nube'
import { aNumero } from '../lib/formato'
import { Confirmar } from '../componentes/ui'

const CLAVE_ULTIMO_RESPALDO = 'adminvurslef:ultimo-respaldo'

function Concepto({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <details style={{ borderBottom: '1px solid var(--borde)', paddingBottom: 8 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 650, fontSize: '0.9rem' }}>{titulo}</summary>
      <p className="mini tenue" style={{ marginTop: 6, lineHeight: 1.6 }}>
        {children}
      </p>
    </details>
  )
}

export function Ajustes() {
  const {
    db,
    sesion,
    sync,
    salir,
    sincronizarAhora,
    reemplazar,
    agregarCategoria,
    editarCategoria,
    borrarCategoria,
    editarConfig,
  } = useTienda()

  const archivoRef = useRef<HTMLInputElement>(null)
  const [mensaje, setMensaje] = useState<{ tipo: 'bien' | 'peligro'; texto: string } | null>(null)
  const [confirmando, setConfirmando] = useState<'borrar' | 'ejemplo' | null>(null)
  const [nuevaCategoria, setNuevaCategoria] = useState('')
  const [ambitoNuevo, setAmbitoNuevo] = useState<'gasto' | 'retiro'>('gasto')

  const ultimoRespaldo = localStorage.getItem(CLAVE_ULTIMO_RESPALDO)

  function respaldar() {
    exportarArchivo(db)
    localStorage.setItem(CLAVE_ULTIMO_RESPALDO, new Date().toISOString())
    setMensaje({ tipo: 'bien', texto: 'Respaldo descargado. Guardalo en tu nube o en otro dispositivo.' })
  }

  async function importar(archivo: File) {
    try {
      const datos = await leerArchivo(archivo)
      await reemplazar(datos)
      setMensaje({
        tipo: 'bien',
        texto: `Datos restaurados: ${datos.origenes.length} origenes y ${datos.movimientos.length} movimientos.`,
      })
    } catch (error) {
      setMensaje({
        tipo: 'peligro',
        texto: error instanceof Error ? error.message : 'No se pudo leer el archivo.',
      })
    }
  }

  const pesoDatos = new Blob([JSON.stringify(db)]).size

  return (
    <>
      {hayNube && (
        <div className="tarjeta">
          <div className="tarjeta-cab">
            <h2>Tu cuenta</h2>
          </div>
          <div className="tarjeta-cuerpo" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div className="mini tenue-2" style={{ fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Sesion iniciada como
              </div>
              <div style={{ fontWeight: 650 }}>{sesion?.user.email}</div>
            </div>
            <p className="mini tenue">
              Todo lo que capturas se guarda en tu cuenta. Puedes cerrar la app, quedarte sin senal
              o cambiar de telefono: al volver a entrar sigue todo ahi.
              {sync.pendientes > 0
                ? ` Ahora mismo hay ${sync.pendientes} cambio(s) esperando a subir.`
                : ' Todo esta sincronizado.'}
              {sync.error && ` Ultimo problema: ${sync.error}`}
            </p>
            <div className="fila compacta">
              <button
                className="btn"
                onClick={() => void sincronizarAhora()}
                disabled={sync.sincronizando}
              >
                {sync.sincronizando ? 'Sincronizando…' : 'Sincronizar ahora'}
              </button>
              <button className="btn" onClick={() => void salir()}>
                Cerrar sesion
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="tarjeta">
        <div className="tarjeta-cab">
          <h2>Respaldo</h2>
        </div>
        <div className="tarjeta-cuerpo" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="alerta bien">
            <span className="alerta-icono">💾</span>
            <div>
              <div className="alerta-titulo">Tus datos ya estan en tu cuenta</div>
              <div className="alerta-detalle">
                El respaldo en archivo es un extra por si algun dia quieres tus numeros fuera de la
                app, o para pasarlos a otra cuenta. Restaurar un respaldo <b>reemplaza</b> todo lo
                que tengas hoy, tambien en la nube.
                {ultimoRespaldo && (
                  <>
                    {' '}
                    Ultimo respaldo: {new Date(ultimoRespaldo).toLocaleDateString('es-MX')}.
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="fila compacta">
            <button className="btn primario" onClick={respaldar}>
              Descargar respaldo
            </button>
            <button className="btn" onClick={() => archivoRef.current?.click()}>
              Restaurar desde archivo
            </button>
            <input
              ref={archivoRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const archivo = e.target.files?.[0]
                if (archivo) importar(archivo)
                e.target.value = ''
              }}
            />
          </div>

          <p className="mini tenue">
            Ocupas {(pesoDatos / 1024).toFixed(1)} KB · {db.movimientos.length} movimientos ·{' '}
            {db.origenes.length} origenes.
          </p>

          {mensaje && (
            <div className={`alerta ${mensaje.tipo === 'bien' ? 'bien' : 'peligro'}`}>
              <span className="alerta-icono">{mensaje.tipo === 'bien' ? '✅' : '⚠️'}</span>
              <div className="alerta-titulo">{mensaje.texto}</div>
            </div>
          )}
        </div>
      </div>

      <div className="tarjeta">
        <div className="tarjeta-cab">
          <h2>Preferencias</h2>
        </div>
        <div className="tarjeta-cuerpo">
          <div className="fila">
            <div className="campo">
              <label htmlFor="cfg-nombre">Nombre del tablero</label>
              <input
                id="cfg-nombre"
                type="text"
                value={db.config.nombre}
                onChange={(e) => editarConfig({ nombre: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="cfg-tema">Tema</label>
              <select
                id="cfg-tema"
                value={db.config.tema}
                onChange={(e) => editarConfig({ tema: e.target.value as 'auto' | 'claro' | 'oscuro' })}
              >
                <option value="auto">Automatico</option>
                <option value="claro">Claro</option>
                <option value="oscuro">Oscuro</option>
              </select>
            </div>
            <div className="campo">
              <label htmlFor="cfg-moneda">Moneda</label>
              <select
                id="cfg-moneda"
                value={db.config.moneda}
                onChange={(e) => editarConfig({ moneda: e.target.value })}
              >
                <option value="MXN">Peso mexicano (MXN)</option>
                <option value="USD">Dolar (USD)</option>
                <option value="EUR">Euro (EUR)</option>
                <option value="COP">Peso colombiano (COP)</option>
                <option value="ARS">Peso argentino (ARS)</option>
                <option value="CLP">Peso chileno (CLP)</option>
                <option value="PEN">Sol peruano (PEN)</option>
              </select>
            </div>
          </div>
          <div className="fila" style={{ marginTop: 14 }}>
            <div className="campo">
              <label htmlFor="cfg-margen">Margen minimo saludable (%)</label>
              <input
                id="cfg-margen"
                type="number"
                min={0}
                max={100}
                value={db.config.margenObjetivo}
                onChange={(e) => editarConfig({ margenObjetivo: aNumero(e.target.value) })}
              />
              <span className="ayuda">Debajo de esto la app te avisa que el negocio va apretado.</span>
            </div>
            <div className="campo">
              <label htmlFor="cfg-dias">Avisar si un origen lleva sin vender (dias)</label>
              <input
                id="cfg-dias"
                type="number"
                min={1}
                value={db.config.diasSinVentasAlerta}
                onChange={(e) => editarConfig({ diasSinVentasAlerta: aNumero(e.target.value) })}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="tarjeta">
        <div className="tarjeta-cab">
          <h2>Categorias</h2>
          <span className="mini tenue">Las marcadas como mercancia no cuentan como perdida</span>
        </div>
        <div className="tarjeta-cuerpo" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {(['gasto', 'retiro'] as const).map((ambito) => (
            <div key={ambito}>
              <h3 style={{ marginBottom: 8, fontSize: '0.88rem' }}>
                {ambito === 'gasto' ? 'Gastos del negocio' : 'Retiros a tu bolsillo'}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {db.categorias
                  .filter((c) => c.ambito === ambito)
                  .map((c) => (
                    <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="text"
                        value={c.nombre}
                        onChange={(e) => editarCategoria(c.id, { nombre: e.target.value })}
                        style={{ flex: 1 }}
                      />
                      {ambito === 'gasto' && (
                        <label
                          className="mini tenue nowrap"
                          style={{ display: 'flex', gap: 5, alignItems: 'center' }}
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(c.inventario)}
                            onChange={(e) =>
                              editarCategoria(c.id, { inventario: e.target.checked || undefined })
                            }
                            style={{ width: 'auto' }}
                          />
                          es mercancia
                        </label>
                      )}
                      <button
                        className="btn chico fantasma"
                        onClick={() => borrarCategoria(c.id)}
                        title="Borrar categoria"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          ))}

          <div className="fila compacta">
            <input
              type="text"
              placeholder="Nueva categoria…"
              value={nuevaCategoria}
              onChange={(e) => setNuevaCategoria(e.target.value)}
              style={{ flex: '1 1 200px' }}
            />
            <select
              value={ambitoNuevo}
              onChange={(e) => setAmbitoNuevo(e.target.value as 'gasto' | 'retiro')}
              style={{ flex: '0 0 150px' }}
            >
              <option value="gasto">Gasto</option>
              <option value="retiro">Retiro</option>
            </select>
            <button
              className="btn"
              disabled={!nuevaCategoria.trim()}
              onClick={() => {
                agregarCategoria(nuevaCategoria.trim(), ambitoNuevo)
                setNuevaCategoria('')
              }}
            >
              Agregar
            </button>
          </div>
        </div>
      </div>

      <div className="tarjeta">
        <div className="tarjeta-cab">
          <h2>Como funcionan los numeros</h2>
        </div>
        <div className="tarjeta-cuerpo" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Concepto titulo="Caja">
            El dinero que tienes disponible en un origen. Sube con ventas, aportes y traspasos que
            entran; baja con gastos, retiros y traspasos que salen.
          </Concepto>
          <Concepto titulo="Mercancia sin vender (inventario)">
            Cuando registras un gasto con una categoria marcada como <b>mercancia</b>, ese dinero no
            se cuenta como perdida: se guarda como inventario. Cuando vendes y pones el costo de la
            venta, ese inventario baja. Por eso puedes tener poca caja y aun asi ir ganando: el
            dinero esta en producto.
          </Concepto>
          <Concepto titulo="Ganancia bruta y margen">
            Ganancia bruta = lo que vendiste menos lo que te costo esa mercancia. El margen es esa
            ganancia como porcentaje de la venta. Mide que tan buen negocio es cada venta.
          </Concepto>
          <Concepto titulo="Ganancia neta">
            Ganancia bruta menos los gastos de operar (envios, publicidad, comisiones, herramientas).
            Es lo que de verdad te queda. No resta la compra de mercancia porque esa ya se resta a
            traves del costo de cada venta.
          </Concepto>
          <Concepto titulo="Aporte, retiro y ROI">
            Un <b>aporte</b> es dinero tuyo que le metes al origen; un <b>retiro</b> es dinero que le
            sacas para ti. El ROI compara la ganancia acumulada contra lo que aportaste, y
            "ya te regresaste" compara tus retiros contra ese mismo capital.
          </Concepto>
          <Concepto titulo="Traspaso">
            Sirve para cuando usas dinero ganado en un negocio para otro. Sale de la caja de uno y
            entra a la del otro, sin inventar ni desaparecer dinero.
          </Concepto>
        </div>
      </div>

      <div className="tarjeta">
        <div className="tarjeta-cab">
          <h2>Zona de riesgo</h2>
        </div>
        <div className="tarjeta-cuerpo" style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => setConfirmando('ejemplo')}>
            Cargar datos de ejemplo
          </button>
          <button className="btn peligro" onClick={() => setConfirmando('borrar')}>
            Borrar todo y empezar de cero
          </button>
        </div>
      </div>

      {confirmando === 'borrar' && (
        <Confirmar
          titulo="Borrar todo"
          mensaje="Se van a borrar todos tus origenes y movimientos, tambien los de tu cuenta en la nube. Descarga un respaldo antes si no estas seguro."
          textoConfirmar="Si, borrar todo"
          onCancelar={() => setConfirmando(null)}
          onConfirmar={() => {
            void reemplazar(baseVacia()).then(() =>
              setMensaje({ tipo: 'bien', texto: 'Listo, todo limpio.' }),
            )
            setConfirmando(null)
          }}
        />
      )}
      {confirmando === 'ejemplo' && (
        <Confirmar
          titulo="Cargar datos de ejemplo"
          mensaje="Esto reemplaza lo que tengas ahora con dos negocios inventados y varios meses de movimientos, para que veas como se ve la app llena."
          textoConfirmar="Cargar ejemplo"
          onCancelar={() => setConfirmando(null)}
          onConfirmar={() => {
            void reemplazar(datosDeEjemplo()).then(() =>
              setMensaje({ tipo: 'bien', texto: 'Datos de ejemplo cargados.' }),
            )
            setConfirmando(null)
          }}
        />
      )}
    </>
  )
}
