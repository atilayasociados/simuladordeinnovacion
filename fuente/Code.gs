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
function estadoPrevio_(P, eq, t) {
  if (t <= 1) return initialState_(P, eq);
  var s = getJson_('Estados', eq.equipoId, t - 1);
  return s || initialState_(P, eq);
}

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
// ---------- vista del equipo ----------
function apiEstado(tok) {
  var ses = sess_(tok, 'equipo'), P = getParams_(), pa = partida_(ses.simId), eq = equipoById_(ses.equipoId);
  var tVista = Math.min(pa.t, P.general.totalTrimestres + 1);
  var S = migrar_(estadoPrevio_(P, eq, tVista), P);
  var sched = scheduleEvents_(pa.semilla);
  var draft = tVista <= P.general.totalTrimestres ? filtrarBorrador_(getJson_('Decisiones', eq.equipoId, tVista), ses.registro) : null;
  var nots = tVista <= P.general.totalTrimestres ? senalesPara_(P, tVista, S, sched).map(function (n) { return { id: n.id, texto: n.texto, anticipada: n.anticipada, fuente: n.fuente, ambito: n.ambito, micro: n.micro, informe: n.informe, metodo: n.metodo, estudio: n.estudio }; }) : [];
  var yo = integrantesDe_(pa.simId, eq.equipoId).filter(function (i) { return String(i.registro) === String(ses.registro); })[0];
  return {
    partida: { nombre: pa.nombre, sigla: pa.sigla, codigo: pa.codigo, t: tVista, estado: pa.estado, total: P.general.totalTrimestres, finalizada: tVista > P.general.totalTrimestres },
    equipo: { id: eq.equipoId, nombre: eq.nombre, mandato: P.mandatos[S.mandato] || P.mandatos.MA },
    usuario: yo ? { registro: yo.registro, nombre: (yo.nombres + ' ' + yo.apPaterno).trim() } : { registro: ses.registro, nombre: ses.registro },
    flags: {
      anualEditable: esInicioAnio_(tVista), c4Disponible: S.c4resp === 'ninguna' && S.world.comps.some(function (c) { return c.id === 'C4' && c.activo; }) && !S.world.c4Adquirido,
      licitacion: tVista === 16, normaEtiquetado: normaEtiquetado_(tVista)
    },
    cat: {
      attrs: ATTR_NOMBRES, segmentos: P.segmentos.map(function (s) { return { id: s.id, nombre: s.nombre, part: s.part, g: s.g, pref: s.pref, est: s.est, nuevo: s.nuevo }; }),
      canales: P.canales, herramientas: P.herramientas || [], iniciativas: P.iniciativas, premios: P.premios, metodos: P.metodos, tiemposRef: tiemposReferencia_(P), gruposInv: P.gruposInv, modalidadesInv: P.modalidadesInv, descuentoContrato: P.descuentoContrato, contratoInicial: normContrato_(P, P.contratoInicial), fidelidades: P.fidelidades, umbrales: P.umbrales, posturas: P.posturas,
      p3: P3_CAT_, tecnicas: TECNICAS_, fuentesExt: FUENTES_EXT_, scamper: SCAMPER_, morfoParams: MORFO_PARAMS_, kanoNom: KANO_NOM_, tiposNom: TIPOS_NOM_, portafolioNom: PORTAFOLIO_NOM_, ptsNom: PTS_NOM_,
      general: { semanasTrimestre: P.general.semanasTrimestre, costoValidacion: P.general.costoValidacion, costoPiloto: P.general.costoPiloto, costoLanzamiento: P.general.costoLanzamiento, costoRevision: P.general.costoRevision, costoUnidadAutonoma: P.general.costoUnidadAutonoma, costoCapacitacion: P.general.costoCapacitacion, costoTiempoLibrePunto: P.general.costoTiempoLibrePunto, maxProyectos: P.general.maxProyectos, costoAlianzaC4: P.general.costoAlianzaC4, costoAdquisicionC4: P.general.costoAdquisicionC4, costoPatente: P.general.costoPatente, costoGestionProducto: P.general.costoGestionProducto, capexEscalamiento: P.general.capexEscalamiento, promoMax: P.general.promoMax, costoTestConcepto: P.general.costoTestConcepto, recargoAcelerar: P.general.recargoAcelerar }
    },
    estado: vistaEquipo_(P, S),
    empresas: empresasPublicas_(pa.simId, tVista - 1, eq.equipoId),
    noticias: nots,
    borrador: draft
  };
}
/** Lo que una empresa sabe públicamente de las demás: solo su nombre. Sus ventas y participación se conocen comprando investigación. */
function empresasPublicas_(simId, t, miId) {
  var res = t >= 1 ? rows_('Resultados').filter(function (r) { return String(r.simId) === String(simId) && Number(r.trimestre) === t; }) : [];
  return equiposDe_(simId).map(function (e) {
    var yo = String(e.equipoId) === String(miId);
    // La participación y los productos en el mercado son observables (los muestra el informe de Mercado);
    // las ventas de las otras empresas son privadas.
    var r = res.filter(function (x) { return String(x.equipoId) === String(e.equipoId); })[0] || null;
    return { nombre: e.nombre, yo: yo, ventas: r && yo ? Number(r.ventas) : null, cuota: r ? Number(r.cuotaTotal) : null, productos: r ? Number(r.productosActivos) : null, t: r ? t : null };
  });
}
function vistaEquipo_(P, S) {
  return {
    t: S.t, saldo: Math.round(S.saldo), presupuestoAnual: S.presupuestoAnual, org: S.org, iq: S.iq, conocimiento: S.conocimiento,
    vigilanciaHasta: S.vigilanciaHasta, c4resp: S.c4resp, feedback: S.feedback, noticiasEval: S.noticiasEval, lecturas: (S.lecturas || []).slice(-60), calibracion: S.calibracion || {}, herr: (S.world && S.world.herr) || {},
    informes: S.informes || [], ultMetodo: S.ultMetodo || {}, seguimiento: S.seguimiento || [], coherencia: S.coherencia || [], preparados: S.preparados || {},
    proyectos: S.proyectos.map(function (p) {
      var o2 = p.flujo === 2 ? vistaProyecto2_(p) : {};
      if (p.flujo === 2) { var o3 = vistaProyecto3_(P, S, p); Object.keys(o3).forEach(function (k) { o2[k] = o3[k]; }); }
      var o = {
        id: p.id, nombre: p.nombre, base: p.base, enfoque: p.enfoque || (p.base === 'nuevo' ? 'radical' : 'incremental'), reto: p.reto || '', segmento: p.segmento, etapa: p.etapa, estado: p.estado, inicio: p.inicio, fin: p.fin,
        iter: p.iter, calObs: p.calObs, fact: p.fact, viab: p.viab, puerta: p.puerta, piloto: p.piloto, revisado: p.revisado, falla: p.falla,
        ideaSel: p.ideaSel ? ideaPublica_(P, p.ideaSel, true) : (p.concepto ? conceptoPublico_(P, p.concepto) : null), productoId: p.productoId, gastoAcum: Math.round(p.gastoAcum || 0),
        pool: p.pool.map(function (it) { var o = ideaPublica_(P, it.ideaId, it.validada); o.pid = it.pid; o.qObs = it.qObs; o.validada = it.validada; o.fuente = it.fuente; o.t = it.t; return o; })
      };
      Object.keys(o2).forEach(function (k) { o[k] = o2[k]; });
      return o;
    }),
    productos: S.world.productos.filter(function (p) { return p.activo; }).map(function (p) {
      return { id: p.id, nombre: p.nombre, attrs: p.attrs, precio: p.precio, costUnit: p.costUnit, canales: p.canales, modelo: p.modelo, proteccion: p.proteccion, AW: p.AW, comunicacion: p.comunicacion, segPub: p.segPub || 'todos', pronHist: p.pronHist || [], desde: p.desde, legado: p.legado };
    }),
    hist: S.hist, hist0: S.hist0 || [],
    portafolioAnios: (function () { var out = [], aMax = Math.max(1, Math.ceil(((S.t || 0) + 1) / 4)); for (var a = 1; a <= aMax; a++) { var r = portafolioAnio_(S, a); if (r.meta || r.proyectos) out.push(r); } return out; })(),
    contrato: S.contrato || {}, contratoAnual: costoContratoAnual_(P, S.contrato || {}), contratoTrim: costoContratoTrim_(P, S.contrato || {}, Math.max(1, S.t + 1))
  };
}
function conceptoPublico_(P, c) {
  var txt = [];
  ATTRS.forEach(function (k) { if (c.ef[k]) txt.push(ATTR_NOMBRES[k] + ' +' + c.ef[k]); });
  if (c.ef.cu) txt.push('Costo por litro ' + (c.ef.cu > 0 ? '+' : '') + c.ef.cu.toFixed(2));
  return { ideaId: c.id, nombre: c.nombre, desc: c.desc, tipo: c.tipo, novedad: c.nov, riesgo: c.riesgo, costo: c.costo, efectos: txt.join(' · ') };
}
/** Borrador que ve un integrante: sus propias ideas; las de los demás solo sin autor y después de abrir la votación. */
function filtrarBorrador_(dec, reg) {
  if (!dec || !dec.proyectos) return dec;
  Object.keys(dec.proyectos).forEach(function (pid) {
    var a = dec.proyectos[pid]; if (!a || (!a.ind && !a.votos)) return;
    if (a.abrirVoto) {
      a._ideas = ideasReveladas_(a);
      var tot = {}, nv = 0;
      Object.keys(a.votos || {}).forEach(function (r) { var v = a.votos[r] || {}, n = 0; Object.keys(v).forEach(function (k) { tot[k] = (tot[k] || 0) + (Number(v[k]) || 0); n += Number(v[k]) || 0; }); if (n) nv++; });
      a._votosTot = tot; a._nVot = nv;
    }
    a._nAutores = Object.keys(a.ind || {}).filter(function (r) { return textosIdeas_(a.tecnica, a.ind[r]).length > 0; }).length;
    var mia = (a.ind || {})[reg], miVoto = (a.votos || {})[reg];
    a.ind = {}; if (mia) a.ind[reg] = mia;
    a.votos = {}; if (miVoto) a.votos[reg] = miVoto;
  });
  return dec;
}
/** Une el borrador recibido con el guardado: cada integrante solo modifica sus propias ideas y votos. */
function unirBorrador_(dec, prev, reg) {
  if (!dec || !dec.proyectos) return dec;
  var pp = (prev && prev.proyectos) || {};
  Object.keys(dec.proyectos).forEach(function (pid) {
    var a = dec.proyectos[pid] || {}, ex = pp[pid] || {};
    var ind = JSON.parse(JSON.stringify(ex.ind || {})), vot = JSON.parse(JSON.stringify(ex.votos || {}));
    if (a.ind && a.ind[reg]) ind[reg] = a.ind[reg];
    var abierto = !!(ex.abrirVoto || a.abrirVoto);
    if (abierto && a.votos && a.votos[reg]) {
      var v = {}, n = 0; Object.keys(a.votos[reg]).forEach(function (k) { var x = Math.max(0, Math.round(Number(a.votos[reg][k]) || 0)); if (x && n + x <= 3) { v[k] = x; n += x; } });
      vot[reg] = v;
    }
    a.ind = ind; a.votos = vot; a.abrirVoto = abierto;
    delete a._ideas; delete a._votosTot; delete a._nVot; delete a._nAutores;
  });
  return dec;
}
function ideaPublica_(P, id, conEfectos) {
  var i = ideaById_(P, id);
  var o = { ideaId: i.id, nombre: i.nombre, desc: i.desc, tipo: i.tipo, novedad: i.nov, riesgo: i.riesgo, costo: i.costo };
  if (conEfectos) {
    var ef = i.ef || {}, txt = [];
    ATTRS.forEach(function (k) { if (ef[k]) txt.push(ATTR_NOMBRES[k] + ' ' + (ef[k] > 0 ? '+' : '') + ef[k]); });
    if (ef.cu) txt.push('Costo por litro ' + (ef.cu > 0 ? '+' : '') + ef.cu.toFixed(2));
    if (ef.canal) txt.push('Canal: ' + canalById_(P, ef.canal).nombre);
    if (ef.modelo) txt.push('Modelo: suscripción');
    if (ef.flags && ef.flags.envaseLocal) txt.push('Envase local');
    if (ef.flags && ef.flags.contratoLeche) txt.push('Precio de leche asegurado');
    if (ef.flags && ef.flags.licitacion) txt.push('Prepara para licitaciones');
    o.efectos = txt.join(' · ') || 'Sin efectos relevantes';
  }
  return o;
}

