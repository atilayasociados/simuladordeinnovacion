/**
 * Simulador de Innovación — Motor de cálculo (v1.0)
 * Funciones puras: no leen ni escriben hojas. Reciben parámetros, estado y decisión,
 * y devuelven el nuevo estado del equipo.
 */

// ---------- utilidades ----------
function clamp_(x, a, b) { return Math.max(a, Math.min(b, x)); }
function r2_(x) { return Math.round(x * 100) / 100; }
function r1_(x) { return Math.round(x * 10) / 10; }
function copy_(o) { return JSON.parse(JSON.stringify(o)); }
function sum_(a) { return a.reduce(function (s, x) { return s + x; }, 0); }
function segById_(P, id) { for (var i = 0; i < P.segmentos.length; i++) if (P.segmentos[i].id === id) return P.segmentos[i]; return null; }
function canalById_(P, id) { for (var i = 0; i < P.canales.length; i++) if (P.canales[i].id === id) return P.canales[i]; return null; }
function ideaById_(P, id) { for (var i = 0; i < P.ideas.length; i++) if (P.ideas[i].id === id) return P.ideas[i]; return null; }
function iniById_(P, id) { for (var i = 0; i < P.iniciativas.length; i++) if (P.iniciativas[i].id === id) return P.iniciativas[i]; return null; }
var MET_SEG_ = ['encuesta', 'observacion', 'percepcion'];
var MET_TIPO_ = { A: 'Estudio de clientes', B: 'Estudio de mercado y competencia', C: 'Estudio de marca' };
function metById_(P, id) { for (var i = 0; i < P.metodos.length; i++) if (P.metodos[i].id === id) return P.metodos[i]; return null; }
function esInicioAnio_(t) { return (t - 1) % 4 === 0; }
function anioDe_(t) { return Math.floor((t - 1) / 4) + 1; }

