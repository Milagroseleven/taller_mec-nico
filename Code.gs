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
const HOJA_ID = '1o0VjHtR1lhE21j-mLR9vP42K5GrimD0-6A7VjvTbxAs';

/** Maestro de motos: de aquí salen marca, modelo, año y km. OBLIGATORIO. */
const MAESTRO_ID = '1L7veBgiS4b9v7WpiVrRvCCUtnBrBIwJRzxV-pb52ZCs';
/** Pestaña del maestro. Vacío = la primera. */
const MAESTRO_HOJA = 'Maestro';

/** Lista de mecánicos activos. OBLIGATORIO. */
const MECANICOS_ID = '1L7veBgiS4b9v7WpiVrRvCCUtnBrBIwJRzxV-pb52ZCs';
/** Pestaña de mecánicos. Vacío = la primera. */
const MECANICOS_HOJA = 'Vacaciones';

/** Carpeta de Drive para las fotos. Vacío = se crea con el nombre de abajo. */
const CARPETA_ID = '15p5wiMufVIDIkB4JhzDD4ZZrL2xxCOVa';
const CARPETA_NOMBRE = 'Revisiones Taller - Fotos';

/** Logo PNG para la cabecera del PDF. Vacío = se imprime el nombre en texto. */
const LOGO_ID = '';

const SEDES = ['Barcelona', 'Madrid', 'Sevilla', 'Valencia'];
const ESTADOS = ['Pendiente', 'Completado', 'Incidencia', 'Mantenimiento'];

const HOJA_PARTES = 'Partes';
const HOJA_PRODUCTIVIDAD = 'Productividad';

/**
 * Separador de argumentos de las fórmulas: ',' o ';'. Vacío = se deduce de
 * la configuración regional del libro, que es lo normal. La hoja está en
 * es_ES, donde toca ';'.
 */
const SEPARADOR_FORMULAS = '';

/**
 * Nombres aceptados para cada columna de los Sheets externos. Se comparan
 * sin acentos ni mayúsculas, así que no hace falta que coincidan exacto.
 *
 * Ninguna de las dos hojas tiene los encabezados en la primera fila: en el
 * maestro están en la 4 y en Vacaciones en la 5, con títulos y bloques por
 * encima. Por eso la fila de encabezados se busca, no se da por hecha.
 */
const COLS_MAESTRO = {
  matricula: ['matricula', 'matriculas', 'placa', 'plate', 'matricula moto'],
  marca:     ['marca', 'brand', 'fabricante'],
  modelo:    ['modelo', 'model', 'modelo moto'],
  anio:      ['fecha de matriculacion', 'fecha matriculacion', 'ano matriculacion',
              'ano', 'anio', 'year'],
  km:        ['kms', 'km', 'kilometros', 'kilometraje', 'km actuales']
};

const COLS_MECANICOS = {
  nombre:  ['nombres', 'nombre', 'nombre y apellidos', 'trabajador', 'empleado'],
  subarea: ['sub area', 'subarea', 'area', 'departamento', 'seccion', 'equipo'],
  puesto:  ['puesto', 'cargo', 'categoria', 'funcion'],
  sede:    ['sede', 'centro', 'delegacion', 'ciudad', 'oficina']
};

/** Valor de "Sub área" que identifica a la gente de taller. */
const SUBAREA_TALLER = 'taller';

/**
 * Puestos que quedan fuera del desplegable aunque su sub área sea Taller:
 * sólo firman partes quienes hacen la revisión con sus manos.
 */
const PUESTOS_EXCLUIDOS = ['supervisor', 'auxiliar'];

const CABECERA_PARTES = [
  'ID', 'Timestamp', 'Fecha revisión', 'Hora inicio', 'Hora fin', 'Matrícula',
  'Marca', 'Modelo', 'Año', 'Sede', 'Mecánico', 'Estado', 'Revisiones',
  'Nº revisiones', 'URL foto'
];

/** Posición de cada campo en la fila, para no contar índices a mano. */
const P = {
  id: 0, timestamp: 1, fecha: 2, horaInicio: 3, horaFin: 4, matricula: 5,
  marca: 6, modelo: 7, anio: 8, sede: 9, mecanico: 10, estado: 11,
  revisiones: 12, nRevisiones: 13, urlFoto: 14
};

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
/**
 * Busca la fila de encabezados de una hoja: la primera de las `limite`
 * primeras en la que se reconozca la columna `obligatoria`. Ninguna de
 * las dos hojas que usamos tiene los encabezados en la fila 1.
 *
 * Devuelve { fila, cols } o null si no aparece.
 */
