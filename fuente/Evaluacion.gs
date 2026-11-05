/**
 * Simulador de Innovación — Etapa 4: evaluación entre equipos, calificación docente,
 * textos del curso y guía de debriefing.
 * Datos en la hoja "Evaluaciones" (mismo formato que "Decisiones"):
 *   equipoId = 'PAR|<equipo evaluador>', trimestre = t  → notas de ese equipo a fichas de otros.
 *   equipoId = 'DOC|<simId>', trimestre = 0             → calificaciones del docente.
 * Claves: fichas '<equipo>|<proyecto>|<ficha>'; prototipos '<equipo>|<proyecto>|V<versión>'.
 */
var P4_CRIT_FICHA_ = [['nov', 'Novedad'], ['via', 'Viabilidad'], ['cla', 'Claridad del concepto']];
var P4_CRIT_PROTO_ = [['tan', 'Tangible y responde a la pregunta'], ['pro', 'Probado con personas'], ['apr', 'Aprendizaje concreto'], ['cam', 'El cambio sale de lo observado']];

function P4_hoja_() {
  var ss = ss_(), s = ss.getSheetByName('Evaluaciones');
  if (!s) { s = ss.insertSheet('Evaluaciones', ss.getNumSheets()); s.getRange(1, 1, 1, 6).setValues([['equipoId', 'trimestre', 'estado', 'fecha', 'json', 'enviadoPor']]); s.setFrozenRows(1); }
  return s;
}
function P4_nota_(x) { var n = Math.round(Number(x)); return n >= 1 && n <= 9 ? n : null; }
function P4_media_(o, crit) { var v = crit.map(function (c) { return P4_nota_(o[c[0]]); }).filter(function (x) { return x !== null; }); return v.length === crit.length ? sum_(v) / v.length : null; }
function P4_delta_(prom) { return prom === null || prom === undefined ? 0 : clamp_((prom - 5) / 4 * 0.5, -0.5, 0.5); }

/** Lee todas las evaluaciones de una simulación: pares por clave y calificaciones docentes. */
function P4_leer_(simId) {
  P4_hoja_();
  var eqs = equiposDe_(simId).map(function (e) { return String(e.equipoId); }), out = { pares: {}, doc: {}, porEvaluador: {} };
  rows_('Evaluaciones').forEach(function (r) {
    var id = String(r.equipoId), o; try { o = r.json ? JSON.parse(r.json) : {}; } catch (e) { o = {}; }
    if (id === 'DOC|' + simId) { out.doc = o; return; }
    if (id.indexOf('PAR|') !== 0) return;
    var ev = id.slice(4); if (eqs.indexOf(ev) < 0) return;
    out.porEvaluador[ev + '|' + Number(r.trimestre)] = o;
    Object.keys(o).forEach(function (k) {
      var m = P4_media_(o[k], P4_CRIT_FICHA_); if (m === null) return;
      (out.pares[k] = out.pares[k] || []).push({ ev: ev, t: Number(r.trimestre), media: m, nov: P4_nota_(o[k].nov), via: P4_nota_(o[k].via), cla: P4_nota_(o[k].cla), com: String(o[k].com || '') });
    });
  });
  return out;
}
/** Resumen de los pares de una clave: promedio, n y si dos evaluadores difieren por más de 3 puntos. */
function P4_resPares_(L) {
  if (!L || !L.length) return null;
  var med = L.map(function (x) { return x.media; });
  return { prom: r1_(sum_(med) / med.length), n: L.length, alerta: (Math.max.apply(null, med) - Math.min.apply(null, med)) > 3, detalle: L.map(function (x) { return { media: r1_(x.media), nov: x.nov, via: x.via, cla: x.cla, com: x.com }; }) };
}
/** Ajuste total de calidad de una ficha (máximo ±0,5). Con nota docente y de pares: 60 % docente y 40 % pares. */
function P4_ajusteFicha_(rp, doc) {
  var dp = rp ? P4_delta_(rp.prom) : null, md = doc ? P4_media_(doc, P4_CRIT_FICHA_) : null, dd = md !== null ? P4_delta_(md) : null;
  var t = dd !== null ? (dp !== null ? 0.6 * dd + 0.4 * dp : dd) : (dp !== null ? dp : 0);
  return r2_(clamp_(t, -0.5, 0.5));
}
/** Ajuste de un prototipo: rúbrica docente (±0,5) y +0,5 si se construyó de verdad con enlace de foto. Máximo +1. */
function P4_ajusteProto_(doc, foto) {
  if (!doc) return 0;
  var m = P4_media_(doc, P4_CRIT_PROTO_), d = m !== null ? P4_delta_(m) : 0;
  if (doc.construido && String(foto || '').trim()) d += 0.5;
  return r2_(clamp_(d, -0.5, 1));
}