// ---------- guardar decisiones ----------
function apiGuardar(tok, dec, enviar) {
  var ses = sess_(tok, 'equipo'), P = getParams_(), pa = partida_(ses.simId);
  if (pa.estado !== 'abierto') throw new Error('El trimestre está cerrado: el docente debe abrirlo para recibir decisiones.');
  if (pa.t > P.general.totalTrimestres) throw new Error('La partida terminó.');
  var eq = equipoById_(ses.equipoId), S = estadoPrevio_(P, eq, pa.t);
  var est = estimarCostos_(P, S, dec, pa.t);
  if (enviar && (!dec.hipotesis || String(dec.hipotesis).trim().length < 20)) throw new Error('Para enviar, escribe la hipótesis del equipo (al menos 20 caracteres).');
  if (enviar && esInicioAnio_(pa.t)) { var fA = anualFaltantes_(dec.anual); if (fA.length) throw new Error('Para enviar, completen la Estrategia anual: falta ' + fA.join(', ') + '.'); }
  if (enviar) {
    var acts = actividadesPlan_(P, migrar_(copy_(S), P), dec, pa.t, pa.semilla, scheduleEvents_(pa.semilla)), Cr = cronogramaLimpio_(dec.cronograma);
    var sinPlan = acts.filter(function (a) { return !Cr[a.concepto]; }).length;
    if (sinPlan) throw new Error('Para enviar, completen el cronograma de semanas-persona (4. Proyectos): faltan ' + sinPlan + ' actividad(es) sin estimación o sin semanas de inicio y fin.');
  }
  if (enviar) { var fS = senalesFaltantes_(P, migrar_(copy_(S), P), dec, pa.t, scheduleEvents_(pa.semilla)); if (fS.length) throw new Error('Para enviar, completen la lectura del entorno (1. Entorno): ' + fS.join(' y ') + '.'); }
  if (enviar && informesPendientes_(migrar_(S, P), dec, pa.t).length) throw new Error('Para enviar, escriban en Resultados → Informes de investigación qué decisión toman con cada informe recibido (al menos 10 caracteres).');
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    delete dec._estado; delete dec._fecha; delete dec._autor;
    unirBorrador_(dec, getJson_('Decisiones', eq.equipoId, pa.t), ses.registro);
    putJson_('Decisiones', eq.equipoId, pa.t, dec, { estado: enviar ? 'enviado' : 'borrador', autor: ses.registro });
  } finally { lock.releaseLock(); }
  log_(ses.registro, enviar ? 'enviar' : 'guardar', eq.equipoId + ' T' + pa.t);
  est.estado = enviar ? 'enviado' : 'borrador';
  return est;
}
function apiEstimar(tok, dec) {
  var ses = sess_(tok, 'equipo'), P = getParams_(), pa = partida_(ses.simId);
  var eq = equipoById_(ses.equipoId), S = estadoPrevio_(P, eq, Math.min(pa.t, P.general.totalTrimestres));
  var r = estimarCostos_(P, S, dec, pa.t);
  try { r.actividades = actividadesPlan_(P, S, dec || {}, pa.t, pa.semilla, scheduleEvents_(pa.semilla)); } catch (e) { r.actividades = []; }
  return r;
}
function apiBitacora(tok, datos) {
  var ses = sess_(tok, 'equipo'), pa = partida_(ses.simId), t = Math.max(1, Math.min(pa.t - 1, 20));
  if (pa.t <= 1) throw new Error('La bitácora se escribe después de recibir los resultados del primer trimestre.');
  var s = sh_('Bitacora'), r = findRow_('Bitacora', ses.equipoId, t);
  var fila = [ses.equipoId, t, new Date(), String(datos.decidimos || '').slice(0, 2000), String(datos.paso || '').slice(0, 2000), String(datos.porque || '').slice(0, 2000), String(datos.principio || '').slice(0, 2000)];
  if (r > 0) { s.getRange(r, 1, 1, fila.length).setValues([fila]); s.getRange(r, 10).setValue(ses.registro); }
  else { fila.push('', '', ses.registro); s.appendRow(fila); }
  return { ok: true, trimestre: t };
}
function apiMiBitacora(tok) {
  var ses = sess_(tok, 'equipo');
  return rows_('Bitacora').filter(function (r) { return String(r.equipoId) === String(ses.equipoId); }).map(function (r) {
    return { trimestre: r.trimestre, decidimos: r.decidimos, paso: r.paso, porque: r.porque, principio: r.principio, nota: r.nota, comentario: r.comentario, autor: r.autor };
  });
}

