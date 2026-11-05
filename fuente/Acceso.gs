/**
 * Simulador de Innovación — Acceso (v2.3)
 * Equipos con contraseña de equipo, docentes por invitación (superadmin y profesor),
 * sesiones con token (CacheService + hoja Sesiones, 6 h), bloqueo por intentos fallidos
 * y migración automática desde el acceso anterior (registro + PIN y clave docente).
 * Las contraseñas y respuestas se guardan con SHA-256 y sal por usuario; nunca en texto plano.
 */
var AX_VERSION = '2.3';
var AX_SES_SEG = 21600;          // 6 horas
var AX_MAX_FALLOS = 5;
var AX_VENTANA_MIN = 15;
var AX_INV_HORAS = 72;
var AX_MSG_DATOS = 'Los datos de acceso no son correctos.';
var AX_MSG_BLOQ = 'Demasiados intentos fallidos. Espera 15 minutos y vuelve a intentarlo.';
var AX_LOGOS_DEF = { LOGO_1: '18N3yFvodkCVL2lp8XC_chL9nZlboCOKf', LOGO_2: '1GA6wbLVNqVekpIuPEGrli3gDjs8zGDBv', LOGO_3: '1hAxorhWT_htaFx8cWnd-3-G3BzSElpKi' };

// ---------- utilidades ----------
function AX_hex_(bytes) { return bytes.map(function (b) { var v = (b < 0 ? b + 256 : b).toString(16); return v.length === 1 ? '0' + v : v; }).join(''); }
function AX_hash_(texto, sal) { return AX_hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(sal) + '|' + String(texto), Utilities.Charset.UTF_8)); }
function AX_sal_() { return Utilities.getUuid().replace(/-/g, ''); }
function AX_coincide_(texto, hash, sal) { return !!hash && !!sal && AX_hash_(texto, sal) === String(hash); }
function AX_norm_(s) { return String(s || '').trim().replace(/\s+/g, ' ').toUpperCase(); }
function AX_normCod_(c) { return String(c || '').toUpperCase().replace(/[\s-]/g, ''); }
function AX_normResp_(r) { return String(r || '').trim().replace(/\s+/g, ' ').toLowerCase(); }
function AX_bool_(v) { return v === true || v === 'TRUE' || v === 'true' || v === 'sí' || v === 1; }
function AX_tempClave_() { var abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', s = ''; for (var i = 0; i < 6; i++) s += abc.charAt(Math.floor(Math.random() * abc.length)); return s; }
function AX_lock_(fn) { var l = LockService.getScriptLock(); l.waitLock(30000); try { return fn(); } finally { l.releaseLock(); } }
function AX_props_() { return PropertiesService.getScriptProperties(); }
function AX_url_() { try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; } }
function AX_correoDueno_() {
  var e = '';
  try { e = Session.getEffectiveUser().getEmail(); } catch (x) { e = ''; }
  return String(e || cfgGet_('CORREO_SUPERADMIN') || 'jdavidatila@gmail.com').trim().toLowerCase();
}
function AX_validarClave_(c, min) {
  c = String(c || '');
  if (c.length < min) throw new Error('La contraseña debe tener al menos ' + min + ' caracteres.');
  if (c.length > 64) throw new Error('La contraseña es demasiado larga.');
  return c;
}
function AX_nombreInt_(i) { return (String(i.nombres || '') + ' ' + String(i.apPaterno || '') + ' ' + String(i.apMaterno || '')).replace(/\s+/g, ' ').trim(); }
function AX_simActiva_(s) { return String(s.acceso || 'activa') !== 'cerrada'; }

// ---------- sesiones ----------
function AX_newSession_(datos) {
  var tok = Utilities.getUuid();
  datos.exp = Date.now() + AX_SES_SEG * 1000;
  CacheService.getScriptCache().put('tok_' + tok, JSON.stringify(datos), AX_SES_SEG);
  try { appendObj_('Sesiones', { tokenHash: AX_hash_(tok, 'ses'), rol: datos.rol, datos: JSON.stringify(datos), creada: new Date(), vence: new Date(datos.exp) }); } catch (e) { /* la caché basta */ }
  return tok;
}
function AX_getSession_(tok) {
  if (!tok) return null;
  var c = CacheService.getScriptCache(), v = c.get('tok_' + tok), s = null;
  if (v) s = JSON.parse(v);
  else {
    try { var h = AX_hash_(tok, 'ses'), r = rows_('Sesiones').filter(function (x) { return String(x.tokenHash) === h; })[0]; if (r) s = JSON.parse(r.datos); } catch (e) { s = null; }
    if (s && (!s.exp || Date.now() < s.exp)) c.put('tok_' + tok, JSON.stringify(s), Math.max(1, Math.floor((s.exp - Date.now()) / 1000)));
  }
  if (!s || !s.exp || Date.now() > s.exp) return null;
  return s;
}
function AX_setSession_(tok, s) {
  CacheService.getScriptCache().put('tok_' + tok, JSON.stringify(s), Math.max(1, Math.floor((s.exp - Date.now()) / 1000)));
  try { var h = AX_hash_(tok, 'ses'), r = rows_('Sesiones').filter(function (x) { return String(x.tokenHash) === h; })[0]; if (r) { r.datos = JSON.stringify(s); updateRow_('Sesiones', r); } } catch (e) { }
}
function AX_endSession_(tok) {
  if (!tok) return;
  try { CacheService.getScriptCache().remove('tok_' + tok); } catch (e) { }
  try { var h = AX_hash_(tok, 'ses'), r = rows_('Sesiones').filter(function (x) { return String(x.tokenHash) === h; })[0]; if (r) sh_('Sesiones').deleteRow(r._row); } catch (e) { }
}
/** Sesión de un rol, permitiendo la contraseña temporal pendiente (solo para cambiarla). */
function AX_ses_(tok, rol) {
  var s = AX_getSession_(tok);
  if (!s) throw new Error('Tu sesión expiró. Vuelve a ingresar.');
  if (rol && s.rol !== rol) throw new Error('No tienes permiso para esta acción.');
  return s;
}
function AX_limpiar_() {
  try {
    var ahora = Date.now(), s = sh_('Sesiones'), L = rows_('Sesiones');
    if (L.length > 200) L.filter(function (r) { return new Date(r.vence).getTime() < ahora; }).sort(function (a, b) { return b._row - a._row; }).forEach(function (r) { s.deleteRow(r._row); });
    var I = rows_('IntentosLogin'), lim = ahora - 24 * 3600000;
    if (I.length > 300) I.filter(function (r) { return new Date(r.fecha).getTime() < lim; }).sort(function (a, b) { return b._row - a._row; }).forEach(function (r) { sh_('IntentosLogin').deleteRow(r._row); });
  } catch (e) { }
}

