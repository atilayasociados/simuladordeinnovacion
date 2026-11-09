// Pruebas del servidor en Supabase con una base de datos en memoria (misma semántica que el SQL).
// Repite las pruebas de aceptación 1–8 del acceso v2.3 contra el núcleo de la Edge Function
// y mide el tiempo de cada acción y el procesamiento de un trimestre con 10 equipos.
// Uso: node test/nucleo.test.mjs
import { crearNucleo } from '../supabase/functions/api/nucleo.js';
import { CODIGO } from '../supabase/functions/api/gas_codigo.js';
import { crearMemoria } from './memoria.mjs';
import { sembrar } from '../tools/semilla.mjs';

const mem = crearMemoria();
const sa = await sembrar(mem, 'jdavidatila@gmail.com');
const n = crearNucleo({ codigo: CODIGO, adaptador: mem, entorno: { correoSuperadmin: 'jdavidatila@gmail.com', urlPublica: 'https://ejemplo.github.io/simulador/' } });
const tiempos = {}, pasadas = {};
async function api(fn, ...a) {
  const t = Date.now();
  try { const r = await n.ejecutar(fn, a); (pasadas[fn] = pasadas[fn] || []).push(r.medidas.pasadas); return r.resultado; }
  finally { (tiempos[fn] = tiempos[fn] || []).push(Date.now() - t); }
}
const R = []; let fallos = 0;
async function prueba(k, nombre, fn) { try { const d = await fn(); R.push([k, nombre, 'OK', d || '']); } catch (e) { fallos++; R.push([k, nombre, 'FALLA', e.stack || e.message]); } }
function exige(c, m) { if (!c) throw new Error(m); }
async function falla(p, txt) { try { await p(); } catch (e) { if (txt && !String(e.message).includes(txt)) throw new Error('error distinto: ' + e.message); return e.message; } throw new Error('se esperaba un error'); }
const filas = (t) => mem.tablas[t] || [];
const ADM = 'jdavidatila@gmail.com';

let adm, sim;
await prueba(0, 'Base vacía + semilla: el superadmin entra con la temporal y debe cambiarla', async () => {
  const ini = await api('apiAXInicio', '');
  exige(Array.isArray(ini.logos) && ini.logos.length === 3, 'apiAXInicio sin logos');
  const L = await api('apiAXLogin', ADM, sa.temporal);
  exige(L.cambiarClave && L.tipo === 'docente', 'no obliga a cambiar la temporal');
  await falla(() => api('apiAdmin', L.token, 'simulaciones', {}), 'temporal');
  await api('apiAXCambiarClave', L.token, sa.temporal, 'Super#2026');
  adm = (await api('apiAXLogin', ADM, 'Super#2026')).token;
  sim = await api('apiAdmin', adm, 'crearSimulacion', { nombre: 'Innovación — Grupo U', sigla: 'COM505T', maxIntegrantes: 5, mandato: 'MA' });
  exige(sim && sim.simId === 'S01', 'no creó la simulación');
  return 'superadmin ' + ADM + '; simulación ' + sim.simId + ' código ' + sim.codigo;
});
const est = (k, reg, cel) => ({ apPaterno: 'Pérez', apMaterno: 'Rojas', nombres: 'Ana ' + k, registro: reg, celular: cel || '' });

