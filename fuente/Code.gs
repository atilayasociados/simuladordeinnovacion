/**
 * Simulador de Innovación — Servidor (aplicación web y API). v1.1
 * Varias simulaciones por instalación; equipos autorregistrados con el código de la simulación;
 * acceso por equipo (contraseña) y docentes por invitación: ver Acceso.gs (v2.3).
 */
function doGet(e) {
  var t = HtmlService.createTemplateFromFile('Index');
  t.vista = (e && e.parameter && e.parameter.vista === 'docente') ? 'docente' : 'estudiante';
  t.invitacion = (e && e.parameter && e.parameter.invitacion) ? String(e.parameter.invitacion).replace(/[^A-Za-z0-9-]/g, '').slice(0, 60) : '';
  return t.evaluate()
    .setTitle(t.vista === 'docente' ? 'Simulador de Innovación · Docente' : 'Simulador de Innovación')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); // permite insertarla en Google Sites
}
function include(nombre) { return HtmlService.createHtmlOutputFromFile(nombre).getContent(); }

// ---------- sesiones ----------
function newToken_(datos) { return AX_newSession_(datos); }
/** Sesión válida del rol indicado. Exige haber cambiado la contraseña temporal y, en equipos, haber indicado quién usa el simulador. */
function sess_(tok, rol) {
  var s = AX_getSession_(tok);
  if (!s) throw new Error('Tu sesión expiró. Vuelve a ingresar.');
  if (rol && s.rol !== rol) throw new Error('No tienes permiso para esta acción.');
  if (s.tmp) throw new Error('Debes cambiar tu contraseña temporal antes de continuar.');
  if (s.rol === 'equipo' && !s.registro) throw new Error('Indica quién eres para continuar.');
  if (s.rol === 'equipo') {
    var sm = simById_(s.simId);
    if (!sm || !equipoById_(s.equipoId)) throw new Error('Esta simulación ya no está disponible. Consulta a tu docente.');
    if (String(sm.acceso) === 'archivada') throw new Error('Esta simulación fue archivada. Consulta a tu docente.');
  }
  return s;
}

