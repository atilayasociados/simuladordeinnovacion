/**
 * Simulador de Innovación "vida real" — Servidor (vr-0.1).
 * Una simulación es "vida real" cuando su mandato es 'VR'. Las demás siguen con el motor anterior sin cambios.
 * Guarda: Estados[simId-MERCADO, t] = mercado y competidores; Estados[equipoId, t] = { empresa, innov }.
 * Toda validación se repite aquí (el navegador solo ayuda).
 */
var VR_MANDATO = 'VR';
function vrEsVR_(pa) { return String(pa && pa.mandato) === VR_MANDATO; }
function vrIdMercado_(simId) { return String(simId) + '-MERCADO'; }

// ---------- carga y guardado de la partida ----------
function vrEquiposOrdenados_(simId) {
  return equiposDe_(simId).slice().sort(function (a, b) { return String(a.equipoId) < String(b.equipoId) ? -1 : 1; });
}
/** Estado al cierre del trimestre t (t = 0: Año 0 con los equipos registrados hoy). */
function vrCargar_(pa, t) {
  var D = VR_DATOS;
  if (t <= 0) {
    var eqs = vrEquiposOrdenados_(pa.simId);
    if (!eqs.length) return null;
    var E = vrCrearPartida(D, eqs.length), mapa = {}, innov = {};
    E.equipos.forEach(function (e, i) { mapa[e.id] = eqs[i].equipoId; e.nombre = eqs[i].nombre; innov[e.id] = { comite: [], proyectos: [], rubrosAprobados: {}, solicitudes: [], informes: {} }; });
    return { E: E, mapa: mapa, innov: innov };
  }
  var M = getJson_('Estados', vrIdMercado_(pa.simId), t);
  if (!M) return null;
  var E2 = M.estado; E2.equipos = []; var innov2 = {};
  Object.keys(M.mapa).forEach(function (id) {
    var S = getJson_('Estados', M.mapa[id], t);
    E2.equipos.push(S.empresa); innov2[id] = S.innov;
  });
  E2.equipos.sort(function (a, b) { return Number(a.id.slice(1)) - Number(b.id.slice(1)); });
  E2.rubrosAprobados = E2.rubrosAprobados || {};
  for (var k2 in innov2) innov2[k2].rubrosAprobados = E2.rubrosAprobados; // el banco es común a todos los equipos (decisión 15)
  return { E: E2, mapa: M.mapa, innov: innov2 };
}
function vrGuardar_(pa, t, P) {
  var est = vrCopia_(P.E); var equipos = est.equipos; delete est.equipos;
  for (var k in P.innov) delete P.innov[k].rubrosAprobados; // se guardan una sola vez, en el mercado
  est.mercadoHistorial = est.mercadoHistorial.slice(-4);
  putJson_('Estados', vrIdMercado_(pa.simId), t, { estado: est, mapa: P.mapa });
  equipos.forEach(function (e) { putJson_('Estados', P.mapa[e.id], t, { empresa: e, innov: P.innov[e.id] }); });
  for (var k3 in P.innov) P.innov[k3].rubrosAprobados = P.E.rubrosAprobados || {};
}
function vrMiId_(P, equipoId) { for (var k in P.mapa) if (String(P.mapa[k]) === String(equipoId)) return k; return null; }
function vrEmpresa_(P, id) { for (var i = 0; i < P.E.equipos.length; i++) if (P.E.equipos[i].id === id) return P.E.equipos[i]; return null; }