// ---------- intentos fallidos ----------
function AX_bloqueado_(clave) {
  var lim = Date.now() - AX_VENTANA_MIN * 60000, n = 0;
  rows_('IntentosLogin').forEach(function (r) {
    if (String(r.clave) !== clave || new Date(r.fecha).getTime() < lim) return;
    if (r.resultado === 'ok') n = 0; else n++;
  });
  return n >= AX_MAX_FALLOS;
}
function AX_intento_(clave, ok) { appendObj_('IntentosLogin', { clave: clave, fecha: new Date(), resultado: ok ? 'ok' : 'fallo' }); }

// ---------- migración desde el acceso anterior ----------
function AX_asegurarHojas_() {
  var ss = ss_();
  Object.keys(HOJAS).forEach(function (n) {
    var s = ss.getSheetByName(n) || ss.insertSheet(n, ss.getNumSheets()), head = HOJAS[n];
    var lc = s.getLastColumn(), cur = lc ? s.getRange(1, 1, 1, lc).getValues()[0].filter(function (x) { return x !== ''; }) : [];
    var prefijo = cur.every(function (h, i) { return h === head[i]; });
    if (!prefijo) { log_('sistema', 'migracionAcceso', 'Encabezados de "' + n + '" distintos; no se modificaron.'); return; }
    if (cur.length < head.length) {
      s.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#1F3864').setFontColor('#FFFFFF');
      s.setFrozenRows(1);
    }
  });
}
/** Migra una sola vez. Devuelve { superadmin: {email, temporal} } si creó el superadministrador. */
function AX_migrar_() {
  if (String(cfgGet_('AX_VERSION') || '') === AX_VERSION) return null;
  return AX_lock_(function () {
    if (String(cfgGet_('AX_VERSION') || '') === AX_VERSION) return null;
    AX_asegurarHojas_();
    var out = null, docs = rows_('Docentes'), sa = docs.filter(function (d) { return d.rol === 'superadmin'; })[0];
    if (!sa) {
      var email = AX_correoDueno_(), clave = String(cfgGet_('CLAVE_DOCENTE') || '');
      if (!clave || clave.indexOf('(retirada') === 0) clave = AX_tempClave_();
      var sal = AX_sal_();
      sa = { docenteId: 'D01', nombre: 'Administrador del simulador', email: email, rol: 'superadmin', claveHash: AX_hash_(clave, sal), claveSal: sal, claveTemporal: true, pregunta: '', respuestaHash: '', respuestaSal: '', activo: true, creado: new Date() };
      appendObj_('Docentes', sa);
      out = { superadmin: { email: email, temporal: clave } };
      if (!cfgGet_('CORREO_SUPERADMIN')) cfgSet_('CORREO_SUPERADMIN', email);
    }
    rows_('Simulaciones').forEach(function (s) {
      var cambio = false;
      if (!s.docenteId) { s.docenteId = sa.docenteId; cambio = true; }
      if (!s.acceso) { s.acceso = 'activa'; cambio = true; }
      if (cambio) updateRow_('Simulaciones', s);
    });
    var props = AX_props_();
    rows_('Equipos').forEach(function (e) {
      if (e.claveHash) return;
      var t = AX_tempClave_(), sl = AX_sal_();
      e.claveHash = AX_hash_(t, sl); e.claveSal = sl; e.claveTemporal = true; e.edicionBloqueada = false;
      updateRow_('Equipos', e);
      props.setProperty('AX_TMP_' + e.equipoId, t);
    });
    rows_('Integrantes').forEach(function (i) { if (i.pin !== '' && i.pin !== undefined) { i.pin = ''; updateRow_('Integrantes', i); } });
    if (cfgGet_('CLAVE_DOCENTE') !== undefined) cfgSet_('CLAVE_DOCENTE', '(retirada en v2.3: los docentes ingresan con correo y contraseña)');
    Object.keys(AX_LOGOS_DEF).forEach(function (k) { if (cfgGet_(k) === undefined) cfgSet_(k, AX_LOGOS_DEF[k]); });
    cfgSet_('AX_VERSION', AX_VERSION);
    log_('sistema', 'migracionAcceso', 'Acceso v' + AX_VERSION + (out ? ' · superadmin ' + out.superadmin.email : ''));
    return out;
  });
}

