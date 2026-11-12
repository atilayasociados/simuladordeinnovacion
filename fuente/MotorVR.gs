/**
 * Simulador de Innovación "vida real" — Motor de cálculo (vr-0.1).
 * Funciones puras: reciben datos, estado y decisiones, y devuelven el nuevo estado y los informes.
 * Partes: (1) empresa del Año 0, (2) mercado, (3) semana a semana, (4) estados financieros.
 * Datos y fuentes: DatosVR.gs (banco de datos aprobado por el docente).
 */

// ---------- utilidades ----------
function vrSum_(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }
function vrCopia_(o) { return JSON.parse(JSON.stringify(o)); }
function vrR2_(x) { return Math.round(x * 100) / 100; }

// =====================================================================
// PARTE 2. MERCADO
// =====================================================================

/** Nivel más cercano de una tabla de niveles (banco §9: "asignar a cada producto su nivel más cercano"). */
function vrNivelCercano_(niveles, valor) {
  var mejor = niveles[0];
  for (var i = 1; i < niveles.length; i++) if (Math.abs(niveles[i].valor - valor) < Math.abs(mejor.valor - valor)) mejor = niveles[i];
  return mejor;
}

/** Valores por porción a partir de la etiqueta por 100 ml. */
function vrPorcion_(D, prod) {
  var f = D.porcionMl / 100;
  return {
    azucar: prod.azucarAnadida100ml * f,
    proteina: prod.proteina100ml * f,
    grasa: prod.grasa100ml, // el % de grasa no depende de la porción
    onzas: prod.tamanoMl / 29.5735
  };
}

/** Utilidad de un producto para un segmento: suma de las utilidades de sus niveles (Brodock et al., 2021, tabla 3). */
function vrUtilidad_(D, prod, seg) {
  var U = D.utilidades, p = vrPorcion_(D, prod), u = 0, i;
  var e = prod.endulzante, ue = 0; // mezcla de endulzantes: promedio (banco §9, Cupesí)
  for (i = 0; i < e.length; i++) ue += U.endulzante[e[i]][seg];
  u += ue / e.length;
  u += vrNivelCercano_(U.azucar.niveles, p.azucar).u[seg];
  u += vrNivelCercano_(U.grasa.niveles, p.grasa).u[seg];
  u += vrNivelCercano_(U.proteina.niveles, p.proteina).u[seg];
  u += vrNivelCercano_(U.tamano.niveles, p.onzas).u[seg];
  return u;
}

/** Precio al consumidor promedio según la mezcla de canales (decisión 32): precio empresa / (1 − margen del canal). */
function vrPrecioConsumidor_(D, prod) {
  if (prod.precioConsumidorFijo) return prod.precioConsumidorFijo;
  var m = prod.mezcla, p = 0, tot = 0;
  for (var c in m) { if (!m[c]) continue; p += m[c] * prod.precioEmpresa / (1 - D.canales[c].margen); tot += m[c]; }
  return tot > 0 ? p / tot : prod.precioEmpresa;
}

/** Caída de ventas por trimestres seguidos sin publicidad (Ehrenberg-Bass, 2018), interpolada por trimestre. */
function vrCaidaSinPublicidad_(D, q) {
  var c = D.caidaSinPublicidad;
  if (q <= 0) return 0;
  for (var i = 1; i < c.length; i++) {
    if (q <= c[i].trimestres) {
      var a = c[i - 1], b = c[i];
      return a.caida + (b.caida - a.caida) * (q - a.trimestres) / (b.trimestres - a.trimestres);
    }
  }
  return c[c.length - 1].caida;
}

/**
 * Factor de publicidad: (publicidad / referencia)^0,12 (decisión 33), nunca peor que dejar de anunciar
 * durante los mismos trimestres seguidos con publicidad por debajo de la referencia (Ehrenberg-Bass, 2018).
 */