// ---------- limpieza de lo que envía el navegador ----------
function vrNum_(x, a, b, nombre) {
  var v = Number(x);
  if (!isFinite(v) || v < a || v > b) throw new Error(nombre + ': debe ser un número entre ' + a + ' y ' + b + '.');
  return v;
}
function vrTxt_(x, n) { return String(x === undefined || x === null ? '' : x).slice(0, n || 500); }
function vrMezcla_(m, nombre) {
  m = m || {}; var o = { supermercado: 0, tienda: 0, mercado: 0 }, s = 0;
  for (var k in o) { o[k] = vrNum_(m[k] || 0, 0, 1, nombre + ' · ' + k); s += o[k]; }
  if (s <= 0) throw new Error(nombre + ': elijan al menos un canal.');
  for (var k2 in o) o[k2] = o[k2] / s;
  return o;
}
function vrLimpiarProyecto_(D, x) {
  var nom = vrTxt_(x.nombre, 80) || 'Proyecto';
  if (!/^P\d{1,3}$/.test(String(x.id || ''))) throw new Error(nom + ': identificador de proyecto no válido.');
  var p = {
    id: String(x.id), nombre: nom, clase: x.clase === 'radical' ? 'radical' : (x.clase === 'incremental' ? 'incremental' : ''),
    justificacionClase: vrTxt_(x.justificacionClase, 1000),
    idea: { problema: vrTxt_(x.idea && x.idea.problema, 1500), paraQuien: vrTxt_(x.idea && x.idea.paraQuien, 800), propuesta: vrTxt_(x.idea && x.idea.propuesta, 1500) },
    segmentoObjetivo: ['natural', 'calorias', 'promedio'].indexOf(x.segmentoObjetivo) >= 0 ? x.segmentoObjetivo : '',
    muestra: Number(x.muestra) === 1600 ? 1600 : 400,
    reemplazaProductoActual: !!x.reemplazaProductoActual,
    detener: !!x.detener
  };
  var a = x.producto || {}, ends = Array.isArray(a.endulzante) ? a.endulzante.filter(function (e) { return D.utilidades.endulzante[e]; }).slice(0, 3) : [];
  if (!ends.length) ends = ['azucar_cana'];
  p.producto = {
    endulzante: ends,
    azucarAnadida100ml: vrNum_(a.azucarAnadida100ml || 0, 0, 20, nom + ' · azúcar añadida'),
    grasa100ml: vrNum_(a.grasa100ml || 0, 0, 6, nom + ' · grasa'),
    proteina100ml: vrNum_(a.proteina100ml || 0, 0, 12, nom + ' · proteína'),
    tamanoMl: vrNum_(a.tamanoMl || 1000, 100, 2000, nom + ' · tamaño'),
    conservacion: a.conservacion === 'pasteurizado' ? 'pasteurizado' : 'uht'
  };
  p.hoja = (Array.isArray(x.hoja) ? x.hoja : []).slice(0, 40).map(function (f, i) {
    return { descripcion: vrTxt_(f.descripcion, 120), categoria: ['contenido', 'envase', 'mano_de_obra', 'equipo', 'otro'].indexOf(f.categoria) >= 0 ? f.categoria : 'otro',
      tipo: ['variable', 'inversion', 'fijo', 'desarrollo'].indexOf(f.tipo) >= 0 ? f.tipo : 'variable',
      rubro: vrTxt_(f.rubro, 80), cantidad: vrNum_(f.cantidad || 0, 0, 1e7, nom + ' · fila ' + (i + 1) + ' · cantidad') };
  });
  var pl = x.plan || {};
  p.plan = {
    precioEmpresa: vrNum_(pl.precioEmpresa || 0, 0, 200, nom + ' · precio a la empresa'),
    mezcla: vrMezcla_(pl.mezcla || { supermercado: 1 }, nom + ' · canales'),
    publicidad: vrNum_(pl.publicidad || 0, 0, 1e7, nom + ' · publicidad'),
    produccionSemanal: vrNum_(pl.produccionSemanal || 0, 0, 1e6, nom + ' · producción semanal')
  };
  p.gantt = (Array.isArray(x.gantt) ? x.gantt : []).slice(0, 40).map(function (g, i) {
    return { nombre: vrTxt_(g.nombre, 80), tipo: VR_TIPOS_ACT_[g.tipo] ? g.tipo : 'interna',
      inicio: Math.round(vrNum_(g.inicio, 1, 156, nom + ' · actividad ' + (i + 1) + ' · inicio')),
      duracion: Math.round(vrNum_(g.duracion, 1, 156, nom + ' · actividad ' + (i + 1) + ' · duración')),
      responsable: Math.round(vrNum_(g.responsable || 0, 0, 4, nom + ' · actividad ' + (i + 1) + ' · responsable')),
      carga: vrNum_(g.carga, 0.01, 1, nom + ' · actividad ' + (i + 1) + ' · carga') };
  });
  var c1 = x.compuerta1 || {}, c2 = x.compuerta2 || {};
  p.compuerta1 = { semana: c1.semana ? Math.round(vrNum_(c1.semana, 1, 156, nom + ' · compuerta 1')) : 0, continuar: c1.continuar !== false };
  p.compuerta2 = { semana: c2.semana ? Math.round(vrNum_(c2.semana, 1, 156, nom + ' · compuerta 2')) : 0, continuar: c2.continuar !== false };
  return p;
}

/**
 * Une lo que envía el equipo con su estado guardado. Lo ya ocurrido no se puede cambiar:
 * actividades iniciadas, compuertas evaluadas, resultados, estado del proyecto y productos lanzados.
 */