// ---------- procesamiento ----------
/** Productos activos de las otras empresas de la simulación (lo que ve el mercado). */
function rivalesDe_(equipos, mundos, i) {
  var out = [];
  mundos.forEach(function (W, j) {
    if (j === i || !W) return;
    W.productos.forEach(function (p) { if (p.activo) out.push({ empresa: equipos[j].nombre, id: p.id, nombre: p.nombre, attrs: p.attrs, precio: p.precio, canales: p.canales, AW: p.AW, legado: p.legado, desde: p.desde, penalHasta: p.penalHasta, activo: true, flags: p.flags || {}, promo: p.promo || 0, segPub: p.segPub || 'todos', comunicacion: p.comunicacion || 0, cuotaPorSeg: p.cuotaPorSeg || {}, u1: p.u1 || 0 }); });
  });
  return out;
}

function procesarTrimestre_(simId) {
  var P = getParams_(), pa = partida_(simId), t = pa.t;
  if (t > P.general.totalTrimestres) return { ok: false, mensaje: 'La partida ya terminó.' };
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var sched = scheduleEvents_(pa.semilla), equipos = equiposDe_(simId);
    if (!equipos.length) return { ok: false, mensaje: 'No hay equipos registrados en esta simulación.' };
    var sinEnvio = [], previos = [], decs = [];
    equipos.forEach(function (eq) {
      previos.push(estadoPrevio_(P, eq, t));
      var dec = getJson_('Decisiones', eq.equipoId, t);
      if (!dec || dec._estado !== 'enviado') sinEnvio.push(eq.nombre);
      if (dec) { delete dec._estado; delete dec._fecha; delete dec._autor; }
      decs.push(dec || {});
    });
    try { P4_aplicarEvaluaciones_(P, pa, equipos, previos); } catch (e4) { log_('sistema', 'evaluaciones', String(e4 && e4.message || e4)); }
    // Mercado compartido en dos pasadas: 1) cada empresa decide frente a la oferta anterior de sus rivales;
    // 2) se recalcula con la oferta final de todas, para que nadie dependa del orden de procesamiento.
    var N = equipos.length, mundos = previos.map(function (S) { return S.world; }), estados = [];
    var mundosPrev = mundos.slice(); // la investigación ve a los rivales como estaban al cierre del trimestre anterior
    for (var pasada = 0; pasada < 2; pasada++) {
      var nuevos = [];
      equipos.forEach(function (eq, i) {
        setMercado_(N, rivalesDe_(equipos, mundos, i), rivalesDe_(equipos, mundosPrev, i));
        nuevos.push({ eq: eq, S: simulateQuarter_(P, previos[i], decs[i], t, pa.semilla, sched) });
      });
      mundos = nuevos.map(function (x) { return x.S.world; });
      estados = nuevos;
    }
    setMercado_(1, []);
    if (t % 4 === 0 && t < P.general.totalTrimestres) ajustarPresupuestos_(P, estados.map(function (x) { return x.S; }));
    var pref = simId + '-';
    deleteRowsWhere_('Resultados', function (id, tt) { return tt === t && String(id).indexOf(pref) === 0; });
    var filas = [];
    estados.forEach(function (x) {
      putJson_('Estados', x.eq.equipoId, t, x.S);
      var h = x.S.hist[x.S.hist.length - 1];
      filas.push([x.eq.equipoId, x.eq.nombre, t, h.ventas, h.utilidadNeta, h.caja, h.cuotaTotal, h.cuotas.S1, h.cuotas.S2, h.cuotas.S3, h.cuotas.S4, h.cuotas.S5, h.vitalidad, h.intensidad, h.clima, h.madurez, h.MI, h.AE, h.aciertoNoticias === null ? '' : h.aciertoNoticias, h.gastoInnovTotal, h.saldo, h.twin.ventas, h.twin.utilidadNeta, x.S.world.productos.filter(function (p) { return p.activo; }).length, x.S.proyectos.filter(function (p) { return p.estado === 'activo'; }).length, simId]);
    });
    if (filas.length) { var rs = sh_('Resultados'); rs.getRange(rs.getLastRow() + 1, 1, filas.length, filas[0].length).setValues(filas); }
    var fin = t + 1 > P.general.totalTrimestres;
    setSim_(simId, { trimestre: t + 1, estado: fin ? 'cerrado' : 'abierto' });
    log_('docente', 'procesar', pa.codigo + ' T' + t + (sinEnvio.length ? ' sin envío: ' + sinEnvio.join(', ') : ''));
    return { ok: true, mensaje: 'Trimestre ' + t + ' procesado para ' + equipos.length + ' equipos.' + (sinEnvio.length ? ' Sin envío (se usó su borrador o ninguna acción): ' + sinEnvio.join(', ') + '.' : '') + (fin ? ' La partida terminó.' : ' El trimestre ' + (t + 1) + ' quedó abierto.') };
  } finally { lock.releaseLock(); }
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
function RESP_hoja_(tabla) { if (tabla === 'Evaluaciones') { try { P4_hoja_(); } catch (e) { } } try { return sh_(tabla); } catch (e) { return null; } }
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
    return x.split('PAR|' + viejo + '-').join('PAR|' + nuevo + '-').split('DOC|' + viejo).join('DOC|' + nuevo).split('"' + viejo + '-E').join('"' + nuevo + '-E').replace(new RegExp('^' + viejo + '-E'), nuevo + '-E');
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
  var P = getParams_();
  datos = datos || {};
  // acciones globales
  if (accion === 'simulaciones') {
    var eqs = rows_('Equipos'), ints = rows_('Integrantes');
    var nomDoc = {}; rows_('Docentes').forEach(function (d) { nomDoc[d.docenteId] = d.nombre; });
    return { yo: { nombre: ses.nombre, email: ses.email, superadmin: !!ses.superadmin, rol: ses.superadmin ? 'Superadministrador' : 'Profesor' }, total: P.general.totalTrimestres, mandatos: Object.keys(P.mandatos).map(function (k) { return { id: k, nombre: P.mandatos[k].nombre }; }),
      lista: simulaciones_().filter(function (s) { return AX_puedeSim_(ses, s); }).map(function (s) { var pa = partida_(s.simId); return { acceso: s.acceso || 'activa', docente: nomDoc[s.docenteId] || '', simId: pa.simId, codigo: pa.codigo, nombre: pa.nombre, sigla: pa.sigla, t: pa.t, estado: pa.estado, mandato: pa.mandato, maxIntegrantes: pa.maxIntegrantes, registroAbierto: pa.registroAbierto, equipos: eqs.filter(function (e) { return String(e.simId) === String(s.simId); }).length, integrantes: ints.filter(function (i) { return String(i.simId) === String(s.simId); }).length }; }) };
  }
  if (accion === 'crearSimulacion') {
    var nom = String(datos.nombre || '').trim(); if (!nom) throw new Error('Escribe el nombre de la simulación.');
    var maxI = clamp_(Math.round(Number(datos.maxIntegrantes) || 5), 1, 5);
    var id = RESP_nuevoSimId_();
    var cod = nuevoCodigo_();
    appendObj_('Simulaciones', { simId: id, codigo: cod, nombre: nom, sigla: String(datos.sigla || '').trim().toUpperCase(), semilla: String(Math.floor(Math.random() * 1e9)), trimestre: 1, estado: 'cerrado', mandato: datos.mandato || 'MA', maxIntegrantes: maxI, registroAbierto: true, creada: new Date(), docenteId: ses.docenteId, acceso: 'activa' });
    log_(ses.email, 'crearSimulacion', id + ' ' + cod + ' ' + nom);
    return { ok: true, simId: id, codigo: cod, mensaje: 'Simulación creada. Código para los estudiantes: ' + cod };
  }
  if (accion === 'restaurarSimulacion') return RESP_restaurar_(ses, datos.respaldo);
  // acciones de una simulación (el profesor solo las suyas)
  AX_simDe_(ses, datos.simId);
  var pa = partida_(datos.simId);
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
    if (datos.mandato !== undefined && datos.mandato !== pa.mandato) {
      if (pa.t > 1) throw new Error('El mandato solo puede cambiarse antes de procesar el trimestre 1.');
      cambios.mandato = datos.mandato;
      var claves = Object.keys(P.mandatos);
      equiposDe_(pa.simId).forEach(function (e) { e.mandato = datos.mandato === 'aleatorio' ? claves[Math.floor(Math.random() * claves.length)] : datos.mandato; updateRow_('Equipos', e); });
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
      total: P.general.totalTrimestres,
      equipos: eqs2.map(function (e) {
        var d = decs.filter(function (x) { return String(x.equipoId) === String(e.equipoId); })[0];
        var r = res.filter(function (x) { return String(x.equipoId) === String(e.equipoId); })[0];
        return { equipoId: e.equipoId, nombre: e.nombre, mandato: e.mandato, envio: d ? d.estado : 'sin decisiones', enviadoPor: d ? d.enviadoPor : '',
          integrantes: ints2.filter(function (i) { return String(i.equipoId) === String(e.equipoId); }).map(function (i) { return integrantePublico_(i, true); }),
          ultimo: r ? { ventas: r.ventas, utilidadNeta: r.utilidadNeta, caja: r.caja, cuotaTotal: r.cuotaTotal, vitalidad: r.vitalidad, clima: r.clima } : null };
      }),
      mandatos: Object.keys(P.mandatos).map(function (k) { return { id: k, nombre: P.mandatos[k].nombre }; })
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
  if (accion === 'renombrarEquipo' || accion === 'cambiarMandato') {
    var er = equipoById_(datos.equipoId); if (!er || er.simId !== pa.simId) throw new Error('Equipo no válido.');
    if (accion === 'renombrarEquipo') er.nombre = String(datos.nombre || '').trim() || er.nombre;
    else { if (pa.t > 1) throw new Error('El mandato solo puede cambiarse antes de procesar el trimestre 1.'); er.mandato = datos.mandato; }
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
    if (pa.t > P.general.totalTrimestres) throw new Error('La partida terminó.');
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
    try { P4_hoja_(); deleteRowsWhere_('Evaluaciones', function (id) { id = String(id); return id === 'DOC|' + pa.simId || id.indexOf('PAR|' + pr) === 0; }); } catch (e5) { }
    var c = { trimestre: 1, estado: 'cerrado' }; if (datos.nuevaSemilla) c.semilla = String(Math.floor(Math.random() * 1e9));
    setSim_(pa.simId, c);
    log_('docente', 'reiniciar', pa.codigo);
    return { ok: true, mensaje: 'Simulación reiniciada en el trimestre 1 (los equipos e integrantes se conservan).' };
  }
  if (accion === 'ranking') return rankingClase_(P, pa);
  if (accion === 'textos') return P4_textos_(P, pa);
  if (accion === 'calificar') return P4_calificar_(pa, datos);
  if (accion === 'debriefing') return P4_debriefing_(P, pa, clamp_(Math.round(Number(datos.anio) || 1), 1, 5));
  if (accion === 'resultados') {
    return rows_('Resultados').filter(function (r) { return String(r.simId) === String(pa.simId); }).map(function (r) { var o = {}; HOJAS.Resultados.forEach(function (h) { o[h] = r[h]; }); return o; });
  }
  if (accion === 'bitacoras') {
    var pb = pa.simId + '-';
    return rows_('Bitacora').filter(function (r) { return String(r.equipoId).indexOf(pb) === 0; }).map(function (r) { return { equipoId: r.equipoId, trimestre: r.trimestre, decidimos: r.decidimos, paso: r.paso, porque: r.porque, principio: r.principio, nota: r.nota, comentario: r.comentario, autor: r.autor, _row: r._row }; });
  }
  if (accion === 'calificarBitacora') {
    sh_('Bitacora').getRange(Number(datos.row), 8, 1, 2).setValues([[datos.nota, datos.comentario || '']]);
    return { ok: true };
  }
  throw new Error('Acción desconocida: ' + accion);
}