function vrFactorPublicidad_(D, prod) {
  if (!prod.publicidadRef) return 1; // competidores fijos
  var piso = 1 - vrCaidaSinPublicidad_(D, prod.trimestresPublicidadBaja || 0);
  if (prod.publicidad <= 0) return piso;
  return Math.max(piso, Math.pow(prod.publicidad / prod.publicidadRef, D.elasticidadPublicidad));
}

/**
 * Demanda del trimestre por producto y segmento.
 * Participación de preferencia logit por segmento (banco §9), con precio (−2,05) y publicidad (0,12).
 * Cada equipo pesa 1/N: los N equipos juntos equivalen a la empresa calibrada (participaciones iguales al inicio).
 * Devuelve { [idProducto]: { litros, porSegmento: {seg: litros}, cuota } } para el trimestre.
 */
function vrDemanda_(D, productos, nEquipos) {
  var litrosTrim = D.mercadoLitrosAnio / D.trimestresPorAnio, res = {}, i, s;
  for (i = 0; i < productos.length; i++) res[productos[i].id] = { litros: 0, porSegmento: {}, cuota: 0 };
  for (s = 0; s < D.segmentos.length; s++) {
    var seg = D.segmentos[s], atr = [], tot = 0;
    for (i = 0; i < productos.length; i++) {
      var p = productos[i];
      var w = p.esEquipo ? 1 / nEquipos : 1;
      var cm = (D.constanteMarca && D.constanteMarca[p.clave]) || 1; // constante de marca de los competidores (banco §9)
      var a = w * cm * Math.exp(D.escalaLogit * vrUtilidad_(D, p, seg.id)) *
        Math.pow(vrPrecioConsumidor_(D, p) / D.precioReferencia, D.elasticidadPrecio) * vrFactorPublicidad_(D, p);
      atr.push(a); tot += a;
    }
    for (i = 0; i < productos.length; i++) {
      var l = litrosTrim * seg.peso * atr[i] / tot;
      res[productos[i].id].porSegmento[seg.id] = l;
      res[productos[i].id].litros += l;
    }
  }
  for (i = 0; i < productos.length; i++) res[productos[i].id].cuota = res[productos[i].id].litros / litrosTrim;
  return res;
}

// =====================================================================
// PARTE 1. EMPRESA DEL AÑO 0
// =====================================================================

function vrProductoAnio0_(D, clave, id, esEquipo) {
  var b = D.productosAnio0[clave], p = vrCopia_(b);
  p.id = id; p.clave = clave; p.esEquipo = esEquipo; p.activo = true;
  return p;
}

/** Litros anuales de una Lácteos Chiquitano en el Año 0, con el mismo modelo de mercado (banco §9). */
function vrVolumenAnio0_(D, nEquipos) {
  var prods = vrProductosMercadoAnio0_(D, nEquipos);
  var dem = vrDemanda_(D, prods, nEquipos);
  return dem['E1-actual'].litros * D.trimestresPorAnio;
}

function vrProductosMercadoAnio0_(D, nEquipos) {
  var prods = [], i;
  for (i = 1; i <= nEquipos; i++) {
    var p = vrProductoAnio0_(D, 'chiquitano', 'E' + i + '-actual', true);
    p.precioConsumidorFijo = D.productosAnio0.chiquitano.precioConsumidor; // Año 0: precio de góndola
    prods.push(p);
  }
  var c = vrProductoAnio0_(D, 'cupesi', 'cupesi', false); c.precioConsumidorFijo = c.precioConsumidor; prods.push(c);
  var m = vrProductoAnio0_(D, 'motacu', 'motacu', false); m.precioConsumidorFijo = m.precioConsumidor; prods.push(m);
  return prods;
}

/**
 * Crea la partida: N empresas Lácteos Chiquitano idénticas y dos competidores fijos.
 * Balance por porcentaje de ventas con las proporciones de Leche Gloria 2024 (banco §11).
 */