function vrUnirInnov_(D, prev, dec, t) {
  var st = vrCopia_(prev), s0 = vrSemanaInicioTrim_(D, t), err = [];
  if (Array.isArray(dec.comite)) {
    st.comite = dec.comite.slice(0, 5).map(function (m, i) {
      return { nombre: vrTxt_(m.nombre, 60) || ('Integrante ' + (i + 1)), cargo: m.cargo === 'jefe' ? 'jefe' : 'profesional', dedicacion: vrNum_(m.dedicacion, 0, 1, 'Comité · dedicación') };
    });
  }
  if (Array.isArray(dec.solicitudes)) {
    var previas = (prev.solicitudes || []).filter(function (s) { return s.estado && s.estado !== 'pendiente'; });
    var nuevas = dec.solicitudes.slice(0, 10).filter(function (s) { return s && s.nombre; }).map(function (s) {
      var ya = (prev.solicitudes || []).filter(function (q) { return q.nombre === vrTxt_(s.nombre, 80); })[0];
      return ya && ya.estado !== 'pendiente' ? null : { nombre: vrTxt_(s.nombre, 80), unidad: vrTxt_(s.unidad, 30), justificacion: vrTxt_(s.justificacion, 800), proyecto: vrTxt_(s.proyecto, 10), estado: 'pendiente', trimestre: t };
    }).filter(Boolean);
    st.solicitudes = previas.concat(nuevas);
  }
  if (Array.isArray(dec.proyectos)) {
    var porId = {}; (prev.proyectos || []).forEach(function (p) { porId[p.id] = p; });
    var vistos = {}, lista = [];
    dec.proyectos.slice(0, 8).forEach(function (x) {
      var p = vrLimpiarProyecto_(D, x), q = porId[p.id];
      vistos[p.id] = true;
      if (q && (q.estado === 'detenido' || q.estado === 'lanzado')) { lista.push(q); return; }
      if (q) {
        ['resultados', 'estado', 'c1Aprobada', 'c2Aprobada', 'lanzamientoPendiente', 'trimestreLanzamiento'].forEach(function (k) { if (q[k] !== undefined) p[k] = q[k]; });
        // actividades ya iniciadas: quedan como estaban
        var iniciadas = (q.gantt || []).filter(function (a) { return a.inicio < s0; });
        var nuevas = p.gantt.filter(function (a) { return a.inicio >= s0; });
        if (p.gantt.some(function (a) { return a.inicio < s0 && !iniciadas.some(function (b) { return b.tipo === a.tipo && b.inicio === a.inicio && b.duracion === a.duracion; }); }))
          err.push(p.nombre + ': no se puede agregar ni cambiar una actividad que empieza antes de la semana ' + s0 + ' (ya pasó).');
        p.gantt = iniciadas.concat(nuevas);
        if (q.resultados && q.resultados.compuerta1) p.compuerta1 = q.compuerta1;
        if (q.resultados && q.resultados.compuerta2) p.compuerta2 = q.compuerta2;
        if (q.c1Aprobada) { p.clase = q.clase; p.justificacionClase = q.justificacionClase; p.idea = q.idea; p.segmentoObjetivo = q.segmentoObjetivo; }
        if (q.estado === 'pausa' && !p.detener) p.estado = q.c2Aprobada ? 'lanzamiento' : (q.c1Aprobada ? 'desarrollo' : 'exploracion');
      } else if (p.gantt.some(function (a) { return a.inicio < s0; })) {
        err.push(p.nombre + ': un proyecto nuevo no puede tener actividades antes de la semana ' + s0 + '.');
        p.gantt = p.gantt.filter(function (a) { return a.inicio >= s0; });
      }
      ['compuerta1', 'compuerta2'].forEach(function (k) {
        if (p[k].semana && p[k].semana < s0 && !(q && q.resultados && q.resultados[k])) err.push(p.nombre + ': la ' + (k === 'compuerta1' ? 'compuerta 1' : 'compuerta 2') + ' no puede quedar en una semana que ya pasó.');
      });
      if (p.detener) { p.estado = 'detenido'; p.detenidoPorEquipo = t; }
      delete p.detener;
      lista.push(p);
    });
    // proyectos guardados que el equipo no envió: se conservan si ya empezaron
    (prev.proyectos || []).forEach(function (q) {
      if (vistos[q.id]) return;
      var empezo = (q.gantt || []).some(function (a) { return a.inicio < s0; }) || q.estado === 'detenido' || q.estado === 'lanzado';
      if (empezo) lista.push(q);
    });
    st.proyectos = lista;
  }
  return { st: st, errores: err };
}

/** Decisiones comerciales de los productos activos (sección 5). */
function vrLimpiarComercial_(eq, com) {
  var o = {}; com = com || {};
  eq.productos.forEach(function (p) {
    if (!p.activo) return;
    var x = com[p.id]; if (!x) return;
    var nom = p.nombre || p.id;
    o[p.id] = {
      precioEmpresa: vrNum_(x.precioEmpresa, 1, 200, nom + ' · precio a la empresa'),
      mezcla: vrMezcla_(x.mezcla, nom + ' · canales'),
      publicidad: vrNum_(x.publicidad, 0, 1e7, nom + ' · publicidad'),
      produccionSemanal: (x.produccionSemanal === null || x.produccionSemanal === '' || x.produccionSemanal === undefined) ? null : vrNum_(x.produccionSemanal, 0, 1e6, nom + ' · producción semanal')
    };
  });
  return o;
}