function buscarEncabezados_(datos, alias, obligatoria, limite) {
  const tope = Math.min(datos.length, limite || 20);
  for (var i = 0; i < tope; i++) {
    const cols = mapearColumnas_(datos[i], alias);
    if (cols[obligatoria] !== -1) return { fila: i, cols: cols };
  }
  return null;
}

/** Caché de una sola ejecución: el maestro se lee una vez por petición. */
var _maestro = null;
var _hojaMaestro = null;

/** Seis horas: el maestro cambia poco y un fallo de caché se resuelve solo. */
const CACHE_SEGUNDOS = 21600;

function hojaMaestro_() {
  if (_hojaMaestro) return _hojaMaestro;
  if (!MAESTRO_ID) {
    throw new Error('Falta MAESTRO_ID en la configuración de Code.gs.');
  }
  const ss = SpreadsheetApp.openById(MAESTRO_ID);
  const hoja = MAESTRO_HOJA ? ss.getSheetByName(MAESTRO_HOJA) : ss.getSheets()[0];
  if (!hoja) {
    throw new Error('No existe la pestaña "' + MAESTRO_HOJA + '" en el maestro de motos.');
  }
  _hojaMaestro = hoja;
  return hoja;
}

/** Localiza la fila de encabezados del maestro y mapea sus columnas. */
function encabezadosMaestro_(hoja) {
  const cabeceras = hoja.getRange(1, 1, Math.min(hoja.getLastRow(), 20),
                                  hoja.getLastColumn()).getValues();
  const enc = buscarEncabezados_(cabeceras, COLS_MAESTRO, 'matricula', 20);
  if (!enc) {
    throw new Error(
      'En la pestaña "' + MAESTRO_HOJA + '" no encuentro la fila de encabezados ' +
      'con la columna de matrícula (he mirado las 20 primeras filas).'
    );
  }
  return enc;
}

/**
 * Índice de matrículas del maestro, guardado en caché seis horas.
 *
 * Sólo se cachea la columna de matrículas —unos 40 KB para 5.000 motos, que
 * caben de sobra en el caché de Apps Script—, no la hoja entera. Con eso la
 * consulta que dispara el mecánico al teclear una matrícula no tiene que
 * releer miles de filas: busca en el índice y luego lee una sola fila.
 */
function indiceMaestro_(forzar) {
  const cache = CacheService.getScriptCache();

  if (!forzar) {
    try {
      const meta = cache.get('maestro_meta');
      const claves = cache.get('maestro_claves');
      if (meta && claves) {
        const m = JSON.parse(meta);
        return { primera: m.primera, cols: m.cols, claves: claves.split(',') };
      }
    } catch (err) {
      // Caché ilegible: se relee de la hoja y listo.
    }
  }

  const hoja = hojaMaestro_();
  const enc = encabezadosMaestro_(hoja);
  const primera = enc.fila + 2;                  // +1 por índice, +1 por la cabecera
  const nFilas = hoja.getLastRow() - primera + 1;

  var claves = [];
  if (nFilas > 0) {
    claves = hoja.getRange(primera, enc.cols.matricula + 1, nFilas, 1)
      .getValues()
      .map(function (f) { return normalizarMatricula_(f[0]); });
  }

  try {
    cache.put('maestro_meta',
      JSON.stringify({ primera: primera, cols: enc.cols }), CACHE_SEGUNDOS);
    cache.put('maestro_claves', claves.join(','), CACHE_SEGUNDOS);
  } catch (err) {
    // Si no cabe en el caché se sigue funcionando, sólo que más lento.
    console.warn('No se pudo cachear el índice del maestro: ' + err);
  }

  return { primera: primera, cols: enc.cols, claves: claves };
}

/** Vacía el índice cacheado. Útil tras dar motos de alta en el maestro. */
function limpiarCacheMaestro() {
  CacheService.getScriptCache().removeAll(['maestro_meta', 'maestro_claves']);
  return 'Caché del maestro vaciada.';
}

/**
 * Busca una sola moto. Es lo que se llama al teclear la matrícula, así que
 * lee una única fila en vez de las 5.000 de la hoja.
 */
