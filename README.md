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

### 3. Rellenar la configuración

Al principio de `Code.gs` están las constantes. Sólo dos son obligatorias:

```javascript
const MAESTRO_ID   = '';   // OBLIGATORIO: Sheet del maestro de motos
const MECANICOS_ID = '';   // OBLIGATORIO: Sheet con los mecánicos activos
```

Las demás pueden quedarse vacías y el script resuelve solo:

| Constante | Si se deja vacía |
|---|---|
| `HOJA_ID` | Usa el Sheet que contiene el script |
| `MAESTRO_HOJA` / `MECANICOS_HOJA` | Usa la primera pestaña |
| `CARPETA_ID` | Crea la carpeta `Revisiones Taller - Fotos` en Drive |
| `LOGO_ID` | El PDF imprime «MOTICK» en texto |

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

### Maestro de motos

| Campo | Encabezados que reconoce |
|---|---|
| Matrícula *(obligatorio)* | `Matrícula`, `Matriculas`, `Placa`, `Plate` |
| Marca | `Marca`, `Brand`, `Fabricante` |
| Modelo | `Modelo`, `Model` |
| Año | `Año`, `Year`, `Fecha matriculación` |
| Km | `Km`, `Kms`, `Kilómetros`, `Kilometraje` |

### Mecánicos

| Campo | Encabezados que reconoce |
|---|---|
| Nombre | `Nombre`, `Mecánico`, `Nombre y apellidos` |
| Sede | `Sede`, `Centro`, `Delegación`, `Ciudad` |
| Activo | `Activo`, `Alta`, `En activo` |

Si tus encabezados son otros, añádelos a `COLS_MAESTRO` o `COLS_MECANICOS` en
`Code.gs`. Sólo se descarta un mecánico si la columna *Activo* dice
explícitamente `No`, `Baja`, `Inactivo`, `0` o `False`: una celda vacía cuenta
como activo, para que nadie desaparezca del desplegable por un hueco en la hoja.

La columna **Sede** de los mecánicos es opcional. Si está, se propone sola al
elegir el nombre, pero el mecánico siempre puede cambiarla.

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
