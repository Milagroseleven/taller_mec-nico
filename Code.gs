/**
 * Partes de taller — Motick
 *
 * Sustituye el reporte por WhatsApp: el mecánico registra desde el móvil la
 * moto que acaba de revisar (matrícula, marca, modelo, lista de revisiones,
 * foto y estado) y el parte queda en el Sheet al instante. El resto del
 * equipo lo ve en la vista de estado de motos, con buscador, filtros y una
 * hoja de taller en PDF por cada parte.
 *
 * El formulario es público (sin login): los mecánicos abren un enlace y se
 * identifican eligiendo su nombre, que queda recordado en el móvil.
 *
 * Dos pantallas, un mismo despliegue:
 *   .../exec            -> formulario del mecánico
 *   .../exec?v=equipo   -> estado de motos (vista de equipo)
 */

// ---------------------------------------------------------------------
// CONFIGURACIÓN
//
// Los IDs son el trozo largo de la URL:
//   hoja    -> docs.google.com/spreadsheets/d/ESTO_ES_EL_ID/edit
//   carpeta -> drive.google.com/drive/folders/ESTO_ES_EL_ID
//
// Sólo MAESTRO_ID y MECANICOS_ID son obligatorios. Los demás pueden
// quedarse vacíos y el script resuelve solo (usa la hoja contenedora y
// crea la carpeta de fotos la primera vez).
// ---------------------------------------------------------------------

/** Sheet donde se guardan los partes. Vacío = la hoja que contiene el script. */
const HOJA_ID = '';

/** Maestro de motos: de aquí salen marca, modelo, año y km. OBLIGATORIO. */
const MAESTRO_ID = '';
/** Pestaña del maestro. Vacío = la primera. */
const MAESTRO_HOJA = '';

/** Lista de mecánicos activos. OBLIGATORIO. */
const MECANICOS_ID = '';
/** Pestaña de mecánicos. Vacío = la primera. */
const MECANICOS_HOJA = '';

/** Carpeta de Drive para las fotos. Vacío = se crea con el nombre de abajo. */
const CARPETA_ID = '';
const CARPETA_NOMBRE = 'Revisiones Taller - Fotos';

/** Logo PNG para la cabecera del PDF. Vacío = se imprime el nombre en texto. */
const LOGO_ID = '';

const SEDES = ['Barcelona', 'Madrid', 'Sevilla', 'Valencia'];
const ESTADOS = ['Pendiente', 'Completado', 'Incidencia', 'Mantenimiento'];

const HOJA_PARTES = 'Partes';
const HOJA_PRODUCTIVIDAD = 'Productividad';

/**
 * Nombres aceptados para cada columna de los Sheets externos. Se comparan
 * sin acentos ni mayúsculas, así que no hace falta que coincidan exacto.
 * Si tu maestro usa otro encabezado, añádelo a la lista correspondiente.
 */
const COLS_MAESTRO = {
  matricula: ['matricula', 'matriculas', 'placa', 'plate', 'matricula moto'],
  marca:     ['marca', 'brand', 'fabricante'],
  modelo:    ['modelo', 'model', 'modelo moto'],
  anio:      ['ano', 'anio', 'year', 'ano matriculacion', 'fecha matriculacion'],
  km:        ['km', 'kms', 'kilometros', 'kilometraje', 'km actuales']
};

const COLS_MECANICOS = {
  nombre: ['nombre', 'mecanico', 'name', 'nombre mecanico', 'nombre y apellidos'],
  sede:   ['sede', 'centro', 'delegacion', 'ciudad'],
  activo: ['activo', 'active', 'alta', 'en activo']
};

const CABECERA_PARTES = [
  'ID', 'Timestamp', 'Fecha término', 'Matrícula', 'Marca', 'Modelo', 'Año',
  'Sede', 'Mecánico', 'Estado', 'Revisiones', 'Nº revisiones', 'URL foto'
];

/** Texto que se muestra cuando la moto todavía no está en el maestro. */
const SIN_MAESTRO = 'Ingreso pdte';

// ---------------------------------------------------------------------
// UTILIDADES
// ---------------------------------------------------------------------

/** Pasa un texto a minúsculas y sin acentos, para comparar encabezados. */
function norm_(s) {
  return String(s == null ? '' : s)
    .trim()
    .toLowerCase()
    .normalize('NFD')          // separa la letra de su tilde
    .replace(/[^ -~]/g, '')    // y descarta la tilde suelta
    .replace(/\s+/g, ' ');
}

/**
 * Deja la matrícula en su forma canónica para comparar y buscar: sólo
 * letras y números en mayúscula. Los mecánicos escriben indistintamente
 * "7083 MGF" y "8514LZB", y sin esto el cruce con el maestro falla.
 */