/** Aplica pares y docente a los estados previos antes de procesar el trimestre. Idempotente: guarda lo ya aplicado. */
function P4_aplicarEvaluaciones_(P, pa, equipos, previos) {
  var E = P4_leer_(pa.simId);
  equipos.forEach(function (eq, i) {
    var S = previos[i]; if (!S || !S.proyectos) return;
    S.proyectos.forEach(function (pj) {
      if (pj.flujo !== 2) return;
      (pj.fichas || []).forEach(function (f) {
        var k = eq.equipoId + '|' + pj.id + '|' + f.id, rp = P4_resPares_(E.pares[k]), doc = E.doc[k];
        if (!rp && !doc && !f.p4Aj) return;
        var obj = P4_ajusteFicha_(rp, doc), dif = r2_(obj - (f.p4Aj || 0));
        if (!dif) return;
        f.Q = r1_(clamp_(f.Q + dif, 1, 9)); f.p4Aj = obj;
        if (pj.concepto && pj.concepto.id === f.id && pj.Q) pj.Q = r1_(clamp_(pj.Q + dif, 1, 9));
      });
      ((pj.proto && pj.proto.versiones) || []).forEach(function (v) {
        var k = eq.equipoId + '|' + pj.id + '|V' + v.v, obj = P4_ajusteProto_(E.doc[k], v.foto), dif = r2_(obj - (v.p4Aj || 0));
        if (!dif) return;
        v.p4Aj = obj;
        if (v === pj.proto.versiones[pj.proto.versiones.length - 1]) pj.calProto = r1_(clamp_((pj.calProto || 0) + dif, 0, 10));
      });
    });
  });
}

/** Fichas que cada equipo debe evaluar en el trimestre t: las fichas nuevas (del trimestre anterior) de otros dos equipos. */
function P4_asignacion_(P, pa, t) {
  var eqs = equiposDe_(pa.simId), con = [];
  if (t <= 1) return {};
  eqs.forEach(function (eq) {
    var S = getJson_('Estados', eq.equipoId, t - 1); if (!S) return;
    var L = [];
    (S.proyectos || []).forEach(function (pj) {
      if (pj.flujo !== 2) return;
      (pj.fichas || []).forEach(function (f) { if (f.t === t - 1 && !f.combinado) L.push({ key: eq.equipoId + '|' + pj.id + '|' + f.id, seg: pj.segmento, reto: pj.reto || '', nombre: f.nombre, frase: f.frase || '', pts: f.pts, precioObj: f.precioObj || 0, tipo4p: f.tipo4p || '' }); });
    });
    if (L.length) con.push({ eq: eq.equipoId, fichas: L });
  });
  var out = {}, letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  eqs.forEach(function (eq) {
    var otros = con.filter(function (c) { return c.eq !== eq.equipoId; });
    if (!otros.length) { out[eq.equipoId] = []; return; }
    var base = hashStr_(pa.semilla + '|' + t + '|' + eq.equipoId) % otros.length, sel = [];
    for (var j = 0; j < Math.min(2, otros.length); j++) sel.push(otros[(base + j) % otros.length]);
    var L = [];
    sel.forEach(function (c, j) { c.fichas.forEach(function (f) { var o = JSON.parse(JSON.stringify(f)); o.alias = 'Empresa ' + letras[j]; L.push(o); }); });
    out[eq.equipoId] = L;
  });
  return out;
}

