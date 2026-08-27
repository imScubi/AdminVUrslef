# AdminVUrslef

Herramienta personal para llevar en orden **varios negocios a la vez**, pensada para usarse desde
el celular.

Cada fuente de dinero es un **origen** con su propia caja, sus propios gastos y sus propias
estadísticas. Nada se mezcla salvo que tú lo muevas a propósito. La idea es responder de un
vistazo las preguntas que más cuesta contestar cuando tienes varios ingresos:

- ¿Cuánto dinero tengo **de cada negocio**, por separado?
- ¿En qué se fue lo que gané? ¿Cuánto me lo gasté yo y cuánto se quedó en el negocio?
- ¿Tengo poco dinero porque va mal, o porque está metido en mercancía sin vender?
- ¿Este negocio ya me devolvió lo que le invertí? ¿Cuánto de más?
- ¿A cuál de todos me conviene meterle el siguiente peso?

---

## Cómo funciona

Es una app web instalable (PWA) con base de datos en la nube:

- **Entras con correo y contraseña.** Tus datos viven en tu cuenta, no en el navegador. Puedes
  cerrar la app, cambiar de teléfono o reinstalar: al volver a entrar sigue todo ahí.
- **Funciona sin señal.** Lo que captures sin internet se guarda en el teléfono y se sube solo
  cuando vuelve la conexión. El chip de arriba a la derecha te dice siempre en qué estado está:
  `Guardado`, `2 por subir`, `Sin conexión`.
- **Nadie más ve tus números.** Cada fila de la base lleva tu `usuario_id` y Postgres tiene Row
  Level Security: aunque alguien tuviera la dirección de la app, la base solo devuelve las filas
  de la sesión que pregunta.

### Instalarla en el celular

1. Abre la URL en Chrome (Android) o Safari (iPhone).
2. Entra o crea tu cuenta.
3. Menú del navegador → **Agregar a la pantalla de inicio**.

Queda como una app normal, a pantalla completa y con su ícono.

---

## Los seis movimientos

Con estos seis se describe cualquier cosa que le pase al dinero:

| Movimiento | Qué es | Efecto |
|---|---|---|
| **Venta** | Vendiste algo. Puedes anotar cuánto te costó a ti. | Entra dinero |
| **Gasto** | Lo que sale para operar: mercancía, envíos, publicidad, comisiones. | Sale dinero |
| **Retiro** | Dinero que sacas del negocio para ti. | Sale dinero |
| **Aporte** | Capital tuyo que le metes al origen desde fuera. | Entra dinero |
| **Traspaso** | Usas dinero de un negocio en otro. | Sale de uno, entra al otro |
| **Ajuste** | Cuadras la caja cuando el saldo real no coincide. | Corrige |

---

## Pedidos y recibos

Para lo que se paga en partes: separaciones, encargos y ventas con anticipo.

Un **pedido** guarda a quién le vendes, su teléfono, qué lleva (texto libre o productos elegidos
del inventario) y el total acordado. Cada **abono**
que registras se convierte automáticamente en una entrada de dinero en la caja de ese negocio: no
capturas nada dos veces y la caja siempre refleja lo que de verdad te pagaron.

Un pedido pagado en tres abonos cuenta como **una** venta, no como tres, para que el ticket
promedio y el número de ventas no se distorsionen.

Cada abono genera un **recibo** con folio consecutivo, el logo del negocio, los datos del cliente,
el desglose (total, abonado antes, este abono, saldo) y cómo te pagaron. Se descarga como imagen
para mandársela al cliente. También hay un **estado de cuenta** con todos los abonos del pedido.

Cada negocio tiene su propio logo y contacto, y salen impresos en sus recibos. Se ponen al crear o
editar el origen, justo debajo del nombre. El logo también se usa como la cara del negocio en las
tarjetas del panel y en su encabezado; mientras no haya logo se usa el emoji. Si abres un recibo de
un negocio sin logo, el propio recibo te ofrece subirlo y se redibuja al instante.

El logo se reduce a 320px antes de guardarse, para que sincronizar no cargue una foto de cámara
completa.

---

## Cómo se calculan los números

Esta es la parte que hace que la app sirva de verdad, así que vale la pena entenderla.

**Caja.** El dinero disponible de un origen: ventas + aportes + traspasos que entran − gastos −
retiros − traspasos que salen, ± ajustes.

**Mercancía sin vender (inventario).** Las categorías de gasto marcadas como *mercancía* no se
tratan como pérdida: ese dinero se guarda como inventario. Cuando registras una venta y anotas su
costo, el inventario baja. Por eso puedes tener poca caja y aun así ir ganando — el dinero está en
producto, no perdido. La app te lo dice explícitamente cuando pasa.

**Desglose de la compra.** Al registrar una compra de mercancía puedes decir en qué se te fue el
dinero: si gastaste $2,400, cuántas piezas de cada producto trajiste y a qué costo salió cada una.
Eso arma un **inventario por producto** — cuántas te quedan y a qué costo — que puedes ver en el
detalle del negocio. Al crear un pedido eliges de ese inventario: el recibo sale con el detalle de
lo que se lleva, la mercancía se descuenta sola y el pedido carga su costo real, así tu "mercancía
sin vender" sí baja cuando vendes. Los pedidos cancelados devuelven la mercancía al estante.

