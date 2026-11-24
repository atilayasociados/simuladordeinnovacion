// Prueba integral del simulador "vida real" en el servidor: node test/vr.js
const { makeGas } = require('./gasmock');
const G = makeGas();
G.instalar();
let fallas = 0;
const ok = (c, m) => { if (!c) { fallas++; console.log('FALLA:', m); } else console.log('ok  ', m); };
const falla = (fn, txt, m) => { try { fn(); ok(false, m + ' (no dio error)'); } catch (e) { ok(String(e.message).includes(txt), m + ' → ' + e.message.slice(0, 140)); } };
const fmt = (x) => Math.round(x).toLocaleString('es-BO');

const adm = G.apiLoginDocente().token;
const lista = G.apiAdmin(adm, 'simulaciones', {});
ok(lista.mandatos.length === 1 && lista.mandatos[0].id === 'VR', 'solo existe el simulador vida real');
const sim = G.apiAdmin(adm, 'crearSimulacion', { nombre: 'Innovación vida real', sigla: 'COM505T', maxIntegrantes: 3, mandato: 'VR' });
// aunque se pida otro mandato, la simulación nueva es vida real
const simOld = G.apiAdmin(adm, 'crearSimulacion', { nombre: 'Otra', sigla: 'COM540D', maxIntegrantes: 3, mandato: 'MA' });
const est = (n, reg) => ({ apPaterno: 'Vaca', apMaterno: 'Roca', nombres: 'Ana ' + n, registro: reg });
const equipos = ['Halcones', 'Jaguares', 'Parabas'].map((n, i) => G.apiRegistrarEquipo(sim.codigo, { nombreEquipo: n, clave: 'Clave#' + (1000 + i), integrantes: [est(i, String(218100 + i))] }));
const tokVieja = G.apiRegistrarEquipo(simOld.codigo, { nombreEquipo: 'Antiguo', clave: 'Clave#9999', integrantes: [est(9, '218999')] }).token;
const tok = equipos.map((e) => e.token);

// estado inicial
let V = G.apiEstado(tok[0]);
ok(V.modelo === 'VR' && V.partida.total === 12, 'el equipo ve el simulador vida real con 12 trimestres');
ok(V.empresa.productos.length === 1 && Math.abs(V.empresa.productos[0].precioConsumidor - 17) < 1e-6, 'producto actual a Bs 17,00 al consumidor');
ok(V.informes.industria.gondola.length === 5, 'la góndola muestra 3 Lácteos Chiquitano + Cupesí + Motacú');
ok(V.empresa.balanceInicial && V.empresa.balanceInicial.activo > 0, 'balance inicial disponible');
const pid = V.empresa.productos[0].id, precio = V.empresa.productos[0].precioEmpresa, pubRef = V.empresa.productos[0].publicidadRef;

falla(() => G.apiGuardar(tok[0], {}, false), 'cerrado', 'no se puede guardar con el trimestre cerrado');
G.apiAdmin(adm, 'abrir', { simId: sim.simId });
// rubro nuevo pedido en el trimestre 1 y aprobado antes de procesarlo
G.apiGuardar(tok[2], { solicitudes: [{ tipo: 'rubro', nombre: 'Estevia', unidad: 'kg', justificacion: 'Proyecto sin azúcar' }] }, false);
const pan1 = G.apiAdmin(adm, 'vrPanel', { simId: sim.simId });
ok(pan1.equipos[2].solicitudes.some((x) => x.nombre === 'Estevia' && x.enBorrador), 'el docente ve la solicitud del borrador antes de procesar el trimestre 1');
ok(G.apiAdmin(adm, 'vrRubro', { simId: sim.simId, nombre: 'Estevia', unidad: 'kg', precio: 500, fuente: 'Prueba del simulador' }).ok, 'el docente aprueba un rubro antes de procesar el trimestre 1');
ok(!!G.apiEstado(tok[0]).innov.rubrosAprobados['nuevo:Estevia'], 'todos los equipos ven el rubro aprobado en el trimestre 1');