function motoDeMaestro_(clave) {
  var idx = indiceMaestro_(false);
  var i = idx.claves.indexOf(clave);

  if (i === -1) {
    // Puede ser una moto dada de alta después de cachear el índice, así que
    // se refresca y se vuelve a mirar antes de darla por inexistente.
    idx = indiceMaestro_(true);
    i = idx.claves.indexOf(clave);
    if (i === -1) return null;
  }

  const cols = idx.cols;
  const ancho = Math.max(cols.matricula, cols.marca, cols.modelo,
                         cols.anio, cols.km) + 1;
  const v = hojaMaestro_().getRange(idx.primera + i, 1, 1, ancho).getValues()[0];

  return {
    marca:  cols.marca  === -1 ? '' : String(v[cols.marca]  || '').trim(),
    modelo: cols.modelo === -1 ? '' : String(v[cols.modelo] || '').trim(),
    anio:   cols.anio   === -1 ? '' : textoAnio_(v[cols.anio]),
    km:     cols.km     === -1 ? '' : textoKm_(v[cols.km])
  };
}

/**
 * Devuelve { MATRICULANORMALIZADA: {marca, modelo, anio, km} } con el maestro
 * entero. Sólo lo usa la vista de equipo, que necesita cruzar muchas motos de
 * una vez; para una sola matrícula está `motoDeMaestro_`, mucho más rápido.
 */
function maestro_() {
  if (_maestro) return _maestro;

  const hoja = hojaMaestro_();
  const enc = encabezadosMaestro_(hoja);
  const cols = enc.cols;
  const primera = enc.fila + 2;
  const nFilas = hoja.getLastRow() - primera + 1;
  if (nFilas < 1) { _maestro = {}; return _maestro; }

  // Una lectura por columna útil, en vez de arrastrar las 26 de la hoja.
  function columna(idx) {
    if (idx === -1) return null;
    return hoja.getRange(primera, idx + 1, nFilas, 1).getValues();
  }
  const cMat = columna(cols.matricula);
  const cMar = columna(cols.marca);
  const cMod = columna(cols.modelo);
  const cAno = columna(cols.anio);
  const cKm  = columna(cols.km);

  const mapa = {};
  for (var i = 0; i < nFilas; i++) {
    const clave = normalizarMatricula_(cMat[i][0]);
    if (!clave) continue;
    mapa[clave] = {
      marca:  cMar ? String(cMar[i][0] || '').trim() : '',
      modelo: cMod ? String(cMod[i][0] || '').trim() : '',
      anio:   cAno ? textoAnio_(cAno[i][0]) : '',
      km:     cKm  ? textoKm_(cKm[i][0])    : ''
    };
  }
  _maestro = mapa;
  return mapa;
}

function textoAnio_(v) {
  if (v instanceof Date && !isNaN(v)) return String(v.getFullYear());
  const s = String(v == null ? '' : v).trim();
  const m = s.match(/(19|20)\d{2}/);
  return m ? m[0] : '';
}