/** Revisión completa de una decisión: errores (impiden enviar) y vista previa de costos del trimestre. */
function vrRevisar_(pa, P, eqId, dec) {
  var D = VR_DATOS, t = pa.t, eq = vrEmpresa_(P, eqId), banco = vrBanco(D, P.E), errores = [];
  var u = { st: P.innov[eqId], errores: [] };
  try { u = vrUnirInnov_(D, P.innov[eqId], dec || {}, t); } catch (e) { errores.push(e.message); }
  errores = errores.concat(u.errores);
  try { vrLimpiarComercial_(eq, (dec || {}).comercial); } catch (e2) { errores.push(e2.message); }
  var st = u.st;
  try { errores = errores.concat(vrValidarInnovacion(D, { t: t - 1 }, eq, st, banco)); } catch (e3) { errores.push(e3.message); }
  var s0 = vrSemanaInicioTrim_(D, t), s1 = vrSemanaFinTrim_(D, t);
  var comite = vrCostoComiteSemana(D, st.comite) * D.semanasPorTrimestre, estudios = (dec && dec.estudioMercado) ? D.estudios.mercado : 0, desarrollo = 0, registro = 0;
  var hojas = {};
  (st.proyectos || []).forEach(function (p) {
    var h = vrEvaluarHoja(D, banco, p, st.rubrosAprobados);
    hojas[p.id] = { valida: h.valida, errores: h.errores, costoVariableL: h.costoVariableL, distribucionL: h.distribucionL, margenL: h.margenL, fijoTrim: h.fijoTrim, inversion: h.inversion,
      desarrollo: h.desarrollo, depreciacionTrim: h.depreciacionTrim, equilibrioSinPublicidadTrim: isFinite(h.equilibrioSinPublicidadTrim) ? h.equilibrioSinPublicidadTrim : null,
      equilibrioConPublicidadTrim: isFinite(h.equilibrioConPublicidadTrim) ? h.equilibrioConPublicidadTrim : null };
    if (p.estado === 'detenido' || p.estado === 'lanzado') return;
    var semDes = 0; (p.gantt || []).forEach(function (a) { if (a.tipo === 'desarrollo') semDes += a.duracion; });
    (p.gantt || []).forEach(function (a) {
      if (a.inicio >= s0 && a.inicio <= s1) {
        if (a.tipo === 'estudio_consumidor') estudios += D.estudios.consumidor;
        if (a.tipo === 'prueba_concepto' || a.tipo === 'prueba_producto') estudios += D.estudios.prueba[p.muestra || 400];
        if (a.tipo === 'registro_sanitario') registro += D.registroSanitario.costo;
      }
      if (a.tipo === 'desarrollo') for (var w = a.inicio; w < a.inicio + a.duracion; w++) if (w >= s0 && w <= s1) desarrollo += h.desarrollo / Math.max(1, semDes);
    });
  });
  return {
    errores: errores, hojas: hojas,
    costosTrimestre: { comite: comite, desarrollo: desarrollo, registroSanitario: registro, estudios: estudios, totalInnovacion: comite + desarrollo + registro },
    presupuestoAnual: vrPresupuestoExploracion(D, eq)
  };
}