// ---------- simulaciones ----------
function simulaciones_() { return rows_('Simulaciones'); }
function simById_(id) { return simulaciones_().filter(function (s) { return String(s.simId) === String(id); })[0]; }
function simPorCodigo_(codigo) {
  var c = AX_normCod_(codigo); if (!c) return null;
  return simulaciones_().filter(function (s) { return AX_normCod_(s.codigo) === c; })[0];
}
function partida_(simId) {
  var s = simById_(simId); if (!s) throw new Error('Simulación no encontrada.');
  return { simId: s.simId, codigo: s.codigo, nombre: s.nombre, sigla: s.sigla, t: Number(s.trimestre) || 1, estado: s.estado || 'cerrado', semilla: String(s.semilla), mandato: s.mandato, maxIntegrantes: Number(s.maxIntegrantes) || 5, registroAbierto: s.registroAbierto === true || s.registroAbierto === 'TRUE' || s.registroAbierto === 'sí', _row: s._row, _obj: s };
}
function setSim_(simId, cambios) {
  var s = simById_(simId); Object.keys(cambios).forEach(function (k) { s[k] = cambios[k]; }); updateRow_('Simulaciones', s);
}
function nuevoCodigo_() {
  var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', usados = simulaciones_().map(function (s) { return s.codigo; }), c;
  usados = usados.map(AX_normCod_);
  do { c = 'INN-'; for (var i = 0; i < 4; i++) c += abc.charAt(Math.floor(Math.random() * abc.length)); } while (usados.indexOf(AX_normCod_(c)) >= 0);
  return c;
}
function equiposDe_(simId) { return rows_('Equipos').filter(function (e) { return String(e.simId) === String(simId); }); }
function integrantesDe_(simId, equipoId) { return rows_('Integrantes').filter(function (i) { return String(i.simId) === String(simId) && (!equipoId || String(i.equipoId) === String(equipoId)); }); }
function equipoById_(id) { return rows_('Equipos').filter(function (r) { return String(r.equipoId) === String(id); })[0]; }
// ---------- validación de datos personales ----------
function limpiarIntegrante_(x, i) {
  var o = {
    apPaterno: String(x.apPaterno || '').trim().replace(/\s+/g, ' ').toUpperCase(),
    apMaterno: String(x.apMaterno || '').trim().replace(/\s+/g, ' ').toUpperCase(),
    nombres: String(x.nombres || '').trim().replace(/\s+/g, ' ').toUpperCase(),
    registro: String(x.registro || '').replace(/\s/g, ''),
    celular: String(x.celular || '').replace(/[\s-]/g, '')
  };
  var n = 'Integrante ' + (i + 1) + ': ';
  if (!o.apPaterno && !o.apMaterno) throw new Error(n + 'escribe al menos un apellido.');
  if (!o.nombres) throw new Error(n + 'escribe los nombres.');
  if (!/^\d{5,12}$/.test(o.registro)) throw new Error(n + 'el número de registro debe tener solo dígitos (5 a 12).');
  if (o.celular && !/^[67]\d{7}$/.test(o.celular)) throw new Error(n + 'el teléfono (opcional) debe tener 8 dígitos y empezar con 6 o 7.');
  return o;
}
// ---------- mi equipo ----------
function integrantePublico_(i, completo) {
  var o = { registro: i.registro, apPaterno: i.apPaterno, apMaterno: i.apMaterno, nombres: i.nombres, activo: true };
  if (completo) o.celular = i.celular;
  return o;
}
function apiMiEquipo(tok) {
  var ses = sess_(tok, 'equipo'), pa = partida_(ses.simId), eq = equipoById_(ses.equipoId);
  return { equipo: eq.nombre, simulacion: pa.nombre, sigla: pa.sigla, codigo: pa.codigo, maxIntegrantes: pa.maxIntegrantes, puedeAgregar: !AX_bool_(eq.edicionBloqueada), bloqueado: AX_bool_(eq.edicionBloqueada), yo: ses.registro,
    integrantes: integrantesDe_(pa.simId, eq.equipoId).map(function (i) { return integrantePublico_(i, true); }) };
}
// ---------- equipo: simulador vida real (VR.gs) ----------
// El motor anterior fue retirado (17-nov-2026). Las simulaciones creadas con él conservan sus datos
// (respaldo, archivo y eliminación siguen disponibles para el docente), pero ya no se pueden jugar.
var MOTOR_RETIRADO_ = 'Esta simulación usa el motor anterior, que fue retirado. Sus datos se conservan: el docente puede descargar su respaldo. Pide a tu docente el código de una simulación nueva.';
function vrExigir_(pa) { if (!vrEsVR_(pa)) throw new Error(MOTOR_RETIRADO_); }
function apiEstado(tok) {
  var ses = sess_(tok, 'equipo'), pa = partida_(ses.simId);
  vrExigir_(pa);
  return vrApiEstado_(ses, pa, equipoById_(ses.equipoId));
}
function apiGuardar(tok, dec, enviar) {
  var ses = sess_(tok, 'equipo'), pa = partida_(ses.simId);
  vrExigir_(pa);
  return vrApiGuardar_(ses, pa, equipoById_(ses.equipoId), dec, enviar);
}
function apiEstimar(tok, dec) {
  var ses = sess_(tok, 'equipo'), pa = partida_(ses.simId);
  vrExigir_(pa);
  return vrApiEstimar_(ses, pa, equipoById_(ses.equipoId), dec);
}
function procesarTrimestre_(simId) {
  if (!vrEsVR_(partida_(simId))) return { ok: false, mensaje: 'Esta simulación usa el motor anterior, que fue retirado. Descargue su respaldo o archívela; para jugar, cree una simulación nueva.' };
  return vrProcesar_(simId);
}