// ---------- API del estudiante ----------
function apiPares(tok) {
  var ses = sess_(tok, 'equipo'), P = getParams_(), pa = partida_(ses.simId), t = Math.min(pa.t, P.general.totalTrimestres);
  var A = P4_asignacion_(P, pa, t)[ses.equipoId] || [];
  P4_hoja_();
  var mias = getJson_('Evaluaciones', 'PAR|' + ses.equipoId, t) || {};
  delete mias._estado; delete mias._fecha; delete mias._autor;
  return { t: t, abierto: pa.estado === 'abierto' && pa.t <= P.general.totalTrimestres, asignadas: A, mias: mias, criterios: P4_CRIT_FICHA_ };
}
function apiGuardarPares(tok, notas) {
  var ses = sess_(tok, 'equipo'), P = getParams_(), pa = partida_(ses.simId), t = pa.t;
  if (pa.estado !== 'abierto' || t > P.general.totalTrimestres) throw new Error('El trimestre está cerrado: no se pueden guardar evaluaciones.');
  var A = P4_asignacion_(P, pa, t)[ses.equipoId] || [], keys = A.map(function (a) { return a.key; }), out = {};
  Object.keys(notas || {}).forEach(function (k) {
    if (keys.indexOf(k) < 0) return;
    var n = notas[k] || {}, o = { com: String(n.com || '').slice(0, 300) };
    P4_CRIT_FICHA_.forEach(function (c) { o[c[0]] = P4_nota_(n[c[0]]); });
    out[k] = o;
  });
  P4_hoja_();
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try { putJson_('Evaluaciones', 'PAR|' + ses.equipoId, t, out, { estado: 'pares', autor: ses.registro }); } finally { lock.releaseLock(); }
  var n = Object.keys(out).filter(function (k) { return P4_media_(out[k], P4_CRIT_FICHA_) !== null; }).length;
  return { ok: true, completas: n, total: keys.length };
}
/** Lo que los otros equipos y el docente dijeron de los conceptos y prototipos del propio equipo. */
function apiMisEvaluaciones(tok) {
  var ses = sess_(tok, 'equipo'), P = getParams_(), pa = partida_(ses.simId), eq = equipoById_(ses.equipoId);
  var S = estadoPrevio_(P, eq, Math.min(pa.t, P.general.totalTrimestres + 1)), E = P4_leer_(pa.simId), fichas = [], protos = [];
  (S.proyectos || []).forEach(function (pj) {
    if (pj.flujo !== 2) return;
    (pj.fichas || []).forEach(function (f) {
      var k = eq.equipoId + '|' + pj.id + '|' + f.id, rp = P4_resPares_(E.pares[k]), doc = E.doc[k];
      if (!rp && !doc) return;
      fichas.push({ proyecto: pj.nombre, nombre: f.nombre, t: f.t, pares: rp ? { prom: rp.prom, n: rp.n, comentarios: rp.detalle.map(function (d) { return d.com; }).filter(function (c) { return c; }), nov: P4_promCrit_(rp, 'nov'), via: P4_promCrit_(rp, 'via'), cla: P4_promCrit_(rp, 'cla') } : null,
        docente: doc ? { media: P4_media_(doc, P4_CRIT_FICHA_), nov: doc.nov, via: doc.via, cla: doc.cla, com: doc.com || '' } : null, ajuste: P4_ajusteFicha_(rp, doc) });
    });
    ((pj.proto && pj.proto.versiones) || []).forEach(function (v) {
      var doc = E.doc[eq.equipoId + '|' + pj.id + '|V' + v.v]; if (!doc) return;
      protos.push({ proyecto: pj.nombre, version: v.v, t: v.t, media: P4_media_(doc, P4_CRIT_PROTO_), notas: doc, construido: !!doc.construido, com: doc.com || '', ajuste: P4_ajusteProto_(doc, v.foto) });
    });
  });
  return { fichas: fichas, protos: protos, critFicha: P4_CRIT_FICHA_, critProto: P4_CRIT_PROTO_ };
}
function P4_promCrit_(rp, c) { var v = rp.detalle.map(function (d) { return d[c]; }).filter(function (x) { return x !== null && x !== undefined; }); return v.length ? r1_(sum_(v) / v.length) : null; }

