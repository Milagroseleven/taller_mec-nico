# Revisiones de Taller · Motick

Sustituye el reporte por WhatsApp. El mecánico registra desde el móvil la moto
que acaba de revisar y el parte queda en el Sheet al instante, sin que nadie
tenga que copiar y pegar nada a Trello.

Está montado sobre **Google Apps Script + Google Sheets**: sin servidores, sin
coste y sin instalar nada en los móviles. Los mecánicos abren un enlace y lo
añaden a la pantalla de inicio.

---

## Las dos pantallas

Un mismo despliegue sirve las dos, según la URL:

| URL | Para quién | Qué hace |
|---|---|---|
| `.../exec` | Mecánicos | Formulario de alta de la revisión |
| `.../exec?v=equipo` | Todo el equipo | Estado de motos: listado, buscador, filtros y hoja de taller en PDF |

### Formulario del mecánico

Mecánico → Sede → Matrícula → Marca → Modelo → Revisiones → Foto → Estado →
Fecha término → **Vista previa** → *Guardar* / *Editar*

- **Mecánico y sede se eligen una sola vez.** Quedan recordados en el móvil, así
  que a partir de la segunda moto el formulario empieza directamente en la
  matrícula.
- **La matrícula se normaliza sola.** Llegan indistintamente como `7083 MGF` y
  como `8514LZB`; se guardan siempre igual para que el cruce con el maestro y el
  buscador no fallen.
- **Si la moto está en el maestro**, marca y modelo se rellenan solos y siguen
  siendo editables. **Si no está**, aparece la nota *«Matrícula aún no ingresada
  en Maestro»*: el modelo pasa a ser obligatorio y la marca queda opcional.
- **Si la moto ya pasó por taller**, sale un aviso con la última fecha y el
  mecánico que la atendió, y un enlace *Ver registro previo*. Nunca bloquea el
  alta.
- **Las revisiones se meten como lista**, una a una. Se pueden reordenar y
  borrar. No hay catálogo cerrado todavía: los mecánicos escriben libre.
- **La foto es obligatoria** y se reduce a 1600 px en el propio móvil antes de
  subirla, para que vaya rápida con la cobertura del taller.

### Estado de motos

Listado de la más reciente a la más antigua con **Matrícula, Marca, Modelo, Año,
Km, Estado, Sede, Responsable y Fecha**, más un botón **Hoja de taller** que
genera el PDF del parte.

- Buscador general sobre matrícula, marca, modelo, responsable y sede.
- Desplegable de filtro en cada encabezado, combinables entre sí.
- Al tocar una fila se despliega la lista completa de revisiones y el enlace a la
  foto.
- **Año y Km salen siempre del maestro**, no del parte: son datos de la moto, no
  del trabajo de aquel día. Si la moto no está en el maestro, esas columnas
  muestran *Ingreso pdte*.

---

## Instalación

### 1. Crear el Sheet de partes

Crea un Google Sheet nuevo (por ejemplo *Revisiones Taller*). Ahí se guardarán
los partes y los indicadores. Apunta su ID: es el trozo largo de la URL.

```
docs.google.com/spreadsheets/d/ESTO_ES_EL_ID/edit
```

### 2. Crear el proyecto de Apps Script

Desde ese Sheet: **Extensiones → Apps Script**. Luego crea los archivos y pega
el contenido de este repositorio:

| Archivo en Apps Script | Contenido |
|---|---|
| `Código.gs` | `Code.gs` |
| `Index` (HTML) | `Index.html` |
| `Equipo` (HTML) | `Equipo.html` |
| `Estilos` (HTML) | `Estilos.html` |

Los archivos HTML se crean con **+ → HTML** y sin escribir la extensión: Apps
Script la añade sola.

En **Configuración del proyecto** marca *Mostrar el archivo de manifiesto
`appsscript.json`* y pega el contenido de `appsscript.json`.

### 3. Configuración

Ya viene rellena con los recursos reales:

| Constante | Apunta a |
|---|---|
| `HOJA_ID` | Sheet de registro donde se guardan los partes |
| `MAESTRO_ID` + `MAESTRO_HOJA` | Pestaña **Maestro** del Sheet de personal y flota |
| `MECANICOS_ID` + `MECANICOS_HOJA` | Pestaña **Vacaciones** del mismo Sheet |
| `CARPETA_ID` | Carpeta de Drive para las fotos |
| `LOGO_ID` | Vacío: el PDF imprime «MOTICK» en texto |

Si alguno cambia de sitio, se sustituye ahí y ya está.

### 4. Preparar las hojas

En el editor, ejecuta la función **`prepararHojas`** una vez. Crea las pestañas
`Partes` y `Productividad` con su formato. La primera ejecución pide autorizar
los permisos.

### 5. Desplegar

**Implementar → Nueva implementación → Aplicación web**:

- *Ejecutar como*: **Yo**
- *Quién tiene acceso*: **Cualquier usuario**

«Cualquier usuario» es lo que permite que los mecánicos entren sin cuenta de
Google. Como se ejecuta con tu cuenta, las fotos van a tu Drive y los partes a
tu Sheet independientemente de quién rellene el formulario.

Copia la URL que termina en `/exec`. Esa es la del formulario; añadiéndole
`?v=equipo` tienes la del estado de motos.

### 6. Comprobar

Ejecuta **`diagnostico`** en el editor. Escribe en el registro si encuentra el
maestro, cuántas matrículas ha leído, cuántos mecánicos activos hay y si la
carpeta de fotos está accesible. Es el primer sitio donde mirar cuando algo no
cuadre.