function normalizarMatricula_(s) {
  return String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Forma legible: 4 dígitos, espacio, 3 letras. Si no encaja, se deja igual. */
function formatearMatricula_(s) {
  const m = normalizarMatricula_(s);
  const r = m.match(/^(\d{4})([A-Z]{3})$/);
  return r ? r[1] + ' ' + r[2] : m;
}

function zonaHoraria_() {
  return Session.getScriptTimeZone() || 'Europe/Madrid';
}

function fechaISO_(d) {
  return Utilities.formatDate(d, zonaHoraria_(), 'yyyy-MM-dd');
}

function fechaCorta_(d) {
  return Utilities.formatDate(d, zonaHoraria_(), 'dd/MM/yyyy');
}

/** Convierte a Date lo que venga de un Sheet o del formulario. */
function aFecha_(v) {
  if (v instanceof Date && !isNaN(v)) return v;
  const s = String(v == null ? '' : v).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

/** Escapa texto para meterlo en el HTML del PDF. */
function esc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Localiza las columnas de una hoja a partir de la fila de encabezados.
 * Devuelve { campo: índice } usando los alias de COLS_*.
 */
function mapearColumnas_(encabezados, alias) {
  const norm = encabezados.map(norm_);
  const mapa = {};
  Object.keys(alias).forEach(function (campo) {
    let idx = -1;
    alias[campo].some(function (a) {
      const i = norm.indexOf(norm_(a));
      if (i !== -1) { idx = i; return true; }
      return false;
    });
    // Segunda pasada más laxa: encabezado que empiece por el alias.
    if (idx === -1) {
      alias[campo].some(function (a) {
        const na = norm_(a);
        const i = norm.findIndex(function (h) { return h && h.indexOf(na) === 0; });
        if (i !== -1) { idx = i; return true; }
        return false;
      });
    }
    mapa[campo] = idx;
  });
  return mapa;
}

function libro_() {
  if (HOJA_ID) return SpreadsheetApp.openById(HOJA_ID);
  const activa = SpreadsheetApp.getActiveSpreadsheet();
  if (!activa) {
    throw new Error(
      'No hay hoja de destino. Rellena HOJA_ID en la configuración de Code.gs ' +
      'con el ID del Sheet donde deben guardarse los partes.'
    );
  }
  return activa;
}

function carpetaFotos_() {
  if (CARPETA_ID) return DriveApp.getFolderById(CARPETA_ID);
  const it = DriveApp.getFoldersByName(CARPETA_NOMBRE);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(CARPETA_NOMBRE);
}

function urlApp_() {
  try { return ScriptApp.getService().getUrl(); } catch (err) { return ''; }
}

// ---------------------------------------------------------------------
// LECTURA DE LOS SHEETS EXTERNOS
// ---------------------------------------------------------------------

/** Caché de una sola ejecución: el maestro se lee una vez por petición. */
var _maestro = null;

/** Devuelve { MATRICULANORMALIZADA: {marca, modelo, anio, km} }. */
function maestro_() {
  if (_maestro) return _maestro;
  if (!MAESTRO_ID) {
    throw new Error('Falta MAESTRO_ID en la configuración de Code.gs.');
  }
  const ss = SpreadsheetApp.openById(MAESTRO_ID);
  const hoja = MAESTRO_HOJA ? ss.getSheetByName(MAESTRO_HOJA) : ss.getSheets()[0];
  if (!hoja) {
    throw new Error('No existe la pestaña "' + MAESTRO_HOJA + '" en el maestro de motos.');
  }
  const datos = hoja.getDataRange().getValues();
  if (datos.length < 2) { _maestro = {}; return _maestro; }

  const cols = mapearColumnas_(datos[0], COLS_MAESTRO);
  if (cols.matricula === -1) {
    throw new Error(
      'En el maestro no encuentro la columna de matrícula. Encabezados leídos: ' +
      datos[0].join(' | ') + '. Añade el nombre correcto a COLS_MAESTRO.matricula.'
    );
  }

  const mapa = {};
  for (var i = 1; i < datos.length; i++) {
    const f = datos[i];
    const clave = normalizarMatricula_(f[cols.matricula]);
    if (!clave) continue;
    mapa[clave] = {
      marca:  cols.marca  === -1 ? '' : String(f[cols.marca]  || '').trim(),
      modelo: cols.modelo === -1 ? '' : String(f[cols.modelo] || '').trim(),
      anio:   cols.anio   === -1 ? '' : textoAnio_(f[cols.anio]),
      km:     cols.km     === -1 ? '' : textoKm_(f[cols.km])
    };
  }
  _maestro = mapa;
  return mapa;
}

function textoAnio_(v) {
  if (v instanceof Date && !isNaN(v)) return String(v.getFullYear());
  const s = String(v == null ? '' : v).trim();
  const m = s.match(/(19|20)\d{2}/);
  return m ? m[0] : s;
}

function textoKm_(v) {
  if (v === '' || v == null) return '';
  const n = Number(String(v).replace(/[^\d]/g, ''));
  if (!n || isNaN(n)) return String(v).trim();
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Sólo se descarta un mecánico si la columna "Activo" dice explícitamente
 * que no lo está. Una celda vacía cuenta como activo, para que nadie
 * desaparezca del desplegable por un hueco en la hoja.
 */
function esBaja_(v) {
  const s = norm_(v);
  return s === 'no' || s === 'false' || s === '0' || s === 'baja' || s === 'inactivo';
}

/** Devuelve [{nombre, sede}] de los mecánicos en activo, ordenados. */
function mecanicos_() {
  if (!MECANICOS_ID) {
    throw new Error('Falta MECANICOS_ID en la configuración de Code.gs.');
  }
  const ss = SpreadsheetApp.openById(MECANICOS_ID);
  const hoja = MECANICOS_HOJA ? ss.getSheetByName(MECANICOS_HOJA) : ss.getSheets()[0];
  if (!hoja) {
    throw new Error('No existe la pestaña "' + MECANICOS_HOJA + '" en la hoja de mecánicos.');
  }
  const datos = hoja.getDataRange().getValues();
  if (datos.length < 2) return [];

  const cols = mapearColumnas_(datos[0], COLS_MECANICOS);
  const iNombre = cols.nombre === -1 ? 0 : cols.nombre;

  const vistos = {};
  const lista = [];
  for (var i = 1; i < datos.length; i++) {
    const f = datos[i];
    const nombre = String(f[iNombre] || '').trim();
    if (!nombre) continue;
    if (cols.activo !== -1 && esBaja_(f[cols.activo])) continue;
    const clave = norm_(nombre);
    if (vistos[clave]) continue;
    vistos[clave] = true;
    lista.push({
      nombre: nombre,
      sede: cols.sede === -1 ? '' : String(f[cols.sede] || '').trim()
    });
  }
  lista.sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); });
  return lista;
}