// ---------- panel docente ----------
/** Todos los textos escritos por los equipos, ordenados por empresa, proyecto y fase. */
function P4_textos_(P, pa) {
  var tUlt = Math.min(pa.t - 1, P.general.totalTrimestres), E = P4_leer_(pa.simId), ints = integrantesDe_(pa.simId), nombres = {};
  ints.forEach(function (i) { nombres[String(i.registro)] = (i.nombres + ' ' + i.apPaterno).trim(); });
  var equipos = [];
  equiposDe_(pa.simId).forEach(function (eq) {
    var S = tUlt >= 1 ? getJson_('Estados', eq.equipoId, tUlt) : null, items = [], part = {};
    if (S) {
      (S.informes || []).forEach(function (inf) { if (String(inf.decision || '').trim()) items.push({ t: inf.t, proyecto: '', fase: 'Investigación', tipo: 'Decisión con el informe “' + inf.nombre + '”', texto: inf.decision }); });
      (S.proyectos || []).forEach(function (pj) {
        if (pj.flujo !== 2) return;
        var b = pj.brief || {}, pn = pj.nombre;
        items.push({ t: pj.inicio, proyecto: pn, fase: 'Definir', tipo: 'Brief', texto: 'Cuando ' + (b.cuando || '…') + ', quiero ' + (b.quiero || '…') + ', para ' + (b.para || '…') + '. Reto: ' + (pj.reto || '') + (b.frase ? ' · Evidencia: “' + b.frase + '”' : '') + (b.criterio ? ' · Criterio de éxito: ' + b.criterio : '') });
        (pj.ideas || []).forEach(function (x) {
          part[x.autor] = (part[x.autor] || 0) + x.textos.length;
          items.push({ t: x.t, proyecto: pn, fase: 'Idear', tipo: 'Ideas (' + (TECNICAS_[x.tecnica] ? TECNICAS_[x.tecnica].nombre : x.tecnica) + ')', autor: nombres[String(x.autor)] || String(x.autor), texto: x.textos.join(' · ') });
        });
        (pj.fichas || []).forEach(function (f) {
          var k = eq.equipoId + '|' + pj.id + '|' + f.id;
          items.push({ t: f.t, proyecto: pn, fase: 'Idear', tipo: 'Ficha de concepto' + (f.combinado ? ' (combinada)' : ''), texto: f.nombre + ': ' + (f.frase || '') + ' · Puntos: ' + PTS_KEYS_.filter(function (x) { return f.pts && f.pts[x]; }).map(function (x) { return PTS_NOM_[x] + ' ' + f.pts[x]; }).join(', '), key: k, calif: 'ficha', doc: E.doc[k] || null, pares: P4_resPares_(E.pares[k]) });
        });
        if (pj.justificacion) items.push({ t: (pj.historial || []).filter(function (h) { return h.fase === 'Evaluar'; }).map(function (h) { return h.t; }).pop() || pj.inicio, proyecto: pn, fase: 'Evaluar', tipo: 'Justificación de la elección', texto: pj.justificacion });
        ((pj.proto && pj.proto.versiones) || []).forEach(function (v) {
          var k = eq.equipoId + '|' + pj.id + '|V' + v.v;
          items.push({ t: v.t, proyecto: pn, fase: 'Prototipar', tipo: 'Prototipo versión ' + v.v, texto: 'Pregunta: ' + (v.pregunta || '') + ' · ' + (v.desc || '') + (v.aprendizaje ? ' · Aprendizaje: ' + v.aprendizaje : '') + ' · Resultado: ' + (v.conclusion || ''), foto: v.foto || '', key: k, calif: 'proto', doc: E.doc[k] || null });
        });
        if (pj.acta) items.push({ t: pj.acta.t, proyecto: pn, fase: 'Puerta', tipo: 'Caso de negocio y pre-mortem', texto: 'Precio Bs ' + pj.acta.caso.precioU + ' · volumen ' + pj.acta.caso.volumen + ' · publicidad Bs ' + pj.acta.caso.publicidad + ' · Riesgos elegidos: ' + (pj.acta.causas || []).map(function (c) { return P3_RIESGOS_[c] || c; }).join('; ') + (pj.acta.mitig ? ' · Cómo los evitarían: ' + pj.acta.mitig : '') + ' · Veredicto: ' + pj.acta.veredicto });
        if (pj.pil) items.push({ t: pj.pil.t, proyecto: pn, fase: 'Piloto', tipo: 'Pronóstico y límite', texto: 'Pronóstico ' + pj.pil.pronostico + ', vendidas ' + pj.pil.vendidas + ' · límite de recompra ' + pj.pil.limite + ' %, logrado ' + pj.pil.recompra + ' %' });
        if (pj.lan) items.push({ t: pj.lan.t, proyecto: pn, fase: 'Lanzar', tipo: 'Nombre y mensaje', texto: pj.lan.nombre + ': “' + pj.lan.mensaje + '”' + (pj.lan.mensajeOk ? '' : ' (no habla del beneficio principal)') });
        if (pj.aar) items.push({ t: pj.aar.t, proyecto: pn, fase: 'Revisión', tipo: 'Revisión después de la acción', texto: 'Por qué: ' + pj.aar.porque + ' · Clasificación: ' + (P3_TIPOFR_[pj.aar.tipo] || pj.aar.tipo) + ' · En este producto: ' + pj.aar.d1 + ' · En próximos proyectos: ' + pj.aar.d2 });
      });
    }
    var integ = ints.filter(function (i) { return String(i.equipoId) === String(eq.equipoId); }).map(function (i) { return { nombre: nombres[String(i.registro)], ideas: part[String(i.registro)] || 0 }; });
    var orden = ['Investigación', 'Definir', 'Idear', 'Evaluar', 'Prototipar', 'Puerta', 'Piloto', 'Lanzar', 'Revisión'];
    items.sort(function (a, b) { return String(a.proyecto).localeCompare(String(b.proyecto)) || orden.indexOf(a.fase) - orden.indexOf(b.fase) || a.t - b.t; });
    equipos.push({ equipoId: eq.equipoId, nombre: eq.nombre, participacion: integ, items: items });
  });
  var alertas = [];
  Object.keys(E.pares).forEach(function (k) { var r = P4_resPares_(E.pares[k]); if (r && r.alerta) alertas.push({ key: k, equipo: (equipoById_(k.split('|')[0]) || {}).nombre || k, detalle: r.detalle.map(function (d) { return d.media; }) }); });
  return { t: tUlt, equipos: equipos, alertas: alertas, critFicha: P4_CRIT_FICHA_, critProto: P4_CRIT_PROTO_ };
}
function P4_calificar_(pa, d) {
  var k = String(d.key || ''), eqId = k.split('|')[0], eq = equipoById_(eqId);
  if (!eq || String(eq.simId) !== String(pa.simId)) throw new Error('Elemento no válido.');
  var crit = d.tipo === 'proto' ? P4_CRIT_PROTO_ : P4_CRIT_FICHA_, o = { com: String(d.com || '').slice(0, 400) };
  crit.forEach(function (c) { o[c[0]] = P4_nota_(d[c[0]]); });
  if (d.tipo === 'proto') o.construido = !!d.construido;
  P4_hoja_();
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var all = getJson_('Evaluaciones', 'DOC|' + pa.simId, 0) || {}; delete all._estado; delete all._fecha; delete all._autor;
    if (d.borrar) delete all[k]; else all[k] = o;
    putJson_('Evaluaciones', 'DOC|' + pa.simId, 0, all, { estado: 'docente', autor: 'docente' });
  } finally { lock.releaseLock(); }
  return { ok: true, mensaje: d.borrar ? 'Calificación eliminada.' : 'Calificación guardada. Ajustará la calidad al procesar el próximo trimestre.' };
}