El costo se reconoce **en proporción a lo cobrado**: si llevas la mitad del pedido pagado, se
reconoce la mitad del costo. Así el margen del mes no se dispara ni se hunde por el momento en que
el cliente terminó de pagar. Si corriges el total o los productos de un pedido, el costo repartido
a cada abono se recalcula solo.

**Retorno esperado.** Al registrar una compra de mercancía puedes anotar en cuánto esperas
venderla. De ahí sale un factor (compraste $7,000 esperando $12,000 → cada peso de mercancía vale
1.71 al venderse) que se aplica a lo que **queda** sin vender, así el pronóstico baja solo conforme
vendes, sin llevar cuenta pieza por pieza. Con eso la app te dice cuánta ganancia sigue guardada en
el inventario, y compara el margen que planeaste contra el que llevas de verdad — si vendes bastante
más barato de lo previsto, te avisa.

**Ganancia bruta y margen.** Ventas − costo de lo vendido. El margen es eso como porcentaje de la
venta: mide qué tan buen negocio es cada venta por sí sola.

**Ganancia neta.** Ganancia bruta − gastos de operar (envíos, publicidad, comisiones, herramientas).
Es lo que realmente te queda. No vuelve a restar la compra de mercancía, porque esa ya se descuenta
a través del costo de cada venta: así no se cuenta dos veces.

**ROI y "ya te regresaste".** El ROI compara la ganancia acumulada contra el capital que aportaste.
"Ya te regresaste" compara tus retiros contra ese mismo capital: te dice si la inversión ya se pagó
sola.

**Rinde por $1.** Ganancia neta entre todo lo que costó operar. Responde: por cada peso que le meto
a este negocio, ¿cuánto me regresa?

**Puntaje del comparador.** Mezcla cuatro cosas: cuánto deja al mes (35%), margen (25%), cuánto
rinde por peso metido (25%) y hacia dónde va la tendencia (15%). Es una guía, no un oráculo: un
origen con pocas ventas puede salir alto por pura suerte.

---

## Qué te avisa la app

En el panel aparece un bloque de "qué revisar" cuando detecta:

- Un origen con la caja en negativo.
- Margen por debajo de tu objetivo (lo configuras en Ajustes).
- Un origen que lleva mucho sin vender.
- Demasiado dinero atorado en mercancía.
- **Que estás sacando más de lo que el negocio gana** — el que más muerde.
- Que casi toda tu ganancia depende de un solo origen.

---

## Sincronización

Cada fila lleva `actualizado_en` y `borrado`:

- Al sincronizar se sube lo que cambió en el teléfono desde la última vez y se baja lo que cambió
  en la nube. Cuando hay dos versiones de la misma fila, **gana la más reciente**.
- Los borrados son lógicos. Si se borrara la fila de verdad, el otro dispositivo la volvería a
  subir en la siguiente sincronización.
- La marca de "hasta dónde vamos sincronizados" se toma **antes** de subir. Si capturas algo a
  media sincronización se reenvía la próxima vez: es preferible mandar de más (el upsert es
  idempotente) a perder un movimiento.

Restaurar un respaldo y "borrar todo" son operaciones autoritativas: primero vacían la nube y
luego suben lo nuevo, para que no reaparezca nada de lo anterior.

---

## Respaldo

Tus datos ya están a salvo en tu cuenta. El respaldo en archivo (Ajustes → Descargar respaldo) es
un extra: sirve para tener tus números fuera de la app o pasarlos a otra cuenta. Desde
**Movimientos** también puedes exportar a CSV lo que tengas filtrado.

---

## Desarrollo

```bash
npm install
npm run dev      # desarrollo
npm run build    # compila a dist/
npm start        # sirve dist/ en la red local
```

La app apunta a un proyecto de Supabase configurado en `src/lib/nube.ts`; se puede cambiar con las
variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Esa llave es pública por diseño: lo que
protege los datos es RLS, no esconderla.

### Estructura

```
src/
  tipos.ts              modelo de datos
  lib/calculos.ts       motor de estadísticas (caja, margen, ROI, alertas, comparador)
  lib/nube.ts           cliente de Supabase, mapeo de tablas y sincronización
  lib/almacen.ts        copia local por cuenta, respaldo y restauración
  estado/tienda.tsx     estado global, sesión y cola de cambios sin señal
  componentes/          piezas reutilizables (formularios, gráficas, listas)
  vistas/               Acceso, Panel, DetalleOrigen, Pedidos, DetallePedido,
                        Movimientos, Comparar, Ajustes
  componentes/Recibo    dibuja el recibo en un canvas y lo exporta como PNG
public/sw.js            service worker; la lista de precarga la inyecta vite.config.ts
```

### Base de datos

Tablas `av_origenes`, `av_movimientos`, `av_categorias`, `av_pedidos` y `av_config`, todas con
`usuario_id`, RLS activo y una política por tabla (`usuario_id = auth.uid()`). Llevan el prefijo
`av_` para convivir con otras tablas en el mismo proyecto de Supabase.

Los abonos no tienen tabla propia: son filas de `av_movimientos` con `pedido_id`, `metodo` y
`folio`. Así el dinero tiene una sola fuente de verdad.

El desglose de una compra vive como `jsonb` en `av_movimientos.articulos`, y lo que se lleva un
pedido en `av_pedidos.lineas`. Son pocos renglones, siempre se leen junto con su fila, y así no
hacen falta más tablas ni más políticas de RLS. En las líneas del pedido el nombre y el costo se
copian al momento de vender: si después corriges la compra original, el recibo que ya entregaste y
el margen de esa venta no cambian solos.
