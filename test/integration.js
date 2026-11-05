// Prueba integral v1.1: dos simulaciones, autorregistro, activación, ingreso con registro + PIN y 20 trimestres.
const { makeGas } = require('./gasmock');
const G = makeGas();
G.instalar();
const adm = G.apiLoginDocente(G.cfgGet_('CLAVE_DOCENTE')).token;
const s1 = G.apiAdmin(adm, 'crearSimulacion', { nombre: 'Innovación — Grupo T', sigla: 'COM505T', maxIntegrantes: 5, mandato: 'MA' });
const s2 = G.apiAdmin(adm, 'crearSimulacion', { nombre: 'Juego de Negocios — D', sigla: 'COM540D', maxIntegrantes: 3, mandato: 'aleatorio' });
console.log(s1.mensaje, '|', s2.mensaje);
function expectErr(fn, txt) { try { fn(); console.log('FALLO: se esperaba error', txt); process.exitCode = 1; } catch (e) { if (!String(e.message).includes(txt)) { console.log('FALLO: error distinto', e.message); process.exitCode = 1; } } }
const est = (n, reg) => ({ apPaterno: 'Pérez', apMaterno: 'Rojas', nombres: 'Ana ' + n, registro: reg, celular: '7' + String(1000000 + Number(reg) % 9000000) });
// registro de equipos en S1
const r1 = G.apiRegistrarEquipo(s1.codigo, { nombreEquipo: 'Halcones', pin: '1234', integrantes: [est(1, '218001'), est(2, '218002'), est(3, '218003')] });
const r2 = G.apiRegistrarEquipo(s1.codigo.toLowerCase(), { nombreEquipo: 'Jaguares', pin: '4321', integrantes: [est(4, '218004')] });
const r3 = G.apiRegistrarEquipo(s1.codigo, { nombreEquipo: 'Parabas', pin: '5555', integrantes: [est(5, '218005'), est(6, '218006')] });
// validaciones
expectErr(() => G.apiRegistrarEquipo(s1.codigo, { nombreEquipo: 'Halcones', pin: '1111', integrantes: [est(7, '218007')] }), 'Ya existe un equipo');
expectErr(() => G.apiRegistrarEquipo(s1.codigo, { nombreEquipo: 'Otro', pin: '1111', integrantes: [est(7, '218001')] }), 'ya pertenece');
expectErr(() => G.apiRegistrarEquipo(s1.codigo, { nombreEquipo: 'Otro', pin: '1111', integrantes: [{ ...est(7, '218007'), celular: '123' }] }), 'teléfono');
expectErr(() => G.apiRegistrarEquipo(s2.codigo, { nombreEquipo: 'Grande', pin: '1111', integrantes: [est(1, '1'), est(2, '300002'), est(3, '300003'), est(4, '300004')] }), 'Máximo 3');
expectErr(() => G.apiRegistrarEquipo('XXXXXX', { nombreEquipo: 'Otro', pin: '1111', integrantes: [est(7, '218007')] }), 'no es válido');
// el mismo estudiante en otra simulación
G.apiRegistrarEquipo(s2.codigo, { nombreEquipo: 'Cóndores', pin: '1234', integrantes: [est(1, '218001'), est(9, '300009')] });
// login con varias simulaciones
const L = G.apiLogin('218001', '1234'); console.log('Elegir simulación:', JSON.stringify(L.elegir.map(x => x.sigla + '/' + x.equipo)));
const tokA = G.apiLogin('218001', '1234', L.elegir[0].simId).token;
const tokB = G.apiActivar(s1.codigo, '218002', '2222').token;
console.log('Login 218002:', !!G.apiLogin('218002', '2222').token);
// el equipo agrega un integrante; el docente bloquea la edición
console.log(G.apiAXMiEquipo(r2.token, 'agregar', est(8, '218008')).mensaje);
console.log('Mi equipo Jaguares:', G.apiMiEquipo(r2.token).integrantes.map(i => i.registro).join(','));
const eqJ = G.equiposDe_('S01').filter(e => e.nombre === 'Jaguares')[0];
G.apiAXEquipos(adm, 'bloquear', { simId: 'S01', equipoId: eqJ.equipoId, valor: true });
expectErr(() => G.apiAXMiEquipo(r2.token, 'agregar', est(9, '218009')), 'bloqueó');
G.apiAdmin(adm, 'editarSimulacion', { simId: 'S01', registroAbierto: false });
expectErr(() => G.apiRegistrarEquipo(s1.codigo, { nombreEquipo: 'Tarde', pin: '1111', integrantes: [est(7, '218007')] }), 'cerrado');
// docente: corregir datos
console.log(G.apiAdmin(adm, 'editarIntegrante', { simId: 'S01', registroOriginal: '218003', apPaterno: 'Gómez', apMaterno: '', nombres: 'Luis', registro: '218003', celular: '69999999' }).mensaje);
const res = G.apiAdmin(adm, 'resumen', { simId: 'S01' });
console.log('Resumen S01:', res.equipos.map(e => e.nombre + '[' + e.mandato + '](' + e.integrantes.length + ')').join(' '));
// jugar 20 trimestres en S01 y 4 en S02
const toks = [r1.token, r2.token, r3.token];
G.apiAdmin(adm, 'abrir', { simId: 'S01' }); G.apiAdmin(adm, 'abrir', { simId: 'S02' });
for (let t = 1; t <= 20; t++) {
  toks.forEach((tk, i) => {
    const v = G.apiEstado(tk);
    const d = { noticias: {}, proyectos: {}, productos: {}, hipotesis: 'Hipótesis de prueba del equipo para el trimestre ' + t };
    v.noticias.forEach(n => d.noticias[n.id] = 'amenaza');
    if (v.flags.anualEditable) d.anual = { p4: { producto: 40, proceso: 20, posicion: 20, paradigma: 20 }, inc: 50, rad: 50, act: 60, nue: 40, estructura: 'autonoma', tiempoLibre: 10, incentivo: 'reconocimiento', politica: 'aprendizaje', composicion: 'multifuncional', capacitacion: t === 1, umbral: 'moderado' };
    if (t === 1) d.investigacion = { metodos: ['observacion'], segmentos: ['S2', 'S3'] };
    const act = v.estado.proyectos.filter(p => p.estado === 'activo');
    if (!act.length && t < 18 && i < 2) d.nuevosProyectos = [{ nombre: 'P' + t, base: 'nuevo', segmento: i ? 'S4' : 'S2' }];
    act.forEach(p => { const a = {};
      if (p.etapa === 'ideacion') { if (!p.pool.length) a.iniciativas = [{ id: 'taller' }, { id: 'redes', premio: 'medio' }]; else { a.validar = p.pool.slice(0, 5).map(x => x.pid); a.seleccionar = 'mejorValidada'; a.prototipo = { fidelidad: 'baja', iteraciones: 3 }; } }
      else if (p.etapa === 'prototipo') { if (p.puerta < 6 && p.iter < 4) a.prototipo = { fidelidad: 'baja', iteraciones: 1 }; else if (p.puerta < 6) a.detener = true; else a.lanzar = { nombre: 'L' + t, precio: 5.4, canales: ['kiosco', 'delivery', 'super'], proteccion: 'activos', comunicacion: 20000 }; }
      d.proyectos[p.id] = a; });
    d.decInformes = {}; (G.apiEstado(tk).estado.informes || []).filter(x => x.requiere && x.t === t - 1).forEach(x => { d.decInformes[x.id] = 'Usamos el dato para ajustar el proyecto.'; });
    G.apiGuardar(i === 0 && t === 3 ? tokA : tk, d, true);
  });
  const r = G.apiAdmin(adm, 'procesar', { simId: 'S01' });
  if (!r.ok) console.log('ERROR', r.mensaje);
  if (t <= 4) G.apiAdmin(adm, 'procesar', { simId: 'S02' });
}
const dec3 = G.rows_('Decisiones').filter(d => d.equipoId === 'S01-E01' && Number(d.trimestre) === 3)[0];
console.log('Decisión T3 enviada por:', dec3.enviadoPor);
const rk = G.apiAdmin(adm, 'ranking', { simId: 'S01' }); rk.filas.forEach(f => console.log('  ', f.nombre, f.puntaje, Math.round(f.valor / 1000) + 'k'));
console.log('Simulaciones:', JSON.stringify(G.apiAdmin(adm, 'simulaciones', {}).lista.map(s => [s.codigo, s.sigla, 'T' + s.t, s.equipos, s.integrantes])));
console.log('Resultados S02:', G.apiAdmin(adm, 'resultados', { simId: 'S02' }).length, '| S01:', G.apiAdmin(adm, 'resultados', { simId: 'S01' }).length);
G.apiBitacora(G.apiActivar(s1.codigo, '218002', '7777').token, { decidimos: 'a', paso: 'b', porque: 'c', principio: 'd' });
console.log('Bitácoras S01:', G.apiAdmin(adm, 'bitacoras', { simId: 'S01' }).map(b => b.equipoId + ' T' + b.trimestre + ' por ' + b.autor).join(', '));
console.log('Reiniciar S02:', G.apiAdmin(adm, 'reiniciar', { simId: 'S02', confirmar: 'REINICIAR' }).mensaje, '| S01 intacta:', G.apiAdmin(adm, 'resultados', { simId: 'S01' }).length);
console.log('Sin PIN legibles:', G.rows_('Integrantes').every(i => !i.pin));
console.log(process.exitCode ? 'CON FALLOS' : 'TODO OK');