// ---------- logos y datos de la pantalla de acceso ----------
function AX_logo_(v) {
  v = String(v || '').trim(); if (!v) return '';
  if (/^(data:|https?:)/.test(v)) return v;
  try {
    var f = DriveApp.getFileById(v), b = null;
    try { b = f.getThumbnail(); } catch (e) { b = null; }
    if (!b) { b = f.getBlob(); if (b.getBytes().length > 90000) return ''; }
    return 'data:' + (b.getContentType() || 'image/png') + ';base64,' + Utilities.base64Encode(b.getBytes());
  } catch (e) { return ''; }
}
function AX_logos_() {
  var c = CacheService.getScriptCache(), v = c.get('ax_logos');
  if (v) return JSON.parse(v);
  var L = ['LOGO_1', 'LOGO_2', 'LOGO_3'].map(function (k) { var x = cfgGet_(k); return AX_logo_(x === undefined ? AX_LOGOS_DEF[k] : x); });
  var txt = JSON.stringify(L);
  if (txt.length < 95000 && L.some(function (x) { return !!x; })) c.put('ax_logos', txt, 21600);
  return L;
}
function apiAXInicio(invitacion) {
  AX_migrar_();
  return { logos: AX_logos_(), manual: String(cfgGet_('MANUAL_URL') || ''), invitacion: invitacion ? AX_estadoInvitacion_(invitacion) : null };
}

// ---------- ingreso ----------
function apiAXLogin(usuario, clave, codigo) {
  AX_migrar_();
  usuario = String(usuario || '').trim(); clave = String(clave || '');
  if (!usuario || !clave) throw new Error('Completa el usuario y la contraseña.');
  if (usuario.indexOf('@') > 0) {
    var email = usuario.toLowerCase(), kd = 'doc|' + email;
    if (AX_bloqueado_(kd)) throw new Error(AX_MSG_BLOQ);
    var d = rows_('Docentes').filter(function (x) { return String(x.email).toLowerCase() === email; })[0];
    if (!d || !AX_bool_(d.activo) || !AX_coincide_(clave, d.claveHash, d.claveSal)) { AX_intento_(kd, false); throw new Error(AX_MSG_DATOS); }
    AX_intento_(kd, true); AX_limpiar_();
    var tmpD = AX_bool_(d.claveTemporal);
    var tokD = AX_newSession_({ rol: 'docente', docenteId: d.docenteId, email: d.email, nombre: d.nombre, superadmin: d.rol === 'superadmin', tmp: tmpD });
    log_(email, 'login', 'docente');
    return { token: tokD, tipo: 'docente', nombre: d.nombre, rol: d.rol, cambiarClave: tmpD };
  }
  var cod = AX_normCod_(codigo);
  if (!cod) throw new Error('Escribe el código de la simulación.');
  var nom = AX_norm_(usuario), s = simPorCodigo_(cod), ke = 'eq|' + (s ? s.simId : '?' + cod) + '|' + nom;
  if (AX_bloqueado_(ke)) throw new Error(AX_MSG_BLOQ);
  var eq = s ? equiposDe_(s.simId).filter(function (e) { return AX_norm_(e.nombre) === nom; })[0] : null;
  if (!eq || !AX_coincide_(clave, eq.claveHash, eq.claveSal)) { AX_intento_(ke, false); throw new Error(AX_MSG_DATOS); }
  AX_intento_(ke, true); AX_limpiar_();
  if (!AX_simActiva_(s)) throw new Error('Esta simulación está cerrada. Consulta a tu docente.');
  var tmp = AX_bool_(eq.claveTemporal);
  var ints = integrantesDe_(s.simId, eq.equipoId).map(function (i) { return { registro: String(i.registro), nombre: AX_nombreInt_(i) }; });
  var tok = AX_newSession_({ rol: 'equipo', equipoId: eq.equipoId, simId: s.simId, registro: '', tmp: tmp });
  log_(eq.nombre, 'login', s.codigo);
  return { token: tok, tipo: 'equipo', equipo: eq.nombre, integrantes: ints, cambiarClave: tmp };
}
/** Después del ingreso del equipo: quién de los integrantes está usando el simulador. */
function apiAXElegir(tok, registro) {
  var s = AX_ses_(tok, 'equipo');
  if (s.tmp) throw new Error('Primero cambia la contraseña temporal.');
  var it = integrantesDe_(s.simId, s.equipoId).filter(function (i) { return String(i.registro) === String(registro); })[0];
  if (!it) throw new Error('Elige un integrante de tu equipo.');
  s.registro = String(it.registro); AX_setSession_(tok, s);
  return { ok: true, nombre: AX_nombreInt_(it) };
}
function apiAXSalir(tok) { AX_endSession_(tok); return { ok: true }; }

