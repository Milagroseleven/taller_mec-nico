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

Sede → Mecánico → Matrícula → Marca → Modelo → Revisiones → Foto → Estado →
Fecha de revisión → Hora inicio/fin → **Vista previa** → *Guardar* / *Editar*

- **Sede y mecánico se eligen una sola vez.** Primero la sede, y el desplegable
  de nombres se filtra con los mecánicos de esa sede. Quedan recordados en el
  móvil, así que a partir de la segunda moto el formulario empieza directamente
  en la matrícula.
- **La consulta salta mientras se escribe.** En cuanto la matrícula tiene sus
  siete caracteres se busca sola, sin esperar a salir del campo. Va por un
  índice de matrículas cacheado seis horas y luego lee una única fila del
  maestro, en vez de recorrer las 5.000 motos en cada tecleo. Mientras busca se
  ve un indicador con spinner —*«Buscando la matrícula en Maestro…»*— cuyo texto
  va cambiando si tarda, para que nadie piense que se ha quedado colgado.
- **La matrícula se normaliza sola.** Llegan indistintamente como `7083 MGF` y
  como `8514LZB`; se guardan siempre igual para que el cruce con el maestro y el
  buscador no fallen.
- **Si la moto está en el maestro**, no se pide nada: aparece una ficha verde de
  confirmación con marca, modelo, año y km. No hay campos que rellenar.
- **Si no está**, sale la nota *«Matrícula aún no está registrada en Maestro»* y
  **sólo entonces** aparece un campo, el **modelo**, que es obligatorio. La marca
  no se pide: se rellenará cuando la moto se dé de alta en el maestro, que es
  donde le corresponde vivir. Hasta entonces la vista de equipo la muestra como
  *Ingreso pdte*.
- **Si la moto ya pasó por taller**, sale un aviso con la última fecha y el
  mecánico que la atendió, y un enlace *Ver registro previo*. Nunca bloquea el
  alta.
- **Las revisiones se meten como lista**, una a una. Se pueden reordenar y
  borrar. No hay catálogo cerrado todavía: los mecánicos escriben libre.
- **La foto es obligatoria** y se reduce a 1600 px en el propio móvil antes de
  subirla, para que vaya rápida con la cobertura del taller.

### Estado de motos

La hoja `Partes` se reordena sola en cada alta, así que en el propio Google
Sheet lo más reciente queda arriba. La vista de equipo hace lo mismo: listado de
la más reciente a la más antigua con **Matrícula, Marca, Modelo, Año,
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

Los pasos detallados, con cada clic, están en **[INSTALACION.md](INSTALACION.md)**.

Resumen: pegar los cinco archivos en un proyecto de Apps Script colgado del Sheet
de registro, ejecutar `prepararHojas` para crear las pestañas, ejecutar
`diagnostico` para comprobar que lee bien las hojas, y publicar como aplicación
web *ejecutando como tú* y con acceso para *cualquier usuario*.

### Configuración

Ya viene rellena con los recursos reales:

| Constante | Apunta a |
|---|---|
| `HOJA_ID` | Sheet de registro donde se guardan los partes |
| `MAESTRO_ID` + `MAESTRO_HOJA` | Pestaña **Maestro** del libro *Maestro 2026* |
| `MECANICOS_ID` + `MECANICOS_HOJA` | Pestaña **Vacaciones** del mismo libro |
| `CARPETA_ID` | Carpeta de Drive para las fotos |
| `LOGO_ID` | Vacío: el PDF imprime «MOTICK» en texto |

Si alguno cambia de sitio, se sustituye ahí y ya está.


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
código busca la fila de encabezados, filtra por esa columna y descarta los
puestos de `PUESTOS_EXCLUIDOS`: sólo firman partes quienes hacen la revisión con
sus manos.

Verificado contra la hoja real: de las 14 personas con sub área Taller quedan
**12 mecánicos** en el desplegable — Madrid (7), Valencia (3) y Barcelona (2).
Fuera se quedan el **Supervisor de taller** y el **Auxiliar de taller**.

Para volver a incluir a alguno de esos puestos, o excluir otro, se edita
`PUESTOS_EXCLUIDOS` en `Code.gs`; se compara por coincidencia parcial y sin
acentos.

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

`ID · Timestamp · Fecha revisión · Hora inicio · Hora fin · Matrícula · Marca ·
Modelo · Año · Sede · Mecánico · Estado · Revisiones · Nº revisiones · URL foto`

### Pestaña `Productividad`

**Son fórmulas, no valores.** La pestaña se calcula sola sobre la hoja `Partes`:
cambia en cuanto entra un parte nuevo, y también si alguien corrige uno a mano.
No hay nada que actualizar ni ningún proceso que pueda quedarse atrás.

1. **Motos por mecánico** — hoy · esta semana · semana pasada · últimos 30 días ·
   total · revisiones totales · media de revisiones por moto
2. **Motos por sede** — mismos periodos, para las cuatro sedes
3. **Totales** — la fila de toda la empresa

La semana empieza en lunes. Los nombres de los mecánicos salen solos de los
partes registrados, así que **sólo aparece quien tenga al menos un parte**: hay
sitio reservado para 30, de sobra para los 12 actuales.

Son indicadores deliberadamente sencillos. Cuando exista el catálogo de
revisiones se podrán cruzar por tipo de trabajo, que es donde está el jugo.


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
INSTALACION.md    Guía de instalación paso a paso
Code.gs           Backend: configuración, lectura de Sheets, guardado, PDF, métricas
Index.html        Formulario del mecánico
Equipo.html       Estado de motos
Estilos.html      Estilos compartidos por las dos pantallas
appsscript.json   Manifiesto: permisos y modo de publicación
```