function vrCrearPartida(D, nEquipos) {
  var V = vrVolumenAnio0_(D, nEquipos);              // litros por año por equipo
  var precioEmp = D.productosAnio0.chiquitano.precioConsumidor * (1 - D.canales.supermercado.margen); // banco §7
  var S = V * precioEmp;                              // ventas anuales por equipo
  var B = D.balance;
  var costoUnit = D.costoVentasPct * precioEmp;       // costo de ventas por litro (absorción)
  var varUnit = costoUnit * D.costoVentasVariablePct; // parte variable (materias primas e insumos)
  var fijoFabAnual = (costoUnit - varUnit) * V;       // costos fijos de fabricación (incluye depreciación de planta)
  var activoFijo = B.activoFijoPctVentas * S;
  var depAnual = activoFijo * B.depreciacionAnualPct;
  var depFab = depAnual * B.depreciacionFabricacionPct;
  var depAdm = depAnual - depFab;
  var publicidadTrim = D.publicidadPctVentas * S / D.trimestresPorAnio;
  var admAnual = (D.gastosVentaAdmPct - D.costoDistribucionPctVentas - D.publicidadPctVentas) * S; // incluye depreciación administrativa

  var equipos = [];
  for (var e = 1; e <= nEquipos; e++) {
    var prod = vrProductoAnio0_(D, 'chiquitano', 'E' + e + '-actual', true);
    prod.precioEmpresa = precioEmp;
    prod.mezcla = { supermercado: 1, tienda: 0, mercado: 0 };
    prod.publicidad = publicidadTrim;
    prod.publicidadRef = publicidadTrim;
    prod.costoVariable = varUnit;
    prod.vidaUtilSemanas = D.vidaUtilSemanas.uht;
    // Inventario inicial: días de producto terminado de Gloria; lotes de una semana, el más viejo incompleto.
    var semanal = V / 52, semInv = B.diasInventarioPT / 7, lotes = [], edad = 0, resto = semInv;
    while (resto > 1e-9) { var l = Math.min(1, resto); lotes.unshift({ litros: semanal * l, costoUnit: costoUnit, edad: edad }); resto -= l; edad++; }
    // lotes en orden del más viejo al más nuevo
    lotes.sort(function (a, b) { return b.edad - a.edad; });
    prod.lotes = lotes;

    var caja = B.cajaPctVentas * S;
    var cxc = B.diasCxC / 365 * S;
    var inventario = vrSum_(lotes.map(function (x) { return x.litros * x.costoUnit; }));
    var activo = caja + cxc + inventario + activoFijo;
    var cxp = B.diasCxP / 365 * costoUnit * V;
    var deuda = B.deudaSobreFinanciamiento * (activo - cxp);
    var patrimonio = activo - cxp - deuda;

    equipos.push({
      id: 'E' + e, nombre: 'Lácteos Chiquitano ' + e,
      productos: [prod],
      caja: caja, cxc: cxc, activoFijo: activoFijo, cxp: cxp, deuda: deuda,
      capital: patrimonio, resultadosAcumulados: 0,
      fijoFabTrim: fijoFabAnual / D.trimestresPorAnio,
      depFabTrim: depFab / D.trimestresPorAnio,
      depAdmTrim: depAdm / D.trimestresPorAnio,
      admEfectivoTrim: (admAnual - depAdm) / D.trimestresPorAnio,
      produccionNormalTrim: V / D.trimestresPorAnio,
      capacidadSemanal: V / 52 / D.utilizacionCapacidadAnio0, // litros por semana de toda la planta
      reposicionActivoTrim: depAnual / D.trimestresPorAnio, // la empresa repone lo que se deprecia (regla del motor)
      ventasAnioAnterior: S,
      ebtAnio: 0, impuestoAnio: 0,
      historial: []
    });
  }
  var competidores = [];
  ['cupesi', 'motacu'].forEach(function (k) {
    var c = vrProductoAnio0_(D, k, k, false); c.precioConsumidorFijo = c.precioConsumidor; competidores.push(c);
  });
  return {
    version: D.version, nEquipos: nEquipos, t: 0, equipos: equipos, competidores: competidores,
    anio0: { litrosPorEquipo: V, precioEmpresa: precioEmp, ventasPorEquipo: S, costoUnitario: costoUnit, costoVariable: varUnit },
    mercadoHistorial: []
  };
}