function apiAXCambiarClave(tok, actual, nueva) {
  var s = AX_ses_(tok);
  return AX_lock_(function () {
    if (s.rol === 'equipo') {
      AX_validarClave_(nueva, 4);
      var eq = equipoById_(s.equipoId); if (!eq) throw new Error('Equipo no encontrado.');
      if (!AX_coincide_(actual, eq.claveHash, eq.claveSal)) throw new Error('La contraseña actual no es correcta.');
      if (String(actual) === String(nueva)) throw new Error('La contraseña nueva debe ser distinta de la actual.');
      var sl = AX_sal_(); eq.claveHash = AX_hash_(nueva, sl); eq.claveSal = sl; eq.claveTemporal = false; updateRow_('Equipos', eq);
      AX_props_().deleteProperty('AX_TMP_' + eq.equipoId);
      s.tmp = false; AX_setSession_(tok, s);
      log_(eq.nombre, 'cambiarClave', 'equipo');
      return { ok: true, integrantes: integrantesDe_(s.simId, s.equipoId).map(function (i) { return { registro: String(i.registro), nombre: AX_nombreInt_(i) }; }) };
    }
    if (s.rol === 'docente') {
      AX_validarClave_(nueva, 6);
      var d = rows_('Docentes').filter(function (x) { return String(x.docenteId) === String(s.docenteId); })[0]; if (!d) throw new Error('Docente no encontrado.');
      if (!AX_coincide_(actual, d.claveHash, d.claveSal)) throw new Error('La contraseña actual no es correcta.');
      if (String(actual) === String(nueva)) throw new Error('La contraseña nueva debe ser distinta de la actual.');
      var sd = AX_sal_(); d.claveHash = AX_hash_(nueva, sd); d.claveSal = sd; d.claveTemporal = false; updateRow_('Docentes', d);
      s.tmp = false; AX_setSession_(tok, s);
      log_(d.email, 'cambiarClave', 'docente');
      return { ok: true };
    }
    throw new Error('No tienes permiso para esta acción.');
  });
}

// ---------- registro de equipos ----------
function apiAXInfoCodigo(codigo) {
  AX_migrar_();
  var s = simPorCodigo_(codigo);
  if (!s || !AX_simActiva_(s)) return { ok: false };
  var pa = partida_(s.simId);
  if (!pa.registroAbierto) return { ok: false, motivo: 'El registro de equipos de esta simulación está cerrado.' };
  return { ok: true, nombre: pa.nombre + (pa.sigla ? ' (' + pa.sigla + ')' : ''), maxIntegrantes: pa.maxIntegrantes };
}
function apiRegistrarEquipo(codigo, datos) {
  AX_migrar_();
  datos = datos || {};
  var s = simPorCodigo_(codigo);
  if (!s || !AX_simActiva_(s)) throw new Error('El código de simulación no es válido.');
  var pa = partida_(s.simId), P = getParams_();
  if (!pa.registroAbierto) throw new Error('El registro de equipos de esta simulación está cerrado. Consulta al docente.');
  var nombre = String(datos.nombreEquipo || '').trim().replace(/\s+/g, ' ');
  if (nombre.length < 3 || nombre.length > 40) throw new Error('El nombre del equipo debe tener entre 3 y 40 caracteres.');
  var clave = AX_validarClave_(datos.clave !== undefined ? datos.clave : datos.pin, 4);
  if (datos.confirmar !== undefined && String(datos.confirmar) !== clave) throw new Error('Las contraseñas no coinciden.');
  var lista = (datos.integrantes || []).filter(function (x) { return x && (x.registro || x.nombres || x.apPaterno || x.apMaterno); });
  if (lista.length < 1) throw new Error('Registra al menos un integrante.');
  if (lista.length > pa.maxIntegrantes) throw new Error('Máximo ' + pa.maxIntegrantes + ' integrantes por equipo.');
  var limpios = lista.map(limpiarIntegrante_), equipoId;
  AX_lock_(function () {
    var eqs = equiposDe_(pa.simId), ints = integrantesDe_(pa.simId);
    if (eqs.some(function (e) { return AX_norm_(e.nombre) === AX_norm_(nombre); })) throw new Error('Ya existe un equipo con ese nombre en esta simulación.');
    var regs = {};
    limpios.forEach(function (o) {
      if (regs[o.registro]) throw new Error('El registro ' + o.registro + ' está repetido en el formulario.');
      regs[o.registro] = true;
      if (ints.some(function (i) { return String(i.registro) === o.registro; })) throw new Error('El registro ' + o.registro + ' ya pertenece a otro equipo de esta simulación.');
    });
    var n = eqs.length + 1;
    do { equipoId = pa.simId + '-E' + ('0' + n).slice(-2); n++; } while (equipoById_(equipoId));
    var claves = Object.keys(P.mandatos);
    var mand = pa.mandato === 'aleatorio' ? claves[Math.floor(Math.random() * claves.length)] : (P.mandatos[pa.mandato] ? pa.mandato : 'MA');
    var sl = AX_sal_();
    appendObj_('Equipos', { equipoId: equipoId, simId: pa.simId, nombre: nombre, mandato: mand, creado: new Date(), registradoPor: limpios[0].registro, claveHash: AX_hash_(clave, sl), claveSal: sl, claveTemporal: false, edicionBloqueada: false });
    limpios.forEach(function (o) {
      appendObj_('Integrantes', { simId: pa.simId, equipoId: equipoId, registro: o.registro, apPaterno: o.apPaterno, apMaterno: o.apMaterno, nombres: o.nombres, celular: o.celular, pin: '', creado: new Date() });
    });
  });
  log_(nombre, 'registrarEquipo', pa.codigo + ' (' + limpios.length + ' integrantes)');
  return { token: AX_newSession_({ rol: 'equipo', equipoId: equipoId, simId: pa.simId, registro: limpios[0].registro, tmp: false }), equipo: nombre, otros: limpios.length - 1 };
}