function textoKm_(v) {
  if (v === '' || v == null) return '';
  const n = Number(String(v).replace(/[^\d]/g, ''));
  if (!n || isNaN(n)) return '';
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * La hoja guarda la sede abreviada (Mad, Val, Bar, Sev). Se traduce a la
 * forma larga que usan los partes; si no se reconoce se devuelve vacío y
 * el mecánico la elige a mano.
 */
function normalizarSede_(v) {
  const s = norm_(v);
  if (!s) return '';
  if (s.indexOf('bar') === 0 || s === 'bcn') return 'Barcelona';
  if (s.indexOf('mad') === 0) return 'Madrid';
  if (s.indexOf('val') === 0 || s === 'vlc') return 'Valencia';
  if (s.indexOf('sev') === 0 || s === 'svq') return 'Sevilla';
  return '';
}

function esPuestoExcluido_(v) {
  const s = norm_(v);
  return PUESTOS_EXCLUIDOS.some(function (p) { return s.indexOf(p) !== -1; });
}

/** Devuelve [{nombre, sede, puesto}] de la gente de taller, ordenada. */
function mecanicos_() {
  return personalTaller_().lista;
}

/**
 * Los mecánicos no tienen hoja propia: están en la pestaña "Vacaciones",
 * que lista a toda la plantilla con sus encabezados en la fila 5. Lo que
 * identifica al taller no es el rótulo "TALLER" suelto que hay más abajo,
 * sino la columna **Sub área** con el valor "Taller".
 *
 * Devuelve también cómo se ha interpretado la hoja, para `diagnostico()`.
 */
function personalTaller_() {
  if (!MECANICOS_ID) {
    throw new Error('Falta MECANICOS_ID en la configuración de Code.gs.');
  }
  const ss = SpreadsheetApp.openById(MECANICOS_ID);
  const hoja = MECANICOS_HOJA ? ss.getSheetByName(MECANICOS_HOJA) : ss.getSheets()[0];
  if (!hoja) {
    throw new Error('No existe la pestaña "' + MECANICOS_HOJA + '" en ese Sheet.');
  }
  const datos = hoja.getDataRange().getValues();

  const enc = buscarEncabezados_(datos, COLS_MECANICOS, 'nombre', 20);
  if (!enc) {
    throw new Error(
      'En la pestaña "' + MECANICOS_HOJA + '" no encuentro la fila de encabezados ' +
      'con la columna de nombres (he mirado las 20 primeras filas).'
    );
  }
  const cols = enc.cols;
  if (cols.subarea === -1) {
    throw new Error(
      'En la pestaña "' + MECANICOS_HOJA + '" no encuentro la columna "Sub área", ' +
      'que es la que dice quién es de taller.'
    );
  }

  const vistos = {};
  const lista = [];
  const excluidos = [];

  for (var i = enc.fila + 1; i < datos.length; i++) {
    const f = datos[i];
    const nombre = String(f[cols.nombre] == null ? '' : f[cols.nombre]).trim();
    if (!nombre) continue;
    if (norm_(nombre) === 'nombres' || norm_(nombre) === 'nombre') continue;

    if (norm_(f[cols.subarea]) !== SUBAREA_TALLER) continue;

    const puesto = cols.puesto === -1 ? '' : String(f[cols.puesto] || '').trim();
    if (esPuestoExcluido_(puesto)) {
      excluidos.push(nombre + ' — ' + puesto);
      continue;
    }

    const clave = norm_(nombre);
    if (vistos[clave]) continue;
    vistos[clave] = true;

    lista.push({
      nombre: nombre,
      sede: cols.sede === -1 ? '' : normalizarSede_(f[cols.sede]),
      puesto: puesto
    });
  }

  lista.sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); });

  return {
    lista: lista,
    excluidos: excluidos,
    filaCabecera: enc.fila + 1,
    encabezados: datos[enc.fila].filter(function (v) {
      return String(v || '').trim();
    }).join(' | '),
    columnas: cols
  };
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
    if (!String(f[P.id] || '').trim()) continue;
    const revisiones = String(f[P.revisiones] || '')
      .split('\n')
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s; });
    salida.push({
      id: String(f[P.id]).trim(),
      timestamp: aFecha_(f[P.timestamp]) || new Date(0),
      fecha: aFecha_(f[P.fecha]) || aFecha_(f[P.timestamp]) || new Date(0),
      horaInicio: textoHora_(f[P.horaInicio]),
      horaFin: textoHora_(f[P.horaFin]),
      matricula: normalizarMatricula_(f[P.matricula]),
      marca: String(f[P.marca] || '').trim(),
      modelo: String(f[P.modelo] || '').trim(),
      anio: String(f[P.anio] || '').trim(),
      sede: String(f[P.sede] || '').trim(),
      mecanico: String(f[P.mecanico] || '').trim(),
      estado: String(f[P.estado] || '').trim(),
      revisiones: revisiones,
      nRevisiones: Number(f[P.nRevisiones]) || revisiones.length,
      urlFoto: String(f[P.urlFoto] || '').trim()
    });
  }
  return salida;
}

/**
 * Deja una hora en HH:mm. El Sheet devuelve unas veces texto y otras un
 * Date de 1899, según cómo esté formateada la celda.
 */
