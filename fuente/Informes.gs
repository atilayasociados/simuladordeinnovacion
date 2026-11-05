/**
 * Simulador de Innovación — Informes de investigación, respuesta al entorno,
 * estrategia anual (portafolio y postura) e informe de coherencia (v1.8).
 * Funciones puras usadas por Engine.gs.
 */

// ---------- migración de estados guardados ----------
function migrar_(S, P) {
  S.informes = S.informes || [];
  S.ultMetodo = S.ultMetodo || {};
  S.preparados = S.preparados || {};
  S.seguimiento = S.seguimiento || [];
  S.coherencia = S.coherencia || [];
  S.nextInf = S.nextInf || 1;
  var O = S.org;
  if (O.nucleo === undefined) {
    // desde el esquema anterior: incremental/radical y clientes actuales/nuevos
    O.transf = Math.max(0, Math.min(100, Math.round((O.rad || 30) / 2)));
    O.adyacente = Math.max(0, Math.min(100 - O.transf, Math.round(O.nue || 20)));
    O.nucleo = 100 - O.transf - O.adyacente;
  }
  O.postura = O.postura || 'defensiva';
  if (S.world) {
    S.world.prep = S.world.prep || {};
    S.world.productos.forEach(function (p) {
      if (p.segPub === undefined) { p.segPub = 'todos'; if (p.legado && !p.comunicacion) p.comunicacion = P.general.publicidadBase || 0; }
      if (p.promo === undefined) p.promo = 0;
    });
  }
  if (S.twin) S.twin.productos.forEach(function (p) { if (p.legado && p.segPub === undefined) { p.segPub = 'todos'; p.promo = 0; if (!p.comunicacion) p.comunicacion = P.general.publicidadBase || 0; } });
  return S;
}

/** Traduce el portafolio de Nagji y Tuff a los parámetros internos del motor. */
function portafolioAInterno_(O) {
  var n = Number(O.nucleo) || 0, a = Number(O.adyacente) || 0, tr = Number(O.transf) || 0;
  O.rad = Math.round(Math.min(100, tr + 0.3 * a));
  O.inc = 100 - O.rad;
  O.nue = Math.round(Math.min(100, a + tr));
  O.act = 100 - O.nue;
}

/** Costo de un método con recargo por repetirlo en el trimestre siguiente. */
function costoMetodo_(P, S, m, t) {
  var rep = S.ultMetodo && S.ultMetodo[m.id] === t - 1;
  return { costo: m.costo * (rep ? 1 + P.general.recargoRepeticion : 1), recargo: rep };
}

// ---------- utilidades de informes ----------
function nuevoInforme_(S, m, t, extra) {
  var inf = { id: 'INF' + (S.nextInf++), metodo: m.id, nombre: m.nombre, fam: m.fam, t: t, decision: '', requiere: true };
  Object.keys(extra || {}).forEach(function (k) { inf[k] = extra[k]; });
  S.informes.push(inf);
  // se conservan los datos completos de los 16 informes más recientes; los anteriores guardan solo su resumen
  if (S.informes.length > 16) S.informes.slice(0, S.informes.length - 16).forEach(function (x) { if (x.datos) { x.resumen = x.resumen || ''; delete x.datos; } });
  return inf;
}
function ordenAttrs_(w) {
  return Object.keys(w).filter(function (k) { return k !== 'precio'; }).sort(function (a, b) { return w[b] - w[a]; });
}
var ENVASES_ = { C1: 'Caja 1 L', C2: 'Caja 1 L', C3: 'Botella importada 250 ml', C4: 'Botella vegetal 330 ml' };
var MENSAJES_ = { C1: '“La leche de siempre para toda la familia”', C2: '“Precio justo para tu familia”', C3: '“Calidad premium importada”', C4: '“Vegetal, práctica y a un clic”' };
var CANALES_COMP_ = { C1: ['Tiendas de barrio', 'Supermercados'], C2: ['Tiendas de barrio', 'Supermercados'], C3: ['Supermercados'], C4: ['App propia con entrega'] };
function nivel_(x, a, b) { return x >= b ? 'alta' : (x >= a ? 'media' : 'baja'); }

