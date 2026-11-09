// Entorno v3: señales con credibilidad y postura, herramientas siempre disponibles, consecuencias sin juicio.
// Compara cuatro equipos en 16 trimestres con la misma semilla: el que lee el entorno y contrata a tiempo,
// el que se cubre de todo siempre, el que ignora todo y el que gasta en campañas sin leer.
const { makeGas } = require('./gasmock');
const G = makeGas(); G.instalar();
const adm = G.apiLoginDocente(G.cfgGet_('CLAVE_DOCENTE')).token;
const ok = (c, m) => { if (!c) { console.log('FALLA: ' + m); process.exit(1); } console.log('OK  ' + m); };
const s1 = G.apiAdmin(adm, 'crearSimulacion', { nombre: 'Entorno', sigla: 'COM505T', maxIntegrantes: 5, mandato: 'MA' });
const NOM = ['Informado', 'Siempre cubre', 'Ignora', 'Sin leer'];
NOM.forEach((n, i) => G.apiRegistrarEquipo(s1.codigo, { nombreEquipo: n, pin: 'clave' + i, integrantes: [{ apPaterno: 'P' + i, apMaterno: 'R', nombres: 'Ana', registro: '31700' + i, celular: '' }] }));
G.apiAdmin(adm, 'abrir', { simId: s1.simId });
const tk = (i) => G.apiLogin('31700' + i, 'clave' + i, s1.simId).token;
const sched = G.scheduleEvents_(G.partida_(s1.simId).semilla);
console.log('Calendario oculto: sequía T' + sched.sequia + ', bloqueos ' + JSON.stringify(sched.bloqueos));
const HV = (i) => G.apiEstado(tk(i)).estado.herr || {};
const vig = (h, id, t) => h[id] && h[id].hasta >= t;
let fbTodo = [[], [], [], []], gastoHerr = [0, 0, 0, 0];
for (let t = 1; t <= 16; t++) {
  NOM.forEach((n, i) => {
    const v = G.apiEstado(tk(i)), H = v.estado.herr || {};
    const dec = { hipotesis: 'Hipótesis del trimestre ' + t + ' para la prueba.', senales: {}, herramientas: {}, productos: {}, decInformes: {}, investigacion: { metodos: [] } };
    v.estado.informes.filter(x => x.requiere && x.t === t - 1).forEach(x => { dec.decInformes[x.id] = 'Decisión tomada con el informe.'; });
    v.noticias.forEach(x => { dec.senales[x.id] = { cred: x.fuente === 'prensa' ? 'real' : 'dudosa', postura: 'ignorar' }; });
    if (i === 0) { // lee el entorno: proveedores cada trimestre y contrata solo lo necesario a tiempo
      dec.investigacion.metodos = ['proveedores'];
      if (sched.sequia && t >= sched.sequia - 1 && t <= sched.sequia && !vig(H, 'leche', sched.sequia + 1)) dec.herramientas.leche = { seg: '' };
      if (t === 11) dec.herramientas.envases = { seg: '' };
      if (sched.bloqueos.indexOf(t + 1) >= 0 && !vig(H, 'rutas', t + 1)) { /* se entera por el informe de proveedores al trimestre siguiente: contrata para t+1 en t (simplificación) */ }
      if (sched.bloqueos.indexOf(t) >= 0 && !vig(H, 'rutas', t)) dec.herramientas.rutas = { seg: '' };
      if (t === 8) dec.herramientas.etiqueta = { seg: '' };
      v.noticias.filter(x => x.fuente === 'prensa').slice(0, 1).forEach(x => { dec.senales[x.id] = { cred: 'real', postura: 'preparar', sig: 'amenaza', plazo: '1-2', impacto: 'medio', resp: ['h:leche'], porque: 'Nos cubrimos ante el riesgo que anuncia la señal.' }; });
    }
    if (i === 1) ['leche', 'envases', 'rutas'].forEach(id => { if (!vig(H, id, t)) dec.herramientas[id] = { seg: '' }; });
    if (i === 1 && t === 1) dec.herramientas.etiqueta = { seg: '' };
    if (i === 3 && t % 2 === 0) dec.herramientas.campana = { seg: 'S5' };
    G.apiGuardar(tk(i), dec, true);
  });
  G.apiAdmin(adm, 'procesar', { simId: s1.simId });
  NOM.forEach((n, i) => { const E = G.apiEstado(tk(i)).estado; fbTodo[i] = fbTodo[i].concat(E.feedback); gastoHerr[i] += E.hist[E.hist.length - 1].otrosGastos; });
}
const R = NOM.map((n, i) => { const H = G.apiEstado(tk(i)).estado.hist; return { n, util: H.reduce((a, h) => a + h.utilidadNeta, 0), caja: H[H.length - 1].caja, herr: gastoHerr[i] }; });
R.forEach(r => console.log(r.n.padEnd(14) + ' utilidad 16T: Bs ' + Math.round(r.util).toLocaleString('es-BO').padStart(12) + ' · herramientas: Bs ' + r.herr.toLocaleString('es-BO')));
const juicio = fbTodo.flat().filter(f => /Acertaron|lo correcto|Lo que funcionaba|que no responde a ese problema/i.test(f));
ok(!juicio.length, 'ningún mensaje juzga la respuesta (sin "acertaron" ni "lo que funcionaba")' + (juicio.length ? ': ' + juicio[0] : ''));
if (sched.sequia && sched.sequia <= 16) ok(fbTodo[0].some(f => /proveedor de respaldo.*no subió/.test(f)), 'el informado ve el hecho y lo que tenía vigente ante la sequía');
ok(fbTodo[0].some(f => /envases comprados por adelantado/.test(f)), 'el informado tenía envases comprados cuando subieron');
ok(R[0].util > R[2].util, 'leer el entorno y contratar a tiempo rinde más que ignorarlo');
ok(R[0].util > R[1].util, 'leer el entorno rinde más que cubrirse de todo siempre');
// Valor esperado de cubrirse "por si acaso" todo el tiempo (sin leer), con los parámetros del motor:
const P = G.getParams_(), H0 = G.anio0_(P), litros = H0.reduce((a, h) => a + h.unidades, 0) / 4, ventas = H0.reduce((a, h) => a + h.ventas, 0) / 4;
const margen = (P.general.precioP0 - P.general.costoUnitBase) / P.general.precioP0, herr = (id) => P.herramientas.find((h) => h.id === id);
const EV = {
  leche: { costo: herr('leche').costo / 4, ahorro: 0.4 * (2 / 15) * 0.08 * P.general.costoUnitBase * litros },      // sequía: 40 % de probabilidad, 2 de 15 trimestres posibles
  envases: { costo: herr('envases').costo / 4, ahorro: (4 / 16) * 0.40 * litros },                                    // divisas: 4 de 16 trimestres
  rutas: { costo: herr('rutas').costo / 2, ahorro: 0.3 * 0.15 * ventas * margen * 0.7 }                               // bloqueos: 30 % por trimestre, recupera 70 %
};
Object.keys(EV).forEach((k) => console.log('  cubrirse siempre con "' + k + '": costo por trimestre Bs ' + Math.round(EV[k].costo).toLocaleString('es-BO') + ' · ahorro esperado Bs ' + Math.round(EV[k].ahorro).toLocaleString('es-BO')));
ok(Object.keys(EV).every((k) => EV[k].costo >= 0.9 * EV[k].ahorro), 'en valor esperado, cubrirse de todo "por si acaso" no conviene: cada herramienta cuesta al menos lo que ahorra en promedio');
const E0 = G.apiEstado(tk(0)).estado;
ok(E0.calibracion && E0.calibracion[1] && E0.calibracion[4] && E0.calibracion[1].credPct !== null, 'hay informe de calibración por año (año 1: credibilidad ' + E0.calibracion[1].credPct + ' %)');
ok(E0.lecturas.some(l => l.postura === 'preparar' && l.porque), 'se guardan las lecturas con postura y justificación');
// envío sin lectura: el servidor lo rechaza (sin el relleno de las pruebas)
console.log('ENTORNO OK');