// ---------------------------------------------------------------------
// HOJA DE PARTES
// ---------------------------------------------------------------------

function hojaPartes_() {
  const ss = libro_();
  var h = ss.getSheetByName(HOJA_PARTES);
  if (!h) {
    h = ss.insertSheet(HOJA_PARTES);
    h.getRange(1, 1, 1, CABECERA_PARTES.length).setValues([CABECERA_PARTES]);
    h.setFrozenRows(1);
  }
  return h;
}

/** Lee todos los partes ya tipados. Se usa en listados, PDF y métricas. */
function filasPartes_() {
  const datos = hojaPartes_().getDataRange().getValues();
  const salida = [];
  for (var i = 1; i < datos.length; i++) {
    const f = datos[i];
    if (!String(f[0] || '').trim()) continue;
    const revisiones = String(f[10] || '')
      .split('\n')
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s; });
    salida.push({
      id: String(f[0]).trim(),
      timestamp: aFecha_(f[1]) || new Date(0),
      fecha: aFecha_(f[2]) || aFecha_(f[1]) || new Date(0),
      matricula: normalizarMatricula_(f[3]),
      marca: String(f[4] || '').trim(),
      modelo: String(f[5] || '').trim(),
      anio: String(f[6] || '').trim(),
      sede: String(f[7] || '').trim(),
      mecanico: String(f[8] || '').trim(),
      estado: String(f[9] || '').trim(),
      revisiones: revisiones,
      nRevisiones: Number(f[11]) || revisiones.length,
      urlFoto: String(f[12] || '').trim()
    });
  }
  return salida;
}

/** Ordena de la más reciente a la más antigua (fecha de trabajo, luego alta). */
function ordenarRecientes_(a, b) {
  const d = b.fecha.getTime() - a.fecha.getTime();
  return d !== 0 ? d : b.timestamp.getTime() - a.timestamp.getTime();
}

// ---------------------------------------------------------------------
// PUNTOS DE ENTRADA WEB
// ---------------------------------------------------------------------