function textoHora_(v) {
  if (v === '' || v == null) return '';
  if (v instanceof Date && !isNaN(v)) {
    return Utilities.formatDate(v, zonaHoraria_(), 'HH:mm');
  }
  const m = String(v).match(/(\d{1,2}):(\d{2})/);
  if (!m) return '';
  return ('0' + m[1]).slice(-2) + ':' + m[2];
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
 *
 * Se dispara mientras el mecánico teclea, así que va por el índice cacheado
 * y acaba leyendo una sola fila del maestro.
 */
function consultarMatricula(matricula) {
  try {
    const clave = normalizarMatricula_(matricula);
    if (!clave) return { ok: false, error: 'Matrícula vacía.' };

    const m = motoDeMaestro_(clave);

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
 *
 * Aquí sólo pasa lo imprescindible para que el mecánico pueda seguir con la
 * siguiente moto: subir la foto y añadir la fila. El año viene del cliente,
 * que ya lo tiene de la consulta de matrícula, para no releer el maestro; y
 * los indicadores se recalculan aparte, sin hacer esperar a nadie.
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

    const horaInicio = textoHora_(d.horaInicio);
    const horaFin = textoHora_(d.horaFin);
    if (!horaInicio) throw new Error('Indica la hora de inicio.');
    if (!horaFin) throw new Error('Indica la hora de fin.');

    const fecha = aFecha_(d.fecha) || new Date();
    const id = 'P' + Utilities.formatDate(new Date(), zonaHoraria_(), 'yyyyMMdd-HHmmss') +
               '-' + Math.floor(Math.random() * 900 + 100);

    const urlFoto = guardarFoto_(d.foto, clave, d.estado, fecha);

    const fila = [];
    fila[P.id] = id;
    fila[P.timestamp] = new Date();
    fila[P.fecha] = fecha;
    fila[P.horaInicio] = horaInicio;
    fila[P.horaFin] = horaFin;
    fila[P.matricula] = formatearMatricula_(clave);
    fila[P.marca] = String(d.marca || '').trim();
    fila[P.modelo] = String(d.modelo || '').trim();
    fila[P.anio] = String(d.anio || '').trim();
    fila[P.sede] = d.sede;
    fila[P.mecanico] = String(d.mecanico).trim();
    fila[P.estado] = d.estado;
    fila[P.revisiones] = revisiones.join('\n');
    fila[P.nRevisiones] = revisiones.length;
    fila[P.urlFoto] = urlFoto;

    const h = hojaPartes_();
    h.appendRow(fila);

    // La hoja se deja siempre con lo más reciente arriba: la fila entra al
    // final y se reordena por fecha de revisión y, a igualdad, por hora de
    // alta. Es una sola llamada y evita tener que ordenar a mano al mirarla.
    const n = h.getLastRow() - 1;
    if (n > 1) {
      h.getRange(2, 1, n, CABECERA_PARTES.length).sort([
        { column: P.fecha + 1, ascending: false },
        { column: P.timestamp + 1, ascending: false }
      ]);
    }

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
 * Listado para la vista de equipo, **sin tocar el maestro**.
 *
 * El maestro vive en un libro de 68 pestañas con casi 5.000 motos: sólo
 * abrirlo ya tarda varios segundos. Si la tabla lo esperase, el equipo se
 * quedaría mirando un "Cargando…" cada vez que abre la página.
 *
 * Así que aquí se devuelve lo que guarda el propio parte, que se lee al
 * instante, y el cruce con el maestro lo pide la página después, con la
 * tabla ya en pantalla (ver `datosDeMaestro`).
 */
function listarPartes() {
  try {
    const filas = filasPartes_().sort(ordenarRecientes_).map(function (p) {
      return {
        id: p.id,
        fecha: fechaCorta_(p.fecha),
        horario: horario_(p),
        matricula: formatearMatricula_(p.matricula),
        marca:  p.marca  || SIN_MAESTRO,
        modelo: p.modelo || SIN_MAESTRO,
        anio:   p.anio   || SIN_MAESTRO,
        km: '',                      // lo completa datosDeMaestro
        estado: p.estado,
        sede: p.sede,
        mecanico: p.mecanico,
        nRevisiones: p.nRevisiones,
        revisiones: p.revisiones,
        urlFoto: p.urlFoto
      };
    });

    return { ok: true, filas: filas, urlForm: urlApp_() };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

/**
 * Segunda fase de la vista de equipo: marca, modelo, año y km al día para
 * las matrículas que se están viendo.
 *
 * Devuelve sólo las pedidas, no el maestro entero, para que lo que viaja al
 * navegador sea pequeño aunque la hoja tenga miles de motos.
 */
function datosDeMaestro(matriculas) {
  try {
    const pedidas = (matriculas || []).map(normalizarMatricula_)
      .filter(function (m) { return m; });
    if (!pedidas.length) return { ok: true, motos: {} };

    const mm = maestro_();
    const motos = {};
    pedidas.forEach(function (clave) {
      const m = mm[clave];
      if (m) motos[clave] = m;
    });

    return { ok: true, motos: motos };
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

/** "09:30 - 11:00", o sólo una de las dos si falta la otra. */
function horario_(p) {
  if (p.horaInicio && p.horaFin) return p.horaInicio + ' - ' + p.horaFin;
  if (p.horaInicio) return 'desde ' + p.horaInicio;
  if (p.horaFin) return 'hasta ' + p.horaFin;
  return '';
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
'  <td><span class="et">Fecha revisión</span><span class="vl">' + esc_(fechaCorta_(p.fecha)) + '</span></td>' +
'  <td><span class="et">Horario</span><span class="vl">' + esc_(horario_(p)) + '</span></td>' +
'  <td><span class="et">Sede</span><span class="vl">' + dato(p.sede) + '</span></td>' +
'  <td><span class="et">Estado</span><span class="estado">' + esc_(p.estado) + '</span></td>' +
'</tr><tr>' +
'  <td><span class="et">Año</span><span class="vl">' + dato((m && m.anio) || p.anio) + '</span></td>' +
'  <td><span class="et">Kilómetros</span><span class="vl">' + dato(m && m.km) + '</span></td>' +
'  <td colspan="2"><span class="et">Mecánico responsable</span><span class="vl">' + dato(p.mecanico) + '</span></td>' +
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


/**
 * Separador de argumentos que espera la hoja.
 *
 * En español —y en casi toda Europa— las fórmulas se escriben con `;`, no
 * con `,`, y Apps Script **no** lo traduce al escribirlas con setValues: una
 * fórmula con comas se queda en #ERROR!. Se mira la configuración regional
 * del libro y se usa el separador que toque.
 *
 * Si alguna vez fallara, se puede forzar poniendo ',' o ';' en
 * SEPARADOR_FORMULAS, arriba en la configuración.
 */
function separadorFormulas_(ss) {
  if (SEPARADOR_FORMULAS) return SEPARADOR_FORMULAS;
  const loc = norm_(ss.getSpreadsheetLocale()).replace('-', '_');
  // Idiomas que usan la coma como separador de argumentos.
  const conComa = ['en', 'ja', 'ko', 'zh', 'th', 'he', 'iw', 'ms', 'fil'];
  const idioma = loc.split('_')[0];
  return conComa.indexOf(idioma) !== -1 ? ',' : ';';
}

/**
 * Deja la pestaña de indicadores montada **con fórmulas**, no con valores.
 *
 * Antes se recalculaba entera en cada parte, que era lento y dejaba los
 * números viejos en cuanto alguien editaba la hoja a mano. Con fórmulas la
 * pestaña se actualiza sola —también si se corrige un parte— y esta función
 * sólo hace falta ejecutarla una vez, al instalar.
 */
function actualizarProductividad() {
  const ss = libro_();
  var h = ss.getSheetByName(HOJA_PRODUCTIVIDAD);
  if (!h) h = ss.insertSheet(HOJA_PRODUCTIVIDAD);

  // clear() borra contenido y formato pero NO deshace las celdas combinadas,
  // así que hay que separarlas a mano o la segunda ejecución se encuentra con
  // los títulos de bloque de la anterior todavía combinados.
  h.clear();
  h.getRange(1, 1, h.getMaxRows(), h.getMaxColumns()).breakApart();

  const S = separadorFormulas_(ss);

  // Letras de columna de la hoja de partes, para no contarlas a mano.
  const cFecha = letraColumna_(P.fecha);
  const cSede  = letraColumna_(P.sede);
  const cMec   = letraColumna_(P.mecanico);
  const cRev   = letraColumna_(P.nRevisiones);
  const hoja   = "'" + HOJA_PARTES + "'!";

  const colFecha = hoja + cFecha + ':' + cFecha;
  const colSede  = hoja + cSede + ':' + cSede;
  const colMec   = hoja + cMec + ':' + cMec;
  const colRev   = hoja + cRev + ':' + cRev;

  // Lunes de esta semana y de la pasada. WEEKDAY(...;3) da 0 en lunes.
  const lunes = 'TODAY()-WEEKDAY(TODAY()' + S + '3)';
  const lunesPasado = '(' + lunes + ')-7';

  const filas = [];
  const formatos = [];

  function titulo(texto) {
    filas.push([texto, '', '', '', '', '', '', '']);
    formatos.push({ fila: filas.length, tipo: 'titulo' });
  }
  function cabecera(cols) {
    while (cols.length < 8) cols.push('');
    filas.push(cols);
    formatos.push({ fila: filas.length, tipo: 'cabecera' });
  }
  function blanco() { filas.push(['', '', '', '', '', '', '', '']); }

  /** Cuenta partes de una columna igual a `valor`, con filtro de fechas. */
  function cuentaSi(columna, valor, fechas) {
    var f = 'COUNTIFS(' + columna + S + valor;
    (fechas || []).forEach(function (c) { f += S + colFecha + S + c; });
    return f + ')';
  }

  // Criterios de fecha de cada columna. Los partes guardan la fecha a las
  // 00:00, así que para "hoy" basta la igualdad con TODAY().
  const HOY = 0, ESTA_SEMANA = 1, SEMANA_PASADA = 2, DIAS_30 = 3;
  const PERIODOS = [
    ['TODAY()'],
    ['">="&' + lunes],
    ['">="&' + lunesPasado, '"<"&' + lunes],
    ['">="&TODAY()-30']
  ];

  // ------------------------------------------------------------------
  // 1 · Motos por mecánico
  // ------------------------------------------------------------------
  titulo('MOTOS POR MECÁNICO');
  cabecera(['Mecánico', 'Hoy', 'Esta semana', 'Semana pasada',
            'Últimos 30 días', 'Total motos', 'Revisiones', 'Media revisiones']);

  const filaMec = filas.length + 1;

  // La lista de nombres sale sola de los partes ya registrados.
  filas.push([
    '=IFERROR(SORT(UNIQUE(FILTER(' + hoja + cMec + '2:' + cMec + S +
      hoja + cMec + '2:' + cMec + '<>"")))' + S + '"")',
    '', '', '', '', '', '', ''
  ]);

  const HUECO_MEC = 29;
  for (var i = 0; i < HUECO_MEC; i++) blanco();

  for (var r = filaMec; r < filaMec + HUECO_MEC + 1; r++) {
    const mec = '$A' + r;
    const si = function (f) {
      return '=IF($A' + r + '=""' + S + '""' + S + f + ')';
    };
    const cuenta = 'COUNTIF(' + colMec + S + mec + ')';
    const suma = 'SUMIF(' + colMec + S + mec + S + colRev + ')';

    filas[r - 1][1] = si(cuentaSi(colMec, mec, PERIODOS[HOY]));
    filas[r - 1][2] = si(cuentaSi(colMec, mec, PERIODOS[ESTA_SEMANA]));
    filas[r - 1][3] = si(cuentaSi(colMec, mec, PERIODOS[SEMANA_PASADA]));
    filas[r - 1][4] = si(cuentaSi(colMec, mec, PERIODOS[DIAS_30]));
    filas[r - 1][5] = si(cuenta);
    filas[r - 1][6] = si(suma);
    filas[r - 1][7] = si('IFERROR(ROUND(' + suma + '/' + cuenta + S + '1)' + S + '0)');
  }

  // ------------------------------------------------------------------
  // 2 · Motos por sede
  // ------------------------------------------------------------------
  blanco();
  titulo('MOTOS POR SEDE');
  cabecera(['Sede', 'Hoy', 'Esta semana', 'Semana pasada',
            'Últimos 30 días', 'Total motos', '', '']);

  SEDES.forEach(function (sede) {
    const r = filas.length + 1;
    const s = '$A' + r;
    filas.push([
      sede,
      '=' + cuentaSi(colSede, s, PERIODOS[HOY]),
      '=' + cuentaSi(colSede, s, PERIODOS[ESTA_SEMANA]),
      '=' + cuentaSi(colSede, s, PERIODOS[SEMANA_PASADA]),
      '=' + cuentaSi(colSede, s, PERIODOS[DIAS_30]),
      '=COUNTIF(' + colSede + S + s + ')',
      '', ''
    ]);
  });

  // ------------------------------------------------------------------
  // 3 · Totales
  // ------------------------------------------------------------------
  blanco();
  titulo('TOTALES');
  cabecera(['', 'Hoy', 'Esta semana', 'Semana pasada',
            'Últimos 30 días', 'Total motos', 'Revisiones', '']);
  filas.push([
    'Todas las sedes',
    '=COUNTIF(' + colFecha + S + 'TODAY())',
    '=COUNTIF(' + colFecha + S + '">="&' + lunes + ')',
    '=COUNTIFS(' + colFecha + S + '">="&' + lunesPasado + S +
      colFecha + S + '"<"&' + lunes + ')',
    '=COUNTIF(' + colFecha + S + '">="&TODAY()-30)',
    '=COUNTA(' + hoja + 'A2:A)',
    '=SUM(' + colRev + ')',
    ''
  ]);

  h.getRange(1, 1, filas.length, 8).setValues(filas);

  // ------------------------------------------------------------------
  // Formato
  // ------------------------------------------------------------------
  formatos.forEach(function (f) {
    if (f.tipo === 'titulo') {
      h.getRange(f.fila, 1, 1, 8).merge()
        .setFontWeight('bold').setFontColor('#ffffff').setBackground('#1f2a37');
    } else {
      h.getRange(f.fila, 1, 1, 8)
        .setFontWeight('bold').setBackground('#eef1f5');
    }
  });

  h.setColumnWidth(1, 210);
  for (var c = 2; c <= 8; c++) h.setColumnWidth(c, 120);
  h.getRange(1, 1, filas.length, 8).setVerticalAlignment('middle');
  h.getRange(1, 2, filas.length, 7).setHorizontalAlignment('center');

  const nota = h.getRange(filas.length + 2, 1, 1, 8);
  nota.merge().setValue(
    'Esta pestaña se calcula sola con fórmulas sobre la hoja "' + HOJA_PARTES +
    '". No hace falta actualizarla: cambia en cuanto entra o se corrige un parte. ' +
    'La semana empieza en lunes.'
  );
  nota.setFontColor('#9ca3af').setFontSize(9).setWrap(true);

  return 'Indicadores montados con fórmulas (separador "' + S + '").';
}


/** Índice de columna (base 0) a letra de Sheets: 0 -> A, 26 -> AA. */
function letraColumna_(idx) {
  var n = idx + 1;
  var letra = '';
  while (n > 0) {
    var resto = (n - 1) % 26;
    letra = String.fromCharCode(65 + resto) + letra;
    n = Math.floor((n - 1) / 26);
  }
  return letra;
}

// ---------------------------------------------------------------------
// PUESTA EN MARCHA Y DIAGNÓSTICO
// ---------------------------------------------------------------------

/** Crea las dos pestañas con su formato. Ejecutar una vez tras instalar. */
function prepararHojas() {
  const ss = libro_();
  var h = ss.getSheetByName(HOJA_PARTES);
  if (!h) h = ss.insertSheet(HOJA_PARTES);

  // La cabecera se reescribe siempre, no sólo al crearla: así una versión
  // nueva que añada columnas deja la hoja al día con volver a ejecutar esto.
  h.getRange(1, 1, 1, CABECERA_PARTES.length).setValues([CABECERA_PARTES]);
  h.getRange(1, 1, 1, CABECERA_PARTES.length)
    .setFontWeight('bold').setBackground('#1f2a37').setFontColor('#ffffff');
  h.setFrozenRows(1);

  const anchos = [150, 145, 105, 95, 90, 100, 110, 150, 60, 100, 160, 120, 420, 95, 230];
  anchos.forEach(function (w, i) { h.setColumnWidth(i + 1, w); });
  h.getRange(2, P.revisiones + 1, Math.max(h.getMaxRows() - 1, 1), 1).setWrap(true);

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
    const b = personalTaller_();
    lineas.push('Personal de taller : encabezados en fila ' + b.filaCabecera);
    lineas.push('   encabezados leidos : ' + b.encabezados);
    lineas.push('   columnas usadas    : nombre=' + b.columnas.nombre +
      ' subarea=' + b.columnas.subarea +
      ' puesto=' + b.columnas.puesto + ' sede=' + b.columnas.sede +
      '   (-1 = no encontrada)');
    lineas.push('Mecánicos activos  : ' + b.lista.length);
    b.lista.forEach(function (m) {
      lineas.push('   · ' + m.nombre + '  [' + (m.sede || 'SIN SEDE') + ']' +
        (m.puesto ? '  ' + m.puesto : ''));
    });
    if (b.excluidos.length) {
      lineas.push('Excluidos          : ' + b.excluidos.join(', '));
    }
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