/** Participación de cada empresa (con un trimestre de retraso). */
function informeIndustria_(P, S, prev, t, sched) {
  var W = S.world, hPrev = prev.hist.length ? prev.hist[prev.hist.length - 1] : null, N = MKT_.N;
  var pesoSeg = {}, totD = 0, tRef = Math.max(1, t - 1);
  P.segmentos.forEach(function (s) { pesoSeg[s.id] = demanda_(P, s, tRef, sched); totD += pesoSeg[s.id]; });
  Object.keys(pesoSeg).forEach(function (k) { pesoSeg[k] /= totD; });
  var filas = [];
  function agrega(nombre, porSeg, yo) { // porSeg en % del segmento
    var s = 0; Object.keys(pesoSeg).forEach(function (k) { s += (porSeg[k] || 0) * pesoSeg[k]; });
    filas.push({ nombre: nombre, yo: !!yo, lo: Math.max(0, Math.round(s * 0.85 * 2) / 2), hi: Math.round(s * 1.15 * 2) / 2, c: s });
  }
  var estimado = !hPrev;
  if (hPrev) {
    agrega('Su empresa', hPrev.cuotas, true);
    W.comps.forEach(function (c) { if (!c.activo || !c.ultCuota) return; var ps = {}; Object.keys(c.ultCuota).forEach(function (k) { ps[k] = 100 * c.ultCuota[k]; }); if (Object.keys(ps).length) agrega(c.nombre, ps); });
    var porEmp = {};
    (MKT_.previos || []).forEach(function (p) { porEmp[p.empresa] = porEmp[p.empresa] || {}; Object.keys(p.cuotaPorSeg || {}).forEach(function (k) { porEmp[p.empresa][k] = (porEmp[p.empresa][k] || 0) + p.cuotaPorSeg[k]; }); });
    Object.keys(porEmp).forEach(function (e) { agrega(e, porEmp[e]); });
  } else {
    var tmp = {}, comp = {};
    P.segmentos.forEach(function (seg) {
      marketShares_(P, W, seg, t).forEach(function (o) {
        var key = o.tipo === 'propio' ? 'Su empresa' : (o.tipo === 'rival' ? o.empresa : o.id);
        tmp[key] = tmp[key] || {}; tmp[key][seg.id] = (tmp[key][seg.id] || 0) + 100 * o.cuota;
        if (o.tipo === 'comp') comp[o.id] = true;
      });
    });
    Object.keys(tmp).forEach(function (k) {
      var c = W.comps.filter(function (x) { return x.id === k; })[0];
      agrega(c ? c.nombre : k, tmp[k], k === 'Su empresa');
    });
  }
  filas.sort(function (a, b) { return b.c - a.c; });
  filas.forEach(function (f) { delete f.c; });
  var tend = P.segmentos.map(function (s) {
    var v = []; for (var k = Math.max(1, t - 4); k <= Math.max(1, t - 1); k++) v.push({ t: k, miles: Math.round(demanda_(P, s, k, sched) * N / 1000) });
    return { seg: s.id, nombre: s.nombre, serie: v };
  });
  return {
    pregunta: '¿Cuánto vende la industria, cómo se reparte entre las empresas y hacia dónde va cada segmento?',
    ficha: 'Panel de puntos de venta (auditoría minorista). Cobertura estimada: 80 % del canal. Participación en rangos. Datos con corte a T' + Math.max(1, t - 1) + (estimado ? ' (estimación de inicio de partida).' : '.'),
    limites: 'Los datos tienen un trimestre de retraso y la participación se entrega en rangos, no en cifras exactas. El canal informal no está cubierto.',
    datos: { filas: filas, tendencia: tend }
  };
}