// ---------- el equipo edita sus integrantes ----------
function apiAXMiEquipo(tok, accion, datos) {
  var ses = sess_(tok, 'equipo'), pa = partida_(ses.simId);
  datos = datos || {};
  return AX_lock_(function () {
    var eq = equipoById_(ses.equipoId);
    if (AX_bool_(eq.edicionBloqueada)) throw new Error('El docente bloqueó la edición de integrantes. Pídele los cambios.');
    var ints = integrantesDe_(pa.simId), mios = ints.filter(function (i) { return String(i.equipoId) === String(eq.equipoId); });
    if (accion === 'agregar') {
      var o = limpiarIntegrante_(datos, 0);
      if (mios.length >= pa.maxIntegrantes) throw new Error('El equipo ya tiene el máximo de ' + pa.maxIntegrantes + ' integrantes.');
      if (ints.some(function (i) { return String(i.registro) === o.registro; })) throw new Error('El registro ' + o.registro + ' ya pertenece a un equipo de esta simulación.');
      appendObj_('Integrantes', { simId: pa.simId, equipoId: eq.equipoId, registro: o.registro, apPaterno: o.apPaterno, apMaterno: o.apMaterno, nombres: o.nombres, celular: o.celular, pin: '', creado: new Date() });
      log_(ses.registro, 'agregarIntegrante', o.registro);
      return { ok: true, mensaje: 'Integrante agregado.' };
    }
    var it = mios.filter(function (i) { return String(i.registro) === String(datos.registroOriginal || datos.registro); })[0];
    if (!it) throw new Error('Integrante no encontrado.');
    if (accion === 'editar') {
      var e = limpiarIntegrante_(datos, 0);
      if (e.registro !== String(it.registro) && ints.some(function (i) { return String(i.registro) === e.registro; })) throw new Error('Ese registro ya existe en la simulación.');
      if (String(it.registro) === String(ses.registro) && e.registro !== String(it.registro)) throw new Error('No puedes cambiar tu propio número de registro mientras lo usas. Pídeselo a un compañero o al docente.');
      it.apPaterno = e.apPaterno; it.apMaterno = e.apMaterno; it.nombres = e.nombres; it.registro = e.registro; it.celular = e.celular;
      updateRow_('Integrantes', it);
      return { ok: true, mensaje: 'Integrante actualizado.' };
    }
    if (accion === 'quitar') {
      if (mios.length <= 1) throw new Error('El equipo debe tener al menos un integrante.');
      if (String(it.registro) === String(ses.registro)) throw new Error('No puedes quitarte a ti mismo mientras usas el simulador.');
      sh_('Integrantes').deleteRow(it._row);
      return { ok: true, mensaje: 'Integrante quitado.' };
    }
    throw new Error('Acción desconocida.');
  });
}

// ---------- recuperación de docentes ----------
function apiAXPregunta(email) {
  AX_migrar_();
  email = String(email || '').trim().toLowerCase();
  var d = rows_('Docentes').filter(function (x) { return String(x.email).toLowerCase() === email && AX_bool_(x.activo); })[0];
  if (!d || !d.pregunta || !d.respuestaHash) throw new Error('No encontramos una pregunta de seguridad para ese correo. Pide ayuda al superadministrador.');
  return { pregunta: d.pregunta };
}
function apiAXRecuperar(email, respuesta, nueva) {
  AX_migrar_();
  email = String(email || '').trim().toLowerCase();
  var k = 'rec|' + email;
  if (AX_bloqueado_(k)) throw new Error(AX_MSG_BLOQ);
  AX_validarClave_(nueva, 6);
  return AX_lock_(function () {
    var d = rows_('Docentes').filter(function (x) { return String(x.email).toLowerCase() === email && AX_bool_(x.activo); })[0];
    if (!d || !AX_coincide_(AX_normResp_(respuesta), d.respuestaHash, d.respuestaSal)) { AX_intento_(k, false); throw new Error('La respuesta no es correcta.'); }
    AX_intento_(k, true);
    var sl = AX_sal_(); d.claveHash = AX_hash_(nueva, sl); d.claveSal = sl; d.claveTemporal = false; updateRow_('Docentes', d);
    log_(email, 'recuperarClave', '');
    return { ok: true, mensaje: 'Contraseña cambiada. Ya puedes ingresar con tu correo y la contraseña nueva.' };
  });
}