// equipo 1: proyecto incremental con menos azúcar
const proyecto = {
  id: 'P1', nombre: 'Chiquitano con menos azúcar', clase: 'incremental', justificacionClase: 'Cambia la fórmula del producto actual',
  idea: { problema: 'Mucha azúcar', paraQuien: 'Consumidores de lo natural', propuesta: '4 g de azúcar añadida por porción' },
  segmentoObjetivo: 'natural', muestra: 400,
  producto: { endulzante: ['azucar_cana'], azucarAnadida100ml: 1.67, grasa100ml: 1.6, proteina100ml: 3.1, tamanoMl: 1000, conservacion: 'uht' },
  hoja: [
    { descripcion: 'Leche', categoria: 'contenido', tipo: 'variable', rubro: 'leche_cruda', cantidad: 1 },
    { descripcion: 'Azúcar', categoria: 'contenido', tipo: 'variable', rubro: 'azucar', cantidad: 0.0167 },
    { descripcion: 'Cacao', categoria: 'contenido', tipo: 'variable', rubro: 'cacao', cantidad: 0.01 },
    { descripcion: 'Envase', categoria: 'envase', tipo: 'variable', rubro: 'insumos_envase_actual', cantidad: 1 },
    { descripcion: 'Planta', categoria: 'mano_de_obra', tipo: 'variable', rubro: 'mano_obra_planta_actual', cantidad: 1 },
    { descripcion: 'Formulación', categoria: 'otro', tipo: 'desarrollo', rubro: 'sueldo_profesional', cantidad: 1 }
  ],
  plan: { precioEmpresa: precio, mezcla: { supermercado: 1 }, publicidad: pubRef, produccionSemanal: 0 },
  gantt: [
    { nombre: 'Estudio del consumidor', tipo: 'estudio_consumidor', inicio: 1, duracion: 5, responsable: 1, carga: 0.2 },
    { nombre: 'Prueba de concepto', tipo: 'prueba_concepto', inicio: 6, duracion: 5, responsable: 1, carga: 0.2 },
    { nombre: 'Formulación', tipo: 'desarrollo', inicio: 12, duracion: 8, responsable: 1, carga: 0.4 },
    { nombre: 'Registro sanitario', tipo: 'registro_sanitario', inicio: 12, duracion: 9, responsable: 0, carga: 0.1 },
    { nombre: 'Prueba de producto', tipo: 'prueba_producto', inicio: 30, duracion: 5, responsable: 1, carga: 0.2 },
    { nombre: 'Lanzamiento', tipo: 'lanzamiento', inicio: 40, duracion: 1, responsable: 0, carga: 0.1 }
  ],
  compuerta1: { semana: 11, continuar: true }, compuerta2: { semana: 36, continuar: true }
};
// el simulador no completa nada: el equipo debe escribir precio, canales, publicidad y producción de cada producto
function comercialDe(V) {
  const o = {}, ult = V.empresa.historial.length ? V.empresa.historial[V.empresa.historial.length - 1] : null;
  V.empresa.productos.filter((p) => p.activo).forEach((p) => {
    const op = ult && ult.operacion && ult.operacion.porProducto[p.id];
    o[p.id] = { precioEmpresa: p.precioEmpresa || 13.85, mezcla: p.mezcla, publicidad: Math.round(p.publicidadRef || p.publicidad || 0), produccionSemanal: Math.round(op ? op.demanda / 13 : 14000) };
  });
  return o;
}
const dec1 = { comite: [{ nombre: 'Jefa', cargo: 'jefe', dedicacion: 0.1 }, { nombre: 'Analista', cargo: 'profesional', dedicacion: 0.45 }], proyectos: [proyecto], comercial: comercialDe(G.apiEstado(tok[0])), estudioMercado: true };
const rev = G.apiEstimar(tok[0], dec1);
ok(rev.errores.length === 0, 'la vista previa no encuentra errores' + (rev.errores.length ? ': ' + rev.errores.join(' | ') : ''));
ok(rev.costosTrimestre.estudios === 59200 * 3, 'costo de estudios del trimestre: mercado + consumidor + prueba = ' + fmt(rev.costosTrimestre.estudios));
// errores que el servidor no deja pasar aunque el navegador los permita
const malo = JSON.parse(JSON.stringify(dec1)); malo.proyectos[0].gantt[0].duracion = 2; malo.comite[1].dedicacion = 0.2;
falla(() => G.apiGuardar(tok[0], malo, true), 'corrijan', 'el servidor rechaza un Gantt inválido al enviar');
falla(() => G.apiGuardar(tok[0], { comercial: { [pid]: { precioEmpresa: -5, mezcla: { supermercado: 1 }, publicidad: 0 } } }, true), 'corrijan', 'el servidor rechaza un precio negativo');
G.apiGuardar(tok[0], dec1, true);
// decisiones enviadas: no se pueden corregir, salvo que el docente lo permita
falla(() => G.apiGuardar(tok[0], dec1, false), 'ya fueron enviadas', 'no se pueden corregir decisiones enviadas');
const pan0 = G.apiAdmin(adm, 'vrPanel', { simId: sim.simId });
ok(pan0.equipos[0].decision === 'enviado', 'el panel docente ve que el equipo envió');
ok(G.apiAdmin(adm, 'vrDevolver', { simId: sim.simId, equipoId: pan0.equipos[0].equipoId }).ok, 'el docente permite corregir');
G.apiGuardar(tok[0], dec1, true);
ok(true, 'el equipo corrige y vuelve a enviar');
// equipo 2: baja publicidad y vende en tiendas; equipo 3 no envía nada
G.apiGuardar(tok[1], { comercial: { [G.apiEstado(tok[1]).empresa.productos[0].id]: { precioEmpresa: precio * 1.05, mezcla: { tienda: 1 }, publicidad: pubRef * 0.5, produccionSemanal: null } }, comite: [{ nombre: 'Uno', cargo: 'profesional', dedicacion: 0.2 }] }, true);