/** Datos para la guía de debriefing de un año (Crookall, 2010). */
function P4_debriefing_(P, pa, anio) {
  var tFin = Math.min(4 * anio, pa.t - 1, P.general.totalTrimestres), tIni = 4 * (anio - 1) + 1;
  if (tFin < tIni) return { anio: anio, filas: [], preguntas: [], vacio: true };
  var filas = [];
  equiposDe_(pa.simId).forEach(function (eq) {
    var S = getJson_('Estados', eq.equipoId, tFin); if (!S) return;
    var H = S.hist || [], h = H[H.length - 1] || {}, hA = H.filter(function (x) { return x.t >= tIni && x.t <= tFin; });
    var eleg = 0, valid = 0, tipos = [], refOk = 0, refN = 0, pron = [], lanz = [];
    (S.proyectos || []).forEach(function (pj) {
      if (pj.flujo !== 2) return;
      if (pj.concepto) { eleg++; if (pj.validadoSel) valid++; }
      if (pj.tipoReal) tipos.push({ proyecto: pj.nombre, decl: TIPOS_NOM_[pj.tipoDecl] || '', real: TIPOS_NOM_[pj.tipoReal] || '' });
      if (pj.acta && pj.acta.ref) { refN++; if (pj.acta.caso.volumen <= pj.acta.ref.p90) refOk++; }
      if (pj.pil && pj.pil.pronostico) pron.push({ que: 'Piloto de ' + pj.nombre, esperado: pj.pil.pronostico, real: pj.pil.vendidas });
      if (pj.acta && pj.resLanz) pron.push({ que: 'Lanzamiento de ' + pj.nombre, esperado: pj.acta.caso.volumen, real: pj.resLanz.unidades });
      if (pj.resLanz) lanz.push({ nombre: (pj.lan && pj.lan.nombre) || pj.nombre, cuota: pj.resLanz.cuota, validado: !!pj.validadoSel });
    });
    ((S.world && S.world.productos) || []).forEach(function (p) { (p.pronHist || []).forEach(function (x) { if (x.t >= tIni && x.t <= tFin && x.pron) pron.push({ que: p.nombre + ' T' + x.t, esperado: x.pron, real: x.real }); }); });
    var errs = pron.filter(function (x) { return x.esperado > 0; }).map(function (x) { return Math.abs(x.real - x.esperado) / x.esperado * 100; });
    var infs = (S.informes || []).filter(function (i) { return i.requiere && i.t >= tIni && i.t <= tFin; });
    var conDec = infs.filter(function (i) { return String(i.decision || '').trim().length >= 10; }).length;
    var evid = (S.proyectos || []).filter(function (pj) { return pj.flujo === 2 && pj.brief && pj.brief.evidencia; }).length;
    filas.push({ equipo: eq.nombre, ventas: h.ventas || 0, utilidad: sum_(hA.map(function (x) { return x.utilidadNeta || 0; })), cuota: h.cuotaTotal || 0,
      elegidos: eleg, validados: valid, lanzamientos: lanz, tipos: tipos, refOk: refOk, refN: refN, errorPron: errs.length ? Math.round(sum_(errs) / errs.length) : null, pronosticos: pron.slice(-4),
      informes: infs.length, conDecision: conDec, briefsConEvidencia: evid });
  });
  var vSi = filas.filter(function (f) { return f.elegidos && f.validados === f.elegidos; }), vNo = filas.filter(function (f) { return f.elegidos && f.validados < f.elegidos; });
  function promU(L) { return L.length ? Math.round(sum_(L.map(function (f) { return f.utilidad; })) / L.length) : null; }
  var difTipo = filas.reduce(function (s, f) { return s + f.tipos.filter(function (x) { return x.decl !== x.real; }).length; }, 0);
  var preguntas = [
    '¿Qué diferencia hubo entre los equipos que validaron sus conceptos antes de elegir (' + vSi.length + (vSi.length === 1 ? ' equipo' : ' equipos') + (promU(vSi) !== null ? ', utilidad media del año Bs ' + promU(vSi).toLocaleString('es-BO') : '') + ') y los que eligieron sin validar (' + vNo.length + (promU(vNo) !== null ? ', Bs ' + promU(vNo).toLocaleString('es-BO') : '') + ')? ¿Qué harían distinto?',
    'Los pronósticos del curso se desviaron en promedio ' + (function () { var e = filas.map(function (f) { return f.errorPron; }).filter(function (x) { return x !== null; }); return e.length ? Math.round(sum_(e) / e.length) + ' %' : '— %'; })() + '. ¿Por qué nos equivocamos y cómo nos ayuda la clase de referencia a pronosticar mejor?',
    'En ' + difTipo + (difTipo === 1 ? ' proyecto' : ' proyectos') + ' el tipo de innovación declarado no coincidió con el real. ¿En qué momento se separó lo que dijimos de lo que hicimos, y qué consecuencias tuvo en el mercado?'
  ];
  return { anio: anio, tIni: tIni, tFin: tFin, filas: filas, preguntas: preguntas };
}
