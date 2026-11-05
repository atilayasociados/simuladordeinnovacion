// Equivalencia de unidades: la misma partida jugada con el motor en porciones (FUENTE=copia anterior, UNIDAD=porcion)
// y con el motor en litros (UNIDAD=litro) debe dar los mismos resultados en Bs y en unidades físicas.
// Uso: AZAR_FIJO=7 FUENTE=<dir> UNIDAD=porcion node test/equivalencia.js > a.json ; AZAR_FIJO=7 UNIDAD=litro node test/equivalencia.js > b.json
const { makeGas } = require('./gasmock');
const { decidir3, revisar3 } = require('./p3driver');
const K = process.env.UNIDAD === 'litro' ? 4 : 1;
const G = makeGas(); G.instalar();
const adm = G.apiLoginDocente(G.cfgGet_('CLAVE_DOCENTE')).token;
const s1 = G.apiAdmin(adm, 'crearSimulacion', { nombre: 'Equivalencia', sigla: 'COM505T', maxIntegrantes: 5, mandato: 'MA' });
const NOM = ['Bueno', 'Gastador', 'Malo', 'Acelera', 'Normal', 'SinPiloto'], PERF = ['bueno', 'gastador', 'malo', 'acelera', 'normal', 'sinPiloto'];
const SEG = ['S2', 'S4', 'S2', 'S3', 'S5', 'S1'];
NOM.forEach((n, i) => G.apiRegistrarEquipo(s1.codigo, { nombreEquipo: n, pin: '1234', integrantes: [{ apPaterno: 'P' + i, apMaterno: 'R', nombres: 'Ana', registro: '31800' + i, celular: '7123456' + i }] }));
G.apiAdmin(adm, 'abrir', { simId: 'S01' });
const tk = i => G.apiLogin('31800' + i, '1234').token;
const ficha = (n, pts, po) => ({ nombre: n, frase: 'Para clientes que necesitan algo práctico, ' + n + ' es una bebida láctea que resuelve su mañana.', pts, precioObj: po * K, tec: 'no', mod: 'no', tipo4p: 'Producto', externa: '', test: true });
const T = Number(process.env.TRIM || 16), salida = { trimestres: [], proyectos: [], informes: [] };
for (let t = 1; t <= T; t++) {
  NOM.forEach((n, i) => {
    const v = G.apiEstado(tk(i)), dec = { hipotesis: 'Hipótesis del trimestre ' + t, noticias: {}, respuestas: {}, productos: {}, investigacion: { metodos: [], segmentos: [] }, decInformes: {}, proyectos: {}, nuevosProyectos: [] };
    v.noticias.forEach(x => { dec.noticias[x.id] = 'amenaza'; dec.respuestas[x.id] = i % 2 ? 'preparar' : 'vigilar'; });
    v.estado.informes.filter(x => x.requiere && x.t === t - 1).forEach(x => { dec.decInformes[x.id] = 'Con este dato ajustamos el proyecto y el precio objetivo.'; });
    v.estado.productos.forEach(p => { dec.productos[p.id] = { precio: Math.round(p.precio * (t % 3 === 0 ? 1.08 : (t % 5 === 0 ? 0.95 : 1)) * 10000) / 10000, comunicacion: 20000 + 2000 * i, segPub: i % 2 ? p.segPub || 'todos' : 'S1', promo: t % 4 === 0 ? 10000 : 0, pronostico: Math.round(1000000 / K), canales: p.canales.concat(t === 6 && i === 1 ? ['maquina'] : []) }; });
    if ((t - 1) % 4 === 0) dec.anual = { p4: { producto: 40, proceso: 20, posicion: 20, paradigma: 20 }, nucleo: 40, adyacente: 40, transf: 20, postura: 'ofensiva', tiempoLibre: 10, incentivo: 'reconocimiento', politica: 'aprendizaje', composicion: 'multifuncional', estructura: 'autonoma', capacitacion: false, umbral: 'moderado', hipotesis: 'Hipótesis anual' };
    if (t === 1) { dec.nuevosProyectos.push({ nombre: 'Proyecto ' + n, segmento: SEG[i], tec: 'no', mod: 'no', portafolio: 'adyacente', brief: { cuando: 'salgo temprano', quiero: 'algo que me quite el hambre', para: 'rendir en la mañana', reto: '¿Cómo podríamos ofrecer a los clientes un desayuno que se tome con una mano?', evidencia: '', frase: '', criterio: '5 % del segmento en dos trimestres' } }); dec.investigacion = { metodos: ['observacion', 'encuesta', 'competidores', 'industria', 'percepcion'], segmentos: [SEG[i], 'S1'] }; }
    if (t === 10 && i === 3) dec.respuestaC4 = 'alianza';
    if (t === 16) dec.licitacion = true;
    v.estado.proyectos.forEach(p => {
      const a = dec.proyectos[p.id] = {};
      if (p.flujo !== 2) return;
      if (p.etapa === 'idear') { a.tecnica = 'scamper'; a.ind = { ['31800' + i]: { campos: { S: 'Botella chica', C: 'Con avena', A: 'Tapa deportiva', M: 'Más espesa' } } }; a.fichas = [ficha('Concepto A' + i, { conv: 5, nut: 3, sab: 2, salud: 0, sost: 0, precio: 0 }, 4.5), ficha('Concepto B' + i, { sab: 4, salud: 3, precio: 3, nut: 0, conv: 0, sost: 0 }, 2.4)]; }
      else if (p.etapa === 'evaluar') { const F = p.fichas.slice().sort((x, y) => (y.test ? y.test.qCorr : 0) - (x.test ? x.test.qCorr : 0)); a.elegir = F[0].id; a.justificacion = 'Elegimos el concepto con calidad ' + (F[0].test ? F[0].test.qCorr : 5) + ' en el test.'; }
      else if (p.estado === 'activo') decidir3(p, a, PERF[i], n);
      else revisar3(p, a);
    });
    G.apiGuardar(tk(i), dec, true);
  });
  G.apiAdmin(adm, 'procesar', { simId: 'S01' });
  NOM.forEach((n, i) => { const h = G.apiEstado(tk(i)).estado.hist.slice(-1)[0];
    salida.trimestres.push([t, n, h.ventas, h.utilidadNeta, h.caja, h.cuotaTotal, h.vitalidad, h.twin.ventas, h.productos.map(p => Math.round(p.unidades / K))]); });
}
NOM.forEach((n, i) => { const E = G.apiEstado(tk(i)).estado; E.proyectos.forEach(p => salida.proyectos.push([n, p.etapa, p.gastoAcum, p.iter, p.protoFit, (p.actas || []).map(a => [a.veredicto, a.promedio, a.costoReal, a.caso && a.caso.volumen]), p.pil ? [p.pil.vendidas, p.pil.recompra] : null, p.resLanz ? [p.resLanz.unidades, p.resLanz.cuota, p.resLanz.utilidad, p.resLanz.canib] : null,
  (p.fichas || []).map(f => f.test ? [f.test.intencion, f.test.qCorr, Math.round(f.test.vw.pmc / K * 100) / 100, Math.round(f.test.vw.pme / K * 100) / 100] : null)]));
  salida.informes.push([n, E.informes.length]); });
console.log(JSON.stringify(salida));