/** Lo observable de cada rival en el punto de venta. */
function informeCompetidores_(P, S, t) {
  var W = S.world, filas = [];
  W.comps.forEach(function (c) {
    if (!c.activo) return;
    var pres = 0, n = 0; Object.keys(c.pres).forEach(function (k) { pres += c.pres[k]; n++; });
    filas.push({ nombre: c.nombre, precio: r2_(c.precio), envase: ENVASES_[c.id] || 'Formato individual', mensaje: MENSAJES_[c.id] || '“Lo mismo, más barato”', canales: (CANALES_COMP_[c.id] || ['Tiendas de barrio', 'Supermercados']).join(', '), presencia: nivel_(n ? pres / n : 0, 0.35, 0.7) });
  });
  (MKT_.previos || []).forEach(function (p) {
    if (!p.activo) return;
    var pub = Number(p.comunicacion) || 0;
    filas.push({ nombre: p.empresa + ': ' + p.nombre, rival: true, precio: r2_(p.precio), envase: p.legado ? 'Caja 1 L' : 'Formato individual', mensaje: pub >= 40000 ? 'Publicidad intensa' : (pub >= 15000 ? 'Publicidad moderada' : (pub > 0 ? 'Poca publicidad' : 'Sin publicidad visible')), canales: (p.canales || []).map(function (c) { var ch = canalById_(P, c); return ch ? ch.nombre : c; }).join(', '), presencia: nivel_(p.AW || 0, 0.4, 0.75) });
  });
  return {
    pregunta: '¿Qué ofrece hoy cada rival en el punto de venta y dónde hay un espacio libre?',
    ficha: 'Visita a 40 puntos de venta y revisión de publicidad: precios de góndola, envases, mensajes y canales.',
    limites: 'Muestra lo que los rivales ya lanzaron, no lo que preparan. Sus costos, márgenes, proyectos y la calidad real de sus productos no son observables.',
    datos: { filas: filas }
  };
}

/** Boletín de señales PESTELDC: noticias reales próximas (con confianza decreciente) y ruido. */
function informeVigilancia_(P, S, t, sched) {
  var senales = [], rng = makeRng_('vig|' + S.equipoId + '|' + t);
  P.noticias.forEach(function (n) {
    var d = n.t - t; if (d < 1 || d > 3) return;
    senales.push({ texto: n.texto, area: n.area || 'Económico', confianza: d === 1 ? 'alta' : (d === 2 ? 'media' : 'baja'), horizonte: d === 1 ? 'próximo trimestre' : (d + ' trimestres') });
  });
  if (sched.sequia && sched.sequia - t >= 1 && sched.sequia - t <= 3) senales.push({ texto: 'Los productores lecheros advierten lluvias por debajo de lo normal.', area: 'Ecológico', confianza: sched.sequia - t === 1 ? 'alta' : 'media', horizonte: (sched.sequia - t) + ' trimestre(s)' });
  var areas = ['Político', 'Económico', 'Social', 'Tecnológico', 'Ecológico', 'Legal', 'Demográfico', 'Cultural'];
  for (var k = 0; k < 2; k++) {
    var ri = sched.ruido[Math.min(20, t + 1 + k)] || 0;
    senales.push({ texto: P.ruido[(ri + 3 + k) % P.ruido.length].replace(/^Rumor: |^Circula que |^Se dice que /, ''), area: areas[Math.floor(rng() * areas.length)], confianza: rng() < 0.5 ? 'media' : 'baja', horizonte: (1 + k) + ' trimestre(s)' });
  }
  senales = senales.map(function (x) { return { x: x, k: rng() }; }).sort(function (a, b) { return a.k - b.k; }).map(function (o) { return o.x; });
  return {
    pregunta: '¿Qué cambios del entorno podrían afectar a la industria en los próximos trimestres?',
    ficha: 'Rastreo de prensa, normas, ferias y redes en las 8 áreas PESTELDC. Boletín trimestral durante 4 trimestres.',
    limites: 'Las señales son ambiguas a propósito: algunas se confirmarán y otras resultarán ruido. Reaccionar a todas es tan costoso como ignorarlas.',
    datos: { senales: senales }
  };
}