function rankingClase_(P, pa) {
  var tUlt = Math.min(pa.t - 1, P.general.totalTrimestres);
  if (tUlt < 1) return { filas: [], t: 0 };
  var datos = [];
  equiposDe_(pa.simId).forEach(function (eq) {
    var S = getJson_('Estados', eq.equipoId, tUlt); if (!S) return;
    var H = S.hist, last = H[H.length - 1];
    var v = valorEmpresa_(P, H, false), vt = valorEmpresa_(P, H, true);
    var tramo = H.filter(function (h) { return h.t >= 9; });
    var vit = tramo.length ? sum_(tramo.map(function (h) { return h.vitalidad; })) / tramo.length : last.vitalidad;
    var crec = (last.cuotas.S2 * 0.15 + last.cuotas.S4 * 0.10) / 0.25;
    var h13 = H.filter(function (h) { return h.t === 13; })[0], h16 = H.filter(function (h) { return h.t === 16; })[0];
    var resil = (h13 && h16) ? (h16.cuotaTotal - h13.cuotaTotal) : 0;
    var clima = sum_(H.map(function (h) { return h.clima; })) / H.length;
    var unAc = sum_(H.map(function (h) { return h.utilidadNeta; })), unTw = sum_(H.map(function (h) { return h.twin.utilidadNeta; }));
    var gInn = sum_(H.map(function (h) { return h.gastoInnovTotal; }));
    datos.push({ equipoId: eq.equipoId, nombre: eq.nombre, valor: v.valor, valorSinInnovar: vt.valor, vitalidad: r2_(vit), cuotaCrecimiento: r2_(crec), resiliencia: r2_(resil), madurez: last.madurez, clima: Math.round(clima), utilidadAcum: unAc, utilidadSinInnovar: unTw, roi: gInn > 0 ? r2_((unAc - unTw) / gInn) : 0, ventas: last.ventas, cuotaTotal: last.cuotaTotal, caja: last.caja });
  });
  function norm(k) { var a = datos.map(function (d) { return d[k]; }), mn = Math.min.apply(null, a), mx = Math.max.apply(null, a); datos.forEach(function (d) { d['n_' + k] = mx > mn ? (d[k] - mn) / (mx - mn) : 0.5; }); }
  ['valor', 'vitalidad', 'cuotaCrecimiento', 'resiliencia', 'madurez', 'clima'].forEach(norm);
  datos.forEach(function (d) { d.puntaje = Math.round(100 * (0.30 * d.n_valor + 0.20 * d.n_vitalidad + 0.15 * d.n_cuotaCrecimiento + 0.15 * d.n_resiliencia + 0.10 * d.n_madurez + 0.10 * d.n_clima)); });
  datos.sort(function (a, b) { return b.puntaje - a.puntaje; });
  return { filas: datos, t: tUlt };
}

