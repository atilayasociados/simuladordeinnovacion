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
ok(lista.mandatos.some((m) => m.id === 'VR'), 'el docente puede elegir el simulador vida real');
const sim = G.apiAdmin(adm, 'crearSimulacion', { nombre: 'Innovación vida real', sigla: 'COM505T', maxIntegrantes: 3, mandato: 'VR' });
// otra simulación con el motor anterior: no debe verse afectada
const simOld = G.apiAdmin(adm, 'crearSimulacion', { nombre: 'Motor anterior', sigla: 'COM540D', maxIntegrantes: 3, mandato: 'MA' });
const est = (n, reg) => ({ apPaterno: 'Vaca', apMaterno: 'Roca', nombres: 'Ana ' + n, registro: reg });
const equipos = ['Halcones', 'Jaguares', 'Parabas'].map((n, i) => G.apiRegistrarEquipo(sim.codigo, { nombreEquipo: n, clave: 'Clave#' + (1000 + i), integrantes: [est(i, String(218100 + i))] }));
G.apiRegistrarEquipo(simOld.codigo, { nombreEquipo: 'Antiguo', clave: 'Clave#9999', integrantes: [est(9, '218999')] });
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
const dec1 = { comite: [{ nombre: 'Jefa', cargo: 'jefe', dedicacion: 0.1 }, { nombre: 'Analista', cargo: 'profesional', dedicacion: 0.45 }], proyectos: [proyecto], comercial: {}, estudioMercado: true };
const rev = G.apiEstimar(tok[0], dec1);
ok(rev.errores.length === 0, 'la vista previa no encuentra errores' + (rev.errores.length ? ': ' + rev.errores.join(' | ') : ''));
ok(rev.costosTrimestre.estudios === 59200 * 3, 'costo de estudios del trimestre: mercado + consumidor + prueba = ' + fmt(rev.costosTrimestre.estudios));
// errores que el servidor no deja pasar aunque el navegador los permita
const malo = JSON.parse(JSON.stringify(dec1)); malo.proyectos[0].gantt[0].duracion = 2; malo.comite[1].dedicacion = 0.2;
falla(() => G.apiGuardar(tok[0], malo, true), 'corrijan', 'el servidor rechaza un Gantt inválido al enviar');
falla(() => G.apiGuardar(tok[0], { comercial: { [pid]: { precioEmpresa: -5, mezcla: { supermercado: 1 }, publicidad: 0 } } }, true), 'corrijan', 'el servidor rechaza un precio negativo');
G.apiGuardar(tok[0], dec1, true);
// equipo 2: baja publicidad y vende en tiendas; equipo 3 no envía nada
G.apiGuardar(tok[1], { comercial: { [G.apiEstado(tok[1]).empresa.productos[0].id]: { precioEmpresa: precio * 1.05, mezcla: { tienda: 1 }, publicidad: pubRef * 0.5, produccionSemanal: null } }, comite: [{ nombre: 'Uno', cargo: 'profesional', dedicacion: 0.2 }] }, true);

for (let t = 1; t <= 12; t++) {
  const r = G.apiAdmin(adm, 'procesar', { simId: sim.simId });
  if (!r.ok) { ok(false, 'procesar T' + t + ': ' + r.mensaje); break; }
  (r.eventos || []).forEach((e) => console.log('   evento:', JSON.stringify(e)));
  if (t < 12) {
    // el equipo 1 vuelve a enviar su plan (sin cambios) cada trimestre
    const Vt = G.apiEstado(tok[0]);
    const d = { comite: Vt.innov.comite, proyectos: Vt.innov.proyectos, comercial: {}, estudioMercado: false };
    const rr = G.apiEstimar(tok[0], d);
    if (rr.errores.length) console.log('   errores T' + (t + 1) + ':', rr.errores.join(' | '));
    G.apiGuardar(tok[0], d, rr.errores.length === 0);
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
// el motor anterior sigue funcionando
G.apiAdmin(adm, 'abrir', { simId: simOld.simId });
const ro = G.apiAdmin(adm, 'procesar', { simId: simOld.simId });
ok(ro.ok, 'la simulación con el motor anterior procesa normalmente');
console.log(fallas ? `\n${fallas} FALLAS` : '\nTodas las pruebas pasaron');
process.exit(fallas ? 1 : 0);