/** Tendencias anticipadas por usuarios extremos (alineadas con los cambios reales del motor). */
function informeExtremos_(P, S, t) {
  var T = [];
  if (t < 12) T.push({ texto: 'Los productos con mucha azúcar serán rechazados por familias, deportistas y adultos mayores.', atributo: 'Saludable', segmentos: 'S1, S4, S5', fuerza: t < 6 ? 'moderada' : 'fuerte', horizonte: t < 6 ? '1 a 2 años' : 'menos de 1 año' });
  T.push({ texto: 'La sostenibilidad del envase y del producto ganará peso en universitarios y deportistas.', atributo: 'Sostenibilidad', segmentos: 'S2, S4', fuerza: t < 12 ? 'débil' : 'moderada', horizonte: t < 12 ? '3 a 4 años' : '1 a 2 años' });
  if (t < 10) T.push({ texto: 'Comprar por aplicación y recibir en el lugar donde se está será lo normal para universitarios y oficinistas.', atributo: 'Conveniencia', segmentos: 'S2, S3', fuerza: 'moderada', horizonte: '1 año' });
  return {
    pregunta: '¿Qué necesidad, hoy exagerada en usuarios extremos, podría volverse común en el mercado?',
    ficha: 'Entrevistas en profundidad a 6 usuarios en los dos extremos del uso (uso intenso y casi nulo). Análisis de patrones comunes.',
    limites: 'Es una hipótesis sobre el futuro, no una certeza. Puede no cumplirse o tardar más. Conviene confirmarla con vigilancia del entorno.',
    datos: {
      casos: [['Uso intenso', 'Un corredor de montaña toma cuatro lácteos al día; busca proteína alta, poca azúcar y porciones que pueda llevar.'], ['Uso mínimo', 'Una adulta mayor dejó de comprar: le cuesta abrir los envases y desperdicia la caja de litro.']],
      tendencias: T
    }
  };
}

/** Encuesta: importancia declarada con margen de error. */
function informeEncuesta_(P, S, seg, obs, m) {
  var filas = Object.keys(obs).map(function (k) { return { attr: k, nombre: k === 'precio' ? 'Precio' : ATTR_NOMBRES[k], v: obs[k] }; }).sort(function (a, b) { return b.v - a.v; });
  return {
    pregunta: '¿Qué atributos declaran importantes los clientes de ' + seg.id + ' (' + seg.nombre + ') al elegir una bebida láctea?',
    ficha: 'Cuestionario cerrado. n = 200 por segmento, muestreo por cuotas. Margen de error ±' + m.err + ' puntos (95 %).',
    limites: 'Mide lo que el cliente dice, no lo que hace. Subestima necesidades latentes y exagera lo socialmente deseable. Si dos barras se solapan dentro del margen, no se puede afirmar cuál importa más.',
    datos: { seg: seg.id, filas: filas, margen: m.err }
  };
}

/** Observación etnográfica: informe cualitativo por segmento. */
function informeObservacion_(P, S, seg, obs) {
  var B = (P.observacion || {})[seg.id] || {};
  var real = ordenAttrs_(seg.w), decl = {}, wDecl = {};
  Object.keys(seg.w).forEach(function (k) { wDecl[k] = seg.latentes.indexOf(k) >= 0 ? seg.w[k] * 0.5 : seg.w[k]; });
  var ordDecl = ordenAttrs_(wDecl);
  var comp = real.slice(0, 3).map(function (k) { return { nombre: ATTR_NOMBRES[k], dice: ordDecl.indexOf(k) + 1, hace: real.indexOf(k) + 1 }; });
  var lat = seg.latentes.map(function (k) { return ATTR_NOMBRES[k]; });
  return {
    pregunta: '¿Cómo viven realmente los clientes de ' + seg.id + ' (' + seg.nombre + ') el consumo de lácteos y dónde se frustran?',
    ficha: 'Acompañamiento en su vida diaria. 12 participantes, 36 horas de observación. Sin margen de error: no es una medición estadística.',
    limites: '12 personas no representan al segmento: muestra qué existe, no cuánto. Lo observado depende de la interpretación del observador. Para dimensionar, combínenla con una encuesta.',
    datos: { seg: seg.id, persona: B.persona || [seg.nombre, ''], citas: B.citas || [], recorrido: B.recorrido || [], empatia: B.empatia || [], latente: lat, comparacion: comp, pesos: obs }
  };
}