// ---------- API del equipo ----------
function vrApiEstado_(ses, pa, eqRow) {
  var D = VR_DATOS, tVista = Math.min(pa.t, D.horizonteTrimestres + 1), fin = pa.t > D.horizonteTrimestres;
  var P = vrCargar_(pa, tVista - 1);
  if (!P) throw new Error('Todavía no hay equipos en la simulación.');
  var id = vrMiId_(P, eqRow.equipoId);
  if (!id) return { modelo: 'VR', sinEmpresa: true, partida: { nombre: pa.nombre, t: tVista, estado: pa.estado }, mensaje: 'Tu equipo se registró después de iniciada la partida: el docente debe crear una partida nueva para incluirlo.' };
  var eq = vrEmpresa_(P, id), st = P.innov[id] || { comite: [], proyectos: [] };
  var draft = fin ? null : getJson_('Decisiones', eqRow.equipoId, tVista);
  if (draft) { delete draft._fecha; }
  var banco = vrBanco(D, P.E);
  // informe de la industria: góndola (productos visibles de todos y sus precios al consumidor)
  var gondola = [];
  P.E.equipos.forEach(function (e) {
    e.productos.forEach(function (p) {
      if (!p.activo) return;
      gondola.push({ empresa: e.id === id ? e.nombre + ' (tu empresa)' : e.nombre, producto: p.nombre, precioConsumidor: vrPrecioConsumidor_(D, p),
        endulzante: p.endulzante, azucarAnadida100ml: p.azucarAnadida100ml, grasa100ml: p.grasa100ml, proteina100ml: p.proteina100ml, tamanoMl: p.tamanoMl });
    });
  });
  P.E.competidores.forEach(function (c) {
    gondola.push({ empresa: c.clave === 'cupesi' ? 'Cupesí (competidor diferenciador)' : 'Motacú (competidor líder en costos)', producto: c.nombre, precioConsumidor: c.precioConsumidorFijo,
      endulzante: c.endulzante, azucarAnadida100ml: c.azucarAnadida100ml, grasa100ml: c.grasa100ml, proteina100ml: c.proteina100ml, tamanoMl: c.tamanoMl });
  });
  var M = D.mercadoLitrosAnio / D.trimestresPorAnio;
  return {
    modelo: 'VR',
    partida: { nombre: pa.nombre, sigla: pa.sigla, codigo: pa.codigo, t: tVista, estado: pa.estado, total: D.horizonteTrimestres, finalizada: fin },
    equipo: { id: eqRow.equipoId, motorId: id, nombre: eqRow.nombre },
    usuario: { registro: ses.registro },
    empresa: {
      nombre: eq.nombre, productos: eq.productos.map(function (p) {
        return { id: p.id, nombre: p.nombre, activo: p.activo, precioEmpresa: p.precioEmpresa, mezcla: p.mezcla, publicidad: p.publicidad, publicidadRef: p.publicidadRef,
          costoVariable: p.costoVariable, vidaUtilSemanas: p.vidaUtilSemanas, precioConsumidor: vrPrecioConsumidor_(D, p),
          endulzante: p.endulzante, azucarAnadida100ml: p.azucarAnadida100ml, grasa100ml: p.grasa100ml, proteina100ml: p.proteina100ml, tamanoMl: p.tamanoMl,
          inventarioLitros: vrSum_((p.lotes || []).map(function (l) { return l.litros; })) };
      }),
      capacidadSemanal: eq.capacidadSemanal, historial: eq.historial,
      balanceInicial: tVista === 1 ? vrBalanceActual_(eq) : null,
      presupuestoAnual: vrPresupuestoExploracion(D, eq), ventasAnioAnterior: eq.ventasAnioAnterior
    },
    innov: st,
    informes: {
      macro: vrInformeMacro_(D),
      industria: { mercadoAproxLitrosTrim: [Math.round(M * 0.9 / 1000) * 1000, Math.round(M * 1.1 / 1000) * 1000], gondola: gondola,
        canales: D.canales, costoDistribucionPct: D.costoDistribucionPctVentas, leche: 5.50 },
      estudiosMercado: st.informes || {}
    },
    cat: {
      banco: banco, segmentos: D.segmentos, endulzantes: Object.keys(D.utilidades.endulzante), semanasTrimestre: D.semanasPorTrimestre,
      semanaInicio: vrSemanaInicioTrim_(D, tVista), semanaFin: vrSemanaFinTrim_(D, tVista), estudios: D.estudios, registroSanitario: D.registroSanitario,
      sueldos: D.sueldos, tiposActividad: Object.keys(VR_TIPOS_ACT_), presupuestoPct: D.presupuestoExploracionPctVentas, horizonte: D.horizonteTrimestres
    },
    borrador: draft
  };
}
function vrBalanceActual_(eq) {
  var inv = 0; eq.productos.forEach(function (p) { (p.lotes || []).forEach(function (l) { inv += l.litros * l.costoUnit; }); });
  return { caja: eq.caja, cxc: eq.cxc, inventario: inv, activoFijo: eq.activoFijo, activo: eq.caja + eq.cxc + inv + eq.activoFijo, cxp: eq.cxp, deuda: eq.deuda, patrimonio: eq.capital + eq.resultadosAcumulados };
}
/** Informe del macroentorno: datos públicos del banco de datos, con su fuente. */
function vrInformeMacro_(D) {
  return [
    { ambito: 'Económico', texto: 'Tipo de cambio oficial: Bs 11,84 por dólar (BCB, 23-oct-2026). Tasa máxima del crédito productivo para mediana empresa: 8 % anual (DS 5403).' },
    { ambito: 'Político-legal', texto: 'El precio de la leche cruda se desreguló en abril de 2026 (se anuló la Resolución Bi-Ministerial 003/2025). Impuesto a las utilidades de las empresas: 25 %. Registro sanitario del SENASAG obligatorio para cada producto nuevo: unas 9 semanas.' },
    { ambito: 'Social-demográfico', texto: 'Santa Cruz tiene 3.115.386 habitantes (Censo 2024), el 27,5 % del país, y es el departamento que más creció.' },
    { ambito: 'Tecnológico', texto: 'La leche UHT sin abrir dura unas 16 semanas en clima cálido; la pasteurizada, cerca de 1 semana refrigerada.' },
    { ambito: 'Ecológico y de insumos', texto: 'Leche cruda: Bs 5,50 por litro más bonos por calidad desde abril de 2026. Azúcar: Bs 6,42 por kg. Cacao en polvo: Bs 121 por kg (precios al consumidor).' }
  ];
}