// ---------- invitaciones ----------
function AX_buscarInv_(tok) {
  var h = AX_hash_(tok, 'inv');
  return rows_('Invitaciones').filter(function (r) { return String(r.tokenHash) === h; })[0];
}
function AX_estadoInvitacion_(tok) {
  var r = tok ? AX_buscarInv_(String(tok)) : null;
  if (!r) return { ok: false, mensaje: 'Este enlace de invitación no es válido.' };
  if (AX_bool_(r.usada)) return { ok: false, mensaje: 'Este enlace de invitación ya fue usado. Pide uno nuevo al superadministrador.' };
  if (new Date(r.vence).getTime() < Date.now()) return { ok: false, mensaje: 'Este enlace de invitación venció (dura 72 horas). Pide uno nuevo al superadministrador.' };
  return { ok: true, pregunta: r.pregunta, rol: r.rol };
}
function apiAXInvitacion(tok) { AX_migrar_(); return AX_estadoInvitacion_(tok); }
function apiAXAlta(tok, datos) {
  AX_migrar_();
  datos = datos || {};
  var nombre = String(datos.nombre || '').trim().replace(/\s+/g, ' '), email = String(datos.email || '').trim().toLowerCase();
  if (nombre.length < 3) throw new Error('Escribe tu nombre completo.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Escribe un correo válido.');
  var clave = AX_validarClave_(datos.clave, 6);
  if (datos.confirmar !== undefined && String(datos.confirmar) !== clave) throw new Error('Las contraseñas no coinciden.');
  var resp = AX_normResp_(datos.respuesta);
  if (resp.length < 2) throw new Error('Responde la pregunta de seguridad.');
  return AX_lock_(function () {
    var est = AX_estadoInvitacion_(tok); if (!est.ok) throw new Error(est.mensaje);
    var docs = rows_('Docentes');
    if (docs.some(function (d) { return String(d.email).toLowerCase() === email; })) throw new Error('Ya existe un docente con ese correo.');
    var n = docs.length + 1, id; do { id = 'D' + ('0' + n).slice(-2); n++; } while (docs.some(function (d) { return d.docenteId === id; }));
    var sl = AX_sal_(), sr = AX_sal_(), inv = AX_buscarInv_(String(tok));
    var d = { docenteId: id, nombre: nombre, email: email, rol: inv.rol === 'superadmin' ? 'superadmin' : 'profesor', claveHash: AX_hash_(clave, sl), claveSal: sl, claveTemporal: false, pregunta: inv.pregunta, respuestaHash: AX_hash_(resp, sr), respuestaSal: sr, activo: true, creado: new Date() };
    appendObj_('Docentes', d);
    inv.usada = true; inv.usadaPor = email; updateRow_('Invitaciones', inv);
    log_(email, 'altaDocente', id);
    return { token: AX_newSession_({ rol: 'docente', docenteId: id, email: email, nombre: nombre, superadmin: d.rol === 'superadmin', tmp: false }), tipo: 'docente', nombre: nombre, rol: d.rol };
  });
}

