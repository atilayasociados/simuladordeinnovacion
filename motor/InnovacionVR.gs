/**
 * Simulador de Innovación "vida real" — Módulo de innovación (vr-0.1).
 * Comité y presupuesto, banco de referencias, hoja de costos, estudios, Gantt, compuertas y lanzamiento.
 * Decisiones del docente: 10, 12, 13–16, 18–23, 27, 28 (claude/decisiones-simulador-vida-real.md).
 * Funciones puras: no leen ni escriben la base de datos.
 */

// ---------- semanas ----------
function vrSemanaInicioTrim_(D, t) { return (t - 1) * D.semanasPorTrimestre + 1; }
function vrSemanaFinTrim_(D, t) { return t * D.semanasPorTrimestre; }
function vrTrimDeSemana_(D, s) { return Math.floor((s - 1) / D.semanasPorTrimestre) + 1; }

// ---------- generador aleatorio con semilla (mulberry32) ----------
function vrRng_(semilla) {
  var s = String(semilla), h = 1779033703 ^ s.length;
  for (var i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  var a = h >>> 0;
  var f = function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.normal = function () { var u = 1 - f(), v = f(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  return f;
}

// =====================================================================
// BANCO DE REFERENCIAS (decisión 14; banco de datos §4, §7, §8, §12)
// =====================================================================
function vrBanco(D, partida) {
  var a0 = partida.anio0;
  var resto = a0.costoVariable - (5.50 * 1 + 6.42 * 0.070 + 121 * 0.010); // insumos y envase del producto actual (derivado)
  return {
    leche_cruda: { nombre: 'Leche cruda', unidad: 'L', precio: 5.50, fuente: 'Los Tiempos, 28-abr-2026 (banco §4)' },
    azucar: { nombre: 'Azúcar granulada', unidad: 'kg', precio: 6.42, fuente: 'Defensoría del Pueblo, dic-2025 (banco §4)' },
    cacao: { nombre: 'Cacao en polvo', unidad: 'kg', precio: 121, fuente: 'Hipermaxi, 11-nov-2026 (banco §4)' },
    insumos_envase_actual: { nombre: 'Otros insumos y envase cartón 1 L (como el producto actual)', unidad: 'L de producto', precio: vrR2_(resto),
      fuente: 'Derivado: costo variable del Año 0 (nota 21 de Gloria) menos leche, azúcar y cacao (banco §7, §15)' },
    mano_obra_planta_actual: { nombre: 'Mano de obra de la planta actual (ya incluida en los costos fijos de fabricación)', unidad: 'L de producto', precio: 0,
      fuente: 'La mano de obra directa es costo fijo de la planta (banco §15, regla 2)' },
    registro_sanitario: { nombre: 'Registro sanitario SENASAG por producto', unidad: 'producto', precio: D.registroSanitario.costo, fuente: 'FOBOMADE (banco §12)' },
    sueldo_jefe: { nombre: 'Sueldo mensual jefe o gerente', unidad: 'mes', precio: D.sueldos.jefe, fuente: 'INE 2020 (banco §8)' },
    sueldo_profesional: { nombre: 'Sueldo mensual profesional', unidad: 'mes', precio: D.sueldos.profesional, fuente: 'INE 2020 (banco §8)' }
  };
}

// =====================================================================
// COMITÉ Y PRESUPUESTO (decisiones 23 y 27)
// =====================================================================
/** comite = [{ nombre, cargo: 'jefe'|'profesional', dedicacion: 0..1 }] (1 a 5 integrantes). */
function vrValidarComite(D, comite) {
  var err = [];
  if (!comite || comite.length < 1 || comite.length > 5) err.push('El comité debe tener entre 1 y 5 integrantes.');
  (comite || []).forEach(function (m, i) {
    if (!D.sueldos[m.cargo]) err.push('Integrante ' + (i + 1) + ': el cargo debe ser jefe o profesional.');
    if (!(m.dedicacion >= 0 && m.dedicacion <= 1)) err.push('Integrante ' + (i + 1) + ': la dedicación debe estar entre 0 % y 100 %.');
  });
  return err;
}
function vrCostoComiteSemana(D, comite) {
  var s = 0; (comite || []).forEach(function (m) { s += D.sueldos[m.cargo] * m.dedicacion * 12 / 52; }); return s;
}
function vrPresupuestoExploracion(D, eq) { return D.presupuestoExploracionPctVentas * eq.ventasAnioAnterior; }

// =====================================================================
// HOJA DE COSTOS (decisión 16)
// =====================================================================
/**
 * proyecto.hoja = [{ descripcion, categoria: 'contenido'|'envase'|'mano_de_obra'|'equipo'|'otro',
 *                    tipo: 'variable'|'inversion'|'fijo'|'desarrollo', rubro: idBanco | 'nuevo:<nombre>', cantidad }]
 * Variable: cantidad por litro de producto. Inversión, fijo (por trimestre) y desarrollo: cantidad en unidades del rubro.
 * El costo de distribución lo agrega el simulador (5,4 % de las ventas, banco §5).
 */
function vrEvaluarHoja(D, banco, proyecto, rubrosAprobados) {
  var err = [], h = proyecto.hoja || [], cat = {};
  var r = { costoVariableL: 0, fijoTrim: 0, inversion: 0, desarrollo: 0, filas: [] };
  rubrosAprobados = rubrosAprobados || {};
  h.forEach(function (f, i) {
    var ref = banco[f.rubro], nombreFila = 'Fila ' + (i + 1) + (f.descripcion ? ' (' + f.descripcion + ')' : '');
    if (!ref && String(f.rubro || '').indexOf('nuevo:') === 0) {
      ref = rubrosAprobados[f.rubro];
      if (proyecto.clase !== 'radical') err.push(nombreFila + ': un rubro nuevo solo se puede usar en un proyecto radical (decisión 18).');
      else if (!ref) err.push(nombreFila + ': el rubro nuevo todavía no fue incorporado al banco por el docente.');
    } else if (!ref) err.push(nombreFila + ': el rubro no existe en el banco de referencias.');
    if (['variable', 'inversion', 'fijo', 'desarrollo'].indexOf(f.tipo) < 0) err.push(nombreFila + ': tipo de costo no válido.');
    if (f.categoria === 'equipo' && f.tipo !== 'inversion') err.push(nombreFila + ': un equipo es una inversión, no un gasto (decisión 16).');
    if (!(f.cantidad >= 0)) err.push(nombreFila + ': la cantidad debe ser un número mayor o igual a cero.');
    cat[f.categoria] = true;
    var monto = ref ? ref.precio * (f.cantidad || 0) : 0;
    if (f.tipo === 'variable') r.costoVariableL += monto;
    if (f.tipo === 'fijo') r.fijoTrim += monto;
    if (f.tipo === 'inversion') r.inversion += monto;
    if (f.tipo === 'desarrollo') r.desarrollo += monto;
    r.filas.push({ descripcion: f.descripcion, categoria: f.categoria, tipo: f.tipo, rubro: f.rubro, cantidad: f.cantidad, precio: ref ? ref.precio : null, monto: monto });
  });
  ['contenido', 'envase', 'mano_de_obra'].forEach(function (c) { if (!cat[c]) err.push('Falta la fila mínima: ' + c.replace('_', ' ') + ' (decisión 16).'); });
  var precio = (proyecto.plan && proyecto.plan.precioEmpresa) || 0;
  r.distribucionL = D.costoDistribucionPctVentas * precio;
  r.margenL = precio - r.costoVariableL - r.distribucionL;
  r.depreciacionTrim = r.inversion * D.balance.depreciacionAnualPct / D.trimestresPorAnio;
  var pub = (proyecto.plan && proyecto.plan.publicidad) || 0;
  if (r.margenL > 0) {
    r.equilibrioSinPublicidadTrim = (r.fijoTrim + r.depreciacionTrim) / r.margenL;
    r.equilibrioConPublicidadTrim = (r.fijoTrim + r.depreciacionTrim + pub) / r.margenL;
  } else { r.equilibrioSinPublicidadTrim = Infinity; r.equilibrioConPublicidadTrim = Infinity; if (precio > 0) err.push('El margen por litro es negativo o cero.'); }
  r.errores = err; r.valida = err.length === 0;
  return r;
}

// =====================================================================
// ESTUDIOS (decisiones 10 y 22)
// =====================================================================
/** Estudio de mercado y competencia: litros, participación por marca y segmento, y precios del último trimestre. */
function vrEstudioMercado(D, estado) {
  var ult = estado.mercadoHistorial[estado.mercadoHistorial.length - 1];
  if (!ult) return null;
  var filas = [];
  for (var id in ult.demanda) filas.push({ producto: id, litros: ult.demanda[id].litros, cuota: ult.demanda[id].cuota, porSegmento: ult.demanda[id].porSegmento });
  var seg = {}; D.segmentos.forEach(function (s) { seg[s.id] = D.mercadoLitrosAnio / D.trimestresPorAnio * s.peso; });
  return { trimestre: ult.t, mercadoLitrosTrim: D.mercadoLitrosAnio / D.trimestresPorAnio, segmentos: seg, productos: filas };
}

/** Estudio del consumidor de un segmento: utilidades por nivel e importancia de cada atributo (Brodock et al., 2021). */
function vrEstudioConsumidor(D, segId) {
  var U = D.utilidades, out = { segmento: segId, atributos: {} }, rangos = {}, tot = 0, k;
  var ends = []; for (k in U.endulzante) ends.push({ nivel: k, utilidad: U.endulzante[k][segId] });
  out.atributos.endulzante = ends;
  ['azucar', 'grasa', 'proteina', 'tamano'].forEach(function (a) {
    out.atributos[a] = U[a].niveles.map(function (n) { return { nivel: n.id || n.valor, utilidad: n.u[segId] }; });
  });
  for (k in out.atributos) {
    var v = out.atributos[k].map(function (x) { return x.utilidad; });
    rangos[k] = Math.max.apply(null, v) - Math.min.apply(null, v); tot += rangos[k];
  }
  out.importancia = {}; for (k in rangos) out.importancia[k] = rangos[k] / tot;
  return out;
}

/**
 * Prueba de concepto o de producto: muestra de n personas del mercado del simulador, sin exageración (decisión 22).
 * Agrega el concepto al mercado actual y compara su participación con la del producto actual de la empresa en la misma prueba.
 */
function vrPrueba(D, estado, equipoId, proyecto, n, semilla) {
  var eq = null; estado.equipos.forEach(function (e) { if (e.id === equipoId) eq = e; });
  var actual = eq.productos[0];
  var concepto = vrProductoDeProyecto_(D, eq, proyecto);
  var prods = [];
  estado.equipos.forEach(function (e) { e.productos.forEach(function (p) { if (p.activo) prods.push(p); }); });
  estado.competidores.forEach(function (c) { prods.push(c); });
  prods.push(concepto);
  var dem = vrDemanda_(D, prods, estado.nEquipos);
  var rng = vrRng_(semilla), M = D.mercadoLitrosAnio / D.trimestresPorAnio;
  function muestra(p) { var se = Math.sqrt(p * (1 - p) / n); var ph = Math.max(0, Math.min(1, p + se * rng.normal())); var e = 1.96 * Math.sqrt(ph * (1 - ph) / n); return { estimada: ph, inferior: Math.max(0, ph - e), superior: Math.min(1, ph + e) }; }
  var pc = muestra(dem[concepto.id].cuota), pa = muestra(dem[actual.id].cuota);
  return {
    n: n, semilla: String(semilla),
    concepto: { cuota: pc, volumenTrim: { estimado: pc.estimada * M, inferior: pc.inferior * M, superior: pc.superior * M } },
    productoActual: { cuota: pa, volumenTrim: { estimado: pa.estimada * M, inferior: pa.inferior * M, superior: pa.superior * M } },
    superaAlActual: pc.estimada > pa.estimada,
    margenError: 1.96 * Math.sqrt(pc.estimada * (1 - pc.estimada) / n)
  };
}

/** Producto que resultaría del proyecto (atributos declarados por el equipo y plan comercial). */
function vrProductoDeProyecto_(D, eq, proyecto) {
  var a = proyecto.producto, plan = proyecto.plan || {}, actual = eq.productos[0];
  return {
    id: eq.id + '-' + proyecto.id, nombre: proyecto.nombre, esEquipo: true, activo: true,
    endulzante: a.endulzante, azucarAnadida100ml: a.azucarAnadida100ml, grasa100ml: a.grasa100ml,
    proteina100ml: a.proteina100ml, tamanoMl: a.tamanoMl,
    precioEmpresa: plan.precioEmpresa || actual.precioEmpresa,
    mezcla: plan.mezcla || vrCopia_(actual.mezcla),
    publicidad: plan.publicidad != null ? plan.publicidad : actual.publicidadRef,
    publicidadRef: actual.publicidadRef, trimestresPublicidadBaja: 0,
    vidaUtilSemanas: D.vidaUtilSemanas[a.conservacion || 'uht'], lotes: []
  };
}

// =====================================================================
// GANTT (decisión 28)
// =====================================================================
var VR_TIPOS_ACT_ = {
  interna: { externa: false }, desarrollo: { externa: false }, lanzamiento: { externa: false },
  estudio_consumidor: { externa: true, semanas: 'estudios' }, prueba_concepto: { externa: true, semanas: 'estudios' },
  prueba_producto: { externa: true, semanas: 'estudios' }, registro_sanitario: { externa: true, semanas: 'registro' }
};
function vrDuracionExterna_(D, tipo) { var t = VR_TIPOS_ACT_[tipo]; return t.semanas === 'estudios' ? D.estudios.semanas : D.registroSanitario.semanas; }

/**
 * proyecto.gantt = [{ id, nombre, tipo, inicio (semana de la partida, 1 a 156), duracion, responsable (índice del comité), carga (0..1) }]
 * proyecto.compuerta1 = { semana, continuar: true|false }, proyecto.compuerta2 = { semana, continuar }
 * Valida todas las reglas y la carga semanal de cada integrante sumando todos los proyectos del equipo.
 */
function vrValidarGantt(D, comite, proyectos) {
  var err = [], carga = {}, finPartida = D.horizonteTrimestres * D.semanasPorTrimestre;
  proyectos.forEach(function (p) {
    if (p.estado === 'detenido' || p.estado === 'lanzado') return;
    var g = p.gantt || [], fin = {}, ini = {};
    var c1 = p.compuerta1 && p.compuerta1.semana, c2 = p.compuerta2 && p.compuerta2.semana;
    g.forEach(function (a) {
      var nom = p.nombre + ' · ' + (a.nombre || a.tipo);
      if (!VR_TIPOS_ACT_[a.tipo]) { err.push(nom + ': tipo de actividad no válido.'); return; }
      if (VR_TIPOS_ACT_[a.tipo].externa && a.duracion !== vrDuracionExterna_(D, a.tipo))
        err.push(nom + ': es una actividad externa y dura ' + vrDuracionExterna_(D, a.tipo) + ' semanas; no se puede cambiar.');
      if (!(a.duracion >= 1)) err.push(nom + ': la duración debe ser de al menos 1 semana.');
      if (!(a.inicio >= 1) || a.inicio + a.duracion - 1 > finPartida) err.push(nom + ': fuera del horizonte de la partida.');
      if (!comite[a.responsable]) err.push(nom + ': el responsable no es integrante del comité.');
      if (!(a.carga > 0 && a.carga <= 1)) err.push(nom + ': la carga debe estar entre 1 % y 100 %.');
      var f = a.inicio + a.duracion - 1;
      fin[a.tipo] = Math.max(fin[a.tipo] || 0, f); ini[a.tipo] = Math.min(ini[a.tipo] || Infinity, a.inicio);
      for (var s = a.inicio; s <= f; s++) { var k = a.responsable + '|' + s; carga[k] = (carga[k] || 0) + (a.carga || 0); }
    });
    if (!c1) err.push(p.nombre + ': falta la semana de la compuerta 1.');
    if (!c2) err.push(p.nombre + ': falta la semana de la compuerta 2.');
    if (c1 && (fin.estudio_consumidor || 0) > c1 - 1) err.push(p.nombre + ': el estudio del consumidor debe terminar antes de la compuerta 1.');
    if (c1 && (fin.prueba_concepto || 0) > c1 - 1) err.push(p.nombre + ': la prueba de concepto debe terminar antes de la compuerta 1.');
    if (c1 && ini.desarrollo != null && ini.desarrollo <= c1) err.push(p.nombre + ': el desarrollo no puede empezar antes de superar la compuerta 1.');
    if (c1 && ini.prueba_producto != null && ini.prueba_producto <= c1) err.push(p.nombre + ': la prueba de producto es sobre el prototipo; va después de la compuerta 1.');
    if (c2 && (fin.prueba_producto || 0) > c2 - 1) err.push(p.nombre + ': la prueba de producto debe terminar antes de la compuerta 2.');
    if (c1 && c2 && c2 <= c1) err.push(p.nombre + ': la compuerta 2 va después de la compuerta 1.');
    if (c2 && ini.lanzamiento != null && ini.lanzamiento <= c2) err.push(p.nombre + ': el lanzamiento no puede ocurrir antes de superar la compuerta 2.');
    if (ini.lanzamiento != null && (fin.registro_sanitario || Infinity) >= ini.lanzamiento) err.push(p.nombre + ': el registro sanitario debe terminar antes del lanzamiento.');
  });
  // carga de cada integrante frente a su dedicación (PMBOK: sobreasignación)
  var avisados = {};
  for (var k in carga) {
    var parts = k.split('|'), m = comite[parts[0]];
    if (m && carga[k] > m.dedicacion + 1e-9 && !avisados[parts[0]]) {
      avisados[parts[0]] = true;
      err.push((m.nombre || ('Integrante ' + (Number(parts[0]) + 1))) + ' queda sobreasignado en la semana ' + parts[1] + ' (' + Math.round(carga[k] * 100) + ' % frente a ' + Math.round(m.dedicacion * 100) + ' % de dedicación).');
    }
  }
  return err;
}

// =====================================================================
// COMPUERTAS (decisiones 19 a 21)
// =====================================================================
function vrEvaluarCompuerta1(D, banco, proyecto, rubrosAprobados) {
  var req = [], i = proyecto.idea || {}, res = proyecto.resultados || {};
  req.push({ id: 'idea', texto: 'Idea completa por escrito, con la clase (incremental o radical) y su justificación',
    cumple: !!(i.problema && i.paraQuien && i.propuesta && (proyecto.clase === 'incremental' || proyecto.clase === 'radical') && proyecto.justificacionClase) });
  req.push({ id: 'cliente', texto: 'Estudio del consumidor del segmento objetivo comprado',
    cumple: !!(proyecto.segmentoObjetivo && res.estudioConsumidor && res.estudioConsumidor.segmento === proyecto.segmentoObjetivo) });
  var hoja = vrEvaluarHoja(D, banco, proyecto, rubrosAprobados);
  req.push({ id: 'hoja', texto: 'Hoja de costos válida (filas mínimas, costo, margen y punto de equilibrio)', cumple: hoja.valida && isFinite(hoja.equilibrioSinPublicidadTrim), detalle: hoja.errores });
  req.push({ id: 'concepto', texto: 'Prueba de concepto: la intención de compra del concepto supera la del producto actual',
    cumple: !!(res.pruebaConcepto && res.pruebaConcepto.superaAlActual) });
  return { aprobada: req.every(function (r) { return r.cumple; }), requisitos: req, hoja: hoja };
}

function vrEvaluarCompuerta2(D, banco, proyecto, rubrosAprobados, cajaDisponible) {
  var req = [], plan = proyecto.plan || {}, res = proyecto.resultados || {};
  req.push({ id: 'plan', texto: 'Plan de lanzamiento completo (precio, canales, publicidad y producción)',
    cumple: plan.precioEmpresa > 0 && !!plan.mezcla && plan.publicidad >= 0 && plan.produccionSemanal >= 0 });
  req.push({ id: 'prueba', texto: 'Prueba de producto sobre el prototipo', cumple: !!res.pruebaProducto });
  var hoja = vrEvaluarHoja(D, banco, proyecto, rubrosAprobados);
  req.push({ id: 'hoja', texto: 'Hoja de costos actualizada y válida', cumple: hoja.valida, detalle: hoja.errores });
  var li = res.pruebaProducto ? res.pruebaProducto.concepto.volumenTrim.inferior : 0;
  req.push({ id: 'equilibrio', texto: 'Límite inferior del volumen (95 %) mayor que el punto de equilibrio con publicidad',
    cumple: li > hoja.equilibrioConPublicidadTrim, detalle: { limiteInferior: li, equilibrio: hoja.equilibrioConPublicidadTrim } });
  var fondos = hoja.inversion + (plan.publicidad || 0) + D.registroSanitario.costo;
  req.push({ id: 'fondos', texto: 'Fondos solicitados no mayores que la caja disponible', cumple: fondos <= cajaDisponible, detalle: { fondos: fondos, disponible: cajaDisponible } });
  return { aprobada: req.every(function (r) { return r.cumple; }), requisitos: req, hoja: hoja, fondos: fondos };
}

// =====================================================================
// TRIMESTRE DE INNOVACIÓN: avanza los proyectos semana a semana y prepara las decisiones del motor
// =====================================================================
/**
 * innov[idEquipo] = { comite, proyectos, rubrosAprobados }  (estado persistente del comité)
 * Devuelve { estado (con productos lanzados), innov (actualizado), extras: { [idEquipo]: { gastoInnovacion, gastoEstudios, inversion } }, eventos }
 * Se llama ANTES de vrSimularTrimestre, que recibe los extras en las decisiones.
 */
function vrTrimestreInnovacion(D, estado0, innov0, banco) {
  var E = vrCopia_(estado0), I = vrCopia_(innov0), t = E.t + 1;
  var s0 = vrSemanaInicioTrim_(D, t), s1 = vrSemanaFinTrim_(D, t), extras = {}, eventos = [];
  E.equipos.forEach(function (eq) {
    var st = I[eq.id] || { comite: [], proyectos: [] };
    var ex = { gastoInnovacion: 0, gastoEstudios: 0, inversion: 0 };
    ex.gastoInnovacion += vrCostoComiteSemana(D, st.comite) * D.semanasPorTrimestre;
    var ultimo = eq.historial[eq.historial.length - 1];
    var cajaDisp = ultimo ? ultimo.cajaDisponibleLanzamiento : Math.max(0, eq.caja - D.saldoMinimoCajaPctVentas * eq.ventasAnioAnterior);
    (st.proyectos || []).forEach(function (p) {
      if (p.estado === 'detenido' || p.estado === 'lanzado') return;
      p.resultados = p.resultados || {}; p.estado = p.estado || 'exploracion';
      var g = p.gantt || [];
      for (var s = s0; s <= s1; s++) {
        if (p.estado === 'detenido' || p.estado === 'pausa') break;
        g.forEach(function (a) {
          var fin = a.inicio + a.duracion - 1;
          var permitido = (a.tipo === 'desarrollo' || a.tipo === 'prueba_producto' || a.tipo === 'registro_sanitario') ? p.c1Aprobada : (a.tipo === 'lanzamiento' ? p.c2Aprobada : true);
          if (!permitido) return;
          // compra de estudios: se paga al iniciar (presupuesto operativo, gasto de ventas; banco §14)
          if (s === a.inicio) {
            if (a.tipo === 'estudio_consumidor') ex.gastoEstudios += D.estudios.consumidor;
            if (a.tipo === 'prueba_concepto' || a.tipo === 'prueba_producto') ex.gastoEstudios += D.estudios.prueba[p.muestra || 400];
            if (a.tipo === 'registro_sanitario') ex.gastoInnovacion += D.registroSanitario.costo;
          }
          // resultados al terminar la actividad externa
          if (s === fin) {
            if (a.tipo === 'estudio_consumidor') p.resultados.estudioConsumidor = vrEstudioConsumidor(D, p.segmentoObjetivo);
            if (a.tipo === 'prueba_concepto') p.resultados.pruebaConcepto = vrPrueba(D, E, eq.id, p, p.muestra || 400, eq.id + '|' + p.id + '|concepto|' + s);
            if (a.tipo === 'prueba_producto') p.resultados.pruebaProducto = vrPrueba(D, E, eq.id, p, p.muestra || 400, eq.id + '|' + p.id + '|producto|' + s);
            if (a.tipo === 'registro_sanitario') p.resultados.registroSanitario = { semana: s };
          }
          // gasto de desarrollo repartido en las semanas de desarrollo
          if (a.tipo === 'desarrollo' && s >= a.inicio && s <= fin) {
            var semDes = 0; g.forEach(function (b) { if (b.tipo === 'desarrollo') semDes += b.duracion; });
            var hoja = vrEvaluarHoja(D, banco, p, st.rubrosAprobados);
            ex.gastoInnovacion += hoja.desarrollo / Math.max(1, semDes);
          }
        });
        // compuertas
        if (p.compuerta1 && s === p.compuerta1.semana && !p.c1Aprobada) {
          var c1 = vrEvaluarCompuerta1(D, banco, p, st.rubrosAprobados);
          p.resultados.compuerta1 = { semana: s, aprobada: c1.aprobada, requisitos: c1.requisitos };
          if (c1.aprobada) { p.c1Aprobada = true; p.estado = p.compuerta1.continuar === false ? 'pausa' : 'desarrollo'; }
          else p.estado = 'detenido';
          eventos.push({ equipo: eq.id, proyecto: p.id, semana: s, evento: 'compuerta1', aprobada: c1.aprobada });
        }
        if (p.compuerta2 && s === p.compuerta2.semana && p.c1Aprobada && !p.c2Aprobada) {
          var c2 = vrEvaluarCompuerta2(D, banco, p, st.rubrosAprobados, cajaDisp);
          p.resultados.compuerta2 = { semana: s, aprobada: c2.aprobada, requisitos: c2.requisitos, fondos: c2.fondos };
          if (c2.aprobada) { p.c2Aprobada = true; p.estado = p.compuerta2.continuar === false ? 'pausa' : 'lanzamiento'; }
          else p.estado = 'detenido';
          eventos.push({ equipo: eq.id, proyecto: p.id, semana: s, evento: 'compuerta2', aprobada: c2.aprobada });
        }
        // lanzamiento: el producto entra al mercado al inicio del primer trimestre que empieza en o después de esa semana
        var lan = null; g.forEach(function (a) { if (a.tipo === 'lanzamiento') lan = a; });
        if (lan && p.c2Aprobada && p.estado === 'lanzamiento' && s === lan.inicio) {
          var hojaL = vrEvaluarHoja(D, banco, p, st.rubrosAprobados);
          ex.inversion += hojaL.inversion;
          p.lanzamientoPendiente = { semana: s, entraEnTrimestre: s === vrSemanaInicioTrim_(D, vrTrimDeSemana_(D, s)) ? vrTrimDeSemana_(D, s) : vrTrimDeSemana_(D, s) + 1 };
        }
      }
      // productos que entran al mercado este trimestre
      if (p.lanzamientoPendiente && p.lanzamientoPendiente.entraEnTrimestre === t) vrIncorporarProducto_(D, eq, p, banco, st.rubrosAprobados, eventos, t);
    });
    extras[eq.id] = ex;
    I[eq.id] = st;
  });
  // segunda pasada: lo lanzado con entrada en el trimestre siguiente se incorpora al empezar ese trimestre
  return { estado: E, innov: I, extras: extras, eventos: eventos };
}

function vrIncorporarProducto_(D, eq, p, banco, rubros, eventos, t) {
  var hoja = vrEvaluarHoja(D, banco, p, rubros);
  var prod = vrProductoDeProyecto_(D, eq, p);
  prod.costoVariable = hoja.costoVariableL;
  if (p.reemplazaProductoActual) {
    var act = eq.productos[0];
    ['endulzante', 'azucarAnadida100ml', 'grasa100ml', 'proteina100ml', 'tamanoMl'].forEach(function (k) { act[k] = prod[k]; });
    act.costoVariable = prod.costoVariable; act.precioEmpresa = prod.precioEmpresa; act.mezcla = prod.mezcla; act.publicidad = prod.publicidad;
    act.nombre = prod.nombre || act.nombre;
  } else {
    eq.productos.push(prod);
  }
  eq.fijoOperativoNuevoTrim = (eq.fijoOperativoNuevoTrim || 0) + hoja.fijoTrim;
  p.estado = 'lanzado'; p.trimestreLanzamiento = t; delete p.lanzamientoPendiente;
  eventos.push({ equipo: eq.id, proyecto: p.id, trimestre: t, evento: 'lanzamiento', producto: prod.id });
}

/** Une los extras de innovación con las decisiones comerciales del trimestre. */
function vrUnirDecisiones(decComerciales, extras) {
  var d = vrCopia_(decComerciales);
  for (var id in extras) {
    d[id] = d[id] || { productos: {} };
    d[id].gastoInnovacion = (d[id].gastoInnovacion || 0) + extras[id].gastoInnovacion;
    d[id].gastoEstudios = (d[id].gastoEstudios || 0) + extras[id].gastoEstudios;
    d[id].inversion = (d[id].inversion || 0) + extras[id].inversion;
  }
  return d;
}

// =====================================================================
// VALIDACIÓN DE LAS DECISIONES DE INNOVACIÓN DE UN EQUIPO (se repite en el servidor)
// =====================================================================
/** Errores que impiden guardar: comité, Gantt y presupuesto anual del 0,8 % (comité + registro + desarrollo). */
function vrValidarInnovacion(D, estado, eq, st, banco) {
  var err = vrValidarComite(D, st.comite).concat(vrValidarGantt(D, st.comite || [], st.proyectos || []));
  (st.proyectos || []).forEach(function (p) {
    if (p.estado === 'detenido' || p.estado === 'lanzado') return;
    if (!p.segmentoObjetivo) err.push(p.nombre + ': falta el segmento objetivo.');
    if ([400, 1600].indexOf(p.muestra || 400) < 0) err.push(p.nombre + ': la muestra de las pruebas debe ser 400 o 1.600 personas.');
  });
  // presupuesto del año en curso
  var t = estado.t + 1, anio = Math.floor((t - 1) / D.trimestresPorAnio);
  var s0 = anio * 52 + 1, s1 = s0 + 51, gasto = vrCostoComiteSemana(D, st.comite) * 52;
  (st.proyectos || []).forEach(function (p) {
    if (p.estado === 'detenido' || p.estado === 'lanzado') return;
    var semDes = 0; (p.gantt || []).forEach(function (a) { if (a.tipo === 'desarrollo') semDes += a.duracion; });
    var hoja = vrEvaluarHoja(D, banco, p, st.rubrosAprobados);
    (p.gantt || []).forEach(function (a) {
      for (var w = a.inicio; w < a.inicio + a.duracion; w++) {
        if (w < s0 || w > s1) continue;
        if (a.tipo === 'desarrollo') gasto += hoja.desarrollo / Math.max(1, semDes);
        if (a.tipo === 'registro_sanitario' && w === a.inicio) gasto += D.registroSanitario.costo;
      }
    });
  });
  var pres = vrPresupuestoExploracion(D, eq);
  if (gasto > pres + 1e-6) err.push('El plan del año gasta Bs ' + Math.round(gasto).toLocaleString('es-BO') + ' y el presupuesto de innovación es Bs ' + Math.round(pres).toLocaleString('es-BO') + ' (0,8 % de las ventas del año anterior).');
  return err;
}

if (typeof module !== 'undefined') module.exports = {};