function vrApiGuardar_(ses, pa, eqRow, dec, enviar) {
  var D = VR_DATOS;
  if (pa.estado !== 'abierto') throw new Error('El trimestre está cerrado: el docente debe abrirlo para recibir decisiones.');
  if (pa.t > D.horizonteTrimestres) throw new Error('La partida terminó.');
  var P = vrCargar_(pa, pa.t - 1); if (!P) throw new Error('Todavía no hay equipos en la simulación.');
  var id = vrMiId_(P, eqRow.equipoId); if (!id) throw new Error('Tu equipo no forma parte de esta partida.');
  dec = dec || {}; delete dec._estado; delete dec._fecha; delete dec._autor;
  var rev = vrRevisar_(pa, P, id, dec);
  if (enviar && rev.errores.length) throw new Error('Para enviar, corrijan: ' + rev.errores.slice(0, 6).join(' · '));
  var limpio = { comite: dec.comite, proyectos: dec.proyectos, solicitudes: dec.solicitudes, comercial: dec.comercial, estudioMercado: !!dec.estudioMercado, nota: vrTxt_(dec.nota, 2000) };
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try { putJson_('Decisiones', eqRow.equipoId, pa.t, limpio, { estado: enviar ? 'enviado' : 'borrador', autor: ses.registro }); }
  finally { lock.releaseLock(); }
  log_(ses.registro, enviar ? 'enviar' : 'guardar', eqRow.equipoId + ' T' + pa.t + ' (VR)');
  rev.estado = enviar ? 'enviado' : 'borrador';
  return rev;
}
function vrApiEstimar_(ses, pa, eqRow, dec) {
  var P = vrCargar_(pa, Math.min(pa.t, VR_DATOS.horizonteTrimestres) - 1); if (!P) throw new Error('Todavía no hay equipos en la simulación.');
  var id = vrMiId_(P, eqRow.equipoId); if (!id) throw new Error('Tu equipo no forma parte de esta partida.');
  return vrRevisar_(pa, P, id, dec || {});
}

// ---------- procesamiento del trimestre ----------
function vrProcesar_(simId) {
  var D = VR_DATOS, pa = partida_(simId), t = pa.t;
  if (t > D.horizonteTrimestres) return { ok: false, mensaje: 'La partida ya terminó.' };
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var P = vrCargar_(pa, t - 1);
    if (!P) return { ok: false, mensaje: 'No hay equipos registrados en esta simulación.' };
    var banco = vrBanco(D, P.E), sinEnvio = [], avisos = [], decs = {};
    // 1) decisiones de innovación (lo inválido se ignora y se mantiene el plan anterior)
    P.E.equipos.forEach(function (e) {
      var dec = getJson_('Decisiones', P.mapa[e.id], t);
      if (!dec || dec._estado !== 'enviado') sinEnvio.push(e.nombre);
      dec = dec || {}; decs[e.id] = dec;
      try {
        var u = vrUnirInnov_(D, P.innov[e.id], dec, t);
        var errs = u.errores.concat(vrValidarInnovacion(D, P.E, e, u.st, banco));
        if (errs.length) avisos.push(e.nombre + ': plan de innovación con errores, se mantuvo el anterior (' + errs[0] + ')');
        else P.innov[e.id] = u.st;
      } catch (ex) { avisos.push(e.nombre + ': ' + ex.message); }
    });
    // 2) avance de proyectos semana a semana (estudios, compuertas, lanzamientos)
    var r = vrTrimestreInnovacion(D, P.E, P.innov, banco);
    // 3) decisiones comerciales
    var com = vrDecisionesNeutras(r.estado);
    r.estado.equipos.forEach(function (e) {
      var dec = decs[e.id], c = {};
      try { c = vrLimpiarComercial_(e, dec.comercial); } catch (ex) { avisos.push(e.nombre + ': ' + ex.message); }
      for (var pid in com[e.id].productos) if (c[pid]) com[e.id].productos[pid] = c[pid];
      // productos que entran este trimestre: usan su plan de lanzamiento
      (r.innov[e.id].proyectos || []).forEach(function (p) {
        if (p.trimestreLanzamiento === t && p.plan && !p.reemplazaProductoActual) {
          var pid2 = e.id + '-' + p.id; if (!com[e.id].productos[pid2]) return;
          com[e.id].productos[pid2] = { precioEmpresa: p.plan.precioEmpresa, mezcla: p.plan.mezcla, publicidad: p.plan.publicidad, produccionSemanal: p.plan.produccionSemanal || null };
        }
      });
      if (dec.estudioMercado) r.extras[e.id].gastoEstudios += D.estudios.mercado;
    });
    var E2 = vrSimularTrimestre(D, r.estado, vrUnirDecisiones(com, r.extras));
    // 4) estudios de mercado comprados: se entregan con los resultados del trimestre
    E2.equipos.forEach(function (e) {
      if (decs[e.id].estudioMercado) { r.innov[e.id].informes = r.innov[e.id].informes || {}; r.innov[e.id].informes['T' + t] = vrEstudioMercado(D, E2); }
    });
    var NP = { E: E2, mapa: P.mapa, innov: r.innov };
    vrGuardar_(pa, t, NP);
    // 5) filas de resultados (compatibles con la vista del docente)
    var pref = simId + '-';
    deleteRowsWhere_('Resultados', function (id, tt) { return tt === t && String(id).indexOf(pref) === 0 && String(id) !== vrIdMercado_(simId); });
    var filas = [];
    E2.equipos.forEach(function (e) {
      var h = e.historial[e.historial.length - 1], ind = vrIndicadores_(D, e, r.innov[e.id]);
      var seg = { natural: 0, calorias: 0, promedio: 0 }, M = D.mercadoLitrosAnio / D.trimestresPorAnio;
      var ult = E2.mercadoHistorial[E2.mercadoHistorial.length - 1].demanda;
      e.productos.forEach(function (p) { if (ult[p.id]) for (var s in seg) seg[s] += ult[p.id].porSegmento[s] / (M * vrSegPeso_(D, s)); });
      var cuota = 0; e.productos.forEach(function (p) { if (ult[p.id]) cuota += ult[p.id].cuota; });
      filas.push([P.mapa[e.id], e.nombre, t, h.resultados.ventas, h.resultados.utilidadNeta, h.balance.caja, cuota * 100, seg.natural * 100, seg.calorias * 100, seg.promedio * 100, '', '',
        ind.vitalidad * 100, h.resultados.ventas ? (h.resultados.innovacion / h.resultados.ventas * 100) : 0, '', '', '', '', '', h.resultados.innovacion + h.resultados.investigacionMercados,
        vrPresupuestoExploracion(D, e), '', '', e.productos.filter(function (p) { return p.activo; }).length,
        (r.innov[e.id].proyectos || []).filter(function (p) { return p.estado !== 'detenido' && p.estado !== 'lanzado'; }).length, simId]);
    });
    if (filas.length) { var rs = sh_('Resultados'); rs.getRange(rs.getLastRow() + 1, 1, filas.length, filas[0].length).setValues(filas); }
    var finP = t + 1 > D.horizonteTrimestres;
    setSim_(simId, { trimestre: t + 1, estado: finP ? 'cerrado' : 'abierto' });
    log_('docente', 'procesar', pa.codigo + ' T' + t + ' (VR)' + (sinEnvio.length ? ' sin envío: ' + sinEnvio.join(', ') : ''));
    return { ok: true, mensaje: 'Trimestre ' + t + ' procesado para ' + E2.equipos.length + ' equipos.' + (sinEnvio.length ? ' Sin envío (se usó su borrador o se repitieron las decisiones anteriores): ' + sinEnvio.join(', ') + '.' : '') +
      (avisos.length ? ' Avisos: ' + avisos.join(' | ') + '.' : '') + (finP ? ' La partida terminó.' : ' El trimestre ' + (t + 1) + ' quedó abierto.'), eventos: r.eventos };
  } finally { lock.releaseLock(); }
}
function vrSegPeso_(D, s) { for (var i = 0; i < D.segmentos.length; i++) if (D.segmentos[i].id === s) return D.segmentos[i].peso; return 1; }