// tablero del docente: quién envió y quién no; forzar el envío
let RS = G.apiAdmin(adm, 'resumen', { simId: sim.simId });
const parab = RS.equipos.find((e) => e.nombre === 'Parabas');
console.log('   tablero T1:', RS.equipos.map((e) => e.nombre + '=' + e.envio).join(', '));
ok(RS.equipos.filter((e) => e.envio === 'enviado').length === 2 && parab.envio !== 'enviado', 'el tablero muestra quién envió (2) y quién no (Parabas)');
ok(RS.equipos.every((e) => e.envio === 'sin decisiones' || !!e.fechaEnvio), 'el tablero muestra la fecha de la última actualización');
const tieneBor = parab.envio === 'borrador';
ok(G.apiAdmin(adm, 'vrForzarEnvio', { simId: sim.simId, equipoId: parab.equipoId }).mensaje.includes(tieneBor ? 'su borrador' : 'sin decisiones'), 'el docente fuerza el envío de un equipo pendiente');
RS = G.apiAdmin(adm, 'resumen', { simId: sim.simId });
const parab2 = RS.equipos.find((e) => e.nombre === 'Parabas');
ok(parab2.envio === 'enviado' && String(parab2.enviadoPor).indexOf('docente') === 0, 'el equipo forzado figura como enviado por el docente');
falla(() => G.apiGuardar(tok[2], {}, false), 'ya fueron enviadas', 'el equipo forzado ya no puede editar');
ok(G.apiAdmin(adm, 'vrForzarEnvio', { simId: sim.simId, todos: true }).mensaje.includes('No había'), 'forzar todos sin pendientes no cambia nada');