function doGet(e) {
  const p = (e && e.parameter) || {};
  const vista = norm_(p.v);
  const archivo = (vista === 'equipo' || vista === 'estado') ? 'Equipo' : 'Index';
  const t = HtmlService.createTemplateFromFile(archivo);
  // Sólo letras, números y espacios: el valor se imprime dentro del <script>
  // de la plantilla y no debe poder cerrar la etiqueta.
  t.matriculaInicial = String(p.m || '').replace(/[^A-Za-z0-9 ]/g, '').slice(0, 20);
  t.urlBase = urlApp_();
  return t.evaluate()
    .setTitle('Revisiones de Taller · Motick')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(nombre) {
  return HtmlService.createHtmlOutputFromFile(nombre).getContent();
}

/** Datos que necesita el formulario al abrirse. */
function obtenerConfiguracionInicial() {
  try {
    return {
      ok: true,
      mecanicos: mecanicos_(),
      sedes: SEDES,
      estados: ESTADOS,
      hoy: fechaISO_(new Date()),
      urlEquipo: urlApp_() + '?v=equipo'
    };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

/**
 * Consulta una matrícula: si está en el maestro devuelve marca, modelo,
 * año y km; y en cualquier caso avisa de si esa moto ya tiene partes.
 */
function consultarMatricula(matricula) {
  try {
    const clave = normalizarMatricula_(matricula);
    if (!clave) return { ok: false, error: 'Matrícula vacía.' };

    const m = maestro_()[clave] || null;

    const suyos = filasPartes_()
      .filter(function (p) { return p.matricula === clave; })
      .sort(ordenarRecientes_);

    const previo = suyos.length ? {
      n: suyos.length,
      fecha: fechaCorta_(suyos[0].fecha),
      mecanico: suyos[0].mecanico,
      sede: suyos[0].sede,
      estado: suyos[0].estado
    } : null;

    return {
      ok: true,
      matricula: formatearMatricula_(clave),
      enMaestro: !!m,
      marca:  m ? m.marca  : '',
      modelo: m ? m.modelo : '',
      anio:   m ? m.anio   : '',
      km:     m ? m.km     : '',
      previo: previo
    };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

// ---------------------------------------------------------------------
// GUARDAR UN PARTE
// ---------------------------------------------------------------------

/**
 * Registra el parte y sube la foto a Drive. La foto llega desde el móvil
 * ya en base64 dentro de d.foto = {nombre, tipo, datos}.
 */
function guardarParte(d) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (err) {
    return { ok: false, error: 'El sistema está ocupado. Vuelve a intentarlo en unos segundos.' };
  }
  try {
    d = d || {};
    const clave = normalizarMatricula_(d.matricula);
    if (!clave) throw new Error('Falta la matrícula.');
    if (!String(d.mecanico || '').trim()) throw new Error('Falta el mecánico.');
    if (SEDES.indexOf(d.sede) === -1) throw new Error('Elige una sede válida.');
    if (!String(d.modelo || '').trim()) throw new Error('El modelo es obligatorio.');
    if (ESTADOS.indexOf(d.estado) === -1) throw new Error('Elige un estado válido.');

    const revisiones = (d.revisiones || [])
      .map(function (s) { return String(s || '').trim(); })
      .filter(function (s) { return s; });
    if (!revisiones.length) throw new Error('Añade al menos una revisión.');

    if (!d.foto || !d.foto.datos) throw new Error('Adjunta la foto de la moto.');

    const fecha = aFecha_(d.fecha) || new Date();
    const id = 'P' + Utilities.formatDate(new Date(), zonaHoraria_(), 'yyyyMMdd-HHmmss') +
               '-' + Math.floor(Math.random() * 900 + 100);

    const urlFoto = guardarFoto_(d.foto, clave, d.estado, fecha);
    const m = maestro_()[clave] || null;

    hojaPartes_().appendRow([
      id,
      new Date(),
      fecha,
      formatearMatricula_(clave),
      String(d.marca || '').trim(),
      String(d.modelo || '').trim(),
      m ? m.anio : '',
      d.sede,
      String(d.mecanico).trim(),
      d.estado,
      revisiones.join('\n'),
      revisiones.length,
      urlFoto
    ]);

    // Si fallan las métricas no se pierde el parte: se recalculan luego.
    try { actualizarProductividad(); } catch (err) { console.error(err); }

    return {
      ok: true,
      id: id,
      matricula: formatearMatricula_(clave),
      urlEquipo: urlApp_() + '?v=equipo&m=' + encodeURIComponent(formatearMatricula_(clave))
    };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Guarda la foto como "7083 MGF - Revisión Taller - Completado - 2026-08-13.jpg".
 * Si ya existe una con ese nombre se numera, nunca se pisa la anterior.
 */
function guardarFoto_(foto, clave, estado, fecha) {
  const carpeta = carpetaFotos_();
  const base = formatearMatricula_(clave) + ' - Revisión Taller - ' + estado +
               ' - ' + fechaISO_(fecha);
  const ext = extensionDe_(foto.tipo, foto.nombre);
  const nombre = nombreLibre_(carpeta, base, ext);
  const blob = Utilities.newBlob(
    Utilities.base64Decode(foto.datos),
    foto.tipo || 'image/jpeg',
    nombre
  );
  return carpeta.createFile(blob).getUrl();
}

function nombreLibre_(carpeta, base, ext) {
  var nombre = base + ext;
  var n = 2;
  while (carpeta.getFilesByName(nombre).hasNext() && n <= 60) {
    nombre = base + ' (' + n + ')' + ext;
    n++;
  }
  return nombre;
}

function extensionDe_(tipo, nombre) {
  const t = String(tipo || '').toLowerCase();
  if (t.indexOf('png') !== -1) return '.png';
  if (t.indexOf('webp') !== -1) return '.webp';
  if (t.indexOf('heic') !== -1 || t.indexOf('heif') !== -1) return '.heic';
  const m = String(nombre || '').match(/(\.[a-z0-9]{2,5})$/i);
  return m ? m[1].toLowerCase() : '.jpg';
}

// ---------------------------------------------------------------------
// VISTA DE EQUIPO
// ---------------------------------------------------------------------

/**
 * Listado completo para la vista de estado de motos, de la más reciente a
 * la más antigua. Marca, modelo, año y km se refrescan contra el maestro
 * en cada consulta: son datos de la moto, no del trabajo de aquel día.
 */
function listarPartes() {
  try {
    var mm = {};
    var avisoMaestro = '';
    try {
      mm = maestro_();
    } catch (err) {
      avisoMaestro = String(err && err.message ? err.message : err);
    }

    const filas = filasPartes_().sort(ordenarRecientes_).map(function (p) {
      const m = mm[p.matricula] || null;
      return {
        id: p.id,
        fecha: fechaCorta_(p.fecha),
        matricula: formatearMatricula_(p.matricula),
        marca:  (m && m.marca)  || p.marca  || SIN_MAESTRO,
        modelo: (m && m.modelo) || p.modelo || SIN_MAESTRO,
        anio:   (m && m.anio)   || p.anio   || SIN_MAESTRO,
        km:     (m && m.km)     || SIN_MAESTRO,
        estado: p.estado,
        sede: p.sede,
        mecanico: p.mecanico,
        nRevisiones: p.nRevisiones,
        revisiones: p.revisiones,
        urlFoto: p.urlFoto
      };
    });

    return { ok: true, filas: filas, aviso: avisoMaestro, urlForm: urlApp_() };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

// ---------------------------------------------------------------------
// HOJA DE TALLER (PDF)
// ---------------------------------------------------------------------

function idDeUrlDrive_(url) {
  const m = String(url || '').match(/[-\w]{25,}/);
  return m ? m[0] : '';
}

/** Trae la foto de Drive como data URI para incrustarla en el PDF. */
function imagenDataUri_(url) {
  try {
    const id = idDeUrlDrive_(url);
    if (!id) return '';
    const archivo = DriveApp.getFileById(id);
    var blob = null;
    try {
      // Las fotos de móvil pesan bastante; por encima de ~2,5 MB se usa la
      // miniatura de Drive para que la conversión a PDF no se atragante.
      if (archivo.getSize() > 2500000) blob = archivo.getThumbnail();
    } catch (err) {
      blob = null;
    }
    if (!blob) blob = archivo.getBlob();
    const tipo = blob.getContentType() || 'image/jpeg';
    if (tipo.indexOf('image/') !== 0) return '';
    return 'data:' + tipo + ';base64,' + Utilities.base64Encode(blob.getBytes());
  } catch (err) {
    return '';
  }
}

function logoDataUri_() {
  if (!LOGO_ID) return '';
  try {
    const blob = DriveApp.getFileById(LOGO_ID).getBlob();
    return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
  } catch (err) {
    return '';
  }
}

/** Devuelve el PDF de un parte en base64, para que el navegador lo baje. */
function generarHojaTaller(id) {
  try {
    const parte = filasPartes_().filter(function (p) { return p.id === id; })[0];
    if (!parte) throw new Error('No encuentro el parte ' + id + '.');

    var m = null;
    try { m = maestro_()[parte.matricula] || null; } catch (err) { m = null; }

    const pdf = Utilities
      .newBlob(htmlHojaTaller_(parte, m), MimeType.HTML, 'hoja.html')
      .getAs(MimeType.PDF);

    return {
      ok: true,
      nombre: 'Hoja de taller - ' + formatearMatricula_(parte.matricula) +
              ' - ' + fechaISO_(parte.fecha) + '.pdf',
      base64: Utilities.base64Encode(pdf.getBytes())
    };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

function htmlHojaTaller_(p, m) {
  const logo = logoDataUri_();
  const foto = imagenDataUri_(p.urlFoto);
  const dato = function (v) { return v && String(v).trim() ? esc_(v) : SIN_MAESTRO; };

  const cabecera = logo
    ? '<img class="logo" src="' + logo + '">'
    : '<div class="marca">MOTICK</div>';

  const items = p.revisiones.map(function (r, i) {
    return '<li><span class="n">' + (i + 1) + '</span>' + esc_(r) + '</li>';
  }).join('');

  const bloqueFoto = foto
    ? '<div class="foto"><img src="' + foto + '"></div>'
    : '';

  return '' +
'<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
'  @page { size: A4; margin: 14mm; }' +
'  * { box-sizing: border-box; }' +
'  body { font-family: Helvetica, Arial, sans-serif; color: #1a1f27; font-size: 11pt; margin: 0; }' +
'  .cab { display: table; width: 100%; border-bottom: 2.5pt solid #1f2a37; padding-bottom: 8pt; margin-bottom: 14pt; }' +
'  .cab > div { display: table-cell; vertical-align: middle; }' +
'  .logo { height: 34pt; }' +
'  .marca { font-size: 19pt; font-weight: bold; letter-spacing: 2pt; }' +
'  .tit { text-align: right; }' +
'  .tit h1 { font-size: 14pt; margin: 0; letter-spacing: 1pt; }' +
'  .tit .ref { font-size: 8.5pt; color: #6b7280; margin-top: 3pt; }' +
'  .matricula { font-size: 24pt; font-weight: bold; letter-spacing: 2pt; margin-bottom: 2pt; }' +
'  .submatricula { font-size: 12pt; color: #374151; margin-bottom: 14pt; }' +
'  table.datos { width: 100%; border-collapse: collapse; margin-bottom: 16pt; }' +
'  table.datos td { border: 0.6pt solid #d5d9e0; padding: 6pt 8pt; width: 25%; vertical-align: top; }' +
'  table.datos .et { font-size: 7.5pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.6pt; display: block; margin-bottom: 2pt; }' +
'  table.datos .vl { font-size: 11pt; font-weight: bold; }' +
'  h2 { font-size: 10pt; text-transform: uppercase; letter-spacing: 1pt; color: #1f2a37; border-bottom: 1pt solid #d5d9e0; padding-bottom: 4pt; margin: 0 0 8pt; }' +
'  ol.rev { list-style: none; margin: 0 0 16pt; padding: 0; }' +
'  ol.rev li { padding: 4.5pt 0 4.5pt 22pt; border-bottom: 0.5pt dotted #d5d9e0; position: relative; }' +
'  ol.rev .n { position: absolute; left: 0; color: #6b7280; font-size: 8.5pt; font-weight: bold; }' +
'  .estado { display: inline-block; padding: 3pt 10pt; border: 1pt solid #1f2a37; border-radius: 3pt; font-weight: bold; font-size: 10pt; }' +
'  .foto { margin-bottom: 16pt; }' +
'  .foto img { max-width: 100%; max-height: 260pt; border: 0.6pt solid #d5d9e0; }' +
'  .firma { margin-top: 26pt; width: 47%; border-top: 0.7pt solid #9ca3af; padding-top: 5pt; font-size: 9pt; }' +
'  .pie { margin-top: 20pt; border-top: 0.5pt solid #d5d9e0; padding-top: 6pt; font-size: 7.5pt; color: #9ca3af; }' +
'</style></head><body>' +
'<div class="cab"><div>' + cabecera + '</div>' +
'  <div class="tit"><h1>HOJA DE TALLER</h1>' +
'    <div class="ref">Ref. ' + esc_(p.id) + '</div></div></div>' +
'<div class="matricula">' + esc_(formatearMatricula_(p.matricula)) + '</div>' +
'<div class="submatricula">' +
   dato((m && m.marca) || p.marca) + ' &nbsp;·&nbsp; ' +
   dato((m && m.modelo) || p.modelo) + '</div>' +
'<table class="datos"><tr>' +
'  <td><span class="et">Fecha término</span><span class="vl">' + esc_(fechaCorta_(p.fecha)) + '</span></td>' +
'  <td><span class="et">Sede</span><span class="vl">' + dato(p.sede) + '</span></td>' +
'  <td><span class="et">Año</span><span class="vl">' + dato((m && m.anio) || p.anio) + '</span></td>' +
'  <td><span class="et">Kilómetros</span><span class="vl">' + dato(m && m.km) + '</span></td>' +
'</tr><tr>' +
'  <td colspan="2"><span class="et">Mecánico responsable</span><span class="vl">' + dato(p.mecanico) + '</span></td>' +
'  <td colspan="2"><span class="et">Estado</span><span class="estado">' + esc_(p.estado) + '</span></td>' +
'</tr></table>' +
'<h2>Revisiones efectuadas &nbsp;(' + p.revisiones.length + ')</h2>' +
'<ol class="rev">' + items + '</ol>' +
(bloqueFoto ? '<h2>Fotografía</h2>' + bloqueFoto : '') +
'<div class="firma">Firma del mecánico &nbsp;—&nbsp; ' + dato(p.mecanico) + '</div>' +
'<div class="pie">Documento generado automáticamente el ' +
   esc_(Utilities.formatDate(new Date(), zonaHoraria_(), "dd/MM/yyyy 'a las' HH:mm")) +
   ' · Revisiones de Taller · Motick</div>' +
'</body></html>';
}

// ---------------------------------------------------------------------
// PRODUCTIVIDAD
// ---------------------------------------------------------------------

/** Lunes de la semana de esa fecha, a las 00:00. */
function lunesDe_(d) {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dia = (t.getDay() + 6) % 7;
  t.setDate(t.getDate() - dia);
  return t;
}

function etiquetaSemana_(lunes) {
  const domingo = new Date(lunes.getTime());
  domingo.setDate(domingo.getDate() + 6);
  return Utilities.formatDate(lunes, zonaHoraria_(), 'dd/MM') + ' - ' +
         Utilities.formatDate(domingo, zonaHoraria_(), 'dd/MM/yyyy');
}

/**
 * Rehace la pestaña de indicadores. Se llama tras cada parte, y también
 * se puede lanzar a mano desde el editor si hiciera falta.
 */
function actualizarProductividad() {
  const ss = libro_();
  var h = ss.getSheetByName(HOJA_PRODUCTIVIDAD);
  if (!h) h = ss.insertSheet(HOJA_PRODUCTIVIDAD);
  h.clear();

  const partes = filasPartes_();
  const hoy = new Date();
  const hoyISO = fechaISO_(hoy);
  const lunesEsta = lunesDe_(hoy);
  const lunesPasada = new Date(lunesEsta.getTime());
  lunesPasada.setDate(lunesPasada.getDate() - 7);
  const hace30 = new Date(hoy.getTime() - 30 * 24 * 3600 * 1000);

  // --- Bloque 1: motos por mecánico -----------------------------------
  const porMec = {};
  partes.forEach(function (p) {
    const k = p.mecanico || '(sin asignar)';
    if (!porMec[k]) {
      porMec[k] = { hoy: 0, semana: 0, pasada: 0, dias30: 0, total: 0, revisiones: 0 };
    }
    const r = porMec[k];
    r.total++;
    r.revisiones += p.nRevisiones;
    if (fechaISO_(p.fecha) === hoyISO) r.hoy++;
    if (p.fecha >= lunesEsta) r.semana++;
    else if (p.fecha >= lunesPasada) r.pasada++;
    if (p.fecha >= hace30) r.dias30++;
  });

  const mecs = Object.keys(porMec).sort(function (a, b) {
    return porMec[b].total - porMec[a].total || a.localeCompare(b, 'es');
  });

  const salida = [];
  salida.push(['MOTOS POR MECÁNICO', '', '', '', '', '']);
  salida.push(['Mecánico', 'Hoy', 'Esta semana', 'Semana pasada', 'Últimos 30 días', 'Total']);
  if (!mecs.length) salida.push(['(todavía no hay partes)', '', '', '', '', '']);
  mecs.forEach(function (k) {
    const r = porMec[k];
    salida.push([k, r.hoy, r.semana, r.pasada, r.dias30, r.total]);
  });

  // --- Bloque 2: motos por sede y semana ------------------------------
  salida.push(['', '', '', '', '', '']);
  salida.push(['MOTOS POR SEDE Y SEMANA', '', '', '', '', '']);
  salida.push(['Semana'].concat(SEDES).concat(['Total']));

  const porSemana = {};
  partes.forEach(function (p) {
    const clave = fechaISO_(lunesDe_(p.fecha));
    if (!porSemana[clave]) porSemana[clave] = {};
    const s = SEDES.indexOf(p.sede) !== -1 ? p.sede : 'Otras';
    porSemana[clave][s] = (porSemana[clave][s] || 0) + 1;
  });

  const semanas = Object.keys(porSemana).sort().reverse().slice(0, 10);
  if (!semanas.length) {
    salida.push(['(todavía no hay partes)'].concat(SEDES.map(function () { return ''; })).concat(['']));
  }
  semanas.forEach(function (clave) {
    const partesSem = porSemana[clave];
    const fila = [etiquetaSemana_(aFecha_(clave))];
    var total = 0;
    SEDES.forEach(function (s) {
      const n = partesSem[s] || 0;
      total += n;
      fila.push(n);
    });
    total += partesSem['Otras'] || 0;
    fila.push(total);
    salida.push(fila);
  });

  // --- Bloque 3: promedio de revisiones por mecánico -------------------
  salida.push(['', '', '', '', '', '']);
  salida.push(['PROMEDIO DE REVISIONES POR MECÁNICO', '', '', '', '', '']);
  salida.push(['Mecánico', 'Partes', 'Revisiones totales', 'Promedio por moto', '', '']);
  if (!mecs.length) salida.push(['(todavía no hay partes)', '', '', '', '', '']);
  mecs.forEach(function (k) {
    const r = porMec[k];
    const media = r.total ? Math.round((r.revisiones / r.total) * 10) / 10 : 0;
    salida.push([k, r.total, r.revisiones, media, '', '']);
  });

  h.getRange(1, 1, salida.length, 6).setValues(salida);

  // Formato de los tres encabezados de bloque y de sus filas de columnas.
  salida.forEach(function (fila, i) {
    const texto = String(fila[0] || '');
    const esTitulo = texto === texto.toUpperCase() && texto.length > 8 &&
                     texto.indexOf('(') === -1;
    if (esTitulo) {
      h.getRange(i + 1, 1, 1, 6).merge()
        .setFontWeight('bold').setFontColor('#ffffff').setBackground('#1f2a37');
    } else if (['Mecánico', 'Semana'].indexOf(texto) !== -1) {
      h.getRange(i + 1, 1, 1, 6).setFontWeight('bold').setBackground('#eef1f5');
    }
  });

  h.setColumnWidth(1, 220);
  for (var c = 2; c <= 6; c++) h.setColumnWidth(c, 130);
  h.getRange(1, 1, salida.length, 6).setVerticalAlignment('middle');

  const marca = h.getRange(salida.length + 2, 1);
  marca.setValue('Actualizado el ' +
    Utilities.formatDate(new Date(), zonaHoraria_(), "dd/MM/yyyy 'a las' HH:mm"));
  marca.setFontColor('#9ca3af').setFontSize(9);

  return 'Indicadores actualizados.';
}

// ---------------------------------------------------------------------
// PUESTA EN MARCHA Y DIAGNÓSTICO
// ---------------------------------------------------------------------

/** Crea las dos pestañas con su formato. Ejecutar una vez tras instalar. */
function prepararHojas() {
  const ss = libro_();
  var h = ss.getSheetByName(HOJA_PARTES);
  if (!h) h = ss.insertSheet(HOJA_PARTES);
  if (h.getLastRow() === 0) {
    h.getRange(1, 1, 1, CABECERA_PARTES.length).setValues([CABECERA_PARTES]);
  }
  h.getRange(1, 1, 1, CABECERA_PARTES.length)
    .setFontWeight('bold').setBackground('#1f2a37').setFontColor('#ffffff');
  h.setFrozenRows(1);
  const anchos = [150, 145, 105, 100, 110, 150, 60, 100, 160, 120, 420, 95, 230];
  anchos.forEach(function (w, i) { h.setColumnWidth(i + 1, w); });
  h.getRange(2, 11, Math.max(h.getMaxRows() - 1, 1), 1).setWrap(true);

  actualizarProductividad();
  return 'Hojas "' + HOJA_PARTES + '" y "' + HOJA_PRODUCTIVIDAD + '" listas.';
}

/**
 * Comprueba la configuración y escribe el resultado en el registro.
 * Ejecutar desde el editor cuando algo no cuadre.
 */
function diagnostico() {
  const lineas = [];
  const url = urlApp_();
  lineas.push('URL del formulario : ' + (url || '(sin desplegar todavía)'));
  lineas.push('URL vista equipo   : ' + (url ? url + '?v=equipo' : '-'));

  try {
    lineas.push('Hoja de partes     : OK -> ' + libro_().getName());
  } catch (err) {
    lineas.push('Hoja de partes     : ERROR -> ' + err.message);
  }

  try {
    const m = maestro_();
    const n = Object.keys(m).length;
    lineas.push('Maestro de motos   : OK -> ' + n + ' matrículas');
    const ejemplo = Object.keys(m)[0];
    if (ejemplo) {
      lineas.push('   ejemplo ' + formatearMatricula_(ejemplo) + ' -> ' +
        JSON.stringify(m[ejemplo]));
    }
  } catch (err) {
    lineas.push('Maestro de motos   : ERROR -> ' + err.message);
  }

  try {
    const l = mecanicos_();
    lineas.push('Mecánicos activos  : OK -> ' + l.length + ' (' +
      l.slice(0, 5).map(function (x) { return x.nombre; }).join(', ') + ')');
  } catch (err) {
    lineas.push('Mecánicos activos  : ERROR -> ' + err.message);
  }

  try {
    lineas.push('Carpeta de fotos   : OK -> ' + carpetaFotos_().getName());
  } catch (err) {
    lineas.push('Carpeta de fotos   : ERROR -> ' + err.message);
  }

  const texto = lineas.join('\n');
  console.log(texto);
  return texto;
}