/** Indicadores de rendición de cuentas (decisión 4): resultado comercial, retorno y calidad del proceso. */
function vrIndicadores_(D, e, st) {
  var h = e.historial, ult = h.slice(-D.trimestresPorAnio);
  var ventas = 0, ventasNuevas = 0, contribNuevos = 0;
  ult.forEach(function (x) {
    ventas += x.resultados.ventas;
    for (var pid in x.operacion.porProducto) if (pid.indexOf('-actual') < 0) ventasNuevas += x.operacion.porProducto[pid].ventas;
  });
  // retorno de lo lanzado: margen de contribución acumulado de los productos nuevos menos su inversión y gastos de innovación
  var inversionTotal = 0, gastoInnov = 0;
  h.forEach(function (x) {
    gastoInnov += x.resultados.innovacion + x.resultados.investigacionMercados;
    for (var pid in x.operacion.porProducto) {
      if (pid.indexOf('-actual') >= 0) continue;
      var rp = x.operacion.porProducto[pid];
      var prod = null; e.productos.forEach(function (p) { if (p.id === pid) prod = p; });
      var cv = prod ? prod.costoVariable : 0;
      contribNuevos += rp.ventas - rp.litros * cv - D.costoDistribucionPctVentas * rp.ventas;
    }
  });
  (st.proyectos || []).forEach(function (p) { if (p.estado === 'lanzado' && p.resultados && p.resultados.compuerta2) inversionTotal += p.resultados.compuerta2.fondos || 0; });
  gastoInnov += inversionTotal;
  var evaluadas = 0, conEvidencia = 0, proyectos = (st.proyectos || []).length;
  (st.proyectos || []).forEach(function (p) {
    var r = p.resultados || {};
    if (r.compuerta1) { evaluadas++; if (r.estudioConsumidor && r.pruebaConcepto) conEvidencia++; }
    if (r.compuerta2) { evaluadas++; if (r.pruebaProducto) conEvidencia++; }
  });
  return {
    vitalidad: ventas ? ventasNuevas / ventas : 0,
    retorno: gastoInnov ? (contribNuevos - gastoInnov) / gastoInnov : 0,
    proceso: proyectos ? evaluadas / (2 * proyectos) : 0,
    gastoInnovacion: gastoInnov, contribucionNuevos: contribNuevos
  };
}