for (let t = 1; t <= 12; t++) {
  const r = G.apiAdmin(adm, 'procesar', { simId: sim.simId });
  if (!r.ok) { ok(false, 'procesar T' + t + ': ' + r.mensaje); break; }
  (r.eventos || []).forEach((e) => console.log('   evento:', JSON.stringify(e)));
  if (t < 12) {
    // el equipo 1 vuelve a enviar su plan (sin cambios) cada trimestre
    const Vt = G.apiEstado(tok[0]);
    const d = { comite: Vt.innov.comite, proyectos: Vt.innov.proyectos, comercial: comercialDe(Vt), estudioMercado: false };
    const rr = G.apiEstimar(tok[0], d);
    if (rr.errores.length) console.log('   errores T' + (t + 1) + ':', rr.errores.join(' | '));
    G.apiGuardar(tok[0], d, rr.errores.length === 0);
    if (t === 1) {
      const rf = G.apiAdmin(adm, 'vrForzarEnvio', { simId: sim.simId, todos: true });
      ok(/Jaguares \(sin decisiones/.test(rf.mensaje) && /Parabas \(sin decisiones/.test(rf.mensaje) && !/Halcones \(sin decisiones/.test(rf.mensaje), 'forzar todos en T2 envía solo a los pendientes que no guardaron nada');
    }
  }
}
const sims = G.apiAdmin(adm, 'simulaciones', {}).lista.find((s) => s.simId === sim.simId);
ok(sims.t === 13 && sims.estado === 'cerrado', 'la partida termina después de 12 trimestres');
V = G.apiEstado(tok[0]);
ok(V.partida.finalizada, 'el equipo ve la partida finalizada');
const H = V.empresa.historial;
ok(H.length === 12 && H.every((h) => Math.abs(h.balance.cuadre) < 1e-3), 'historial de 12 trimestres con balances cuadrados');
const p1 = V.innov.proyectos[0];
console.log('   proyecto P1:', p1.estado, '| C1', p1.resultados.compuerta1 && p1.resultados.compuerta1.aprobada, '| C2', p1.resultados.compuerta2 && p1.resultados.compuerta2.aprobada);
console.log('   litros por trimestre equipo 1:', H.map((h) => fmt(h.operacion.litrosVendidos)).join(' | '));
console.log('   utilidad neta equipo 1:', H.map((h) => fmt(h.resultados.utilidadNeta)).join(' | '));
ok(V.informes.estudiosMercado.T1 && V.informes.estudiosMercado.T1.productos.length >= 5, 'el estudio de mercado comprado en T1 se entregó');
const panel = G.apiAdmin(adm, 'vrPanel', { simId: sim.simId });
ok(panel.equipos.length === 3, 'panel del docente con 3 equipos');
const rank = G.apiAdmin(adm, 'ranking', { simId: sim.simId });
ok(rank.modelo === 'VR' && rank.filas.length === 3, 'ranking con los pesos 35/35/30: ' + rank.filas.map((f) => f.nombre + ' ' + f.puntaje).join(', '));
const res = G.apiAdmin(adm, 'resultados', { simId: sim.simId });
ok(res.length === 36, 'filas de resultados para el docente: ' + res.length);
// rubro nuevo
G.apiAdmin(adm, 'retroceder', { simId: sim.simId });
const rr = G.apiAdmin(adm, 'vrRubro', { simId: sim.simId, nombre: 'Estevia en polvo', unidad: 'kg', precio: 950, fuente: 'Cotización proveedor X, 2026' });
ok(rr.ok, rr.mensaje);
ok(G.apiEstado(tok[1]).cat.banco && G.apiEstado(tok[1]).innov.rubrosAprobados['nuevo:Estevia en polvo'], 'el rubro nuevo queda disponible para todos los equipos');
ok(!!G.apiEstado(tok[1]).innov.rubrosAprobados['nuevo:Estevia'], 'el rubro aprobado antes del trimestre 1 sigue después de procesarlo');
// atributo nuevo (punto b2): solo con utilidades por segmento y fuente
falla(() => G.apiAdmin(adm, 'vrAtributo', { simId: sim.simId, nombre: 'Sin lactosa', natural: 5, calorias: 3, promedio: 2, fuente: '' }), 'estudio', 'un atributo nuevo exige la fuente del estudio');
const ra = G.apiAdmin(adm, 'vrAtributo', { simId: sim.simId, nombre: 'Sin lactosa', natural: 5, calorias: 3, promedio: 2, fuente: 'Estudio de conjunto del equipo 1, 2026', rubro: 'nuevo:Estevia en polvo' });
ok(ra.ok, ra.mensaje);
const est1 = G.apiEstado(tok[1]);
ok(est1.cat.atributosAprobados.some((x) => x.clave === 'nuevo:Sin lactosa') && est1.cat.mensajes.length === 7, 'los equipos ven el atributo aprobado y los 7 mensajes frontales');
// toda simulación nueva es vida real
ok(G.rows_('Simulaciones').find((x) => x.simId === simOld.simId).mandato === 'VR', 'una simulación nueva siempre usa el simulador vida real');
// una simulación antigua (motor retirado) solo se puede administrar: respaldo sí, procesar no
const vieja = G.rows_('Simulaciones').find((x) => x.simId === simOld.simId); vieja.mandato = 'MA'; G.updateRow_('Simulaciones', vieja);
falla(() => G.apiAdmin(adm, 'procesar', { simId: simOld.simId }), 'motor anterior', 'no se puede procesar una simulación del motor anterior');
falla(() => G.apiAdmin(adm, 'abrir', { simId: simOld.simId }), 'motor anterior', 'no se puede jugar una simulación del motor anterior');
ok(G.apiAdmin(adm, 'respaldo', { simId: simOld.simId }).simulacion, 'su respaldo sigue disponible');
falla(() => G.apiEstado(G.apiRegistrarEquipo === undefined ? '' : tokVieja), 'motor anterior', 'el equipo de una simulación antigua ve el aviso de motor retirado');
console.log(fallas ? `\n${fallas} FALLAS` : '\nTodas las pruebas pasaron');
process.exit(fallas ? 1 : 0);