/** Tiempos de referencia (semanas-persona) de las actividades que consumen tiempo del equipo, con su rango. */
function tiemposReferencia_(P) {
  var g = P.general, r = function (x) { return Math.max(0.5, Math.round(2 * x) / 2); };
  var L = [
    ['Idear', 'Técnica de ideación: ' + TECNICAS_.scamper.nombre, TECNICAS_.scamper.sem],
    ['Idear', 'Técnica de ideación: ' + TECNICAS_.flor.nombre, TECNICAS_.flor.sem],
    ['Idear', 'Técnica de ideación: ' + TECNICAS_.morfo.nombre, TECNICAS_.morfo.sem],
    ['Idear', 'Ideas de afuera: ' + FUENTES_EXT_.concurso.nombre, FUENTES_EXT_.concurso.sem],
    ['Idear', 'Ideas de afuera: ' + FUENTES_EXT_.intra.nombre, FUENTES_EXT_.intra.sem],
    ['Idear', 'Ideas de afuera: ' + FUENTES_EXT_.startups.nombre, FUENTES_EXT_.startups.sem],
    ['Evaluar', 'Test de concepto con clientes', 1],
    ['Prototipar', 'Prototipo y prueba con 5 u 8 usuarios', 1],
    ['Prototipar', 'Prototipo y prueba con 12 usuarios', 2],
    ['Especificar', 'Planta piloto y comité (puerta)', 2],
    ['Piloto', 'Piloto en tiendas', g.semPiloto],
    ['Lanzar', 'Lanzamiento', g.semLanzamiento],
    ['Revisar', 'Revisión después de la acción', g.semRevision],
    ['Estrategia anual', 'Capacitación en Design Thinking', g.semCapacitacion]
  ];
  return L.map(function (x) { return { fase: x[0], actividad: x[1], ref: x[2], min: r(x[2] * 0.8), max: r(x[2] * 1.35) }; });
}