/** Percepción de marcas en un segmento: valores percibidos y valor real propio. */
function informePercepcion_(P, S, seg, t, rng) {
  var W = S.world, marcas = [], w = seg.w, ord = ordenAttrs_(w), ax = [ord[0], ord[1]];
  function perc(attrs, AW) { var o = {}; ATTRS.forEach(function (k) { o[k] = r1_(clamp_((attrs[k] || 0) * (0.7 + 0.3 * (AW || 0.5)) + rng.normal(0, 0.7), 0, 10)); }); return o; }
  W.productos.forEach(function (p) { if (p.activo && p.desde <= t) marcas.push({ nombre: p.nombre, propio: true, perc: perc(p.attrs, p.AW), real: copy_(p.attrs), precio: p.precio }); });
  W.comps.forEach(function (c) { if (c.activo && (c.pres[seg.id] || 0) > 0) marcas.push({ nombre: c.nombre, perc: perc(c.attrs, 0.9), precio: c.precio }); });
  (MKT_.previos || []).forEach(function (p) { if (p.activo) marcas.push({ nombre: p.empresa + ': ' + p.nombre, perc: perc(p.attrs, p.AW), precio: p.precio }); });
  var wmax = Math.max(w[ax[0]], w[ax[1]]) || 1;
  return {
    pregunta: '¿Cómo perciben los clientes de ' + seg.id + ' (' + seg.nombre + ') a cada marca frente a lo que consideran ideal?',
    ficha: 'Calificación de marcas en 5 atributos (0–10). n = 150. Mapa con los dos atributos que más pesan en el segmento.',
    limites: 'La percepción cambia lentamente y depende de la publicidad pasada. El mapa resume 5 atributos en 2 ejes: se pierde información.',
    datos: { seg: seg.id, ejes: ax.map(function (k) { return { attr: k, nombre: ATTR_NOMBRES[k] }; }), ideal: [r1_(10 * w[ax[0]] / wmax), r1_(10 * w[ax[1]] / wmax)], marcas: marcas }
  };
}

// ---------- respuesta al entorno ----------
/** Clave de preparación que activa una noticia real. */
function clavePreparacion_(id) {
  if (id === 'N06' || id === 'N07') return 'etiquetado';
  if (id === 'NSEQ') return 'sequia';
  if (/^NBLQ/.test(id)) return 'bloqueos';
  if (id === 'N09') return 'divisas';
  if (id === 'N05' || id === 'N08' || id === 'N10') return 'startup';
  if (id === 'N02' || id === 'N04') return 'op:S2';
  if (id === 'N03') return 'op:S3';
  if (id === 'N11') return 'op:S1';
  if (id === 'N12' || id === 'N13') return 'op:S4';
  return null;
}
var EFECTO_PREP_ = {
  etiquetado: 'el etiquetado frontal les restará la mitad de atractivo que al resto (prepararon su reformulación y su etiqueta)',
  sequia: 'la sequía elevará su costo de leche la mitad que a los demás (aseguraron proveedores)',
  bloqueos: 'los bloqueos les quitarán la mitad de ventas (armaron rutas y stock alternativos)',
  divisas: 'la escasez de divisas encarecerá sus envases la mitad (compraron por adelantado)',
  startup: 'su oferta para universitarios tendrá 5 % más de atractivo mientras la startup compita (prepararon la respuesta)'
};
/** Dato adicional para una noticia que el equipo decidió vigilar. */
function datoSeguimiento_(n) {
  if (n.tipo === 'ruido') return 'No aparecieron fuentes que confirmen esta información. Por ahora no hay evidencia de que sea real.';
  if (n.tipo === 'oportunidad') return 'Nuevos datos respaldan la noticia: el cambio avanza y abre espacio para ofertas que respondan a él.';
  if (n.tipo === 'amenaza') return 'Nuevos datos confirman la noticia: el riesgo para la industria es real y se acerca.';
  return 'Nuevos datos confirman la noticia: trae riesgos para quien no se adapte y oportunidades para quien se prepare.';
}