/** Decisiones que repiten el Año 0 (útil para pruebas y como valor por defecto). */
function vrDecisionesNeutras(estado) {
  var dec = {};
  estado.equipos.forEach(function (eq) {
    var d = { productos: {}, gastoInnovacion: 0, gastoEstudios: 0, inversion: 0 };
    eq.productos.forEach(function (p) {
      if (!p.activo) return;
      d.productos[p.id] = { precioEmpresa: p.precioEmpresa, mezcla: vrCopia_(p.mezcla), publicidad: p.publicidad, produccionSemanal: null };
    });
    dec[eq.id] = d;
  });
  return dec;
}

// =====================================================================
// PARTES 3 y 4. SEMANA A SEMANA Y ESTADOS FINANCIEROS
// =====================================================================

/**
 * Simula un trimestre para todas las empresas.
 * decisiones[idEquipo] = { productos: { [idProducto]: { precioEmpresa, mezcla, publicidad, produccionSemanal } },
 *                          gastoInnovacion, gastoEstudios, inversion }
 * produccionSemanal: número (litros por semana) o null = producir lo que se espera vender (demanda semanal).
 */
function vrSimularTrimestre(D, estado0, decisiones) {
  var E = vrCopia_(estado0), N = E.nEquipos, sem = D.semanasPorTrimestre;
  E.t += 1;
  var esInicioAnio = (E.t - 1) % D.trimestresPorAnio === 0;

  // 1) aplicar decisiones comerciales
  E.equipos.forEach(function (eq) {
    var d = decisiones[eq.id] || {};
    eq.productos.forEach(function (p) {
      var dp = (d.productos || {})[p.id];
      if (!dp || !p.activo) return;
      if (dp.precioEmpresa != null) p.precioEmpresa = dp.precioEmpresa;
      if (dp.mezcla) p.mezcla = vrCopia_(dp.mezcla);
      if (dp.publicidad != null) p.publicidad = dp.publicidad;
    });
    // trimestres seguidos con publicidad por debajo de la referencia
    eq.productos.forEach(function (p) {
      if (!p.activo || !p.publicidadRef) return;
      p.trimestresPublicidadBaja = p.publicidad < p.publicidadRef * (1 - 1e-9) ? (p.trimestresPublicidadBaja || 0) + 1 : 0;
    });
  });

  // 2) mercado del trimestre (decisiones constantes dentro del trimestre)
  var todos = [];
  E.equipos.forEach(function (eq) { eq.productos.forEach(function (p) { if (p.activo) todos.push(p); }); });
  E.competidores.forEach(function (c) { todos.push(c); });
  var dem = vrDemanda_(D, todos, N);
  E.mercadoHistorial.push({ t: E.t, demanda: vrCopia_(dem) });

  // 3) semana a semana por empresa, y 4) estados financieros
  E.equipos.forEach(function (eq) {
    var d = decisiones[eq.id] || {};
    var ini = { caja: eq.caja, cxc: eq.cxc, cxp: eq.cxp, deuda: eq.deuda, activoFijo: eq.activoFijo,
      inventario: vrValorInventario_(eq), fijoEnInventario: vrFijoEnInventario_(eq),
      patrimonio: eq.capital + eq.resultadosAcumulados };

    // producción planificada y tasa de costos fijos (NIC 2, párr. 13: capacidad normal)
    var plan = {}, prodTotal = 0;
    eq.productos.forEach(function (p) {
      if (!p.activo) return;
      var dp = (d.productos || {})[p.id] || {};
      var q = dp.produccionSemanal == null ? dem[p.id].litros / sem : Math.max(0, dp.produccionSemanal);
      plan[p.id] = q; prodTotal += q * sem;
    });
    // capacidad de planta: si el plan semanal la supera, se recorta en proporción (banco §15, regla 10)
    var planSemanal = prodTotal / sem, recorte = 1;
    if (eq.capacidadSemanal && planSemanal > eq.capacidadSemanal) {
      recorte = eq.capacidadSemanal / planSemanal;
      for (var kp in plan) plan[kp] *= recorte;
      prodTotal *= recorte;
    }
    var tasaFijo = eq.fijoFabTrim / Math.max(eq.produccionNormalTrim, prodTotal);
    var fijoNoAbsorbido = eq.fijoFabTrim - tasaFijo * prodTotal;

    var r = { litros: 0, ventas: 0, ventasSuper: 0, costoVentas: 0, vencido: 0, vencidoFijo: 0, litrosVencidos: 0, perdidas: 0,
      costoVariableVendido: 0, produccionLitros: 0, costoProduccionVariable: 0, porProducto: {}, semanas: [] };

    eq.productos.forEach(function (p) {
      if (!p.activo) return;
      var demSem = dem[p.id].litros / sem, rp = { litros: 0, ventas: 0, costoVentas: 0, vencido: 0, demanda: dem[p.id].litros, perdidas: 0, produccion: 0, semanas: [] };
      var precioEmp = p.precioEmpresa, mez = p.mezcla, totM = 0, c;
      for (c in mez) totM += mez[c] || 0;
      for (var w = 1; w <= sem; w++) {
        // producción de la semana (llega al inicio de la semana)
        var q = plan[p.id];
        if (q > 0) p.lotes.push({ litros: q, costoUnit: p.costoVariable + tasaFijo, edad: 0, costoVar: p.costoVariable });
        rp.produccion += q;
        // venta FIFO (primero lo más viejo)
        var porVender = demSem, vendido = 0, costo = 0, costoVar = 0;
        for (var k = 0; k < p.lotes.length && porVender > 1e-9; k++) {
          var lote = p.lotes[k], x = Math.min(lote.litros, porVender);
          lote.litros -= x; porVender -= x; vendido += x; costo += x * lote.costoUnit;
          costoVar += x * (lote.costoVar != null ? lote.costoVar : p.costoVariable);
        }
        p.lotes = p.lotes.filter(function (l) { return l.litros > 1e-9; });
        // envejecer y dar de baja lo vencido
        var venc = 0, vencL = 0, vencF = 0;
        p.lotes.forEach(function (l) { l.edad += 1; });
        p.lotes = p.lotes.filter(function (l) {
          if (l.edad >= p.vidaUtilSemanas) {
            venc += l.litros * l.costoUnit; vencL += l.litros;
            vencF += l.litros * (l.costoUnit - (l.costoVar != null ? l.costoVar : p.costoVariable));
            return false;
          }
          return true;
        });
        r.vencidoFijo += vencF;
        rp.litros += vendido; rp.costoVentas += costo; rp.vencido += venc; rp.perdidas += porVender;
        r.costoVariableVendido += costoVar; r.litrosVencidos += vencL;
        rp.semanas.push({ semana: w, produccion: q, demanda: demSem, ventas: vendido, perdidas: porVender, vencido: vencL,
          inventarioLitros: vrSum_(p.lotes.map(function (l) { return l.litros; })) });
      }
      rp.ventas = rp.litros * precioEmp;
      var fracSuper = totM > 0 ? (mez.supermercado || 0) / totM : 0;
      r.ventasSuper += rp.ventas * fracSuper;
      r.litros += rp.litros; r.ventas += rp.ventas; r.costoVentas += rp.costoVentas; r.vencido += rp.vencido; r.perdidas += rp.perdidas;
      r.produccionLitros += rp.produccion; r.costoProduccionVariable += rp.produccion * p.costoVariable;
      r.porProducto[p.id] = rp;
    });

    // ----- estado de resultados (costeo por absorción, NIC 2) -----
    var publicidad = 0;
    eq.productos.forEach(function (p) { if (p.activo) publicidad += p.publicidad; });
    var distribucion = D.costoDistribucionPctVentas * r.ventas;
    var innov = d.gastoInnovacion || 0, estudios = d.gastoEstudios || 0;
    var adm = eq.admEfectivoTrim + eq.depAdmTrim;
    var fijosNuevos = eq.fijoOperativoNuevoTrim || 0;          // filas "fijo por trimestre" de productos lanzados (decisión 16)
    var depNueva = eq.depInversionNuevaTrim || 0;              // depreciación de inversiones de innovación (decisión 16)
    var intereses = eq.deuda * D.tasaInteresAnual / D.trimestresPorAnio;
    var utilidadBruta = r.ventas - r.costoVentas - fijoNoAbsorbido - r.vencido;
    var utilidadOperativa = utilidadBruta - distribucion - publicidad - adm - fijosNuevos - depNueva - innov - estudios;
    var ebt = utilidadOperativa - intereses;
    if (esInicioAnio) { eq.ebtAnio = 0; eq.impuestoAnio = 0; }
    eq.ebtAnio += ebt;
    var impuestoDebido = Math.max(0, eq.ebtAnio) * D.tasaImpuesto; // IUE sobre la utilidad acumulada del año
    var impuesto = impuestoDebido - eq.impuestoAnio;
    eq.impuestoAnio = impuestoDebido;
    var utilidadNeta = ebt - impuesto;

    // ----- flujo de efectivo (método directo) -----
    var cxcFin = r.ventasSuper * D.canales.supermercado.diasCobro / 91; // 91 días por trimestre
    var cobros = r.ventas + eq.cxc - cxcFin;
    var costoVentasPeriodo = r.costoVentas + fijoNoAbsorbido;
    var cxpFin = D.balance.diasCxP / 91 * costoVentasPeriodo; // días de costo de ventas (Gloria 2024)
    var compras = r.costoProduccionVariable + (eq.fijoFabTrim - eq.depFabTrim); // materiales + fijos de fabricación en efectivo
    var pagosProveedores = compras + eq.cxp - cxpFin;
    var pagosGastos = distribucion + publicidad + eq.admEfectivoTrim + fijosNuevos + innov + estudios;
    var inversion = eq.reposicionActivoTrim + (d.inversion || 0);
    var flujoOperativo = cobros - pagosProveedores - pagosGastos - intereses - impuesto;
    var cajaPrev = eq.caja + flujoOperativo - inversion;
    var prestamo = cajaPrev < 0 ? -cajaPrev : 0; // si la caja queda negativa, préstamo automático a la misma tasa (regla del motor)

    // ----- actualizar balance -----
    eq.caja = cajaPrev + prestamo;
    eq.cxc = cxcFin; eq.cxp = cxpFin; eq.deuda += prestamo;
    eq.activoFijo += inversion - eq.depFabTrim - eq.depAdmTrim - depNueva;
    if (d.inversion) eq.depInversionNuevaTrim = depNueva + d.inversion * D.balance.depreciacionAnualPct / D.trimestresPorAnio;
    eq.resultadosAcumulados += utilidadNeta;
    var inventarioFin = vrValorInventario_(eq), fijoEnInvFin = vrFijoEnInventario_(eq);
    var activo = eq.caja + eq.cxc + inventarioFin + eq.activoFijo;
    var pasivo = eq.cxp + eq.deuda, patrimonio = eq.capital + eq.resultadosAcumulados;

    // ----- costeo variable y conciliación -----
    var margenContribucion = r.ventas - r.costoVariableVendido - distribucion;
    var vencidoVariable = r.vencido - r.vencidoFijo; // parte variable de lo vencido
    var utilidadOperativaVariable = margenContribucion - vencidoVariable - eq.fijoFabTrim - publicidad - adm - fijosNuevos - depNueva - innov - estudios;
    var conciliacion = utilidadOperativa - utilidadOperativaVariable; // = fijo en inventario final − inicial (± vencido)

    var saldoMinimo = D.saldoMinimoCajaPctVentas * eq.ventasAnioAnterior;
    var informe = {
      t: E.t,
      operacion: { litrosVendidos: r.litros, litrosProducidos: r.produccionLitros, ventasPerdidasLitros: r.perdidas,
        capacidadSemanal: eq.capacidadSemanal, recorteCapacidad: 1 - recorte,
        litrosVencidos: r.litrosVencidos, porProducto: r.porProducto },
      resultados: { ventas: r.ventas, costoVentas: r.costoVentas, capacidadNoAbsorbida: fijoNoAbsorbido, bajasVencimiento: r.vencido,
        utilidadBruta: utilidadBruta, distribucion: distribucion, publicidad: publicidad, administracion: adm,
        fijosProductosNuevos: fijosNuevos, depreciacionInversionesNuevas: depNueva,
        innovacion: innov, investigacionMercados: estudios, utilidadOperativa: utilidadOperativa,
        intereses: intereses, utilidadAntesImpuestos: ebt, impuesto: impuesto, utilidadNeta: utilidadNeta },
      costeoVariable: { margenContribucion: margenContribucion, costosFijosFabricacion: eq.fijoFabTrim,
        utilidadOperativa: utilidadOperativaVariable, conciliacion: conciliacion,
        fijoEnInventarioInicial: ini.fijoEnInventario, fijoEnInventarioFinal: fijoEnInvFin },
      flujo: { cobros: cobros, pagosProveedores: pagosProveedores, pagosGastos: pagosGastos, intereses: intereses, impuesto: impuesto,
        flujoOperativo: flujoOperativo, inversion: inversion, prestamo: prestamo, variacionCaja: eq.caja - ini.caja },
      balance: { caja: eq.caja, cxc: eq.cxc, inventario: inventarioFin, activoFijo: eq.activoFijo, activo: activo,
        cxp: eq.cxp, deuda: eq.deuda, pasivo: pasivo, capital: eq.capital, resultadosAcumulados: eq.resultadosAcumulados,
        patrimonio: patrimonio, cuadre: activo - pasivo - patrimonio },
      cajaDisponibleLanzamiento: Math.max(0, eq.caja - saldoMinimo), saldoMinimo: saldoMinimo,
      mercado: { cuotas: vrCuotasResumen_(dem) }
    };
    eq.historial.push(informe);
    if (E.t % D.trimestresPorAnio === 0) {
      var ult = eq.historial.slice(-D.trimestresPorAnio);
      eq.ventasAnioAnterior = vrSum_(ult.map(function (h) { return h.resultados.ventas; }));
    }
  });
  return E;
}

function vrValorInventario_(eq) {
  var v = 0; eq.productos.forEach(function (p) { (p.lotes || []).forEach(function (l) { v += l.litros * l.costoUnit; }); }); return v;
}
function vrFijoEnInventario_(eq) {
  var v = 0; eq.productos.forEach(function (p) { (p.lotes || []).forEach(function (l) { var cv = l.costoVar != null ? l.costoVar : p.costoVariable; v += l.litros * (l.costoUnit - cv); }); }); return v;
}
function vrCuotasResumen_(dem) { var o = {}; for (var k in dem) o[k] = dem[k].cuota; return o; }

// Exportación para pruebas en Node (no afecta a Apps Script).
if (typeof module !== 'undefined') module.exports = { vrDemanda_: vrDemanda_, vrPrecioConsumidor_: vrPrecioConsumidor_, vrUtilidad_: vrUtilidad_, vrCrearPartida: vrCrearPartida,
  vrSimularTrimestre: vrSimularTrimestre, vrDecisionesNeutras: vrDecisionesNeutras, vrProductosMercadoAnio0_: vrProductosMercadoAnio0_ };
