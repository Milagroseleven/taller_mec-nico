# Instalación paso a paso

Guía completa para dejar la herramienta funcionando. No hace falta saber nada de
Apps Script: cada paso dice exactamente dónde hay que hacer clic.

Se hace una sola vez y lleva unos 15 minutos.

---

## Paso 1 · Abrir el editor de Apps Script

1. Abre el **Sheet de registro de partes** (el que acaba en `…VjvTbxAs`).
2. En el menú de arriba: **Extensiones → Apps Script**.
3. Se abre una pestaña nueva con el editor. Arriba a la izquierda pone
   *«Proyecto sin título»*: haz clic ahí y ponle **`Revisiones de Taller`**.

En la columna de la izquierda verás la sección **Archivos**, con un único
archivo llamado `Código.gs` que trae dentro una función de ejemplo
(`function myFunction() {}`).

---

## Paso 2 · Pegar el código

### 2.1 · `Código.gs`

1. Haz clic en **`Código.gs`**.
2. Selecciona **todo** lo que hay dentro (clic en el editor y `Ctrl + A`) y
   **bórralo**. Tiene que quedar completamente vacío.
3. Abre el archivo `Code.gs` de este repositorio, copia **todo** su contenido y
   pégalo ahí.
4. Guarda con `Ctrl + S` (o el icono del disquete).

> El archivo del repo se llama `Code.gs` y el del editor `Código.gs`. Es el
> mismo: Apps Script nombra el suyo en español y no se puede cambiar.

### 2.2 · Los tres archivos HTML

Hay que crear tres. Para **cada uno**:

1. Pasa el ratón por **Archivos** y pulsa el **`+`** que aparece al lado.
2. Elige **HTML** (no «Secuencia de comandos»).
3. Escribe el nombre **sin la extensión** y pulsa Enter.
4. Borra todo lo que traiga por defecto y pega el contenido del archivo del repo.
5. `Ctrl + S`.

| Nombre que escribes | Contenido que pegas |
|---|---|
| `Index` | `Index.html` |
| `Equipo` | `Equipo.html` |
| `Estilos` | `Estilos.html` |

**Importante:** escribe `Index`, no `Index.html`. Apps Script añade la extensión
solo. Si escribes `Index.html` acabarás con un archivo `Index.html.html` y no
funcionará.

Al terminar, en **Archivos** debe haber exactamente cuatro:

```
Código.gs
Equipo.html
Estilos.html
Index.html
```

### 2.3 · El manifiesto `appsscript.json`

Este archivo existe pero está oculto por defecto.

1. En la barra estrecha de la izquierda, pulsa el icono de **engranaje**
   (**Configuración del proyecto**).
2. Marca la casilla **«Mostrar el archivo de manifiesto "appsscript.json" en el
   editor»**.
3. Vuelve al **Editor** (icono `<>` de la misma barra).
4. Ahora aparece `appsscript.json` en la lista. Ábrelo, borra su contenido y
   pega el del repo.
5. `Ctrl + S`.

Este archivo es el que declara los permisos que necesita la aplicación. Sin él,
el paso siguiente fallará.

---

## Paso 3 · Preparar las hojas y autorizar

1. **Haz clic en `Código.gs`** en la lista de Archivos.

   > Esto no es opcional: el botón *Ejecutar* y el desplegable de funciones
   > **sólo aparecen cuando el archivo abierto es de código**. Si tienes abierto
   > `appsscript.json` o cualquiera de los `.html`, la barra de arriba sólo
   > mostrará *Registro de ejecución* y pensarás que falta algo.

2. Ahora en la barra de arriba tienes **▷ Ejecutar**, **Depurar** y un
   desplegable con los nombres de las funciones. Selecciona **`prepararHojas`**.
3. Pulsa **▷ Ejecutar**.

La primera vez Google pide permisos, y **la pantalla asusta más de lo que
debería**. Es normal: la aplicación es tuya y Google no verifica proyectos
personales. La secuencia es:

1. **«Revisar permisos»**
2. Elige tu cuenta de Google.
3. Sale **«Google no ha verificado esta aplicación»**. Pulsa
   **«Configuración avanzada»** (abajo a la izquierda).
4. Pulsa **«Ir a Revisiones de Taller (no seguro)»**.
5. Revisa lo que pide (Sheets y Drive) y pulsa **«Permitir»**.

Cuando termine, abajo se abre el **Registro de ejecución** con:

```
Hojas "Partes" y "Productividad" listas.
```

Vuelve al Sheet y comprueba que están esas dos pestañas nuevas.

---

## Paso 4 · Comprobar que lee bien las hojas

1. Con `Código.gs` abierto, elige **`diagnostico`** en el mismo desplegable.
2. Pulsa **▷ Ejecutar**.
3. Mira el **Registro de ejecución**.