// ---------- gestión de docentes (superadmin) y cuenta propia ----------
function AX_docPublico_(d) {
  return { docenteId: d.docenteId, nombre: d.nombre, email: d.email, rol: d.rol, activo: AX_bool_(d.activo), temporal: AX_bool_(d.claveTemporal), pregunta: d.pregunta || '', tieneRespuesta: !!d.respuestaHash };
}
function apiAXDocentes(tok, accion, datos) {
  var s = sess_(tok, 'docente');
  if (!s.superadmin) throw new Error('Solo el superadministrador gestiona docentes.');
  datos = datos || {};
  if (accion === 'listar') {
    var ahora = Date.now();
    return {
      docentes: rows_('Docentes').map(AX_docPublico_),
      invitaciones: rows_('Invitaciones').map(function (r) { return { invId: r.invId, rol: r.rol, pregunta: r.pregunta, creada: r.creada ? new Date(r.creada).toISOString() : '', vence: r.vence ? new Date(r.vence).toISOString() : '', estado: AX_bool_(r.usada) ? 'usada por ' + r.usadaPor : (new Date(r.vence).getTime() < ahora ? 'vencida' : 'pendiente') }; }).reverse().slice(0, 30)
    };
  }
  return AX_lock_(function () {
    if (accion === 'invitar') {
      var preg = String(datos.pregunta || '').trim();
      if (preg.length < 8) throw new Error('Escribe la pregunta de seguridad que deberá responder el docente.');
      var t = Utilities.getUuid(), L = rows_('Invitaciones'), id = 'INV' + ('00' + (L.length + 1)).slice(-3);
      appendObj_('Invitaciones', { invId: id, tokenHash: AX_hash_(t, 'inv'), rol: datos.rol === 'superadmin' ? 'superadmin' : 'profesor', pregunta: preg, creadoPor: s.email, creada: new Date(), vence: new Date(Date.now() + AX_INV_HORAS * 3600000), usada: false, usadaPor: '' });
      log_(s.email, 'invitar', id);
      var base = AX_url_();
      return { ok: true, enlace: (base || '[URL de la aplicación web]') + '?invitacion=' + t, mensaje: 'Invitación creada. El enlace sirve una sola vez y vence en 72 horas.' };
    }
    if (accion === 'anularInvitacion') {
      var inv = rows_('Invitaciones').filter(function (r) { return r.invId === datos.invId; })[0]; if (!inv) throw new Error('Invitación no encontrada.');
      inv.vence = new Date(Date.now() - 1000); updateRow_('Invitaciones', inv);
      return { ok: true, mensaje: 'Invitación anulada.' };
    }
    var d = rows_('Docentes').filter(function (x) { return String(x.docenteId) === String(datos.docenteId); })[0];
    if (!d) throw new Error('Docente no encontrado.');
    if (accion === 'pregunta') {
      var p = String(datos.pregunta || '').trim(), r = AX_normResp_(datos.respuesta);
      if (p.length < 8 || r.length < 2) throw new Error('Escribe la pregunta y su respuesta.');
      var sr = AX_sal_(); d.pregunta = p; d.respuestaHash = AX_hash_(r, sr); d.respuestaSal = sr; updateRow_('Docentes', d);
      return { ok: true, mensaje: 'Pregunta de seguridad guardada para ' + d.nombre + '.' };
    }
    if (accion === 'activo') {
      if (String(d.docenteId) === String(s.docenteId)) throw new Error('No puedes desactivar tu propia cuenta.');
      d.activo = !!datos.valor; updateRow_('Docentes', d);
      return { ok: true, mensaje: d.nombre + (d.activo ? ' puede ingresar.' : ' ya no puede ingresar.') };
    }
    if (accion === 'claveTemporal') {
      var t2 = AX_tempClave_(), sl = AX_sal_(); d.claveHash = AX_hash_(t2, sl); d.claveSal = sl; d.claveTemporal = true; updateRow_('Docentes', d);
      log_(s.email, 'claveTemporalDocente', d.email);
      return { ok: true, clave: t2, mensaje: 'Contraseña temporal para ' + d.nombre + ': ' + t2 + '. Deberá cambiarla al ingresar.' };
    }
    throw new Error('Acción desconocida.');
  });
}
function apiAXCuenta(tok, accion, datos) {
  var s = sess_(tok, 'docente'); datos = datos || {};
  var d = rows_('Docentes').filter(function (x) { return String(x.docenteId) === String(s.docenteId); })[0];
  if (!d) throw new Error('Docente no encontrado.');
  if (accion === 'ver') return AX_docPublico_(d);
  if (accion === 'pregunta') {
    return AX_lock_(function () {
      if (!AX_coincide_(datos.clave, d.claveHash, d.claveSal)) throw new Error('La contraseña actual no es correcta.');
      var p = String(datos.pregunta || '').trim(), r = AX_normResp_(datos.respuesta);
      if (p.length < 8 || r.length < 2) throw new Error('Escribe la pregunta y su respuesta.');
      var sr = AX_sal_(); d.pregunta = p; d.respuestaHash = AX_hash_(r, sr); d.respuestaSal = sr; updateRow_('Docentes', d);
      return { ok: true, mensaje: 'Pregunta de seguridad guardada.' };
    });
  }
  throw new Error('Acción desconocida.');
}