await prueba(1, 'Registrar un equipo con código válido y 3 integrantes', async () => {
  const info = await api('apiAXInfoCodigo', sim.codigo.toLowerCase());
  exige(info.ok && /Grupo U/.test(info.nombre), 'validación en vivo del código');
  const r = await api('apiRegistrarEquipo', sim.codigo, { nombreEquipo: 'Halcones', clave: 'vuelo1', confirmar: 'vuelo1', integrantes: [est(1, '218001', '71234567'), est(2, '218002'), est(3, '218003')] });
  exige(filas('equipos').length === 1 && filas('integrantes').length === 3, 'no quedó guardado en la base');
  exige(filas('equipos')[0].sim_id === 'S01' && filas('integrantes').every((x) => x.sim_id === 'S01'), 'columnas de filtro mal');
  const v = await api('apiEstado', r.token);
  exige(v.equipo.nombre === 'Halcones' && v.usuario.registro === '218001', 'no entra directamente');
  return 'equipo ' + filas('equipos')[0].k1 + ' con 3 integrantes; entra directo como 218001';
});
await prueba(2, 'Código inválido o nombre repetido: error y no crea nada', async () => {
  const a = filas('equipos').length, b = filas('integrantes').length;
  exige(!(await api('apiAXInfoCodigo', 'INN-ZZZZ')).ok, 'código inválido aceptado');
  const m1 = await falla(() => api('apiRegistrarEquipo', 'INN-ZZZZ', { nombreEquipo: 'Otro', clave: '1234', integrantes: [est(7, '218007')] }), 'no es válido');
  const m2 = await falla(() => api('apiRegistrarEquipo', sim.codigo, { nombreEquipo: 'HALCONES', clave: '1234', integrantes: [est(8, '218008')] }), 'Ya existe');
  exige(filas('equipos').length === a && filas('integrantes').length === b, 'se creó algo');
  return '«' + m1 + '» · «' + m2 + '»';
});
await prueba(3, '5 intentos fallidos: bloqueo temporal (los intentos se guardan aunque la petición falle)', async () => {
  for (let i = 0; i < 5; i++) await falla(() => api('apiAXLogin', 'Halcones', 'mala' + i, sim.codigo), 'no son correctos');
  const m = await falla(() => api('apiAXLogin', 'Halcones', 'vuelo1', sim.codigo), 'Demasiados intentos');
  const md = [];
  for (let i = 0; i < 5; i++) md.push(await falla(() => api('apiAXLogin', ADM, 'x' + i)));
  await falla(() => api('apiAXLogin', ADM, 'Super#2026'), 'Demasiados intentos');
  exige(md.every((x) => x === md[0]), 'los mensajes revelan algo distinto');
  const hace16 = new Date(Date.now() - 16 * 60000).toISOString();
  filas('intentos_login').forEach((r) => { r.fila[1] = { $d: hace16 }; r.ts = hace16; });
  exige(!!(await api('apiAXLogin', 'Halcones', 'vuelo1', sim.codigo)).token, 'no se desbloquea después de 15 minutos');
  adm = (await api('apiAXLogin', ADM, 'Super#2026')).token;
  return '«' + m + '»; mismo mensaje para usuario o contraseña («' + md[0] + '»)';
});
await prueba(4, 'Contraseña temporal: obliga a cambiarla', async () => {
  const eqId = filas('equipos')[0].k1;
  const t = (await api('apiAXEquipos', adm, 'claveTemporal', { simId: sim.simId, equipoId: eqId })).clave;
  const L = await api('apiAXLogin', 'halcones', t, sim.codigo);
  exige(L.cambiarClave, 'no marca el cambio obligatorio');
  await falla(() => api('apiEstado', L.token), 'temporal');
  await falla(() => api('apiAXElegir', L.token, '218002'), 'temporal');
  await api('apiAXCambiarClave', L.token, t, 'nueva22');
  await api('apiAXElegir', L.token, '218002');
  exige((await api('apiEstado', L.token)).usuario.registro === '218002', 'no entra después de cambiarla');
  await falla(() => api('apiAXLogin', 'Halcones', t, sim.codigo), 'no son correctos');
  return 'la temporal ' + t + ' solo sirve para crear una nueva';
});
let tokProf;
await prueba(5, 'Invitación usada o vencida: se rechaza; recuperación por pregunta', async () => {
  const inv = await api('apiAXDocentes', adm, 'invitar', { pregunta: '¿Ciudad donde nació?', rol: 'profesor' });
  exige(inv.enlace.startsWith('https://ejemplo.github.io/simulador/'), 'el enlace no usa la dirección pública: ' + inv.enlace);
  const tok = inv.enlace.split('invitacion=')[1];
  exige((await api('apiAXInvitacion', tok)).ok, 'invitación nueva no válida');
  tokProf = (await api('apiAXAlta', tok, { nombre: 'Prof. Luis Rojas', email: 'luis@uagrm.edu.bo', clave: 'Profe#01', confirmar: 'Profe#01', respuesta: 'Montero' })).token;
  const m1 = await falla(() => api('apiAXAlta', tok, { nombre: 'Otra Persona', email: 'otra@uagrm.edu.bo', clave: 'Profe#02', respuesta: 'x y' }), 'ya fue usado');
  const inv2 = await api('apiAXDocentes', adm, 'invitar', { pregunta: '¿Color favorito?', rol: 'profesor' });
  const tok2 = inv2.enlace.split('invitacion=')[1];
  const f = filas('invitaciones').find((r) => r.fila[0] === 'INV002'); const antes = new Date(Date.now() - 60000).toISOString(); f.fila[6] = { $d: antes }; f.ts = antes;
  const e2 = await api('apiAXInvitacion', tok2);
  exige(!e2.ok && /venció/.test(e2.mensaje), 'la vencida no se rechaza');
  exige(!(await api('apiAXInvitacion', 'no-existe')).ok, 'un enlace inventado se acepta');
  exige((await api('apiAXPregunta', 'luis@uagrm.edu.bo')).pregunta === '¿Ciudad donde nació?', 'no muestra la pregunta');
  await falla(() => api('apiAXRecuperar', 'luis@uagrm.edu.bo', 'Warnes', 'Nueva#99'), 'no es correcta');
  await api('apiAXRecuperar', 'luis@uagrm.edu.bo', '  montero ', 'Nueva#99');
  tokProf = (await api('apiAXLogin', 'luis@uagrm.edu.bo', 'Nueva#99')).token;
  return '«' + m1 + '» · «' + e2.mensaje + '»';
});
await prueba(6, 'Ninguna contraseña legible en la base de datos', async () => {
  const sec = [sa.temporal, 'Super#2026', 'vuelo1', 'nueva22', 'Profe#01', 'Nueva#99', 'Montero', 'montero'];
  const hall = [];
  Object.keys(mem.tablas).forEach((t) => mem.tablas[t].forEach((r) => { const v = JSON.stringify(r); sec.forEach((s) => { if (v.includes(s)) hall.push(t + '#' + r.id + ': ' + s); }); }));
  exige(!hall.length, 'texto legible: ' + hall.join(', '));
  const d = filas('docentes')[0].fila;
  exige(/^[0-9a-f]{64}$/.test(d[4]) && d[5], 'no es SHA-256 con sal');
  return Object.keys(mem.tablas).length + ' tablas revisadas';
});
await prueba(7, 'Un profesor no ve las simulaciones de otro', async () => {
  const propia = await api('apiAdmin', tokProf, 'crearSimulacion', { nombre: 'Juego de Negocios — D', sigla: 'COM540D', maxIntegrantes: 3, mandato: 'MA' });
  const lp = (await api('apiAdmin', tokProf, 'simulaciones', {})).lista.map((s) => s.simId);
  exige(lp.length === 1 && lp[0] === propia.simId, 'el profesor ve otras: ' + lp);
  await falla(() => api('apiAdmin', tokProf, 'resumen', { simId: sim.simId }), 'no encontrada');
  await falla(() => api('apiAXEquipos', tokProf, 'listar', { simId: sim.simId }), 'no encontrada');
  await falla(() => api('apiAXDocentes', tokProf, 'listar'), 'superadministrador');
  const ls = (await api('apiAdmin', adm, 'simulaciones', {})).lista;
  exige(ls.length === 2, 'el superadmin no ve todas');
  return 'profesor ve 1; superadmin ve ' + ls.length;
});
const sen = (v) => Object.fromEntries((v.noticias || []).map((n) => [n.id, { cred: 'dudosa', postura: 'ignorar' }]));
await prueba(8, 'Pantalla de trabajo, envío y procesamiento del trimestre', async () => {
  const tk = (await api('apiAXLogin', 'Halcones', 'nueva22', sim.codigo)).token; await api('apiAXElegir', tk, '218003');
  await api('apiAdmin', adm, 'abrir', { simId: sim.simId });
  const v = await api('apiEstado', tk);
  exige(v.partida && v.estado && v.cat && v.usuario.registro === '218003', 'falta la pantalla de trabajo');
  await api('apiGuardar', tk, { senales: sen(v), anual: { p4: { producto: 40, proceso: 20, posicion: 20, paradigma: 20 }, nucleo: 70, adyacente: 20, transf: 10, postura: 'ofensiva', estructura: 'integrada', tiempoLibre: 10, incentivo: 'reconocimiento', politica: 'aprendizaje', composicion: 'multifuncional', capacitacion: 'no', umbral: 'moderado', hipotesis: 'Hipótesis anual de prueba con más de veinte caracteres.' }, noticias: {}, proyectos: {}, productos: {}, hipotesis: 'Hipótesis de prueba del acceso nuevo para el trimestre 1' }, true);
  const p = await api('apiAdmin', adm, 'procesar', { simId: sim.simId });
  exige(p.ok, 'no procesó: ' + p.mensaje);
  const v2 = await api('apiEstado', tk);
  exige(v2.partida.t === 2 && v2.estado.hist.length === 1, 'no avanzó el trimestre');
  const dec = filas('decisiones').find((r) => r.k2 === 1);
  exige(dec && dec.fila.includes('218003'), 'no conserva quién envió');
  await api('apiAXSalir', tk); await falla(() => api('apiEstado', tk), 'expiró');
  return 'T1 enviado por 218003 y procesado; Estados guardados: ' + filas('estados').length + ' filas';
});
await prueba(10, 'Carga: 10 equipos, 3 trimestres', async () => {
  const s = await api('apiAdmin', adm, 'crearSimulacion', { nombre: 'Carga', sigla: 'COM505T', maxIntegrantes: 3, mandato: 'MA' });
  const toks = [];
  for (let i = 1; i <= 10; i++) toks.push((await api('apiRegistrarEquipo', s.codigo, { nombreEquipo: 'Equipo ' + i, clave: 'clave' + i, confirmar: 'clave' + i, integrantes: [est(i, String(300000 + i * 10 + 1)), est(i, String(300000 + i * 10 + 2))] })).token);
  await api('apiAdmin', adm, 'abrir', { simId: s.simId });
  const proc = [];
  for (let t = 1; t <= 3; t++) {
    for (const tk of toks) { const v = await api('apiEstado', tk); await api('apiGuardar', tk, { senales: sen(v), anual: { p4: { producto: 40, proceso: 20, posicion: 20, paradigma: 20 }, nucleo: 70, adyacente: 20, transf: 10, postura: 'ofensiva', estructura: 'integrada', tiempoLibre: 10, incentivo: 'reconocimiento', politica: 'aprendizaje', composicion: 'multifuncional', capacitacion: 'no', umbral: 'moderado', hipotesis: 'Hipótesis anual de prueba con más de veinte caracteres.' }, noticias: {}, proyectos: {}, productos: {}, hipotesis: 'Hipótesis de carga del trimestre ' + t + ' para medir tiempos' }, true); }
    const a = Date.now(); const p = await api('apiAdmin', adm, 'procesar', { simId: s.simId }); proc.push(Date.now() - a);
    exige(p.ok, 'no procesó T' + t + ': ' + p.mensaje);
    if (t < 3) await api('apiAdmin', adm, 'abrir', { simId: s.simId });
  }
  const v = await api('apiEstado', toks[0]);
  exige(v.partida.t === 4, 'no llegó al T4 (t=' + v.partida.t + ')');
  const kb = Math.round(JSON.stringify(mem.tablas.estados).length / 1024);
  return 'procesar T1–T3: ' + proc.join(' / ') + ' ms; tabla estados ' + kb + ' KB';
});

const prom = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
R.forEach((r) => console.log('Prueba ' + r[0] + ' · ' + r[1] + ': ' + r[2] + (r[3] ? ' — ' + r[3] : '')));
console.log('\nTiempo promedio por acción (núcleo + base en memoria, sin red):');
Object.keys(tiempos).sort().forEach((k) => console.log('  ' + k.padEnd(20) + prom(tiempos[k]) + ' ms (' + tiempos[k].length + ' llamadas, pasadas máx ' + Math.max(...pasadas[k] || [0]) + ')'));
console.log('Base en memoria: ' + JSON.stringify(mem.stats));
console.log(fallos ? 'NÚCLEO CON FALLAS: ' + fallos : 'NÚCLEO OK');
process.exit(fallos ? 1 : 0);