// ---------- informe de coherencia ----------
function coherencia_(P, S, t) {
  var O = S.org, msgs = [], anio1 = anioDe_(t) === 1;
  function add(tipo, txt, porque) { msgs.push({ tipo: tipo, texto: txt + (anio1 && porque ? ' ' + porque : '') }); }
  var act = S.proyectos.filter(function (p) { return p.estado === 'activo'; });
  var nuevos = act.filter(function (p) { var s = segById_(P, p.segmento); return s && s.nuevo; }).length;
  var exploradoras = O.adyacente + O.transf;
  if (act.length && exploradoras >= 40 && nuevos === 0) add('aviso', 'Declararon ' + exploradoras + ' % del portafolio en innovación adyacente o transformacional, pero todos sus proyectos son para clientes actuales.', 'Un portafolio se mide por lo que se hace, no por lo que se declara (Nagji y Tuff, 2012).');
  if (act.length && O.nucleo >= 80 && nuevos === act.length) add('aviso', 'Declararon ' + O.nucleo + ' % en el núcleo, pero todos sus proyectos apuntan a segmentos nuevos.', 'Si la estrategia cambió, conviene declararlo en la hipótesis anual.');
  var invUlt = S.informes.filter(function (i) { return i.t >= t - 3; }).length;
  if (O.postura === 'ofensiva' && (invUlt === 0 || !act.length)) add('aviso', 'Su postura es ofensiva, pero en el último año ' + (invUlt === 0 ? 'no investigaron' : 'no tienen proyectos activos') + '.', 'Una postura ofensiva exige llegar primero, y eso requiere investigar y desarrollar antes que los demás (Freeman y Soete, 1997).');
  if (O.postura === 'imitativa' && !S.informes.some(function (i) { return i.metodo === 'competidores' && i.t >= t - 3; })) add('aviso', 'Su postura es imitativa, pero no analizaron a los competidores en el último año.', 'Imitar bien exige observar de cerca lo que hacen los demás.');
  if (O.postura === 'tradicional' && act.length >= 2) add('info', 'Su postura es tradicional, pero tienen ' + act.length + ' proyectos de innovación activos.', 'Revisen si su postura real cambió.');
  var mand = S.mandato || 'MA';
  if ((mand === 'MB' || mand === 'MD') && O.transf > 30) add('aviso', 'El directorio pidió poco riesgo, pero declararon ' + O.transf + ' % de innovación transformacional.', 'Una estrategia de innovación debe alinearse con lo que la empresa está dispuesta a arriesgar (Pisano, 2015).');
  act.forEach(function (p) {
    if ((S.iq[p.segmento] || 0) < 0.3) add('aviso', 'El proyecto "' + p.nombre + '" trabaja para ' + p.segmento + ' sin haber investigado ese segmento.', 'Sin empatía con el cliente, el reto y las ideas se basan en suposiciones (Brown, 2019).');
  });
  var pend = S.informes.filter(function (i) { return i.requiere && i.t < t && !String(i.decision || '').trim(); }).length;
  if (pend) add('aviso', pend + ' informe(s) de investigación sin la decisión que tomaron con el dato.', 'Investigar solo vale si cambia una decisión.');
  if (!msgs.length) add('ok', 'Sus decisiones del trimestre son coherentes con la estrategia anual declarada.', '');
  return msgs;
}

if (typeof module !== 'undefined') module.exports = { migrar_: migrar_, coherencia_: coherencia_ };