// ---------- panel docente: equipos ----------
/** Simulaciones visibles: el profesor solo las suyas; el superadmin todas. */
function AX_puedeSim_(ses, sim) { return !!sim && (ses.superadmin || String(sim.docenteId) === String(ses.docenteId)); }
function AX_simDe_(ses, simId) {
  var s = simById_(simId);
  if (!AX_puedeSim_(ses, s)) throw new Error('Simulación no encontrada.');
  return s;
}
function apiAXEquipos(tok, accion, datos) {
  var ses = sess_(tok, 'docente'); datos = datos || {};
  var sim = AX_simDe_(ses, datos.simId), pa = partida_(sim.simId), props = AX_props_();
  if (accion === 'listar') {
    var ints = integrantesDe_(pa.simId);
    return {
      sim: { simId: pa.simId, nombre: pa.nombre, sigla: pa.sigla, codigo: pa.codigo, acceso: sim.acceso || 'activa', registroAbierto: pa.registroAbierto, maxIntegrantes: pa.maxIntegrantes, t: pa.t },
      equipos: equiposDe_(pa.simId).map(function (e, k) {
        return { n: k + 1, equipoId: e.equipoId, nombre: e.nombre, temporal: AX_bool_(e.claveTemporal), bloqueado: AX_bool_(e.edicionBloqueada), tempPendiente: props.getProperty('AX_TMP_' + e.equipoId) || '',
          integrantes: ints.filter(function (i) { return String(i.equipoId) === String(e.equipoId); }).map(function (i) { return { registro: String(i.registro), apPaterno: i.apPaterno, apMaterno: i.apMaterno, nombres: i.nombres, celular: String(i.celular || '') }; }) };
      })
    };
  }
  return AX_lock_(function () {
    var eq = equipoById_(datos.equipoId);
    if (!eq || String(eq.simId) !== String(pa.simId)) throw new Error('Equipo no válido.');
    if (accion === 'renombrar') {
      var nom = String(datos.nombre || '').trim().replace(/\s+/g, ' ');
      if (nom.length < 3 || nom.length > 40) throw new Error('El nombre del equipo debe tener entre 3 y 40 caracteres.');
      if (equiposDe_(pa.simId).some(function (e) { return e.equipoId !== eq.equipoId && AX_norm_(e.nombre) === AX_norm_(nom); })) throw new Error('Ya existe un equipo con ese nombre en esta simulación.');
      eq.nombre = nom; updateRow_('Equipos', eq);
      return { ok: true, mensaje: 'Nombre corregido.' };
    }
    if (accion === 'claveTemporal') {
      var t = AX_tempClave_(), sl = AX_sal_();
      eq.claveHash = AX_hash_(t, sl); eq.claveSal = sl; eq.claveTemporal = true; updateRow_('Equipos', eq);
      props.deleteProperty('AX_TMP_' + eq.equipoId);
      log_(ses.email, 'claveTemporalEquipo', pa.codigo + ' ' + eq.nombre);
      return { ok: true, clave: t, equipo: eq.nombre };
    }
    if (accion === 'ocultarTemp') { props.deleteProperty('AX_TMP_' + eq.equipoId); return { ok: true }; }
    if (accion === 'bloquear') {
      eq.edicionBloqueada = !!datos.valor; updateRow_('Equipos', eq);
      return { ok: true, mensaje: eq.edicionBloqueada ? 'Edición de integrantes bloqueada para ' + eq.nombre + '.' : 'El equipo ' + eq.nombre + ' puede volver a editar sus integrantes.' };
    }
    if (accion === 'eliminar') {
      integrantesDe_(pa.simId, eq.equipoId).sort(function (a, b) { return b._row - a._row; }).forEach(function (i) { sh_('Integrantes').deleteRow(i._row); });
      deleteRowsWhere_('Decisiones', function (id) { return String(id) === String(eq.equipoId); });
      sh_('Equipos').deleteRow(equipoById_(eq.equipoId)._row);
      props.deleteProperty('AX_TMP_' + eq.equipoId);
      log_(ses.email, 'eliminarEquipo', pa.codigo + ' ' + eq.nombre);
      return { ok: true, mensaje: 'Equipo eliminado.' };
    }
    var todos = integrantesDe_(pa.simId), mios = todos.filter(function (i) { return String(i.equipoId) === String(eq.equipoId); });
    if (accion === 'intAgregar') {
      var o = limpiarIntegrante_(datos, 0);
      if (mios.length >= pa.maxIntegrantes) throw new Error('El equipo ya tiene el máximo de ' + pa.maxIntegrantes + ' integrantes.');
      if (todos.some(function (i) { return String(i.registro) === o.registro; })) throw new Error('Ese registro ya existe en la simulación.');
      appendObj_('Integrantes', { simId: pa.simId, equipoId: eq.equipoId, registro: o.registro, apPaterno: o.apPaterno, apMaterno: o.apMaterno, nombres: o.nombres, celular: o.celular, pin: '', creado: new Date() });
      return { ok: true, mensaje: 'Integrante agregado.' };
    }
    var it = mios.filter(function (i) { return String(i.registro) === String(datos.registroOriginal || datos.registro); })[0];
    if (!it) throw new Error('Integrante no encontrado.');
    if (accion === 'intEditar') {
      var e2 = limpiarIntegrante_(datos, 0);
      if (e2.registro !== String(it.registro) && todos.some(function (i) { return String(i.registro) === e2.registro; })) throw new Error('Ese registro ya existe en la simulación.');
      it.apPaterno = e2.apPaterno; it.apMaterno = e2.apMaterno; it.nombres = e2.nombres; it.registro = e2.registro; it.celular = e2.celular;
      updateRow_('Integrantes', it);
      return { ok: true, mensaje: 'Integrante actualizado.' };
    }
    if (accion === 'intQuitar') {
      if (mios.length <= 1) throw new Error('El equipo debe conservar al menos un integrante. Para quitarlo todo, elimine el equipo.');
      sh_('Integrantes').deleteRow(it._row);
      return { ok: true, mensaje: 'Integrante quitado.' };
    }
    throw new Error('Acción desconocida.');
  });
}

// ---------- menú de la hoja (solo el dueño del script) ----------
function axRestablecerSuperadmin() {
  AX_migrar_();
  var r = AX_lock_(function () {
    var d = rows_('Docentes').filter(function (x) { return x.rol === 'superadmin'; })[0];
    if (!d) throw new Error('No hay superadministrador.');
    var t = AX_tempClave_(), sl = AX_sal_(); d.claveHash = AX_hash_(t, sl); d.claveSal = sl; d.claveTemporal = true; d.activo = true; updateRow_('Docentes', d);
    return { email: d.email, clave: t };
  });
  var txt = 'Superadministrador: ' + r.email + '\nContraseña temporal: ' + r.clave + '\nDeberá cambiarla al ingresar.';
  try { SpreadsheetApp.getUi().alert(txt); } catch (e) { Logger.log(txt); }
  return r;
}
/** Solo para pruebas internas: crea una sesión de integrante sin contraseña (no es invocable desde el navegador). */
function AX_tokenIntegrante_(simId, registro) {
  var it = integrantesDe_(simId).filter(function (i) { return String(i.registro) === String(registro); })[0];
  if (!it) throw new Error('Integrante no encontrado.');
  return AX_newSession_({ rol: 'equipo', equipoId: it.equipoId, simId: it.simId, registro: String(registro), tmp: false });
}