---

## Qué espera de tus Sheets

Los encabezados se buscan **sin distinguir mayúsculas ni acentos**, así que no
tienen que coincidir exactamente.

**Ninguna de las dos hojas tiene los encabezados en la fila 1**, así que la fila
de encabezados se busca en las 20 primeras en lugar de darse por hecha.

### Maestro de motos — pestaña `Maestro`

Encabezados en la **fila 4**. Verificado contra la hoja real: **4.996 motos**.

| Campo | Columna real | Encabezados que reconoce |
|---|---|---|
| Matrícula *(obligatorio)* | `Matricula` | `Matrícula`, `Placa`, `Plate` |
| Marca | `Marca` | `Marca`, `Brand`, `Fabricante` |
| Modelo | `Modelo` | `Modelo`, `Model` |
| Año | `Fecha de matriculación` | `Fecha de matriculación`, `Año`, `Year` |
| Km | `KMs` | `KMs`, `Km`, `Kilómetros`, `Kilometraje` |

Del año sólo se extrae el año (`24/10/2017` → `2017`) y los km se reformatean a
un estilo único, porque en la hoja conviven `18116`, `7.134` y `19.000`. Faltan
km en 21 motos y año en 5; ésas mostrarán *Ingreso pdte* en esas dos columnas.

Como el maestro ronda las 5.000 filas y la consulta se dispara cada vez que un
mecánico escribe una matrícula, **sólo se leen las cinco columnas necesarias**
en vez de las 26 de la hoja.

### Mecánicos — pestaña `Vacaciones`

Encabezados en la **fila 5**: `Nº | Nombres | Sub área | Puesto | Sede | …`

El rótulo `TALLER` que hay suelto más abajo es sólo decorativo: **lo que
identifica a un mecánico es la columna `Sub área` con el valor `Taller`**. El
código busca la fila de encabezados, filtra por esa columna y descarta a quien
lleve `Supervisor` en el puesto.

Verificado contra la hoja real: **13 personas de taller**, con Álvaro Hernanseiz
(Supervisor de taller) excluido. Repartidas en Madrid (8), Valencia (3) y
Barcelona (2).

> Ojo: **Jhon Cruz entra en la lista como «Auxiliar de taller»**, porque la regla
> acordada era excluir sólo al supervisor. Si tampoco debe firmar partes, se
> añade `'auxiliar'` a `PUESTOS_EXCLUIDOS` en `Code.gs`.

La **Sede** viene abreviada y se traduce sola: `Bar` → Barcelona, `Mad` →
Madrid, `Val` → Valencia, `Sev` → Sevilla. Si alguna no se reconoce, el mecánico
la elige a mano.

No hay personal de taller en Sevilla, pero **Sevilla sigue siendo elegible como
sede** en el formulario: la sede es dónde se hizo el trabajo, no de dónde es el
mecánico.

Si la estructura cambia, lo primero que hay que mirar es la salida de
`diagnostico()`: imprime en qué fila encontró los encabezados, cuáles leyó, qué
columnas usó, la lista completa de mecánicos con su sede y quién quedó excluido.

---

## Datos que genera

### Pestaña `Partes`

`ID · Timestamp · Fecha término · Matrícula · Marca · Modelo · Año · Sede ·
Mecánico · Estado · Revisiones · Nº revisiones · URL foto`

### Pestaña `Productividad`

Se recalcula sola con cada parte:

1. **Motos por mecánico** — hoy, esta semana, semana pasada, últimos 30 días y total
2. **Motos por sede y semana** — últimas 10 semanas
3. **Promedio de revisiones por mecánico**

Si prefieres no recalcularla en cada alta, quita la llamada a
`actualizarProductividad()` dentro de `guardarParte` y ponle un activador diario
desde **Activadores** en el editor.

### Fotos en Drive

```
7083 MGF - Revisión Taller - Completado - 2026-08-13.jpg
```

Si la misma moto vuelve el mismo día y con el mismo estado, el archivo se numera
`(2)`, `(3)`… Nunca se pisa una foto anterior.

---

## Pendiente de decidir

- **Catálogo de revisiones.** Ahora se escribe libre. Cuando se liste con los
  mecánicos qué revisiones se hacen de verdad, pasarlo a una pestaña de Sheets y
  ofrecerlas como botones. Es lo que hará medibles los indicadores por tipo de
  trabajo.
- **Los cuatro estados en un solo campo.** `Pendiente / Completado` es avance y
  `Incidencia / Mantenimiento` es tipo de trabajo: son dos ejes distintos y una
  moto puede ser las dos cosas a la vez. Se mantiene así a petición del jefe de
  taller para no cambiarle el hábito a los mecánicos de golpe. Cuando se separe,
  sólo hay que añadir una columna a `CABECERA_PARTES` y un segundo grupo de
  botones en `Index.html`.
- **QR por moto.** Pegatina en el chasis que abra el formulario con la matrícula
  ya puesta. Se dejó para una etapa posterior.
- **Protección de la vista de dirección.** Los indicadores viven hoy en una
  pestaña del Sheet, visible para quien tenga acceso al archivo. Si se quiere una
  pantalla web propia sólo para jefes, hay que añadirle control de acceso.

---

## Estructura del repositorio

```
Code.gs           Backend: configuración, lectura de Sheets, guardado, PDF, métricas
Index.html        Formulario del mecánico
Equipo.html       Estado de motos
Estilos.html      Estilos compartidos por las dos pantallas
appsscript.json   Manifiesto: permisos y modo de publicación
```
