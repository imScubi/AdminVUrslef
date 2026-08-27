# AdminVUrslef

Herramienta personal para llevar en orden **varios negocios a la vez**.

Cada fuente de dinero es un **origen** con su propia caja, sus propios gastos y sus propias
estadísticas. Nada se mezcla salvo que tú lo muevas a propósito. La idea es responder de un
vistazo las preguntas que más cuesta contestar cuando tienes varios ingresos:

- ¿Cuánto dinero tengo **de cada negocio**, por separado?
- ¿En qué se fue lo que gané? ¿Cuánto me lo gasté yo y cuánto se quedó en el negocio?
- ¿Tengo poco dinero porque va mal, o porque está metido en mercancía sin vender?
- ¿Este negocio ya me devolvió lo que le invertí? ¿Cuánto de más?
- ¿A cuál de todos me conviene meterle el siguiente peso?

Los datos se guardan **solo en tu dispositivo** (almacenamiento del navegador). No hay cuentas,
no hay servidor, no hay nube, no hay nada que pagar.

---

## Cómo usarla

Hay dos formas. Elige la que te acomode.

### 1. Archivo único (la más simple)

En la raíz del proyecto está `AdminVUrslef.html`. Es la app completa en un solo archivo.

1. Descárgalo.
2. Ábrelo con doble clic (Chrome, Edge o Firefox).
3. Ya está. Puedes ponerlo en el escritorio y marcarlo como favorito.

Si cambias el código y quieres regenerarlo:

```bash
npm install
npm run empaquetar    # deja un AdminVUrslef.html nuevo en la raíz
```

> Nota: al abrirse como archivo local, los datos se guardan bajo el "origen" `file://` del
> navegador. Funciona bien en Chrome, Edge y Firefox. En Safari el guardado local de archivos
> abiertos así es poco confiable: ahí usa la opción 2.

### 2. Como app web local

```bash
npm install
npm start           # abre http://localhost:4173
```

`npm start` la levanta también en tu red local, así que la terminal te va a mostrar una dirección
tipo `http://192.168.x.x:4173` que puedes abrir **desde el celular** mientras estén en el mismo
WiFi. Desde el celular puedes usar "Agregar a la pantalla de inicio" y queda como una app.

Ojo: cada dispositivo guarda sus propios datos. La computadora y el celular **no se sincronizan**.
Para pasar datos de uno a otro, usa el respaldo (Ajustes → Descargar respaldo → Restaurar).

Para desarrollar: `npm run dev`.

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

## Cómo se calculan los números

Esta es la parte que hace que la app sirva de verdad, así que vale la pena entenderla.

**Caja.** El dinero disponible de un origen: ventas + aportes + traspasos que entran − gastos −
retiros − traspasos que salen, ± ajustes.

**Mercancía sin vender (inventario).** Las categorías de gasto marcadas como *mercancía* no se
tratan como pérdida: ese dinero se guarda como inventario. Cuando registras una venta y anotas su
costo, el inventario baja. Por eso puedes tener poca caja y aun así ir ganando — el dinero está en
producto, no perdido. La app te lo dice explícitamente cuando pasa.

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

## Respaldo

Los datos viven en el navegador de ese dispositivo. Si limpias los datos del navegador, cambias de
equipo o usas modo privado, se pierden.

**Ajustes → Descargar respaldo** te deja un `.json` con todo. Guárdalo en tu nube o en una USB de
vez en cuando. Ese mismo archivo lo restauras con **Restaurar desde archivo**, y sirve también para
pasar tus datos de la computadora al celular.

Desde **Movimientos** también puedes exportar a CSV lo que tengas filtrado, por si quieres hacer
cuentas aparte en una hoja de cálculo.

---

## Atajos

- `N` abre el registro rápido de movimiento.
- En el formulario, **Guardar y seguir** deja capturar varios movimientos seguidos sin cerrar.
- `Esc` cierra cualquier ventana.

---

## Stack

React + TypeScript + Vite. Sin dependencias de UI ni de gráficas: las gráficas son SVG escrito a
mano y el estilo es una sola hoja CSS. Todo el estado vive en `localStorage`.

```
src/
  tipos.ts              modelo de datos
  lib/calculos.ts       motor de estadísticas (caja, margen, ROI, alertas, comparador)
  lib/almacen.ts        guardado, respaldo y restauración
  estado/tienda.tsx     estado global
  componentes/          piezas reutilizables (formularios, gráficas, listas)
  vistas/               Panel, DetalleOrigen, Movimientos, Comparar, Ajustes
```