// ---------- archivo, respaldo, restauración y eliminación de simulaciones ----------
var RESP_TIPO_ = 'simulador-innovacion-respaldo';
var RESP_TABLAS_ = ['Simulaciones', 'Equipos', 'Integrantes', 'Decisiones', 'Estados', 'Resultados', 'Bitacora', 'Evaluaciones'];
var RESP_FECHAS_ = ['creada', 'creado', 'fecha'];
/** Filas de una simulación en cada tabla (por la primera columna). */
function RESP_pred_(tabla, simId) {
  var pre = String(simId) + '-';
  if (tabla === 'Simulaciones' || tabla === 'Integrantes') return function (id) { return String(id) === String(simId); };
  if (tabla === 'Evaluaciones') return function (id) { id = String(id); return id === 'DOC|' + simId || id.indexOf('PAR|' + pre) === 0; };
  return function (id) { return String(id).indexOf(pre) === 0; };
}
function RESP_hoja_(tabla) { try { return sh_(tabla); } catch (e) { return null; } }
/** Un id de simulación nuevo que nunca se usó antes (evita que sesiones antiguas apunten a otra simulación). */
function RESP_nuevoSimId_() {
  var pr = AX_props_(), seq = Number(pr.getProperty('SIM_SEQ')) || 0;
  simulaciones_().forEach(function (s) { var m = /^S(\d+)$/.exec(String(s.simId)); if (m) seq = Math.max(seq, Number(m[1])); });
  var id; do { seq++; id = 'S' + ('0' + seq).slice(-2); } while (simById_(id));
  pr.setProperty('SIM_SEQ', String(seq));
  return id;
}
function RESP_crear_(simId) {
  var pa = partida_(simId), tablas = {};
  RESP_TABLAS_.forEach(function (t) {
    var s = RESP_hoja_(t); if (!s) return;
    var n = s.getLastRow(), c = s.getLastColumn(), cab = HOJAS[t].slice(), filas = [];
    if (n >= 2) {
      var v = s.getRange(1, 1, n, c).getValues(), pred = RESP_pred_(t, simId); cab = v[0].map(String);
      filas = v.slice(1).filter(function (r) { return pred(r[0]); }).map(function (r) { return r.map(function (x) { return x instanceof Date ? x.toISOString() : x; }); });
    }
    tablas[t] = { cab: cab, filas: filas };
  });
  return { tipo: RESP_TIPO_, version: 1, creado: new Date().toISOString(), simulacion: { simId: pa.simId, codigo: pa.codigo, nombre: pa.nombre, sigla: pa.sigla, trimestre: pa.t, equipos: tablas.Equipos ? tablas.Equipos.filas.length : 0, integrantes: tablas.Integrantes ? tablas.Integrantes.filas.length : 0 }, tablas: tablas };
}
function RESP_borrar_(simId) {
  RESP_TABLAS_.slice().reverse().forEach(function (t) { if (RESP_hoja_(t)) deleteRowsWhere_(t, RESP_pred_(t, simId)); });
  // sesiones abiertas de los equipos de esta simulación
  try {
    var ss = sh_('Sesiones'), L = rows_('Sesiones');
    for (var i = L.length - 1; i >= 0; i--) { var d = {}; try { d = JSON.parse(L[i].datos); } catch (e) { } if (d && d.rol === 'equipo' && String(d.simId) === String(simId)) ss.deleteRow(L[i]._row); }
  } catch (e2) { }
}
function RESP_restaurar_(ses, R) {
  if (typeof R === 'string') { try { R = JSON.parse(R); } catch (e) { R = null; } }
  if (!R || R.tipo !== RESP_TIPO_ || !R.tablas || !R.tablas.Simulaciones || !R.tablas.Simulaciones.filas || R.tablas.Simulaciones.filas.length !== 1) throw new Error('El archivo no es un respaldo válido del Simulador de Innovación.');
  if (Number(R.version) > 1) throw new Error('El respaldo es de una versión más nueva del simulador.');
  var obj = function (t, fila) { var o = {}; (R.tablas[t].cab || []).forEach(function (h, j) { o[h] = fila[j]; }); return o; };
  var sim = obj('Simulaciones', R.tablas.Simulaciones.filas[0]), viejo = String(sim.simId || '');
  if (!/^S\d+$/.test(viejo)) throw new Error('El respaldo no tiene un identificador de simulación válido.');
  var mismoId = !simById_(viejo), nuevo = mismoId ? viejo : RESP_nuevoSimId_();
  if (mismoId) { var pr = AX_props_(), m = /^S(\d+)$/.exec(viejo); if (Number(m[1]) > (Number(pr.getProperty('SIM_SEQ')) || 0)) pr.setProperty('SIM_SEQ', m[1]); }
  var codLibre = sim.codigo && !simPorCodigo_(sim.codigo), cod = codLibre ? sim.codigo : nuevoCodigo_();
  var reTxt = function (x) {
    if (typeof x !== 'string' || mismoId) return x;
    return x.split('PAR|' + viejo + '-').join('PAR|' + nuevo + '-').split('DOC|' + viejo).join('DOC|' + nuevo).split('"' + viejo + '-E').join('"' + nuevo + '-E').replace(new RegExp('^' + viejo + '-E'), nuevo + '-E').replace(new RegExp('^' + viejo + '-MERCADO$'), nuevo + '-MERCADO');
  };
  var docExiste = rows_('Docentes').some(function (d) { return String(d.docenteId) === String(sim.docenteId); });
  sim.simId = nuevo; sim.codigo = cod; sim.acceso = 'cerrada'; sim.estado = 'cerrado';
  if (!ses.superadmin || !docExiste) sim.docenteId = ses.docenteId || sim.docenteId;
  if (!mismoId) sim.nombre = String(sim.nombre || '') + ' (restaurada)';
  var total = 0;
  RESP_TABLAS_.forEach(function (t) {
    if (!R.tablas[t] || !R.tablas[t].filas || !R.tablas[t].filas.length) return;
    var s = RESP_hoja_(t); if (!s) return;
    var cab = HOJAS[t], filas = R.tablas[t].filas.map(function (f) {
      var o = t === 'Simulaciones' ? sim : obj(t, f);
      if (t !== 'Simulaciones') {
        if (t === 'Integrantes') o.simId = nuevo;
        if (t === 'Equipos') o.simId = nuevo;
        if (t === 'Estados' && !mismoId) {
          var n = Number(o.partes) || 1, txt = ''; for (var i = 1; i <= n; i++) txt += String(o['p' + i] || '');
          txt = txt.split('"' + viejo + '-E').join('"' + nuevo + '-E');
          var partes = []; for (var k = 0; k < txt.length; k += CHUNK) partes.push(txt.substr(k, CHUNK));
          for (var j = 1; j <= 10; j++) o['p' + j] = partes[j - 1] || '';
          o.partes = partes.length;
        }
        Object.keys(o).forEach(function (h) { if (!(t === 'Estados' && /^p\d+$/.test(h))) o[h] = reTxt(o[h]); });
      }
      return cab.map(function (h) { var v = o[h]; if (v === undefined || v === null) return ''; if (RESP_FECHAS_.indexOf(h) >= 0 && typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v)) return new Date(v); return v; });
    });
    s.getRange(s.getLastRow() + 1, 1, filas.length, cab.length).setValues(filas);
    total += filas.length;
  });
  log_(ses.email, 'restaurarSimulacion', nuevo + ' ' + cod + ' ' + sim.nombre + ' (respaldo del ' + String(R.creado || '').slice(0, 10) + ')');
  return { ok: true, simId: nuevo, codigo: cod, mensaje: 'Simulación "' + sim.nombre + '" restaurada con ' + (R.tablas.Equipos ? R.tablas.Equipos.filas.length : 0) + ' equipos' + (codLibre ? ' y su código ' + cod : '; su código anterior ya estaba en uso, el nuevo es ' + cod) + '. Quedó con el acceso cerrado: actívela cuando corresponda.' };
}