// ---------- docente ----------
/** Ranking de la clase con los pesos aprobados (decisión 4): comercial 35 %, retorno 35 %, proceso 30 %; cada medida normalizada entre equipos. */
function vrRanking_(pa) {
  var D = VR_DATOS, tU = Math.min(pa.t - 1, D.horizonteTrimestres);
  if (tU < 1) return { filas: [], t: 0 };
  var P = vrCargar_(pa, tU), datos = [];
  P.E.equipos.forEach(function (e) {
    var ind = vrIndicadores_(D, e, P.innov[e.id]), last = e.historial[e.historial.length - 1];
    var utilAcum = vrSum_(e.historial.map(function (h) { return h.resultados.utilidadNeta; }));
    datos.push({ equipoId: P.mapa[e.id], nombre: e.nombre, vitalidad: ind.vitalidad * 100, retorno: ind.retorno, proceso: ind.proceso * 100,
      ventas: last.resultados.ventas, utilidadAcum: utilAcum, caja: last.balance.caja });
  });
  function norm(k) { var a = datos.map(function (d) { return d[k]; }), mn = Math.min.apply(null, a), mx = Math.max.apply(null, a); datos.forEach(function (d) { d['n_' + k] = mx > mn ? (d[k] - mn) / (mx - mn) : 0.5; }); }
  ['vitalidad', 'retorno', 'proceso'].forEach(norm);
  datos.forEach(function (d) { d.puntaje = Math.round(100 * (0.35 * d.n_vitalidad + 0.35 * d.n_retorno + 0.30 * d.n_proceso)); });
  datos.sort(function (a, b) { return b.puntaje - a.puntaje; });
  return { filas: datos, t: tU, modelo: 'VR' };
}
function vrApiAdmin_(ses, pa, accion, datos) {
  var D = VR_DATOS, t = Math.min(pa.t, D.horizonteTrimestres + 1) - 1;
  var P = vrCargar_(pa, t);
  if (!P) return { equipos: [] };
  if (accion === 'vrPanel') {
    return {
      t: pa.t, horizonte: D.horizonteTrimestres,
      equipos: P.E.equipos.map(function (e) {
        var st = P.innov[e.id] || {}, h = e.historial[e.historial.length - 1], ind = h ? vrIndicadores_(D, e, st) : null;
        return { id: e.id, equipoId: P.mapa[e.id], nombre: e.nombre,
          ventas: h ? h.resultados.ventas : null, utilidadNeta: h ? h.resultados.utilidadNeta : null, caja: h ? h.balance.caja : e.caja,
          indicadores: ind, productos: e.productos.filter(function (p) { return p.activo; }).map(function (p) { return p.nombre; }),
          proyectos: (st.proyectos || []).map(function (p) { return { id: p.id, nombre: p.nombre, clase: p.clase, estado: p.estado || 'exploracion', c1: p.resultados && p.resultados.compuerta1 ? p.resultados.compuerta1.aprobada : null, c2: p.resultados && p.resultados.compuerta2 ? p.resultados.compuerta2.aprobada : null }; }),
          solicitudes: st.solicitudes || [], rubrosAprobados: st.rubrosAprobados || {} };
      })
    };
  }
  if (accion === 'vrRubro') {
    // el docente incorpora al banco un rubro nuevo con fuente verificable, para todos los equipos (decisión 15)
    if (t < 1) throw new Error('Los rubros nuevos se incorporan después de procesar el trimestre 1.');
    var nombre = vrTxt_(datos.nombre, 80).trim(), clave = 'nuevo:' + nombre;
    if (datos.rechazar) {
      var idR = vrMiId_(P, datos.equipoId); if (!idR) throw new Error('Equipo no encontrado en la partida.');
      (P.innov[idR].solicitudes || []).forEach(function (s) { if (s.nombre === nombre) { s.estado = 'rechazado'; s.motivo = vrTxt_(datos.motivo, 300); } });
      putJson_('Estados', P.mapa[idR], t, { empresa: vrEmpresa_(P, idR), innov: P.innov[idR] });
      return { ok: true, mensaje: 'Solicitud rechazada.' };
    }
    if (!nombre) throw new Error('Escriba el nombre del rubro.');
    var precio = vrNum_(datos.precio, 0, 1e8, 'Precio del rubro');
    var fuente = vrTxt_(datos.fuente, 300).trim(); if (fuente.length < 5) throw new Error('Indique la fuente verificable del costo.');
    P.E.rubrosAprobados = P.E.rubrosAprobados || {};
    P.E.rubrosAprobados[clave] = { nombre: nombre, unidad: vrTxt_(datos.unidad, 30), precio: precio, fuente: fuente, aprobado: new Date().toISOString().slice(0, 10) };
    for (var id in P.innov) { P.innov[id].rubrosAprobados = P.E.rubrosAprobados; (P.innov[id].solicitudes || []).forEach(function (s) { if (s.nombre === nombre) { s.estado = 'aprobado'; s.clave = clave; } }); }
    vrGuardar_(pa, t, P);
    log_(ses.email, 'vrRubro', pa.codigo + ' ' + clave);
    return { ok: true, mensaje: 'Rubro "' + nombre + '" incorporado al banco de todos los equipos (clave ' + clave + ').' };
  }
  throw new Error('Acción no reconocida.');
}