// ---------- generador aleatorio con semilla (mulberry32) ----------
function hashStr_(s) {
  s = String(s); var h = 1779033703 ^ s.length;
  for (var i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}
function makeRng_(seed) {
  var a = hashStr_(seed);
  var f = function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.normal = function (m, s) { var u = 1 - f(), v = f(); return m + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  f.pickWeighted = function (items, weights) {
    var tot = sum_(weights); if (tot <= 0) return items[Math.floor(f() * items.length)];
    var x = f() * tot; for (var i = 0; i < items.length; i++) { x -= weights[i]; if (x <= 0) return items[i]; }
    return items[items.length - 1];
  };
  return f;
}

// ---------- calendario de eventos aleatorios (común a toda la partida) ----------
function scheduleEvents_(seed) {
  var rng = makeRng_('eventos|' + seed);
  var sched = { sequia: 0, bloqueos: [], ruido: {} };
  if (rng() < 0.4) sched.sequia = 5 + Math.floor(rng() * 15); // T5–T19
  for (var t = 1; t <= 20; t++) {
    if (t >= 2 && rng() < 0.3) sched.bloqueos.push(t);
    sched.ruido[t] = Math.floor(rng() * DEF.ruido.length);
  }
  return sched;
}

// ---------- mercado ----------
function segWeights_(seg, t) {
  var w = copy_(seg.w);
  if (t >= 18 && (seg.id === 'S2' || seg.id === 'S4')) { w.sost += 10; var q = Math.min(10, w.precio); w.precio -= q; if (q < 10) w.nut -= (10 - q); }
  return w;
}
function utility_(seg, attrs, precio, t) {
  var w = segWeights_(seg, t), u = 0;
  ATTRS.forEach(function (k) { u += (w[k] / 100) * (clamp_(attrs[k] || 0, 0, 10) / 10); });
  var ps = clamp_(Math.pow(seg.pref / Math.max(0.1, precio), seg.elas), 0, 1.2);
  return u + (w.precio / 100) * ps;
}
function canalFactor_(P, canales, segId, t) {
  var s = 0;
  (canales || []).forEach(function (c) {
    var ch = canalById_(P, c); if (!ch) return;
    var af = ch.af[segId] || 0;
    if (t >= 3 && (c === 'app' || c === 'delivery') && (segId === 'S2' || segId === 'S3')) af += 0.15;
    s += af;
  });
  return Math.min(1, s);
}
function demanda_(P, seg, t, sched) {
  var g = P.general;
  var d = g.mercadoTotal * seg.part * Math.pow(1 + seg.g, t - 1) * seg.est[(t - 1) % 4];
  if (sched.bloqueos.indexOf(t) >= 0) d *= 0.85;
  return d;
}
function normaPenal_(attrs, segId, t) {
  return (t >= 9 && (segId === 'S1' || segId === 'S4' || segId === 'S5') && (attrs.salud || 0) < 6) ? 0.8 : 1;
}

/** Calibra la opción de no compra A0 y el factor de lealtad del producto heredado P0 por segmento. */
function calibrate_(P) {
  var cal = { A0: {}, bf: {}, fitMax: {} };
  var p0 = P.producto0;
  P.segmentos.forEach(function (seg) {
    var Ac = 0;
    P.competidores.forEach(function (c) {
      if (c.entrada) return;
      Ac += Math.exp(P.general.beta * utility_(seg, c.attrs, c.precio, 1)) * (c.pres[seg.id] || 0);
    });
    var A0 = (seg.noCompra || 0.5) * Ac;
    var Ap0 = Math.exp(P.general.beta * utility_(seg, p0.attrs, P.general.precioP0, 1)) * canalFactor_(P, p0.canales, seg.id, 1) * 0.95;
    var sh = seg.cuota0;
    cal.A0[seg.id] = A0;
    cal.bf[seg.id] = sh * (A0 + Ac) / ((1 - sh) * Ap0);
    cal.fitMax[seg.id] = Math.max.apply(null, P.ideas.map(function (i) { return ideaFit_(P, i, seg.id); }));
  });
  return cal;
}

/**
 * Mercado compartido: N empresas (equipos) venden en la misma industria.
 * MKT_.N = número de empresas; MKT_.rivales = productos de las OTRAS empresas.
 * El mercado y la presencia de los competidores externos escalan con N, de modo que
 * cada empresa arranca con las mismas ventas que en el juego individual.
 */
var MKT_ = { N: 1, rivales: [], previos: [] };
function setMercado_(N, rivales, previos) { MKT_ = { N: Math.max(1, N || 1), rivales: rivales || [], previos: previos || rivales || [] }; }
/** Penalización del etiquetado frontal (menor si la empresa se preparó). */
function normaPenalP_(p, segId, t) { var f = normaPenal_(p.attrs, segId, t); var e = p.flags && p.flags.prepEtiq; e = e === true ? 1 : (Number(e) || 0); return f < 1 ? f + 0.1 * e : f; }
/** Efecto comercial de corto plazo: promoción en el punto de venta y publicidad dirigida a un segmento. */
function impulsoComercial_(p, segId) {
  var f = 1, pr = Number(p.promo) || 0;
  if (pr > 0) f *= 1 + 0.15 * pr / (pr + 30000);
  if (p.segPub && p.segPub !== 'todos' && (p.comunicacion || 0) > 0) f *= (p.segPub === segId ? 1.12 : 0.96);
  return f;
}
function atractivoProducto_(P, p, seg, t) {
  var A = Math.exp(P.general.beta * utility_(seg, p.attrs, p.precio, t)) * canalFactor_(P, p.canales, seg.id, t) * p.AW;
  if (p.legado) A *= P.cal.bf[seg.id];
  A *= normaPenalP_(p, seg.id, t) * impulsoComercial_(p, seg.id);
  if (p.penalHasta && t <= p.penalHasta) A *= 0.8;
  return A;
}

/** Atractivo de cada oferente en un segmento y cuotas resultantes. */
function marketShares_(P, world, seg, t) {
  var beta = P.general.beta, ofertas = [], N = MKT_.N;
  world.productos.forEach(function (p) {
    if (!p.activo || p.desde > t) return;
    var A = Math.exp(beta * utility_(seg, p.attrs, p.precio, t)) * canalFactor_(P, p.canales, seg.id, t) * p.AW;
    if (p.legado) A *= P.cal.bf[seg.id];
    A *= normaPenalP_(p, seg.id, t) * impulsoComercial_(p, seg.id);
    if (p.penalHasta && t <= p.penalHasta) A *= 0.8;
    if (seg.id === 'S2' && prepNivel_(world, 'startup') && world.comps.some(function (c) { return c.id === 'C4' && c.activo; })) A *= 1 + 0.05 * prepNivel_(world, 'startup');
    ofertas.push({ id: p.id, tipo: 'propio', A: A, U: utility_(seg, p.attrs, p.precio, t) });
  });
  world.comps.forEach(function (c) {
    if (!c.activo) return;
    var pres = c.pres[seg.id] || 0; if (pres <= 0) return;
    var A = Math.exp(beta * utility_(seg, c.attrs, c.precio, t)) * pres * normaPenal_(c.attrs, seg.id, t) * (c.factor || 1) * N;
    ofertas.push({ id: c.id, tipo: 'comp', A: A, U: utility_(seg, c.attrs, c.precio, t) });
  });
  MKT_.rivales.forEach(function (p) {
    if (!p.activo || p.desde > t) return;
    ofertas.push({ id: p.empresa + '|' + p.id, tipo: 'rival', empresa: p.empresa, A: atractivoProducto_(P, p, seg, t), U: utility_(seg, p.attrs, p.precio, t) });
  });
  var tot = P.cal.A0[seg.id] * N + sum_(ofertas.map(function (o) { return o.A; }));
  ofertas.forEach(function (o) { o.cuota = o.A / tot; });
  return ofertas;
}

// ---------- calidad de una idea para un proyecto ----------
function ideaFit_(P, idea, segId) {
  var seg = segById_(P, segId), w = seg.w, ef = idea.ef || {}, fit = 0;
  ATTRS.forEach(function (k) { fit += (w[k] / 100) * (ef[k] || 0); });
  fit += (w.precio / 100) * (-(ef.cu || 0) * 3);
  if (ef.canal) { var ch = canalById_(P, ef.canal); fit += (ch ? ch.af[segId] : 0) * 0.8; }
  if (ef.modelo === 'suscripcion' && (segId === 'S2' || segId === 'S3')) fit += 0.3;
  if (ef.flags && ef.flags.envaseLocal) fit += 0.3;
  var afin = idea.seg.indexOf(segId) >= 0 ? 1 : 0.6;
  return fit * afin;
}
function ideaQuality_(P, idea, segId, mandato) {
  var fmax = (P.cal && P.cal.fitMax && P.cal.fitMax[segId]) || 2;
  var ajuste = clamp_((ideaFit_(P, idea, segId) + 0.3) / (fmax + 0.3), 0, 1);
  var m = P.mandatos[mandato] || P.mandatos.MA;
  var nov = (idea.nov - 1) / 4, riesgoInv = 1 - (idea.riesgo - 1) / 8, tiempoInv = 1 - (idea.trim - 1) / 2, costoInv = 1 - clamp_(idea.costo / 150000, 0, 1);
  var base = m.w.nov * nov + m.w.riesgo * riesgoInv + m.w.tiempo * tiempoInv + m.w.costo * costoInv + m.w.ajuste * ajuste;
  // El ajuste al segmento condiciona todo: una idea novedosa pero inútil no es buena.
  var q = 1 + 8 * clamp_(base * (0.35 + 0.65 * ajuste) * 1.55, 0, 1);
  if (m.tipos.indexOf(idea.tipo) < 0) q = Math.min(q, 2);
  return r1_(q);
}

// ---------- estado inicial ----------
function initialWorld_(P) {
  var g = P.general, p0 = P.producto0;
  return {
    productos: [{ id: 'P0', nombre: p0.nombre, attrs: copy_(p0.attrs), costUnit: g.costoUnitBase, precio: g.precioP0, canales: p0.canales.slice(), modelo: 'venta', proteccion: 'ninguna', desde: 1, relanz: -99, AW: 0.95, activo: true, legado: true, comunicacion: g.publicidadBase || 0, segPub: 'todos', promo: 0, flags: {}, cuotaHist: [] }],
    comps: P.competidores.map(function (c) { return { id: c.id, nombre: c.nombre, attrs: copy_(c.attrs), precio: c.precio, precio0: c.precio, pres: copy_(c.pres), activo: !c.entrada, cortes: 0, ultCuota: {}, factor: 1 }; }),
    pendClones: [], clonados: [], invasion: g.invasionC4, c4Adquirido: false, alianza: false, prep: {},
    fin: { caja: 400000, cxc: 600000, inv: 500000, af: 2500000, intang: [], prov: 700000, deuda: 1300000, emerg: 0, capital: 1500000, resAcum: 500000, perdida: 0 }
  };
}

function initialState_(P, equipo) {
  var g = P.general, W0 = initialWorld_(P), T0 = initialWorld_(P);
  W0.productos[0].nombre = T0.productos[0].nombre = 'Leche saborizada 1 L';
  return {
    t: 0, equipoId: equipo.equipoId, mandato: equipo.mandato || 'MA',
    presupuestoAnual: g.presupuestoInicial, saldo: g.presupuestoInicial,
    org: { MI: 0.45, AE: 0.45, DIV: 0.2, madurez: 1, ultRevAnio: 0, capHasta: 0, tiempoLibre: 0, incentivo: 'reconocimiento', politica: 'neutral', composicion: 'homogenea', estructura: 'integrada', p4: { producto: 40, proceso: 20, posicion: 20, paradigma: 20 }, inc: 70, rad: 30, act: 80, nue: 20, nucleo: 70, adyacente: 20, transf: 10, postura: 'defensiva', umbral: 'moderado' },
    iq: { S1: 0, S2: 0, S3: 0, S4: 0, S5: 0 },
    conocimiento: { pesos: {}, competidores: null, tendencia: null },
    vigilanciaHasta: 0, proyectos: [], nextId: 1, nextPool: 1, nextProd: 1,
    world: W0, twin: T0,
    c4resp: 'ninguna', licitacionHecha: false, hist: [], feedback: [], noticiasEval: [],
    informes: [], ultMetodo: {}, preparados: {}, seguimiento: [], coherencia: [], nextInf: 1
  };
}

// ---------- noticias visibles para un equipo en el trimestre t ----------
function noticiasPara_(P, t, state, sched) {
  var lista = [];
  var vig = state && state.vigilanciaHasta >= t;
  function add(n, anticipada) { lista.push({ id: n.id, texto: n.texto, tipo: n.tipo, anticipada: !!anticipada }); }
  P.noticias.forEach(function (n) {
    if (n.t === t) add(n, false);
    else if (vig && n.t === t + 1) add(n, true);
  });
  if (sched.sequia && (t === sched.sequia - 1 || (vig && t === sched.sequia - 2)))
    add({ id: 'NSEQ', texto: 'El servicio meteorológico pronostica una sequía severa para el próximo trimestre.', tipo: 'amenaza' }, t === sched.sequia - 2);
  if (sched.bloqueos.indexOf(t) >= 0)
    add({ id: 'NBLQ' + t, texto: 'Organizaciones sociales anuncian bloqueos de carreteras esta temporada.', tipo: 'amenaza' }, false);
  var ri = sched.ruido[t] || 0;
  add({ id: 'NR' + t, texto: P.ruido[ri % P.ruido.length], tipo: 'ruido' }, false);
  // orden estable pero mezclado
  var rng = makeRng_('orden|' + t);
  return lista.map(function (x) { return { x: x, k: rng() }; }).sort(function (a, b) { return a.k - b.k; }).map(function (o) { return o.x; });
}

// ---------- costos ----------
function factorMadurez_(org) { return 1 - 0.05 * (org.madurez - 1); }
function semMadurez_(org, s) { return Math.max(1, s - 0.5 * (org.madurez - 1)); }

/** Simula un trimestre completo para un equipo. Devuelve el nuevo estado. */
function simulateQuarter_(P, prev, dec, t, seed, sched) {
  var S = migrar_(copy_(prev), P), g = P.general;
  prev = migrar_(copy_(prev), P);
  dec = dec || {};
  S.t = t; S.feedback = [];
  var W = S.world, fb = S.feedback;
  var rng = makeRng_(seed + '|' + S.equipoId + '|' + t);
  var semanas = g.semanasTrimestre, gastoInnov = 0, gastoCap = 0, gastoCom = 0, gastoOtros = 0, writeoff = 0, capexExtra = 0;
  var exitos = 0, fracasos = 0;

  // presupuesto anual
  if (esInicioAnio_(t) && t > 1) { /* el saldo se fijó al cierre del año anterior */ }
  function gastar(monto, sem, concepto, capitalizable) {
    monto = Math.round(monto);
    if (monto > S.saldo + 0.5) { fb.push('No se ejecutó "' + concepto + '": presupuesto insuficiente (saldo Bs ' + Math.round(S.saldo).toLocaleString('es-BO') + ').'); return false; }
    if (sem > semanas + 1e-9) { fb.push('No se ejecutó "' + concepto + '": semanas-persona insuficientes (' + semanas + ' disponibles).'); return false; }
    S.saldo -= monto; semanas -= sem;
    if (capitalizable) gastoCap += monto; else gastoInnov += monto;
    return true;
  }

  // 1. decisiones anuales (bloques A y B)
  var O = S.org;
  if (esInicioAnio_(t)) {
    if (t > 1) { Object.keys(S.iq).forEach(function (k) { S.iq[k] = Math.max(0, S.iq[k] - 0.05); }); }
    var A = dec.anual;
    if (A) {
      ['tiempoLibre', 'incentivo', 'politica', 'composicion', 'estructura', 'umbral'].forEach(function (k) { if (A[k] !== undefined && A[k] !== '') O[k] = A[k]; });
      ['inc', 'rad', 'act', 'nue'].forEach(function (k) { if (A[k] !== undefined && A[k] !== '') O[k] = Number(A[k]); });
      if (A.nucleo !== undefined && A.nucleo !== '') {
        O.nucleo = Number(A.nucleo) || 0; O.adyacente = Number(A.adyacente) || 0; O.transf = Number(A.transf) || 0;
        var sP = O.nucleo + O.adyacente + O.transf;
        if (sP !== 100 && sP > 0) { O.nucleo = Math.round(100 * O.nucleo / sP); O.adyacente = Math.round(100 * O.adyacente / sP); O.transf = 100 - O.nucleo - O.adyacente; fb.push('El portafolio no sumaba 100 %: se ajustó proporcionalmente a ' + O.nucleo + ' / ' + O.adyacente + ' / ' + O.transf + '.'); }
        portafolioAInterno_(O);
      }
      if (A.postura && P.posturas[A.postura]) O.postura = A.postura;
      if (A.p4 && ['producto', 'proceso', 'posicion', 'paradigma'].reduce(function (s, k) { return s + (Number(A.p4[k]) || 0); }, 0) > 0) O.p4 = { producto: Number(A.p4.producto) || 0, proceso: Number(A.p4.proceso) || 0, posicion: Number(A.p4.posicion) || 0, paradigma: Number(A.p4.paradigma) || 0 };
      O.tiempoLibre = Number(O.tiempoLibre) || 0;
      if (A.capacitacion === true || A.capacitacion === 'si') { if (gastar(g.costoCapacitacion * factorMadurez_(O), g.semCapacitacion, 'Capacitación en Design Thinking')) O.capHasta = t + 3; }
    }
    var costoInc = { reconocimiento: 5000, bajo: 15000, alto: 40000 }[O.incentivo] || 0;
    gastar(costoInc, 0, 'Incentivos del año');
    if (O.estructura === 'autonoma') gastar(g.costoUnidadAutonoma, 0, 'Unidad autónoma');
  }
  if (O.tiempoLibre > 0) gastar(O.tiempoLibre * g.costoTiempoLibrePunto, 0, 'Tiempo libre para proyectos');
  // conflicto de recursos (Christensen): sin unidad autónoma y con alta proporción radical
  var hayRadical = S.proyectos.some(function (p) { return p.estado === 'activo' && p.base === 'nuevo'; });
  if ((t % 4 === 2 || t % 4 === 3) && O.estructura !== 'autonoma' && O.rad > 40 && hayRadical) {
    var recorte = Math.round(S.saldo * 0.15); S.saldo -= recorte; semanas -= 4;
    fb.push('La línea principal reclamó recursos para sus clientes actuales: sin unidad autónoma y con ' + O.rad + ' % de esfuerzo radical, perdiste 4 semanas-persona y Bs ' + recorte.toLocaleString('es-BO') + ' de presupuesto este trimestre.');
  }

  // 2. clima
  var TL = { 0: 0, 10: 0.12, 15: 0.16, 20: 0.18 }[O.tiempoLibre] || 0;
  var INC = { reconocimiento: 0.12, bajo: 0.05, alto: -0.10 }[O.incentivo] || 0;
  var cap = t <= O.capHasta ? 1 : 0;
  var MIstar = clamp_(0.40 + TL + INC + 0.05 * cap, 0, 1);
  var MIprev = O.MI;
  O.MI = r2_(0.6 * O.MI + 0.4 * MIstar);
  O.DIV = { homogenea: 0.2, multifuncional: 0.6, externos: 0.8 }[O.composicion] || 0.2;
  var PF = { sancion: -0.04, neutral: 0, aprendizaje: 0.03 }[O.politica] || 0;
  O.AE = r2_(clamp_(O.AE + PF, 0, 1));
  if (Math.abs(O.MI - MIprev) >= 0.02) fb.push('La motivación intrínseca del equipo ' + (O.MI > MIprev ? 'subió' : 'bajó') + ' a ' + O.MI.toFixed(2) + (O.incentivo === 'alto' ? ' (los incentivos monetarios altos reducen la motivación intrínseca).' : '.'));

  // 3. clasificación de noticias (tema 15)
  var nots = noticiasPara_(P, t, prev, sched), aciertos = 0, totN = 0;
  S.noticiasEval = [];
  nots.forEach(function (n) {
    var c = dec.noticias ? dec.noticias[n.id] : null; if (!c) return;
    totN++; var ok = (n.tipo === 'ambas') ? (c === 'oportunidad' || c === 'amenaza') : (c === n.tipo);
    if (ok) aciertos++;
    var ac0 = (dec.acciones || {})[n.id] || {};
    S.noticiasEval.push({ id: n.id, texto: n.texto, clasif: c, real: n.tipo, ok: ok, resp: (dec.respuestas || {})[n.id] || 'ignorar', accion: ac0.a || '', seg: ac0.seg || '', porque: ac0.porque || '' });
  });
  // respuesta graduada a las noticias: ignorar, vigilar o preparar
  S.seguimiento = [];
  nots.forEach(function (n) {
    var r = (dec.respuestas || {})[n.id];
    if (r === 'vigilar') S.seguimiento.push({ id: n.id, texto: n.texto, dato: datoSeguimiento_(n), t: t });
    if (r === 'actuar') {
      var ac = (dec.acciones || {})[n.id] || {}, A = (P.accionesEntorno || []).filter(function (x) { return x.id === ac.a; })[0];
      var ev = S.noticiasEval.filter(function (e) { return e.id === n.id; })[0] || {};
      var res = function (nivel, msg) { ev.nivel = nivel; ev.efecto = msg; fb.push(msg); };
      if (!A) { res(0, 'Eligieron actuar ante "' + n.texto.slice(0, 60) + '…" pero no eligieron qué acción: no se hizo nada.'); return; }
      if (A.seg && !ac.seg) { res(0, 'La acción "' + A.nombre + '" necesita un segmento: no se ejecutó.'); return; }
      if (String(ac.porque || '').trim().length < 10) { res(0, 'La acción "' + A.nombre + '" no se ejecutó: falta escribir por qué responde a la noticia.'); return; }
      if (!gastar(A.costo, 0, 'Entorno: ' + A.nombre)) { res(0, 'No alcanzó el presupuesto para "' + A.nombre + '".'); return; }
      var cl = clavePreparacion_(n.id), costoTxt = 'Bs ' + A.costo.toLocaleString('es-BO');
      var segTxt = A.seg ? ' en ' + ac.seg : '';
      if (n.tipo === 'ruido') { res(0, 'Actuaron ante "' + n.texto.slice(0, 60) + '…" (' + A.nombre + segTxt + '), pero era un rumor: se perdieron ' + costoTxt + '.'); return; }
      var aj = ajusteAccion_(A.id, ac.seg, cl);
      if (A.id === 'estudio' && ac.seg) S.iq[ac.seg] = Math.min(1, (S.iq[ac.seg] || 0) + (aj.nivel ? 0.05 : 0.02));
      if (!cl) { res(A.id === 'estudio' ? 0.5 : 0, 'La noticia "' + n.texto.slice(0, 60) + '…" era real, pero describe una tendencia general que ninguna acción puntual cambia' + (A.id === 'estudio' ? '; al menos su estudio les dio algo más de conocimiento de ' + ac.seg : ': ' + costoTxt + ' sin efecto') + '. Las tendencias se responden con proyectos de innovación.'); return; }
      if (cl.indexOf('op:') === 0) {
        var sid = cl.slice(3);
        if (aj.nivel) {
          if (A.id === 'campana') { W.productos.forEach(function (p) { if (p.activo) p.AW = r2_(Math.min(0.98, p.AW + 0.02)); }); S.iq[sid] = Math.min(1, (S.iq[sid] || 0) + 0.02); }
          res(1, 'Acertaron ante la oportunidad "' + n.texto.slice(0, 60) + '…": ' + (A.id === 'campana' ? 'su campaña adelantó su marca en ' + sid + ' antes que los rivales.' : 'su estudio les dio mejor conocimiento de ' + sid + ', justo el segmento que se abre.'));
        } else res(0, 'Ante la oportunidad "' + n.texto.slice(0, 60) + '…" eligieron ' + ACC_NOM_[A.id] + segTxt + ', que no la aprovecha: lo útil era un estudio o una campaña en ' + sid + '. Se gastaron ' + costoTxt + (A.id === 'estudio' ? ' (su estudio sí sumó algo de conocimiento de ' + ac.seg + ')' : '') + '.');
        return;
      }
      if (aj.nivel) {
        W.prep[cl] = Math.max(prepNivel_(W, cl), aj.nivel); S.preparados[cl] = W.prep[cl];
        if (cl === 'etiquetado') W.productos.forEach(function (p) { p.flags = p.flags || {}; var e = p.flags.prepEtiq === true ? 1 : (Number(p.flags.prepEtiq) || 0); p.flags.prepEtiq = Math.max(e, aj.nivel); });
        res(aj.nivel, (aj.nivel === 1 ? 'Acertaron ante "' : 'Su respuesta ayudó en parte ante "') + n.texto.slice(0, 60) + '…" (' + A.nombre + segTxt + '): ' + efectoPrepTxt_(cl, aj.nivel) + (aj.nivel === 1 ? '.' : '. Lo que mejor funcionaba era ' + ACC_MEJOR_[cl] + '.'));
      } else res(0, 'Ante "' + n.texto.slice(0, 60) + '…" eligieron ' + ACC_NOM_[A.id] + segTxt + ', que no responde a ese problema: se gastaron ' + costoTxt + ' sin efecto. Lo que funcionaba era ' + ACC_MEJOR_[cl] + '.');
      return;
    }
    if (r === 'preparar') {
      if (!gastar(g.costoPreparar, 0, 'Preparar respuesta a una noticia')) return;
      var clave = clavePreparacion_(n.id);
      if (n.tipo === 'ruido' || !clave) { fb.push('Prepararon una respuesta a "' + n.texto.slice(0, 70) + '…", pero era ruido: se perdieron Bs ' + g.costoPreparar.toLocaleString('es-BO') + '.'); return; }
      if (clave.indexOf('op:') === 0) {
        var sid = clave.slice(3); S.iq[sid] = Math.min(1, (S.iq[sid] || 0) + 0.05);
        W.productos.forEach(function (p) { if (p.activo) p.AW = r2_(Math.min(0.98, p.AW + 0.02)); });
        fb.push('Se prepararon para la oportunidad "' + n.texto.slice(0, 60) + '…": mejoró su conocimiento de ' + sid + ' y su marca se adelantó en el mercado.');
      } else {
        S.preparados[clave] = true; W.prep[clave] = true;
        if (clave === 'etiquetado') W.productos.forEach(function (p) { p.flags = p.flags || {}; p.flags.prepEtiq = true; });
        fb.push('Se prepararon ante "' + n.texto.slice(0, 60) + '…": ' + EFECTO_PREP_[clave] + '.');
      }
    }
  });

  // 4. investigación: cada método genera un informe con estructura común y queda fechado
  var inv = dec.investigacion || {};
  // Cada estudio por segmentos lleva sus propios 1 o 2 segmentos (versiones anteriores: una lista común).
  var segsDe = function (mid) { var L = (inv.segs && Array.isArray(inv.segs[mid])) ? inv.segs[mid] : (inv.segmentos || []); return L.filter(function (x) { return !!segById_(P, x); }).slice(0, 2); };
  (dec.decInformes ? Object.keys(dec.decInformes) : []).forEach(function (iid) {
    var inf = S.informes.filter(function (x) { return x.id === iid; })[0];
    if (inf) inf.decision = String(dec.decInformes[iid] || '').slice(0, 800);
  });
  var usados = {};
  (inv.metodos || []).forEach(function (mid) {
    var m = metById_(P, mid); if (!m) return;
    var cm = costoMetodo_(P, S, m, t);
    // no se compra (ni se cobra) un estudio que no puede realizarse
    if (MET_SEG_.indexOf(mid) >= 0 && !segsDe(mid).length) { fb.push(m.nombre + ': no eligieron segmentos, así que no se compró ni se cobró.'); return; }
    if (mid === 'lideres' && !S.proyectos.some(function (p) { return p.id === inv.proyectoLideres && p.estado === 'activo'; })) { fb.push('Usuarios líderes: no eligieron un proyecto activo que reciba sus ideas, así que no se compró ni se cobró.'); return; }
    // los estudios los hace una consultora: cuestan dinero, no semanas-persona del equipo
    if (!gastar(cm.costo * factorMadurez_(O), 0, m.nombre + (cm.recargo ? ' (con recargo por repetir)' : ''))) return;
    usados[mid] = true;
    if (cm.recargo) fb.push(m.nombre + ' costó 50 % más por repetirse en trimestres consecutivos.');
    if (mid === 'encuesta' || mid === 'observacion' || mid === 'percepcion') {
      var lista = segsDe(mid);
      lista.forEach(function (sid) {
        var seg = segById_(P, sid); if (!seg) return;
        if (mid === 'percepcion') { var ip = informePercepcion_(P, S, seg, t, rng); nuevoInforme_(S, m, t, { segs: [sid], pregunta: ip.pregunta, ficha: ip.ficha, limites: ip.limites, datos: ip.datos }); return; }
        var obs = {}, tot = 0;
        Object.keys(seg.w).forEach(function (k) {
          var v = seg.w[k];
          if (mid === 'encuesta' && seg.latentes.indexOf(k) >= 0) v = v * 0.5;
          v = Math.max(0, v + rng.normal(0, m.err)); obs[k] = v; tot += v;
        });
        Object.keys(obs).forEach(function (k) { obs[k] = Math.round(obs[k] * 100 / tot); });
        var err = 0; Object.keys(seg.w).forEach(function (k) { err += Math.abs(obs[k] - seg.w[k]); });
        var iq = r2_(clamp_(1 - err / 200, 0, 1));
        var anterior = S.conocimiento.pesos[sid];
        if (!anterior || iq >= (S.iq[sid] || 0)) S.conocimiento.pesos[sid] = { pesos: obs, metodo: m.nombre, t: t };
        S.iq[sid] = Math.max(S.iq[sid] || 0, iq);
        if (mid === 'observacion' && seg.latentes.length) { S.conocimiento.latentes = S.conocimiento.latentes || {}; S.conocimiento.latentes[sid] = seg.latentes.map(function (k) { return ATTR_NOMBRES[k]; }); }
        var r = mid === 'encuesta' ? informeEncuesta_(P, S, seg, obs, m) : informeObservacion_(P, S, seg, obs);
        nuevoInforme_(S, m, t, { segs: [sid], pregunta: r.pregunta, ficha: r.ficha, limites: r.limites, datos: r.datos });
      });
    } else if (mid === 'extremos') {
      S.conocimiento.tendencia = 'Los usuarios extremos anticipan que la sostenibilidad ganará peso en universitarios (S2) y deportistas (S4) hacia el año 5, y que los productos altos en azúcar serán rechazados.';
      ['S2', 'S4'].forEach(function (sid) { S.iq[sid] = Math.min(1, (S.iq[sid] || 0) + 0.05); });
      var ie = informeExtremos_(P, S, t); nuevoInforme_(S, m, t, { pregunta: ie.pregunta, ficha: ie.ficha, limites: ie.limites, datos: ie.datos });
    } else if (mid === 'competidores') {
      var ic = informeCompetidores_(P, S, t); nuevoInforme_(S, m, t, { pregunta: ic.pregunta, ficha: ic.ficha, limites: ic.limites, datos: ic.datos });
      S.conocimiento.competidores = { t: t, informe: true };
    } else if (mid === 'industria') {
      var ii = informeIndustria_(P, S, prev, t, sched); nuevoInforme_(S, m, t, { pregunta: ii.pregunta, ficha: ii.ficha, limites: ii.limites, datos: ii.datos });
    } else if (mid === 'vigilancia') {
      S.vigilanciaHasta = t + 4;
      var iv = informeVigilancia_(P, S, t, sched); nuevoInforme_(S, m, t, { pregunta: iv.pregunta, ficha: iv.ficha, limites: iv.limites, datos: iv.datos });
    } else if (mid === 'lideres') {
      var pj = S.proyectos.filter(function (p) { return p.id === inv.proyectoLideres && p.estado === 'activo'; })[0];
      if (pj) {
        var antes = pj.pool.length;
        addIdeas_(P, S, pj, { n0: 2, mu0: 6.8, s0: 0.6, id: 'lideres', nombre: 'Usuarios líderes' }, null, rng, O, t);
        var nuevas = pj.pool.slice(antes).map(function (it) { var idea = ideaById_(P, it.ideaId); return { nombre: idea.nombre, desc: idea.desc, tipo: idea.tipo, nov: idea.nov, qObs: it.qObs }; });
        nuevoInforme_(S, m, t, { pregunta: '¿Qué soluciones han inventado ya los usuarios adelantados para el reto de "' + pj.nombre + '"?', ficha: 'Taller de co-creación con 5 usuarios líderes identificados por referidos (von Hippel, 1986). Conceptos entregados al proyecto.', limites: 'Los usuarios líderes van adelantados: lo que quieren puede no interesar todavía al cliente común. La calidad es una estimación (±1,5) hasta validarla.', datos: { proyecto: pj.nombre, conceptos: nuevas } });
        fb.push('Los usuarios líderes aportaron ' + nuevas.length + ' ideas al proyecto "' + pj.nombre + '".');
      }
      else fb.push('Usuarios líderes: no indicaron un proyecto activo; no se generaron ideas.');
    }
  });
  // boletín trimestral de vigilancia mientras esté contratada (sin casilla obligatoria)
  if (!usados.vigilancia && S.vigilanciaHasta >= t) {
    var bv = informeVigilancia_(P, S, t, sched); var mv = metById_(P, 'vigilancia');
    var infV = nuevoInforme_(S, mv, t, { pregunta: bv.pregunta, ficha: bv.ficha, limites: bv.limites, datos: bv.datos }); infV.requiere = false; infV.boletin = true;
  }
  S.ultMetodo = {}; Object.keys(usados).forEach(function (k) { S.ultMetodo[k] = t; });

  // 5. nuevos proyectos
  (dec.nuevosProyectos || []).forEach(function (np) {
    var activos = S.proyectos.filter(function (p) { return p.estado === 'activo'; }).length;
    var maxP = anioDe_(t) === 1 ? (g.maxProyectosAnio1 || g.maxProyectos) : g.maxProyectos;
    if (activos >= maxP) { fb.push('No se creó "' + np.nombre + '": máximo ' + maxP + ' proyectos activos' + (anioDe_(t) === 1 ? ' en el primer año' : '') + '.'); return; }
    var seg = segById_(P, np.segmento) || P.segmentos[0];
    if (seg.nuevo && O.nue < 20) { fb.push('No se creó "' + np.nombre + '": dedicas menos de 20 % a segmentos nuevos y ' + seg.id + ' es un segmento nuevo para la empresa.'); return; }
    if (np.brief) {
      var pn = crearProyecto2_(P, S, np, t); S.proyectos.push(pn);
      var malos = pn.revisionBrief.filter(function (x) { return !x.ok; }).length;
      fb.push('Se creó el proyecto "' + pn.nombre + '" para ' + seg.nombre + ' (tipo declarado: ' + TIPOS_NOM_[pn.tipoDecl].toLowerCase() + '). ' + (malos ? 'La revisión del brief encontró ' + malos + ' punto' + (malos === 1 ? '' : 's') + ' por mejorar: véanla en la tarjeta del proyecto.' : 'El brief está completo.') + ' El próximo trimestre empieza Idear.');
      return;
    }
    var enfoque = ['incremental', 'radical', 'disruptiva'].indexOf(np.enfoque) >= 0 ? np.enfoque : (np.base === 'nuevo' ? 'radical' : 'incremental');
    S.proyectos.push({ id: 'PR' + (S.nextId++), nombre: String(np.nombre || 'Proyecto').slice(0, 60), base: enfoque === 'incremental' ? 'P0' : 'nuevo', enfoque: enfoque, reto: String(np.reto || '').slice(0, 300), segmento: seg.id, etapa: 'ideacion', estado: 'activo', inicio: t, pool: [], ideaSel: null, Q: 0, iter: 0, calProto: 0, calObs: null, fact: 0, viab: 0, puerta: 0, capAcum: 0, gastoAcum: 0, piloto: null, validadoSel: false, revisado: false });
    fb.push('Se creó el proyecto "' + np.nombre + '" para ' + seg.nombre + '.');
  });

  // 6. acciones sobre proyectos
  var umbral = P.umbrales[O.umbral] || 6;
  S.proyectos.forEach(function (pj) {
    var s0 = S.saldo; procesarProyecto_(pj);
    pj.gastoAcum = Math.round((pj.gastoAcum || 0) + Math.max(0, s0 - S.saldo));
  });
  // revisión después de la acción (proyectos del flujo nuevo ya terminados)
  S.proyectos.forEach(function (pj) {
    var a = (dec.proyectos || {})[pj.id] || {};
    if (pj.flujo === 2 && pj.estado !== 'activo' && !pj.revisado && a.aar) p3Revision_(P, S, pj, a, { gastar: gastar, fb: fb, t: t });
  });
  function procesarProyecto_(pj) {
    if (pj.estado !== 'activo') return;
    var a = (dec.proyectos || {})[pj.id] || {};
    var seg = segById_(P, pj.segmento);
    if (pj.flujo === 2 && !a.detener && (pj.etapa === 'idear' || pj.etapa === 'evaluar' || pj.etapa === 'definir')) {
      var sigue = procesarFases2_(P, S, pj, a, { gastar: gastar, rng: rng, fb: fb, t: t, O: O });
      if (!sigue) return;
    }
    if (pj.flujo === 2 && !a.detener && ['prototipar', 'especificar', 'piloto', 'lanzar'].indexOf(pj.etapa) >= 0) {
      var r3 = procesarFases3_(P, S, pj, a, { gastar: gastar, rng: rng, fb: fb, t: t, O: O, sched: sched });
      exitos += r3.exito; fracasos += r3.fracaso; capexExtra += r3.capex;
      return;
    }
    if (a.detener) {
      pj.estado = 'detenido'; pj.etapa = 'detenido'; pj.fin = t;
      if (pj.capAcum > 0) { writeoff += pj.capAcum; fb.push('Proyecto "' + pj.nombre + '" detenido: se dio de baja Bs ' + Math.round(pj.capAcum).toLocaleString('es-BO') + ' de desarrollo capitalizado.'); }
      else fb.push('Proyecto "' + pj.nombre + '" detenido.');
      if (O.politica === 'sancion') fracasos++;
      return;
    }
    // validación de ideas existentes
    if (a.validar && a.validar.length && pj.pool.length) {
      var porValidar = pj.pool.filter(function (it) { return a.validar.indexOf(it.pid) >= 0 && !it.validada; }).slice(0, 10);
      if (porValidar.length && gastar(porValidar.length * g.costoValidacion * factorMadurez_(O), g.semValidacion, 'Validación con clientes (' + porValidar.length + ' ideas)')) {
        porValidar.forEach(function (it) { it.validada = true; it.qObs = r1_(clamp_(it.Q + rng.normal(0, 0.4), 1, 9)); });
        fb.push('Validaste ' + porValidar.length + ' ideas de "' + pj.nombre + '" con clientes: su calidad observada ahora es mucho más precisa.');
      }
    }
    // selección de idea (puede ser la mejor validada en este mismo trimestre)
    if (a.seleccionar === 'mejorValidada' && pj.etapa === 'ideacion') {
      var val = pj.pool.filter(function (x) { return x.validada; }).sort(function (x, y) { return y.qObs - x.qObs; });
      a.seleccionar = val.length ? val[0].pid : null;
      if (!val.length) fb.push('"' + pj.nombre + '": no hay ideas validadas para elegir automáticamente.');
    }
    if (a.seleccionar && pj.etapa === 'ideacion') {
      var it = pj.pool.filter(function (x) { return x.pid === a.seleccionar; })[0];
      if (it) {
        var idea = ideaById_(P, it.ideaId);
        pj.ideaSel = idea.id; pj.Q = it.Q; pj.validadoSel = !!it.validada; pj.etapa = 'prototipo';
        var mejor = pj.pool.reduce(function (m, x) { return x.Q > m ? x.Q : m; }, 0);
        pj.errorSeleccion = r1_(mejor - it.Q);
        var baseProd = W.productos.filter(function (p) { return p.id === 'P0'; })[0];
        pj.fact = r1_(clamp_(6 + (O.composicion === 'multifuncional' ? 1.5 : (O.composicion === 'externos' ? 1.0 : 0)) + 0.5 * (O.madurez - 1) - 0.5 * (idea.nov - 3), 1, 10));
        var cu = (pj.base === 'P0' ? baseProd.costUnit : g.costoUnitNuevo) + ((idea.ef || {}).cu || 0);
        var pe = pj.base === 'P0' ? baseProd.precio : seg.pref * 0.95;
        pj.viab = r1_(clamp_(5 + 10 * ((pe - cu) / pe - 0.30), 1, 10));
        fb.push('Seleccionaste "' + idea.nombre + '" para "' + pj.nombre + '". Factibilidad ' + pj.fact + ', viabilidad ' + pj.viab + '.');
      }
    }
    // prototipo e iteraciones
    if (a.prototipo && pj.etapa === 'prototipo' && pj.iter < 4) {
      var fd = P.fidelidades[a.prototipo.fidelidad] || P.fidelidades.baja;
      var nIt = clamp_(Math.round(Number(a.prototipo.iteraciones) || 1), 1, Math.min(fd.max, 4 - pj.iter));
      var capit = pj.fact >= 7;
      var fAc = pj._acel === t ? 1 + (g.recargoAcelerar || 0.5) : 1;
      if (gastar(nIt * fd.costo * factorMadurez_(O) * fAc, semMadurez_(O, nIt * fd.sem) * fAc, 'Prototipo de "' + pj.nombre + '"' + (fAc > 1 ? ' (acelerado)' : ''), capit)) {
        pj.iter += nIt; if (capit) pj.capAcum += nIt * fd.costo * factorMadurez_(O) * fAc;
        var gIt = (1 - Math.exp(-0.8 * pj.iter)) / (1 - Math.exp(-3.2));
        pj.calProto = r1_(pj.Q * gIt);
        pj.calObs = r1_(clamp_(pj.calProto + rng.normal(0, fd.err), 0, 10));
        pj.puerta = r2_(0.4 * pj.calProto + 0.3 * pj.fact + 0.3 * pj.viab);
        fb.push('Prototipo de "' + pj.nombre + '": ' + pj.iter + ' iteraciones, calidad observada ' + pj.calObs + '. Puntaje de puerta ' + pj.puerta + ' (umbral ' + umbral + ').');
      }
    }
    // sin unidad autónoma, los proyectos radicales se evalúan con los criterios del negocio principal (más exigentes)
    var umbralP = umbral + ((O.estructura !== 'autonoma' && pj.base === 'nuevo' && O.rad > 40) ? 1.0 : 0);
    var puertaOk = pj.iter > 0 && pj.puerta >= umbralP && pj.iter >= (pj.iterMin || 1);
    if (pj.iter > 0 && pj.iter < (pj.iterMin || 1) && (a.piloto || a.lanzar)) fb.push('"' + pj.nombre + '" necesita al menos ' + pj.iterMin + ' iteraciones de prototipo por su tipo de innovación (' + (TIPOS_NOM_[pj.tipoReal] || '').toLowerCase() + '); lleva ' + pj.iter + '.');
    if (pj.iter > 0 && !puertaOk && umbralP > umbral && pj.puerta >= umbral) fb.push('"' + pj.nombre + '" supera el umbral normal, pero sin unidad autónoma el comité lo evalúa con los criterios del negocio actual (umbral ' + umbralP + ').');
    // piloto
    if (a.piloto && pj.etapa === 'prototipo' && !pj.piloto) {
      if (!puertaOk) fb.push('El piloto de "' + pj.nombre + '" no se autorizó: no supera la puerta (' + pj.puerta + ' < ' + umbralP + ').');
      else if (gastar(g.costoPiloto * factorMadurez_(O) * (pj.factPiloto || 1), semMadurez_(O, g.semPiloto), 'Piloto de "' + pj.nombre + '"', pj.fact >= 7)) {
        if (pj.fact >= 7) pj.capAcum += g.costoPiloto * factorMadurez_(O) * (pj.factPiloto || 1);
        var efP = ideaDe_(P, pj).ef || {};
        var prov = productoProspectivo_(P, W, pj, { precio: pj.base === 'P0' ? W.productos[0].precio : ((pj.concepto && pj.concepto.precioObj) || seg.pref * 0.95), canales: W.productos[0].canales.concat(efP.canal ? [efP.canal] : []) }, false);
        prov.AW = 0.6; prov.desde = t;
        var Wp = copy_(W); Wp.productos.push(prov);
        var sh = marketShares_(P, Wp, seg, t).filter(function (o) { return o.id === prov.id; })[0];
        pj.piloto = { t: t, cuotaEstimada: r2_((sh ? sh.cuota : 0) * 100) };
        fb.push('Piloto de "' + pj.nombre + '": con buena difusión alcanzaría alrededor de ' + pj.piloto.cuotaEstimada + ' % de cuota en ' + seg.id + '.');
        pj.pilotoT = t;
      }
    }
    // lanzamiento
    if (a.lanzar && pj.etapa === 'prototipo' && pj.pilotoT !== t) {
      if (!puertaOk) { fb.push('El lanzamiento de "' + pj.nombre + '" no se autorizó: no supera la puerta (' + pj.puerta + ' < ' + umbralP + ').'); }
      else {
        var idea2 = ideaDe_(P, pj);
        var costoL = (g.costoLanzamiento + idea2.costo) * factorMadurez_(O);
        if (gastar(costoL, semMadurez_(O, g.semLanzamiento), 'Lanzamiento de "' + pj.nombre + '"')) {
          var L = a.lanzar;
          if (L.proteccion === 'patente') {
            if (idea2.nov >= 4 && gastar(g.costoPatente, g.semPatente, 'Patente')) { /* ok */ }
            else { L.proteccion = 'ninguna'; fb.push('Patente no registrada (requiere novedad ≥ 4 y recursos); la protección quedó en "ninguna".'); }
          }
          var pF = clamp_(0.40 - 0.03 * (pj.calProto - 5) - (pj.piloto ? 0.15 : 0) - (pj.validadoSel ? 0.10 : 0) + 0.05 * (idea2.nov - 3), 0.05, 0.65);
          var falla = rng() < pF;
          var prod = productoProspectivo_(P, W, pj, L, falla);
          prod.desde = t + 1; prod.AW = pj.piloto ? 0.25 : 0.05;
          if (pj.disruptiva) { prod.AW = r2_(prod.AW * 0.5); prod.disruptiva = true; }
          if (pj.base === 'P0') {
            var p0 = W.productos[0];
            p0.attrs = prod.attrs; p0.costUnit = prod.costUnit; p0.canales = prod.canales; p0.flags = prod.flags; p0.relanz = t + 1;
            if (prod.modelo === 'suscripcion') p0.modelo = 'suscripcion';
            if (L.precio) p0.precio = clamp_(Number(L.precio), p0.precio * 0.7, p0.precio * 1.3);
            p0.nombre = L.nombre ? String(L.nombre).slice(0, 60) : p0.nombre;
          } else {
            prod.id = 'N' + (S.nextProd++);
            W.productos.push(prod);
            capexExtra += g.capexEscalamiento;
          }
          if (pj.capAcum > 0) W.fin.intang.push({ concepto: pj.nombre, monto: pj.capAcum, restante: pj.capAcum, desde: t + 1 });
          pj.etapa = 'lanzado'; pj.estado = 'terminado'; pj.fin = t; pj.falla = falla; pj.productoId = pj.base === 'P0' ? 'P0' : prod.id;
          if (falla) { fracasos++; fb.push('El lanzamiento de "' + pj.nombre + '" rindió por debajo de lo esperado: los atributos realizados fueron menores (riesgo ' + Math.round(pF * 100) + ' %).'); }
          else { exitos++; fb.push('"' + (L.nombre || pj.nombre) + '" sale al mercado el próximo trimestre (riesgo de fracaso estimado ' + Math.round(pF * 100) + ' %, no ocurrió).'); }
        }
      }
    }
    // iniciativas de ideas
    if (a.iniciativas && a.iniciativas.length && pj.etapa === 'ideacion') {
      a.iniciativas.slice(0, 3).forEach(function (ia) {
        var ini = iniById_(P, ia.id); if (!ini) return;
        var pr = ini.premio ? (P.premios[ia.premio] || P.premios.medio) : null;
        var costo = (ini.costo + (pr ? pr.costo : 0)) * factorMadurez_(O);
        if (!gastar(costo, semMadurez_(O, ini.sem), ini.nombre + ' (' + pj.nombre + ')')) return;
        var n = addIdeas_(P, S, pj, ini, pr, rng, O, t);
        fb.push(ini.nombre + ' generó ' + n + ' ideas para "' + pj.nombre + '".');
      });
    }
    pj.gastoAcum = pj.gastoAcum || 0;
  }
  if (O.politica === 'sancion' && fracasos > 0) O.AE = r2_(clamp_(O.AE - 0.03 * fracasos, 0, 1));
  if (exitos > 0) O.AE = r2_(clamp_(O.AE + 0.04 * exitos, 0, 1));

  // 7. revisión post-proyecto
  if (dec.revision) {
    var pr2 = S.proyectos.filter(function (p) { return p.id === dec.revision && p.estado !== 'activo' && !p.revisado; })[0];
    if (pr2 && gastar(g.costoRevision, g.semRevision, 'Revisión post-proyecto')) {
      pr2.revisado = true;
      if (O.ultRevAnio < anioDe_(t) && O.madurez < 5) { O.madurez++; O.ultRevAnio = anioDe_(t); fb.push('La revisión post-proyecto elevó la madurez en gestión de la innovación a ' + O.madurez + ' de 5.'); }
      else fb.push('Revisión post-proyecto realizada (la madurez sube como máximo un nivel por año).');
    }
  }

  // 8. respuestas a eventos
  if (dec.respuestaC4 && S.c4resp === 'ninguna' && t >= g.entradaC4 && t <= 16) {
    if (dec.respuestaC4 === 'alianza') { S.c4resp = 'alianza'; W.alianza = true; gastoOtros += g.costoAlianzaC4; fb.push('Firmaste una alianza con la startup: obtienes presencia en apps de delivery y ella no invade los segmentos donde tienes más de 10 % de cuota.'); if (W.productos[0].canales.indexOf('delivery') < 0) W.productos[0].canales.push('delivery'); }
    if (dec.respuestaC4 === 'adquisicion') {
      var c4 = W.comps.filter(function (c) { return c.id === 'C4'; })[0];
      S.c4resp = 'adquisicion'; W.c4Adquirido = true; c4.activo = false;
      W.productos.push({ id: 'N' + (S.nextProd++), nombre: 'Línea vegetal (ex startup)', attrs: copy_(c4.attrs), costUnit: 8.8, precio: c4.precio, canales: ['delivery', 'app'], modelo: 'venta', proteccion: 'activos', desde: t + 1, relanz: -99, AW: 0.5, activo: true, legado: false, comunicacion: 0, flags: {}, cuotaHist: [], penalHasta: O.estructura === 'autonoma' ? 0 : t + 2, lanz: t + 1 });
      W.fin.intang.push({ concepto: 'Adquisición de la startup', monto: g.costoAdquisicionC4, restante: g.costoAdquisicionC4, desde: t + 1 });
      capexExtra += 0; S._adquisicionCaja = g.costoAdquisicionC4;
      fb.push('Adquiriste la startup: su producto pasa a tu portafolio' + (O.estructura === 'autonoma' ? '.' : ' (sin unidad autónoma, la integración reducirá su atractivo durante 2 trimestres).'));
    }
  }

  // 9. productos: precio, comunicación, canales, retiro
  var decP = dec.productos || {};
  W.productos.forEach(function (p) { p.promo = 0; p.pronostico = null; });
  W.productos.forEach(function (p) {
    var d = decP[p.id]; if (!d || !p.activo) return;
    if (d.retirar && !p.legado) { p.activo = false; fb.push('Retiraste "' + p.nombre + '" del mercado.'); return; }
    if (d.precio !== undefined && d.precio !== '') p.precio = r2_(clamp_(Number(d.precio), Math.max(2, p.precio * 0.7), p.precio * 1.3));
    if (d.comunicacion !== undefined) p.comunicacion = clamp_(Number(d.comunicacion) || 0, 0, 80000);
    if (d.segPub !== undefined) p.segPub = segById_(P, d.segPub) ? d.segPub : 'todos';
    p.promo = clamp_(Number(d.promo) || 0, 0, g.promoMax);
    p.pronostico = Number(d.pronostico) > 0 ? Math.round(Number(d.pronostico)) : null;
    if (d.canales) p.canales = d.canales.filter(function (c) { return !!canalById_(P, c); });
    if (p.legado) { ['tienda', 'super'].forEach(function (c) { if (p.canales.indexOf(c) < 0) p.canales.push(c); }); }
  });

  // 10. mundo: competidores, C4, mercado y finanzas (real y contrafactual)
  var licit = (t === 16 && dec.licitacion) ? true : false;
  var res = stepWorld_(P, W, S, t, sched, { gastoInnov: gastoInnov, gastoCap: gastoCap, gastoOtros: gastoOtros, writeoff: writeoff, capexExtra: capexExtra, licitacion: licit, adquisicionCaja: S._adquisicionCaja || 0, fb: fb });
  delete S._adquisicionCaja;
  p3PostMercado_(P, S, t, fb, sched);
  var resTwin = stepWorld_(P, S.twin, null, t, sched, { gastoInnov: 0, gastoCap: 0, gastoOtros: 0, writeoff: 0, capexExtra: 0, licitacion: false, adquisicionCaja: 0, fb: [] });

  // 11. KPIs
  var clima = Math.round(100 * (0.5 * O.MI + 0.3 * O.AE + 0.2 * O.DIV));
  var gastoTotalInnov = gastoInnov + gastoCap;
  var h = res;
  h.t = t; h.semanasUsadas = g.semanasTrimestre - semanas; h.gastoInnovTotal = gastoTotalInnov;
  h.intensidad = res.ventas > 0 ? r2_(100 * gastoTotalInnov / res.ventas) : 0;
  h.MI = O.MI; h.AE = O.AE; h.DIV = O.DIV; h.clima = clima; h.madurez = O.madurez;
  h.aciertoNoticias = totN ? r2_(100 * aciertos / totN) : null;
  h.saldo = Math.round(S.saldo);
  h.twin = { ventas: resTwin.ventas, utilidadNeta: resTwin.utilidadNeta, caja: resTwin.caja, cuotaTotal: resTwin.cuotaTotal, cuotas: resTwin.cuotas, flujoLibre: resTwin.flujoLibre };
  h.exitos = exitos; h.fracasos = fracasos;
  S.hist.push(h);

  // retroalimentación de mercado
  var prevH = prev.hist.length ? prev.hist[prev.hist.length - 1] : null;
  if (prevH) {
    P.segmentos.forEach(function (seg) {
      var d = r2_(h.cuotas[seg.id] - prevH.cuotas[seg.id]);
      if (Math.abs(d) >= 0.8) fb.push('Tu cuota en ' + seg.id + ' (' + seg.nombre + ') ' + (d > 0 ? 'subió' : 'bajó') + ' ' + Math.abs(d).toFixed(1) + ' puntos, a ' + h.cuotas[seg.id].toFixed(1) + ' %.');
    });
  }
  W.productos.forEach(function (p) {
    if (!p.activo || !p.pronostico) return;
    var real = Math.round(p.unidades || 0), d = real ? Math.round(100 * (real - p.pronostico) / p.pronostico) : -100;
    fb.push('Pronóstico de "' + p.nombre + '": ' + p.pronostico.toLocaleString('es-BO') + ' litros; vendieron ' + real.toLocaleString('es-BO') + ' (' + (d >= 0 ? '+' : '') + d + ' %).' + (Math.abs(d) > 15 ? ' Revisen qué supuesto falló.' : ''));
    p.pronHist = (p.pronHist || []).concat([{ t: t, pron: p.pronostico, real: real }]).slice(-8);
  });
  S.coherencia = coherencia_(P, S, t);
  var dif = Math.round(h.utilidadNeta - h.twin.utilidadNeta);
  fb.push('Comparación con la empresa que no innova: tu utilidad neta del trimestre es Bs ' + Math.abs(dif).toLocaleString('es-BO') + (dif >= 0 ? ' mayor.' : ' menor.'));

  return S;
}

/** Construye el producto resultante de un proyecto (sin modificar el mundo). */
function productoProspectivo_(P, W, pj, L, falla) {
  var idea = ideaDe_(P, pj), ef = idea.ef || {};
  var base = W.productos[0];
  var gIt = (1 - Math.exp(-0.8 * Math.max(1, pj.iter))) / (1 - Math.exp(-3.2));
  var exe = Math.pow(clamp_((pj.Q - 2) / 7, 0, 1.05), 1.2);
  var attrs = copy_(base.attrs);
  var fP = pj.protoFit !== undefined && pj.protoFit !== null && pj.flujo === 2 ? 0.5 + 0.6 * pj.protoFit : 1;
  ATTRS.forEach(function (k) {
    var d = (ef[k] || 0) * gIt * (d0pos_(ef[k]) ? exe * fP : 1); if (falla && d > 0) d = d * 0.3;
    if (k === 'conv' && fP !== 1) d += (pj.protoFit - 0.7) * 3;
    attrs[k] = r1_(clamp_(attrs[k] + d, 0, 10));
  });
  var canales = (L.canales && L.canales.length) ? L.canales.slice() : base.canales.slice();
  if (ef.canal && canales.indexOf(ef.canal) < 0) canales.push(ef.canal);
  var flags = copy_(base.flags || {}); if (ef.flags) Object.keys(ef.flags).forEach(function (k) { flags[k] = ef.flags[k]; });
  var precio = Number(L.precio) || (pj.base === 'P0' ? base.precio : ((pj.concepto && pj.concepto.precioObj) || segById_(P, pj.segmento).pref * 0.95));
  return {
    id: 'TMP', nombre: L.nombre ? String(L.nombre).slice(0, 60) : idea.nombre, attrs: attrs,
    costUnit: r2_(Math.max(2, (pj.base === 'P0' ? base.costUnit : P.general.costoUnitNuevo) + (ef.cu || 0))), precio: r2_(clamp_(precio, 2, 80)),
    canales: canales, modelo: ef.modelo === 'suscripcion' || L.modelo === 'suscripcion' ? 'suscripcion' : 'venta',
    proteccion: L.proteccion || 'ninguna', desde: 99, relanz: -99, AW: 0.05, activo: true, legado: false,
    comunicacion: clamp_(Number(L.comunicacion) || 0, 0, 80000), flags: flags, cuotaHist: [], ideaId: idea.id, lanz: 0
  };
}

function d0pos_(x) { return (x || 0) > 0; }

/** Agrega ideas al pool de un proyecto. */
function addIdeas_(P, S, pj, ini, pr, rng, O, t) {
  var fN = pr ? pr.fN : 1, fM = pr ? pr.fM : 0, fS = pr ? pr.fS : 1;
  var cap = t <= O.capHasta ? 1 : 0;
  var n = Math.max(1, Math.round(ini.n0 * fN));
  var lat = (S.conocimiento.latentes && S.conocimiento.latentes[pj.segmento]) ? 0.4 : 0;
  var mu = ini.mu0 + 2.0 * (O.MI - 0.5) + 0.5 * cap + 1.5 * ((S.iq[pj.segmento] || 0) - 0.5) + lat + fM;
  var sd = ini.s0 * (1 + 0.3 * O.DIV + 0.5 * (O.AE - 0.5)) * fS * (O.incentivo === 'alto' ? 0.85 : 1);
  var mand = P.mandatos[S.mandato] || P.mandatos.MA;
  var tipoW = { 'Producto': O.p4.producto, 'Proceso': O.p4.proceso, 'Posición': O.p4.posicion, 'Paradigma': O.p4.paradigma };
  var cands = P.ideas.filter(function (i) { return mand.tipos.indexOf(i.tipo) >= 0 && (tipoW[i.tipo] || 0) > 0; });
  if (!cands.length) cands = P.ideas.slice();
  var Qs = cands.map(function (i) { return ideaQuality_(P, i, pj.segmento, S.mandato); });
  var usadas = pj.pool.map(function (x) { return x.ideaId; });
  var creadas = 0;
  for (var k = 0; k < n; k++) {
    var q = rng.normal(mu, sd); if (rng() < 0.05) q += 2; q = clamp_(q, 1, 9);
    var idx = [], wts = [];
    cands.forEach(function (c, i) {
      if (usadas.indexOf(c.id) >= 0) return;
      var d = Math.abs(Qs[i] - q);
      var nw = c.nov >= 4 ? O.rad / 50 : (c.nov <= 2 ? O.inc / 50 : 1);
      // el enfoque del proyecto orienta la búsqueda de ideas
      if (pj.enfoque === 'incremental') nw *= c.nov <= 2 ? 2 : (c.nov >= 4 ? 0.4 : 1);
      if (pj.enfoque === 'radical') nw *= c.nov >= 4 ? 2 : (c.nov <= 2 ? 0.4 : 1);
      if (pj.enfoque === 'disruptiva') nw *= ((c.ef && (c.ef.cu || 0) <= 0) && c.nov >= 3 && c.costo <= 60000) ? 2.2 : 0.6;
      idx.push(i); wts.push(Math.exp(-d * d / 0.5) * (tipoW[c.tipo] / 25) * Math.max(0.1, nw));
    });
    if (!idx.length) break;
    var pick = rng.pickWeighted(idx, wts), idea = cands[pick];
    usadas.push(idea.id);
    // cada propuesta concreta varía en su ejecución: misma idea base, calidad propia
    var qItem = r1_(clamp_(Qs[pick] + rng.normal(0, 1.0), 1, 9.5));
    pj.pool.push({ pid: 'I' + (S.nextPool++), ideaId: idea.id, Q: qItem, qObs: r1_(clamp_(qItem + rng.normal(0, 1.5), 1, 9.5)), validada: false, fuente: ini.nombre, t: t });
    creadas++;
  }
  return creadas;
}

/** Avanza el mundo un trimestre: competidores, mercado, difusión y finanzas. */
function stepWorld_(P, W, S, t, sched, X) {
  var g = P.general, esReal = !!S;
  var c4 = W.comps.filter(function (c) { return c.id === 'C4'; })[0];

  // C4: entrada, mejora e invasión
  if (c4 && !W.c4Adquirido) {
    if (t === g.entradaC4) { c4.activo = true; if (esReal) X.fb.push('Entró al mercado la startup de bebidas vegetales por app (C4), con precio bajo, en universitarios (S2).'); }
    if (c4.activo && t > g.entradaC4) ATTRS.forEach(function (k) { c4.attrs[k] = r2_(Math.min(9.5, c4.attrs[k] * 1.04)); });
    if (t === 13) {
      var s2 = segById_(P, 'S2');
      var uC4 = utility_(s2, c4.attrs, c4.precio, t);
      var uMejor = W.productos.filter(function (p) { return p.activo && p.desde <= t; }).reduce(function (m, p) { return Math.max(m, utility_(s2, p.attrs, p.precio, t) * Math.min(1, canalFactor_(P, p.canales, 'S2', t) + 0.0001)); }, 0);
      if (uMejor >= uC4) { W.invasion = 16; if (esReal) X.fb.push('Tu oferta en S2 compite de igual a igual con la startup: su expansión a otros segmentos se retrasa.'); }
    }
    if (c4.activo && t === W.invasion) {
      ['S1', 'S3'].forEach(function (sid) {
        if (W.alianza && W.productos[0] && (W.ultCuotas ? W.ultCuotas[sid] * MKT_.N : 0) > 10) return;
        c4.pres[sid] = 0.8;
      });
      if (esReal) X.fb.push('La startup C4 llegó a supermercados y oficinas: ahora compite en ' + Object.keys(c4.pres).join(', ') + '.');
    }
  }
  // los competidores establecidos también mejoran
  W.comps.forEach(function (c) {
    if (c.id === 'C1' && t >= 10) ['nut', 'conv', 'salud'].forEach(function (k) { c.attrs[k] = r2_(Math.min(8, c.attrs[k] * 1.02)); });
    if (c.id === 'C3' && t >= 6) ATTRS.forEach(function (k) { c.attrs[k] = r2_(Math.min(9, c.attrs[k] * 1.015)); });
  });
  // C3: tipo de cambio
  var c3 = W.comps.filter(function (c) { return c.id === 'C3'; })[0];
  if (c3) c3.precio = r2_(c3.precio0 * ((t >= 12 && t <= 15) ? 1.15 : 1));
  // clones pendientes
  W.pendClones = W.pendClones || [];
  W.pendClones.forEach(function (pc) {
    if (pc.t === t) {
      var orig = W.productos.filter(function (p) { return p.id === pc.prodId; })[0]; if (!orig) return;
      var c2 = W.comps.filter(function (c) { return c.id === 'C2'; })[0];
      var attrs = {}; ATTRS.forEach(function (k) { attrs[k] = Math.max(0, orig.attrs[k] - 0.3); });
      var pres = {}; P.segmentos.forEach(function (s) { pres[s.id] = Math.max(c2.pres[s.id] || 0, (orig.cuotaPorSeg && orig.cuotaPorSeg[s.id] * MKT_.N > 3) ? 0.9 : 0); });
      W.comps.push({ id: 'CL' + orig.id, nombre: 'Imitación de C2 (' + orig.nombre + ')', attrs: attrs, precio: r2_(orig.precio * 0.9), precio0: r2_(orig.precio * 0.9), pres: pres, activo: true, cortes: 0, ultCuota: {}, factor: orig.proteccion === 'activos' ? 0.7 : 1 });
      if (esReal) X.fb.push('La marca regional C2 lanzó una imitación de "' + orig.nombre + '" a un precio 10 % menor (protección elegida: ' + orig.proteccion + ').');
    }
  });

  // costos unitarios efectivos
  var sequia = sched.sequia && (t === sched.sequia || t === sched.sequia + 1);
  function costoEf(p) {
    var c = p.costUnit;
    if (sequia && !(p.flags && p.flags.contratoLeche)) c *= 1.08 - 0.04 * prepNivel_(W, 'sequia');
    if (t >= 12 && t <= 15 && !(p.flags && p.flags.envaseLocal)) c += 0.40 - 0.20 * prepNivel_(W, 'divisas');
    return c;
  }
  if (esReal && sequia && t === sched.sequia) X.fb.push('La sequía elevó el costo de la leche cruda 8 % durante dos trimestres' + '.');
  if (esReal && t === 12) X.fb.push('Escasez de divisas: los envases importados suben Bs 0,40 por litro hasta T15 (salvo productos con envase local).');
  if (esReal && sched.bloqueos.indexOf(t) >= 0) X.fb.push('Los bloqueos de carreteras redujeron 15 % la demanda atendida en el trimestre.');
  if (esReal && t === 9) X.fb.push('Entró en vigor el etiquetado frontal: los productos con atributo saludable menor a 6 pierden 20 % de atractivo en S1, S4 y S5.');

  // difusión y olvido: sin publicidad suficiente, el conocimiento de marca cae
  W.productos.forEach(function (p) {
    if (!p.activo || p.desde > t) return;
    var calidad = sum_(ATTRS.map(function (k) { return p.attrs[k]; })) / 50;
    var pp = 0.03 + 0.12 * p.comunicacion / (p.comunicacion + 50000), qB = 0.35 * calidad;
    if ((p.comunicacion || 0) < 10000 && (p.legado || p.desde < t - 1)) {
      var piso = 0.7 + 0.2 * calidad;
      if (p.AW > piso) { p.AW = r2_(Math.max(piso, p.AW - 0.03)); if (esReal && p.AW < 0.9 && !p.avisoOlvido) { X.fb.push('Sin publicidad, el conocimiento de "' + p.nombre + '" está bajando (' + Math.round(p.AW * 100) + ' %).'); p.avisoOlvido = true; } }
    } else {
      p.avisoOlvido = false;
      if (!p.legado || p.AW < 0.95) p.AW = r2_(Math.min(0.98, p.AW + (1 - p.AW) * (pp + qB * p.AW) * (p.disruptiva ? 1.6 : 1)));
    }
  });

  // mercado
  var ventas = 0, costoVentas = 0, unidades = 0, ventasSusc = 0, ventasNuevas = 0, cuotas = {}, uTot = 0, dTot = 0;
  W.productos.forEach(function (p) { p.ventas = 0; p.unidades = 0; p.cuotaPorSeg = {}; });
  P.segmentos.forEach(function (seg) {
    var D = demanda_(P, seg, t, sched) * MKT_.N; dTot += D;
    if (prepNivel_(W, 'bloqueos') && sched.bloqueos.indexOf(t) >= 0) D *= (0.85 + 0.07 * prepNivel_(W, 'bloqueos')) / 0.85;
    var ofs = marketShares_(P, W, seg, t), cuotaSeg = 0;
    ofs.forEach(function (o) {
      if (o.tipo === 'propio') {
        var p = W.productos.filter(function (x) { return x.id === o.id; })[0];
        var u = D * o.cuota;
        p.unidades += u; p.ventas += u * p.precio; p.cuotaPorSeg[seg.id] = r2_(100 * o.cuota);
        cuotaSeg += o.cuota; uTot += u;
      } else if (o.tipo === 'comp') {
        var c = W.comps.filter(function (x) { return x.id === o.id; })[0];
        c.cuotaNueva = c.cuotaNueva || {}; c.cuotaNueva[seg.id] = o.cuota;
      }
    });
    cuotas[seg.id] = r2_(100 * cuotaSeg);
  });
  // capacidad de producción de los productos nuevos
  W.productos.forEach(function (p) {
    p.quiebre = 0;
    if (!p.cap || !p.activo || p.desde > t || p.unidades <= p.cap) return;
    var f = p.cap / p.unidades; p.quiebre = Math.round(p.unidades - p.cap);
    Object.keys(p.cuotaPorSeg).forEach(function (k) { var q = p.cuotaPorSeg[k] * (1 - f); cuotas[k] = r2_(cuotas[k] - q); p.cuotaPorSeg[k] = r2_(p.cuotaPorSeg[k] * f); });
    p.unidades *= f; p.ventas *= f;
    if (esReal) X.fb.push('“' + p.nombre + '” se agotó: la capacidad de producción (' + Math.round(p.cap / (p.porcU || 1)).toLocaleString('es-BO') + ' unidades) no alcanzó para la demanda.');
  });
  W.ultCuotas = cuotas;
  W.productos.forEach(function (p) {
    if (!p.activo || p.desde > t) return;
    if (p.lanzT === t) p.u1 = Math.round(p.unidades);
    ventas += p.ventas; costoVentas += p.unidades * costoEf(p); unidades += p.unidades;
    if (p.modelo === 'suscripcion') ventasSusc += p.ventas;
    var edad = t - Math.max(p.legado ? -99 : p.desde, p.relanz || -99);
    if (edad < 8) ventasNuevas += p.ventas;
    p.cuotaHist.push(sum_(Object.keys(p.cuotaPorSeg).map(function (k) { return p.cuotaPorSeg[k] || 0; })));
  });
  // licitación
  if (X.licitacion) {
    var apto = W.productos.filter(function (p) { return p.activo && p.desde <= t && p.attrs.salud >= 6 && p.attrs.nut >= 6; })[0];
    if (apto) { var vl = 75000 * 8.8; ventas += vl; costoVentas += 75000 * costoEf(apto); unidades += 75000; X.fb.push('Ganaste la licitación con "' + apto.nombre + '": 75.000 litros adicionales.'); }
    else X.fb.push('Tu postulación a la licitación fue rechazada: ningún producto cumple saludable ≥ 6 y nutrición ≥ 6.');
  }

  // reglas de competidores
  var c1 = W.comps.filter(function (c) { return c.id === 'C1'; })[0];
  if (c1 && c1.cuotaNueva) {
    var caida = ['S1', 'S5'].some(function (sid) { return c1.ultCuota[sid] !== undefined && (c1.ultCuota[sid] - c1.cuotaNueva[sid]) > 0.02; });
    if (caida && c1.cortes < 3) { c1.precio = r2_(c1.precio * 0.95); c1.cortes++; if (esReal) X.fb.push('El líder nacional C1 perdió cuota y bajó su precio 5 %.'); }
    else if (c1.precio < c1.precio0) c1.precio = r2_(Math.min(c1.precio0, c1.precio * 1.02));
  }
  W.comps.forEach(function (c) { if (c.cuotaNueva) { c.ultCuota = c.cuotaNueva; c.cuotaNueva = null; } });
  // detección de éxito para imitación (C2)
  W.clonados = W.clonados || [];
  W.productos.forEach(function (p) {
    if (p.legado || !p.activo || p.desde > t || W.clonados.indexOf(p.id) >= 0) return;
    var fuerte = Object.keys(p.cuotaPorSeg).some(function (k) { return p.cuotaPorSeg[k] * MKT_.N > 5; });
    p.rachaExito = fuerte ? (p.rachaExito || 0) + 1 : 0;
    if (p.rachaExito >= 2) {
      var L = { ninguna: 1, velocidad: 2, secreto: 3, patente: 5, activos: 2 }[p.proteccion] || 1;
      if (p.proteccion === 'secreto' && makeRng_('filtra|' + p.id + '|' + t)() < 0.1) L = 1;
      W.pendClones.push({ prodId: p.id, t: t + L }); W.clonados.push(p.id);
    }
  });

  // finanzas
  var F = W.fin;
  var gastoCom = 0;
  W.productos.forEach(function (p) {
    if (!p.activo) return;
    gastoCom += (p.comunicacion || 0) + (p.promo || 0);
    if (!p.legado && p.desde <= t) gastoCom += g.costoGestionProducto;
    (p.canales || []).forEach(function (c) { var ch = canalById_(P, c); if (ch && !(p.legado && (c === 'tienda' || c === 'super'))) gastoCom += ch.costo; });
  });
  var amort = 0;
  F.intang.forEach(function (it) {
    if (it.desde <= t && it.restante > 0) { var a = Math.min(it.restante, it.monto / 8); it.restante -= a; amort += a; }
  });
  var intereses = F.deuda * g.tasaDeuda + F.emerg * g.tasaEmergencia;
  var bruta = ventas - costoVentas;
  var uai = bruta - g.gastosFijos - gastoCom - X.gastoInnov - X.gastoOtros - amort - X.writeoff - intereses;
  var base = uai;
  if (uai > 0 && F.perdida > 0) { var uso = Math.min(F.perdida, uai); base = uai - uso; F.perdida -= uso; }
  else if (uai < 0) { F.perdida += -uai; base = 0; }
  var impuesto = Math.max(0, base) * g.tasaIUE;
  var un = uai - impuesto;
  var cxcNueva = (ventas - ventasSusc) * g.cxcPct;
  var dCxc = cxcNueva - F.cxc;
  var flujoOp = un + g.depreciacion + amort + X.writeoff - dCxc;
  var flujoInv = -(g.depreciacion + X.capexExtra + X.gastoCap + X.adquisicionCaja);
  var caja = F.caja + flujoOp + flujoInv, prestamo = 0, pago = 0;
  if (caja < 50000) { prestamo = 50000 - caja; F.emerg += prestamo; caja = 50000; if (esReal) X.fb.push('La caja quedó en negativo: se tomó un préstamo de emergencia de Bs ' + Math.round(prestamo).toLocaleString('es-BO') + ' al 4 % trimestral.'); }
  else if (F.emerg > 0 && caja > 800000) { pago = Math.min(F.emerg, caja - 800000); F.emerg -= pago; caja -= pago; }
  F.caja = caja; F.cxc = cxcNueva; F.af += X.capexExtra; F.resAcum += un;
  if (X.gastoCap > 0) { /* el capitalizado queda en el proyecto hasta el lanzamiento: se registra como intangible en curso */ F.enCurso = (F.enCurso || 0) + X.gastoCap; }
  // mover a intangible los capitalizados ya lanzados (se agregaron a F.intang); ajustar "en curso"
  var intangNeto = sum_(F.intang.map(function (it) { return it.restante; }));
  var enCurso = 0;
  if (S) S.proyectos.forEach(function (pj) { if (pj.estado === 'activo') enCurso += pj.capAcum || 0; });
  F.enCurso = enCurso;
  var activos = F.caja + F.cxc + F.inv + F.af + intangNeto + enCurso;
  var pasivos = F.prov + F.deuda + F.emerg;
  var patrimonio = F.capital + F.resAcum;

  var cuotaTotal = r2_(100 * uTot / dTot);
  return {
    ventas: Math.round(ventas), costoVentas: Math.round(costoVentas), utilidadBruta: Math.round(bruta), gastosFijos: g.gastosFijos,
    gastosComerciales: Math.round(gastoCom), gastosInnovacion: Math.round(X.gastoInnov), otrosGastos: Math.round(X.gastoOtros),
    amortizacion: Math.round(amort), bajas: Math.round(X.writeoff), intereses: Math.round(intereses), utilidadAntesImp: Math.round(uai),
    impuesto: Math.round(impuesto), utilidadNeta: Math.round(un), flujoOperativo: Math.round(flujoOp), flujoInversion: Math.round(flujoInv),
    flujoFinanciamiento: Math.round(prestamo - pago), flujoLibre: Math.round(flujoOp + flujoInv), caja: Math.round(F.caja),
    balance: { caja: Math.round(F.caja), cxc: Math.round(F.cxc), inventarios: Math.round(F.inv), activoFijo: Math.round(F.af), intangibles: Math.round(intangNeto), desarrolloEnCurso: Math.round(enCurso), totalActivo: Math.round(activos), proveedores: Math.round(F.prov), deuda: Math.round(F.deuda), emergencia: Math.round(F.emerg), capital: Math.round(F.capital), resultados: Math.round(F.resAcum), totalPasivoPatrimonio: Math.round(pasivos + patrimonio) },
    unidades: Math.round(unidades), cuotas: cuotas, cuotaTotal: cuotaTotal,
    vitalidad: ventas > 0 ? r2_(100 * ventasNuevas / ventas) : 0,
    productos: W.productos.filter(function (p) { return p.activo; }).map(function (p) { return { id: p.id, nombre: p.nombre, ventas: Math.round(p.ventas || 0), unidades: Math.round(p.unidades || 0), cuotas: p.cuotaPorSeg, precio: p.precio, AW: p.AW, pronostico: p.pronostico || null, promo: p.promo || 0, margen: p.precio > 0 ? r2_(100 * (p.precio - costoEf(p)) / p.precio) : 0 }; })
  };
}

/** Valor de la empresa al final (flujos descontados + valor terminal). */
function valorEmpresa_(P, hist, usarTwin) {
  var rq = Math.pow(1 + P.general.rAnual, 0.25) - 1, v = 0;
  hist.forEach(function (h, i) { var f = usarTwin ? h.twin.flujoLibre : h.flujoLibre; v += f / Math.pow(1 + rq, i + 1); });
  var ult = hist.slice(-4), fcl = sum_(ult.map(function (h) { return usarTwin ? h.twin.flujoLibre : h.flujoLibre; }));
  var vit = usarTwin ? 0 : (hist.length ? hist[hist.length - 1].vitalidad / 100 : 0);
  var gr = Math.min(0.04, 0.005 + 0.03 * vit) - (usarTwin ? 0.01 : 0);
  var VT = fcl * (1 + gr) / (P.general.rAnual - gr);
  return { valor: Math.round(v + VT / Math.pow(1 + rq, hist.length)), VT: Math.round(VT), g: gr };
}

/** Ajusta el presupuesto del año siguiente para todos los equipos (al cierre de cada año). */
function ajustarPresupuestos_(P, estados) {
  var g = P.general;
  var datos = estados.map(function (S) {
    var u = S.hist.slice(-4);
    return { vit: sum_(u.map(function (h) { return h.vitalidad; })) / Math.max(1, u.length), dif: sum_(u.map(function (h) { return h.utilidadNeta - h.twin.utilidadNeta; })) };
  });
  function norm(arr) { var mn = Math.min.apply(null, arr), mx = Math.max.apply(null, arr); return arr.map(function (x) { return mx > mn ? (x - mn) / (mx - mn) : 0.5; }); }
  var nv = norm(datos.map(function (d) { return d.vit; })), nd = norm(datos.map(function (d) { return d.dif; }));
  estados.forEach(function (S, i) {
    var score = 0.5 * nv[i] + 0.5 * nd[i];
    var carry = Math.max(0, S.saldo) * 0.5;
    var nuevo = clamp_(S.presupuestoAnual * (0.85 + 0.30 * score), g.presupuestoMin, g.presupuestoMax);
    S.presupuestoAnual = Math.round(nuevo); S.saldo = Math.round(nuevo + carry);
    S.feedback.push('El directorio fijó tu presupuesto de innovación del año siguiente en Bs ' + S.presupuestoAnual.toLocaleString('es-BO') + ' (+ Bs ' + Math.round(carry).toLocaleString('es-BO') + ' arrastrados del saldo no usado).');
  });
}

if (typeof module !== 'undefined') module.exports = {
  simulateQuarter_: simulateQuarter_, initialState_: initialState_, scheduleEvents_: scheduleEvents_, calibrate_: calibrate_,
  noticiasPara_: noticiasPara_, ideaQuality_: ideaQuality_, valorEmpresa_: valorEmpresa_, ajustarPresupuestos_: ajustarPresupuestos_,
  marketShares_: marketShares_, segById_: segById_, utility_: utility_, setMercado_: setMercado_
};

/** Estimación de costos y semanas de una decisión (para mostrar antes de enviar). */
/** Campos de la estrategia anual sin completar (todos son obligatorios al inicio de cada año). */
function anualFaltantes_(A) {
  A = A || {}; var f = [], p4 = A.p4 || {}, vac = function (x) { return x === undefined || x === null || x === ''; };
  var k4 = ['producto', 'proceso', 'posicion', 'paradigma'];
  if (k4.some(function (k) { return vac(p4[k]); })) f.push('las 4P'); else if (k4.reduce(function (s, k) { return s + Number(p4[k]); }, 0) !== 100) f.push('las 4P deben sumar 100 %');
  if (['nucleo', 'adyacente', 'transf'].some(function (k) { return vac(A[k]); })) f.push('el portafolio'); else if (Number(A.nucleo) + Number(A.adyacente) + Number(A.transf) !== 100) f.push('el portafolio debe sumar 100 %');
  [['postura', 'la postura'], ['estructura', 'la estructura'], ['tiempoLibre', 'el tiempo libre'], ['incentivo', 'el incentivo'], ['politica', 'la política ante el fracaso'], ['composicion', 'la composición de equipos'], ['umbral', 'el umbral de la puerta'], ['capacitacion', 'la capacitación (sí o no)']].forEach(function (k) { if (vac(A[k[0]]) || A[k[0]] === false && k[0] !== 'capacitacion') f.push(k[1]); });
  if (String(A.hipotesis || '').trim().length < 20) f.push('la hipótesis anual (al menos 20 caracteres)');
  return f;
}
function estimarCostos_(P, S, dec, t) {
  var g = P.general, O = copy_(S.org), costo = 0, sem = 0, avisos = [], f;
  dec = dec || {};
  if (esInicioAnio_(t)) {
    var A = dec.anual || {};
    var fA = anualFaltantes_(A); if (fA.length) avisos.push('Estrategia anual: falta completar ' + fA.join(', ') + '.');
    ['tiempoLibre', 'incentivo', 'estructura', 'composicion'].forEach(function (k) { O[k] = A[k] === undefined ? '' : A[k]; });
    O.tiempoLibre = Number(O.tiempoLibre) || 0;
    if (A.capacitacion === true || A.capacitacion === 'si') { costo += g.costoCapacitacion * factorMadurez_(O); sem += g.semCapacitacion; }
  }
  if (esInicioAnio_(t)) {
    costo += { reconocimiento: 5000, bajo: 15000, alto: 40000 }[O.incentivo] || 0;
    if (O.estructura === 'autonoma') costo += g.costoUnidadAutonoma;
  }
  costo += (Number(O.tiempoLibre) || 0) * g.costoTiempoLibrePunto;
  var inv = dec.investigacion || {};
  S = migrar_(copy_(S), P);
  (inv.metodos || []).forEach(function (mid) {
    var m = metById_(P, mid); if (!m) return;
    var segs = (inv.segs && Array.isArray(inv.segs[mid])) ? inv.segs[mid] : (inv.segmentos || []);
    if (MET_SEG_.indexOf(mid) >= 0 && !segs.length) { avisos.push(m.nombre + ': elijan uno o dos segmentos; sin segmentos no se compra.'); return; }
    if (mid === 'lideres' && !inv.proyectoLideres) { avisos.push('Usuarios líderes: elijan el proyecto que recibirá sus ideas; si no, no se compra.'); return; }
    var cm = costoMetodo_(P, S, m, t); costo += cm.costo * factorMadurez_(O);
    if (cm.recargo) avisos.push(m.nombre + ' cuesta 50 % más porque lo compraron el trimestre anterior.');
  });
  Object.keys(dec.respuestas || {}).forEach(function (k) {
    if (dec.respuestas[k] === 'preparar') costo += g.costoPreparar;
    if (dec.respuestas[k] === 'actuar') {
      var ac = (dec.acciones || {})[k] || {}, A = (P.accionesEntorno || []).filter(function (x) { return x.id === ac.a; })[0];
      if (!A) avisos.push('Entorno: eligieron actuar ante una noticia pero falta elegir la acción.');
      else { costo += A.costo; if (A.seg && !ac.seg) avisos.push('Entorno: la acción "' + A.nombre + '" necesita un segmento.'); if (String(ac.porque || '').trim().length < 10) avisos.push('Entorno: escriban por qué "' + A.nombre + '" responde a la noticia.'); }
    }
  });
  var pend = informesPendientes_(S, dec, t);
  if (pend.length) avisos.push('Escriban qué decisión toman con ' + (pend.length === 1 ? 'el informe' : 'los ' + pend.length + ' informes') + ' de investigación recibidos (Resultados → Informes de investigación).');
  var maxP = anioDe_(t) === 1 ? (g.maxProyectosAnio1 || g.maxProyectos) : g.maxProyectos, actP = S.proyectos.filter(function (p) { return p.estado === 'activo'; }).length;
  if ((dec.nuevosProyectos || []).length + actP > maxP) avisos.push('Pueden tener como máximo ' + maxP + ' proyectos activos' + (anioDe_(t) === 1 ? ' en el primer año' : '') + '; algunos proyectos nuevos no se crearán.');
  Object.keys(dec.proyectos || {}).forEach(function (pid) {
    var a = dec.proyectos[pid], pj = S.proyectos.filter(function (p) { return p.id === pid; })[0];
    if (!pj) return;
    (a.iniciativas || []).slice(0, 3).forEach(function (ia) { var ini = iniById_(P, ia.id); if (!ini) return; var pr = ini.premio ? (P.premios[ia.premio] || P.premios.medio) : null; costo += (ini.costo + (pr ? pr.costo : 0)) * factorMadurez_(O); sem += semMadurez_(O, ini.sem); });
    if (a.validar && a.validar.length) { costo += Math.min(10, a.validar.length) * g.costoValidacion * factorMadurez_(O); sem += g.semValidacion; }
    if (a.prototipo) { f = P.fidelidades[a.prototipo.fidelidad] || P.fidelidades.baja; var n = clamp_(Math.round(Number(a.prototipo.iteraciones) || 1), 1, f.max); costo += n * f.costo * factorMadurez_(O); sem += semMadurez_(O, n * f.sem); }
    if (a.piloto) { costo += g.costoPiloto * factorMadurez_(O); sem += semMadurez_(O, g.semPiloto); }
    if (pj.flujo === 2 && (pj.etapa === 'idear' || pj.etapa === 'evaluar')) { var e2 = estimarProyecto2_(P, S, pj, a, O, t); costo += e2.costo; sem += e2.sem; avisos = avisos.concat(e2.avisos); }
    if (pj.flujo === 2) { var e3 = estimarProyecto3_(P, S, pj, a, O, t); costo += e3.costo; sem += e3.sem; avisos = avisos.concat(e3.avisos); }
    if (a.piloto && pj.factPiloto > 1) costo += g.costoPiloto * factorMadurez_(O) * (pj.factPiloto - 1);
    if (a.lanzar && (pj.ideaSel || pj.concepto)) { var idea = ideaDe_(P, pj); costo += (g.costoLanzamiento + idea.costo) * factorMadurez_(O); sem += semMadurez_(O, g.semLanzamiento); if (a.lanzar.proteccion === 'patente') { costo += g.costoPatente; sem += g.semPatente; } }
  });
  if (dec.revision) { costo += g.costoRevision; sem += g.semRevision; }
  costo = Math.round(costo);
  if (costo > S.saldo) avisos.push('El costo estimado (Bs ' + costo.toLocaleString('es-BO') + ') supera tu saldo de presupuesto (Bs ' + Math.round(S.saldo).toLocaleString('es-BO') + '). Algunas acciones no se ejecutarán.');
  if (sem > g.semanasTrimestre) avisos.push('Las semanas-persona estimadas (' + sem + ') superan las ' + g.semanasTrimestre + ' disponibles. Algunas acciones no se ejecutarán.');
  if (!dec.hipotesis || String(dec.hipotesis).trim().length < 20) avisos.push('Escribe la hipótesis del equipo (al menos 20 caracteres) antes de enviar.');
  return { costo: costo, semanas: Math.round(sem * 10) / 10, saldo: Math.round(S.saldo), semanasDisp: g.semanasTrimestre, avisos: avisos };
}

/** Informes recibidos que todavía no tienen la decisión escrita por el equipo. */
function informesPendientes_(S, dec, t) {
  var d = (dec && dec.decInformes) || {};
  return (S.informes || []).filter(function (i) { return i.requiere && i.t === t - 1 && String(d[i.id] || i.decision || '').trim().length < 10; }).map(function (i) { return i.id; });
}
