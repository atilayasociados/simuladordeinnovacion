// Archivar, respaldo, restauración y eliminación de simulaciones.
const { makeGas } = require('./gasmock');
const G = makeGas(); G.instalar();
const adm = G.apiLoginDocente(G.cfgGet_('CLAVE_DOCENTE')).token;
const ok = (c, m) => { if (!c) { console.log('FALLA: ' + m); process.exit(1); } console.log('OK  ' + m); };
const s1 = G.apiAdmin(adm, 'crearSimulacion', { nombre: 'Grupo A', sigla: 'COM505T', maxIntegrantes: 5, mandato: 'MA' });
const s2 = G.apiAdmin(adm, 'crearSimulacion', { nombre: 'Grupo B', sigla: 'COM505T', maxIntegrantes: 5, mandato: 'MA' });
['Halcones', 'Pumas'].forEach((n, i) => G.apiRegistrarEquipo(s1.codigo, { nombreEquipo: n, pin: 'clave' + i, integrantes: [{ apPaterno: 'P' + i, apMaterno: 'R', nombres: 'Ana', registro: '21800' + i, celular: '' }] }));
G.apiRegistrarEquipo(s2.codigo, { nombreEquipo: 'Otros', pin: 'otra1', integrantes: [{ apPaterno: 'X', apMaterno: 'Y', nombres: 'Luis', registro: '219000', celular: '' }] });
G.apiAdmin(adm, 'abrir', { simId: s1.simId });
const tk = (i) => G.apiLogin('21800' + i, 'clave' + i, s1.simId).token;
for (let t = 1; t <= 3; t++) {
  [0, 1].forEach((i) => { const v = G.apiEstado(tk(i)); const dec = { hipotesis: 'Hipótesis del trimestre ' + t, productos: {}, decInformes: {} };
    v.estado.informes.filter(x => x.requiere && x.t === t - 1).forEach(x => { dec.decInformes[x.id] = 'Decisión tomada con el informe.'; });
    if (t === 1) dec.investigacion = { metodos: ['encuesta'], segmentos: ['S2'] };
    G.apiGuardar(tk(i), dec, true); });
  G.apiBitacora && 0;
  G.apiAdmin(adm, 'procesar', { simId: s1.simId });
}
const antes = G.apiAdmin(adm, 'resultados', { simId: s1.simId });
const estAntes = JSON.stringify(G.apiEstado(tk(0)).estado.hist);
const tokViejo = tk(0);
// 1) respaldo
const R = JSON.parse(JSON.stringify(G.apiAdmin(adm, 'respaldo', { simId: s1.simId })));
ok(R.tipo === 'simulador-innovacion-respaldo' && R.simulacion.equipos === 2 && R.tablas.Estados.filas.length === 6 && R.tablas.Resultados.filas.length === 6, 'respaldo con 2 equipos, 6 estados y 6 resultados');
ok(!JSON.stringify(R).includes('219000'), 'el respaldo no incluye datos de otra simulación');
// 2) eliminar exige el código
let err = ''; try { G.apiAdmin(adm, 'eliminarSimulacion', { simId: s1.simId, confirmar: 'XXXX' }); } catch (e) { err = e.message; }
ok(/escriba exactamente el código/.test(err), 'eliminar sin el código correcto se rechaza');
G.apiAdmin(adm, 'eliminarSimulacion', { simId: s1.simId, confirmar: s1.codigo.toLowerCase() });
ok(!G.simById_(s1.simId) && G.rows_('Equipos').every(e => e.simId !== s1.simId) && G.rows_('Estados').every(e => String(e.equipoId).indexOf(s1.simId + '-') !== 0) && G.rows_('Integrantes').every(x => x.simId !== s1.simId), 'eliminar borra simulación, equipos, integrantes y estados');
ok(G.simById_(s2.simId) && G.rows_('Equipos').some(e => e.simId === s2.simId), 'la otra simulación sigue intacta');
err = ''; try { G.apiEstado(tokViejo); } catch (e) { err = e.message; } ok(/ya no está disponible|expiró/.test(err), 'la sesión de un equipo eliminado deja de funcionar: ' + err);
// 3) una simulación nueva no reutiliza el id eliminado
const s3 = G.apiAdmin(adm, 'crearSimulacion', { nombre: 'Grupo C', sigla: 'X', maxIntegrantes: 5, mandato: 'MA' });
ok(s3.simId !== s1.simId, 'la simulación nueva no reutiliza el id eliminado (' + s3.simId + ')');
// 4) restaurar (id libre → mismo id y mismo código)
const r1 = G.apiAdmin(adm, 'restaurarSimulacion', { respaldo: R });
ok(r1.simId === s1.simId && r1.codigo === s1.codigo, 'restaurar recrea el mismo id y código: ' + r1.mensaje);
ok(G.simById_(s1.simId).acceso === 'cerrada', 'queda con el acceso cerrado');
G.apiAdmin(adm, 'acceso', { simId: s1.simId, valor: 'activa' });
const despues = G.apiAdmin(adm, 'resultados', { simId: s1.simId });
ok(JSON.stringify(despues) === JSON.stringify(antes), 'resultados idénticos tras restaurar');
ok(JSON.stringify(G.apiEstado(tk(0)).estado.hist) === estAntes, 'el equipo ingresa con su contraseña y ve su historia idéntica');
// seguir jugando después de restaurar
G.apiAdmin(adm, 'abrir', { simId: s1.simId });
[0, 1].forEach((i) => { const v = G.apiEstado(tk(i)); const dec = { hipotesis: 'Hipótesis del trimestre 4', productos: {}, decInformes: {} }; v.estado.informes.filter(x => x.requiere && x.t === 3).forEach(x => { dec.decInformes[x.id] = 'Decisión tomada con el informe.'; }); G.apiGuardar(tk(i), dec, true); });
const pr = G.apiAdmin(adm, 'procesar', { simId: s1.simId }); ok(/procesado/.test(pr.mensaje), 'se puede procesar el T4 después de restaurar');
// 5) restaurar otra vez mientras existe → copia con id y código nuevos
const r2 = G.apiAdmin(adm, 'restaurarSimulacion', { respaldo: JSON.stringify(R) });
ok(r2.simId !== s1.simId && r2.codigo !== s1.codigo && /restaurada/.test(G.simById_(r2.simId).nombre), 'restaurar una que existe crea una copia: ' + r2.simId + ' ' + r2.codigo);
const eqCopia = G.rows_('Equipos').filter(e => e.simId === r2.simId);
ok(eqCopia.length === 2 && eqCopia.every(e => e.equipoId.indexOf(r2.simId + '-E') === 0), 'equipos de la copia con ids propios');
ok(G.rows_('Estados').filter(e => String(e.equipoId).indexOf(r2.simId + '-') === 0).length === 6, 'estados de la copia con ids propios');
const st = G.getJson_('Estados', r2.simId + '-E01', 3); ok(st && st.hist.length === 3 && !JSON.stringify(st).includes('"' + s1.simId + '-E'), 'el contenido del estado copiado no apunta a la original');
G.apiAdmin(adm, 'acceso', { simId: r2.simId, valor: 'activa' });
const lc = G.apiLoginEquipo ? null : null;
// 6) archivar
const lgAntes = G.apiAXLogin('Halcones', 'clave0', s1.codigo); ok(!!(lgAntes && (lgAntes.token || lgAntes.quien || lgAntes.ok)), 'antes de archivar, el ingreso real funciona');
const abierta = tk(0);
G.apiAdmin(adm, 'archivar', { simId: s1.simId });
err = ''; try { G.apiEstado(abierta); } catch (e) { err = e.message; } ok(/archivada/.test(err), 'archivada: una sesión abierta queda bloqueada (' + err + ')');
const lg = (() => { try { return G.apiAXLogin('Halcones', 'clave0', s1.codigo); } catch (e) { return { error: e.message }; } })(); ok(!lg.token, 'archivada: no se puede iniciar sesión (' + (lg.error || lg.mensaje || JSON.stringify(lg)).slice(0, 80) + ')');
const L = G.apiAdmin(adm, 'simulaciones').lista; ok(L.find(x => x.simId === s1.simId).acceso === 'archivada', 'aparece como archivada en la lista');
G.apiAdmin(adm, 'desarchivar', { simId: s1.simId }); G.apiAdmin(adm, 'acceso', { simId: s1.simId, valor: 'activa' });
ok(G.apiEstado(tk(0)).estado.hist.length === 4, 'desarchivar y activar: el equipo vuelve a ingresar con sus datos');
// 7) archivo inválido
err = ''; try { G.apiAdmin(adm, 'restaurarSimulacion', { respaldo: { tipo: 'otro' } }); } catch (e) { err = e.message; } ok(/no es un respaldo válido/.test(err), 'un archivo que no es respaldo se rechaza');
console.log('RESPALDO OK');
