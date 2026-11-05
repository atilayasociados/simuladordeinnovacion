/**
 * Simulador de Innovación — Acceso a datos en Google Sheets.
 */
var HOJAS = {
  Config: ['clave', 'valor', 'descripcion'],
  Simulaciones: ['simId', 'codigo', 'nombre', 'sigla', 'semilla', 'trimestre', 'estado', 'mandato', 'maxIntegrantes', 'registroAbierto', 'creada', 'docenteId', 'acceso'],
  Equipos: ['equipoId', 'simId', 'nombre', 'mandato', 'creado', 'registradoPor', 'claveHash', 'claveSal', 'claveTemporal', 'edicionBloqueada'],
  Integrantes: ['simId', 'equipoId', 'registro', 'apPaterno', 'apMaterno', 'nombres', 'celular', 'pin', 'creado'],
  Decisiones: ['equipoId', 'trimestre', 'estado', 'fecha', 'json', 'enviadoPor'],
  Estados: ['equipoId', 'trimestre', 'partes', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10'],
  Resultados: ['equipoId', 'equipo', 'trimestre', 'ventas', 'utilidadNeta', 'caja', 'cuotaTotal', 'cuotaS1', 'cuotaS2', 'cuotaS3', 'cuotaS4', 'cuotaS5', 'vitalidad', 'intensidad', 'clima', 'madurez', 'motivacion', 'autoeficacia', 'aciertoNoticias', 'gastoInnovacion', 'saldoPresupuesto', 'ventasSinInnovar', 'utilidadSinInnovar', 'productosActivos', 'proyectosActivos', 'simId'],
  Bitacora: ['equipoId', 'trimestre', 'fecha', 'decidimos', 'paso', 'porque', 'principio', 'nota', 'comentario', 'autor'],
  Evaluaciones: ['equipoId', 'trimestre', 'estado', 'fecha', 'json', 'enviadoPor'],
  Parametros: ['clave', 'valor', 'descripcion'],
  Log: ['fecha', 'actor', 'accion', 'detalle'],
  // hojas de acceso (v2.3)
  Docentes: ['docenteId', 'nombre', 'email', 'rol', 'claveHash', 'claveSal', 'claveTemporal', 'pregunta', 'respuestaHash', 'respuestaSal', 'activo', 'creado'],
  Invitaciones: ['invId', 'tokenHash', 'rol', 'pregunta', 'creadoPor', 'creada', 'vence', 'usada', 'usadaPor'],
  Sesiones: ['tokenHash', 'rol', 'datos', 'creada', 'vence'],
  IntentosLogin: ['clave', 'fecha', 'resultado']
};
var CHUNK = 45000;

var SS_CACHE_ = null;
function ss_() {
  // Se abre el libro por su ID: evita el error "No se encontró la hoja 0" cuando la pestaña activa fue eliminada.
  if (!SS_CACHE_) SS_CACHE_ = SpreadsheetApp.openById(SpreadsheetApp.getActive().getId());
  return SS_CACHE_;
}
function sh_(nombre) {
  var s = ss_().getSheetByName(nombre);
  if (!s) throw new Error('Falta la hoja "' + nombre + '". Ejecute la función instalar() desde el editor de Apps Script.');
  return s;
}
function cfgAll_() {
  var s = sh_('Config'), o = {};
  if (s.getLastRow() < 2) return o;
  s.getRange(2, 1, s.getLastRow() - 1, 2).getValues().forEach(function (r) { if (r[0] !== '') o[r[0]] = r[1]; });
  return o;
}
function cfgGet_(k) { return cfgAll_()[k]; }
function cfgSet_(k, v) {
  var s = sh_('Config'), n = s.getLastRow();
  if (n >= 2) {
    var keys = s.getRange(2, 1, n - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) if (keys[i][0] === k) { s.getRange(i + 2, 2).setValue(v); return; }
  }
  s.appendRow([k, v, '']);
}
function rows_(nombre) {
  var s = sh_(nombre), n = s.getLastRow(), c = s.getLastColumn();
  if (n < 2) return [];
  var head = s.getRange(1, 1, 1, c).getValues()[0];
  return s.getRange(2, 1, n - 1, c).getValues().map(function (r, i) {
    var o = { _row: i + 2 }; head.forEach(function (h, j) { o[h] = r[j]; }); return o;
  });
}
function findRow_(nombre, equipoId, t) {
  var s = sh_(nombre), n = s.getLastRow();
  if (n < 2) return -1;
  var v = s.getRange(2, 1, n - 1, 2).getValues();
  for (var i = 0; i < v.length; i++) if (String(v[i][0]) === String(equipoId) && Number(v[i][1]) === Number(t)) return i + 2;
  return -1;
}
function putJson_(nombre, equipoId, t, obj, extra) {
  var s = sh_(nombre), txt = JSON.stringify(obj), row;
  if (nombre === 'Estados') {
    var partes = []; for (var i = 0; i < txt.length; i += CHUNK) partes.push(txt.substr(i, CHUNK));
    if (partes.length > 10) throw new Error('Estado demasiado grande para guardarse.');
    row = [equipoId, t, partes.length].concat(partes);
    while (row.length < 13) row.push('');
  } else {
    row = [equipoId, t, (extra && extra.estado) || '', new Date(), txt, (extra && extra.autor) || ''];
  }
  var r = findRow_(nombre, equipoId, t);
  if (r > 0) s.getRange(r, 1, 1, row.length).setValues([row]);
  else s.appendRow(row);
}
function getJson_(nombre, equipoId, t) {
  var r = findRow_(nombre, equipoId, t);
  if (r < 0) return null;
  var s = sh_(nombre);
  if (nombre === 'Estados') {
    var v = s.getRange(r, 1, 1, 13).getValues()[0], n = Number(v[2]) || 1, txt = '';
    for (var i = 0; i < n; i++) txt += v[3 + i];
    return JSON.parse(txt);
  }
  var row = s.getRange(r, 1, 1, 6).getValues()[0];
  var o = row[4] ? JSON.parse(row[4]) : {};
  o._estado = row[2]; o._fecha = row[3]; o._autor = row[5];
  return o;
}
function deleteRowsWhere_(nombre, pred) {
  var s = sh_(nombre), n = s.getLastRow();
  if (n < 2) return;
  var v = s.getRange(2, 1, n - 1, 2).getValues();
  for (var i = v.length - 1; i >= 0; i--) if (pred(v[i][0], Number(v[i][1]))) s.deleteRow(i + 2);
}
function log_(actor, accion, detalle) {
  try { sh_('Log').appendRow([new Date(), actor, accion, String(detalle || '').slice(0, 500)]); } catch (e) { }
}

/** Actualiza campos de una fila (objeto con _row) según los encabezados de la hoja. */
function updateRow_(nombre, obj) {
  var s = sh_(nombre), head = HOJAS[nombre];
  s.getRange(obj._row, 1, 1, head.length).setValues([head.map(function (h) { return obj[h] === undefined ? '' : obj[h]; })]);
}
function appendObj_(nombre, obj) {
  sh_(nombre).appendRow(HOJAS[nombre].map(function (h) { return obj[h] === undefined ? '' : obj[h]; }));
}
// v2.3: el PIN individual se retiró. La columna "pin" de Integrantes queda vacía; las contraseñas viven en Acceso.gs con hash y sal.