Tiene que salir algo así:

```
Hoja de partes     : OK -> ...
Maestro de motos   : OK -> 4996 matrículas
Personal de taller : encabezados en fila 5
Mecánicos activos  : 12
   · Cristian Cadiz      [Madrid]     Mecánico
   · Cristian Cardozo    [Madrid]     Mecánico
   ...
Excluidos          : Alvaro Hernanseiz — Supervisor de taller,
                     Jhon Cruz — Auxiliar de taller
Carpeta de fotos   : OK -> ...
```

**Los 12 mecánicos y las 4.996 motos son la prueba de que todo está bien
conectado.** Si alguna línea pone `ERROR`, cópiala tal cual y pásamela.

---

## Paso 5 · Publicar la aplicación

1. Arriba a la derecha, botón azul **Implementar → Nueva implementación**.
2. Pulsa el **engranaje** que hay junto a *«Seleccionar tipo»* y elige
   **Aplicación web**.
3. Rellena:

   | Campo | Valor |
   |---|---|
   | Descripción | `Version 1` |
   | Ejecutar como | **Yo (tu correo)** |
   | Quién tiene acceso | **Cualquier usuario** |

4. Pulsa **Implementar**.

> **«Cualquier usuario»** es lo que permite que los mecánicos entren sin cuenta
> de Google. Como se ejecuta con *tu* cuenta, las fotos van a tu Drive y los
> partes a tu Sheet, sea quien sea quien rellene el formulario. Nadie más que tú
> tiene acceso real a los archivos.

5. Copia la **URL de la aplicación web**. Termina en `/exec`. Esa es la del
   formulario del mecánico.
6. La vista de equipo es esa misma URL con `?v=equipo` pegado al final:

```
https://script.google.com/macros/s/XXXXXXXX/exec            ← mecánicos
https://script.google.com/macros/s/XXXXXXXX/exec?v=equipo   ← estado de motos
```

---

## Paso 6 · Probarlo

1. Abre la URL del formulario. Debería pedirte tu nombre y tu sede, con los 12
   mecánicos en el desplegable.
2. Escribe una matrícula que sepas que existe, por ejemplo `7083 MGF`, y sal del
   campo. Marca y modelo deben rellenarse solos con **HONDA · CBR 650 R**.
3. Añade un par de revisiones, haz una foto, elige estado y fecha.
4. **Vista previa → Guardar**.
5. Comprueba las tres cosas:
   - Una fila nueva en la pestaña **Partes**.
   - La foto en la carpeta de Drive, con el nombre
     `7083 MGF - Revisión Taller - Completado - 2026-08-27.jpg`.
   - La moto en la vista de equipo, y el botón **Hoja de taller** genera el PDF.
6. Borra esa fila de prueba del Sheet cuando termines.

---

## Paso 7 · Repartirlo a los mecánicos

Manda la URL del formulario al grupo de WhatsApp y pídeles que la **añadan a la
pantalla de inicio**, así les queda como una aplicación más:

- **Android (Chrome):** menú `⋮` → *Añadir a pantalla de inicio*
- **iPhone (Safari):** botón de compartir `↑` → *Añadir a pantalla de inicio*

La primera vez eligen su nombre y su sede, y ya no se lo vuelve a pedir.

---

## Cómo actualizar el código más adelante

Esto es lo que más se olvida: **pegar el código nuevo no basta**. Hay que
publicar una versión nueva.

1. Pega los cambios en los archivos y guarda (`Ctrl + S`).
2. **Implementar → Gestionar implementaciones**.
3. Pulsa el **lápiz** (Editar) de la implementación que ya existe.
4. En **Versión**, elige **Nueva versión**.
5. Pulsa **Implementar**.

Hazlo así y **la URL no cambia**, que es lo importante: los mecánicos tienen ese
enlace guardado en el móvil. Si en vez de esto creas una *Nueva implementación*,
Google te dará una URL distinta y tendrás que repartirla otra vez.

---

## Si algo falla

| Síntoma | Qué mirar |
|---|---|
| «No se puede abrir el formulario» al entrar | Ejecuta `diagnostico` y lee el registro |
| El desplegable de mecánicos sale vacío | La columna `Sub área` de *Vacaciones* debe poner `Taller` |
| Marca y modelo no se autocompletan | Comprueba que la matrícula existe en la pestaña *Maestro* |
| Año y Km ponen «Ingreso pdte» | Esa moto no tiene esos datos en el maestro (pasa en 21 de 4.996) |
| El PDF no se descarga | Prueba en otro navegador; algunos bloquean descargas dentro del marco |
| Los cambios de código no se ven | No publicaste versión nueva (ver sección anterior) |

Ante cualquier error, la salida de `diagnostico` es siempre el primer sitio
donde mirar.