// ---------- panel docente ----------
function apiAdmin(tok, accion, datos) {
  var ses = sess_(tok, 'docente');
  var TOTAL = VR_DATOS.horizonteTrimestres;
  datos = datos || {};
  // acciones globales
  if (accion === 'simulaciones') {
    var eqs = rows_('Equipos'), ints = rows_('Integrantes');
    var nomDoc = {}; rows_('Docentes').forEach(function (d) { nomDoc[d.docenteId] = d.nombre; });
    return { yo: { nombre: ses.nombre, email: ses.email, superadmin: !!ses.superadmin, rol: ses.superadmin ? 'Superadministrador' : 'Profesor' }, total: TOTAL, mandatos: [{ id: VR_MANDATO, nombre: 'Simulador vida real (Lácteos Chiquitano, 12 trimestres)' }],
      lista: simulaciones_().filter(function (s) { return AX_puedeSim_(ses, s); }).map(function (s) { var pa = partida_(s.simId); return { total: TOTAL, motorRetirado: !vrEsVR_(pa), acceso: s.acceso || 'activa', docente: nomDoc[s.docenteId] || '', simId: pa.simId, codigo: pa.codigo, nombre: pa.nombre, sigla: pa.sigla, t: pa.t, estado: pa.estado, mandato: pa.mandato, maxIntegrantes: pa.maxIntegrantes, registroAbierto: pa.registroAbierto, equipos: eqs.filter(function (e) { return String(e.simId) === String(s.simId); }).length, integrantes: ints.filter(function (i) { return String(i.simId) === String(s.simId); }).length }; }) };
  }
  if (accion === 'crearSimulacion') {
    var nom = String(datos.nombre || '').trim(); if (!nom) throw new Error('Escribe el nombre de la simulación.');
    var maxI = clamp_(Math.round(Number(datos.maxIntegrantes) || 5), 1, 5);
    var id = RESP_nuevoSimId_();
    var cod = nuevoCodigo_();
    appendObj_('Simulaciones', { simId: id, codigo: cod, nombre: nom, sigla: String(datos.sigla || '').trim().toUpperCase(), semilla: String(Math.floor(Math.random() * 1e9)), trimestre: 1, estado: 'cerrado', mandato: VR_MANDATO, maxIntegrantes: maxI, registroAbierto: true, creada: new Date(), docenteId: ses.docenteId, acceso: 'activa' });
    log_(ses.email, 'crearSimulacion', id + ' ' + cod + ' ' + nom);
    return { ok: true, simId: id, codigo: cod, mensaje: 'Simulación creada. Código para los estudiantes: ' + cod };
  }
  if (accion === 'restaurarSimulacion') return RESP_restaurar_(ses, datos.respaldo);
  // acciones de una simulación (el profesor solo las suyas)
  AX_simDe_(ses, datos.simId);
  var pa = partida_(datos.simId);
  // simulaciones del motor anterior: solo administración de datos (acceso, archivo, respaldo, eliminación, consulta)
  if (!vrEsVR_(pa) && ['acceso', 'archivar', 'desarchivar', 'respaldo', 'eliminarSimulacion', 'resumen', 'resultados', 'editarSimulacion'].indexOf(accion) < 0)
    throw new Error('Esta simulación usa el motor anterior, que fue retirado. Puede descargar su respaldo, archivarla o eliminarla; para jugar, cree una simulación nueva.');
  if (String(accion).indexOf('vr') === 0) return vrApiAdmin_(ses, pa, accion, datos);
  if (accion === 'acceso') {
    var val = datos.valor === 'cerrada' ? 'cerrada' : 'activa';
    setSim_(pa.simId, { acceso: val });
    log_(ses.email, 'accesoSimulacion', pa.codigo + ' ' + val);
    return { ok: true, mensaje: val === 'activa' ? 'Simulación activada: los equipos pueden registrarse e ingresar.' : 'Simulación cerrada: los equipos no pueden registrarse ni ingresar.' };
  }
  if (accion === 'archivar' || accion === 'desarchivar') {
    var arch = accion === 'archivar';
    setSim_(pa.simId, arch ? { acceso: 'archivada', estado: 'cerrado' } : { acceso: 'cerrada' });
    log_(ses.email, accion, pa.codigo);
    return { ok: true, mensaje: arch ? 'Simulación archivada: los equipos ya no pueden ingresar y no aparece en la lista principal. Sus datos se conservan.' : 'Simulación recuperada del archivo. Quedó con el acceso cerrado: actívela cuando quiera que los equipos vuelvan a ingresar.' };
  }
  if (accion === 'respaldo') { log_(ses.email, 'respaldo', pa.codigo); return RESP_crear_(pa.simId); }
  if (accion === 'eliminarSimulacion') {
    if (AX_normCod_(datos.confirmar) !== AX_normCod_(pa.codigo)) throw new Error('Para eliminar, escriba exactamente el código de la simulación (' + pa.codigo + ').');
    var nEq = equiposDe_(pa.simId).length;
    RESP_borrar_(pa.simId);
    log_(ses.email, 'eliminarSimulacion', pa.codigo + ' ' + pa.nombre + ' (' + nEq + ' equipos)');
    return { ok: true, mensaje: 'Simulación "' + pa.nombre + '" eliminada con sus ' + nEq + ' equipos y todos sus datos.' };
  }
  if (accion === 'editarSimulacion') {
    var cambios = {};
    if (datos.nombre !== undefined) cambios.nombre = String(datos.nombre).trim();
    if (datos.sigla !== undefined) cambios.sigla = String(datos.sigla).trim().toUpperCase();
    if (datos.maxIntegrantes !== undefined) cambios.maxIntegrantes = clamp_(Math.round(Number(datos.maxIntegrantes) || 5), 1, 5);
    if (datos.registroAbierto !== undefined) cambios.registroAbierto = !!datos.registroAbierto;
    var msgCod = '';
    if (datos.codigo !== undefined && String(datos.codigo).trim() !== '') {
      var nc = String(datos.codigo).toUpperCase().replace(/\s/g, '');
      if (nc !== String(pa.codigo).toUpperCase()) {
        if (!/^[A-Z0-9-]{4,12}$/.test(nc) || AX_normCod_(nc).length < 4) throw new Error('El código debe tener de 4 a 12 letras, números o guiones, sin espacios.');
        if (simulaciones_().some(function (s) { return String(s.simId) !== String(pa.simId) && AX_normCod_(s.codigo) === AX_normCod_(nc); })) throw new Error('Ese código ya lo usa otra simulación. Elija otro.');
        cambios.codigo = nc; msgCod = ' Nuevo código para los estudiantes: ' + nc + '. Los equipos usarán el código nuevo para registrarse e ingresar.';
        log_('docente', 'cambiarCodigo', pa.codigo + ' → ' + nc);
      }
    }
    setSim_(pa.simId, cambios);
    return { ok: true, mensaje: 'Parámetros de la simulación actualizados.' + msgCod };
  }
  if (accion === 'resumen') {
    var eqs2 = equiposDe_(pa.simId), ints2 = integrantesDe_(pa.simId);
    var decs = rows_('Decisiones').filter(function (d) { return Number(d.trimestre) === pa.t; });
    var res = rows_('Resultados').filter(function (r) { return Number(r.trimestre) === pa.t - 1 && String(r.simId) === String(pa.simId); });
    return {
      partida: { simId: pa.simId, codigo: pa.codigo, nombre: pa.nombre, sigla: pa.sigla, t: pa.t, estado: pa.estado, mandato: pa.mandato, maxIntegrantes: pa.maxIntegrantes, registroAbierto: pa.registroAbierto },
      total: TOTAL, motorRetirado: !vrEsVR_(pa),
      equipos: eqs2.map(function (e) {
        var d = decs.filter(function (x) { return String(x.equipoId) === String(e.equipoId); })[0];
        var r = res.filter(function (x) { return String(x.equipoId) === String(e.equipoId); })[0];
        return { equipoId: e.equipoId, nombre: e.nombre, mandato: e.mandato, envio: d ? d.estado : 'sin decisiones', enviadoPor: d ? d.enviadoPor : '', fechaEnvio: d ? d.fecha : '',
          integrantes: ints2.filter(function (i) { return String(i.equipoId) === String(e.equipoId); }).map(function (i) { return integrantePublico_(i, true); }),
          ultimo: r ? { ventas: r.ventas, utilidadNeta: r.utilidadNeta, caja: r.caja, cuotaTotal: r.cuotaTotal, vitalidad: r.vitalidad, clima: r.clima } : null };
      }),
      mandatos: [{ id: VR_MANDATO, nombre: 'Simulador vida real' }]
    };
  }
  if (accion === 'editarIntegrante') {
    var it = integrantesDe_(pa.simId).filter(function (i) { return String(i.registro) === String(datos.registroOriginal); })[0];
    if (!it) throw new Error('Integrante no encontrado.');
    var o = limpiarIntegrante_(datos, 0);
    if (o.registro !== String(it.registro)) {
      if (integrantesDe_(pa.simId).some(function (i) { return String(i.registro) === o.registro; })) throw new Error('Ese registro ya existe en la simulación.');
      }
    it.apPaterno = o.apPaterno; it.apMaterno = o.apMaterno; it.nombres = o.nombres; it.registro = o.registro; it.celular = o.celular;
    if (datos.equipoId && datos.equipoId !== it.equipoId) {
      var dest = equipoById_(datos.equipoId); if (!dest || dest.simId !== pa.simId) throw new Error('Equipo de destino no válido.');
      if (integrantesDe_(pa.simId, dest.equipoId).length >= pa.maxIntegrantes) throw new Error('El equipo de destino ya está completo.');
      it.equipoId = dest.equipoId;
    }
    updateRow_('Integrantes', it);
    return { ok: true, mensaje: 'Integrante actualizado.' };
  }
  if (accion === 'agregarIntegrante') {
    var eqA = equipoById_(datos.equipoId); if (!eqA || eqA.simId !== pa.simId) throw new Error('Equipo no válido.');
    var oa = limpiarIntegrante_(datos, 0), intsA = integrantesDe_(pa.simId);
    if (intsA.filter(function (i) { return String(i.equipoId) === String(eqA.equipoId); }).length >= pa.maxIntegrantes) throw new Error('El equipo ya está completo.');
    if (intsA.some(function (i) { return String(i.registro) === oa.registro; })) throw new Error('Ese registro ya existe en la simulación.');
    appendObj_('Integrantes', { simId: pa.simId, equipoId: eqA.equipoId, registro: oa.registro, apPaterno: oa.apPaterno, apMaterno: oa.apMaterno, nombres: oa.nombres, celular: oa.celular, pin: '', creado: new Date() });
    return { ok: true, mensaje: 'Integrante agregado.' };
  }
  if (accion === 'eliminarIntegrante') {
    var ie = integrantesDe_(pa.simId).filter(function (i) { return String(i.registro) === String(datos.registro); })[0];
    if (!ie) throw new Error('Integrante no encontrado.');
    sh_('Integrantes').deleteRow(ie._row);
    return { ok: true, mensaje: 'Integrante eliminado.' };
  }
  if (accion === 'renombrarEquipo') {
    var er = equipoById_(datos.equipoId); if (!er || er.simId !== pa.simId) throw new Error('Equipo no válido.');
    er.nombre = String(datos.nombre || '').trim() || er.nombre;
    updateRow_('Equipos', er);
    return { ok: true, mensaje: 'Equipo actualizado.' };
  }
  if (accion === 'eliminarEquipo') {
    if (pa.t > 1) throw new Error('Solo se pueden eliminar equipos antes de procesar el trimestre 1.');
    var ed = equipoById_(datos.equipoId); if (!ed || ed.simId !== pa.simId) throw new Error('Equipo no válido.');
    integrantesDe_(pa.simId, ed.equipoId).sort(function (a, b) { return b._row - a._row; }).forEach(function (i) { sh_('Integrantes').deleteRow(i._row); });
    deleteRowsWhere_('Decisiones', function (id) { return String(id) === String(ed.equipoId); });
    sh_('Equipos').deleteRow(equipoById_(ed.equipoId)._row);
    return { ok: true, mensaje: 'Equipo eliminado.' };
  }
  if (accion === 'abrir' || accion === 'cerrar') {
    if (pa.t > TOTAL) throw new Error('La partida terminó.');
    setSim_(pa.simId, { estado: accion === 'abrir' ? 'abierto' : 'cerrado' });
    return { ok: true, mensaje: 'Trimestre ' + pa.t + (accion === 'abrir' ? ' abierto.' : ' cerrado.') };
  }
  if (accion === 'procesar') return procesarTrimestre_(pa.simId);
  if (accion === 'retroceder') {
    if (pa.t <= 1) throw new Error('No hay trimestres procesados.');
    var tb = pa.t - 1, pre = pa.simId + '-';
    deleteRowsWhere_('Estados', function (id, tt) { return tt === tb && String(id).indexOf(pre) === 0; });
    deleteRowsWhere_('Resultados', function (id, tt) { return tt === tb && String(id).indexOf(pre) === 0; });
    setSim_(pa.simId, { trimestre: tb, estado: 'cerrado' });
    log_('docente', 'retroceder', pa.codigo + ' T' + tb);
    return { ok: true, mensaje: 'Se deshizo el procesamiento del trimestre ' + tb + '. Las decisiones enviadas se conservan; puede corregirlas y volver a procesar.' };
  }
  if (accion === 'reiniciar') {
    if (datos.confirmar !== 'REINICIAR') throw new Error('Escriba REINICIAR para confirmar.');
    var pr = pa.simId + '-';
    ['Decisiones', 'Estados', 'Resultados', 'Bitacora'].forEach(function (h) { deleteRowsWhere_(h, function (id) { return String(id).indexOf(pr) === 0; }); });
    var c = { trimestre: 1, estado: 'cerrado' }; if (datos.nuevaSemilla) c.semilla = String(Math.floor(Math.random() * 1e9));
    setSim_(pa.simId, c);
    log_('docente', 'reiniciar', pa.codigo);
    return { ok: true, mensaje: 'Simulación reiniciada en el trimestre 1 (los equipos e integrantes se conservan).' };
  }
  if (accion === 'ranking') return vrRanking_(pa);
  if (accion === 'resultados') {
    return rows_('Resultados').filter(function (r) { return String(r.simId) === String(pa.simId); }).map(function (r) { var o = {}; HOJAS.Resultados.forEach(function (h) { o[h] = r[h]; }); return o; });
  }
  throw new Error('Acción desconocida: ' + accion);
}

// ---------- utilidades comunes ----------
function clamp_(x, a, b) { return Math.max(a, Math.min(b, x)); }
