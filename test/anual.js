// Estrategia anual: empieza en blanco y es obligatoria para enviar al inicio de cada año.
process.env.ANUAL_ESTRICTO = '1';
const { makeGas } = require('./gasmock');
const G = makeGas(); G.instalar();
const adm = G.apiLoginDocente(G.cfgGet_('CLAVE_DOCENTE')).token;
const ok = (c, m) => { if (!c) { console.log('FALLA: ' + m); process.exit(1); } console.log('OK  ' + m); };
const s1 = G.apiAdmin(adm, 'crearSimulacion', { nombre: 'Anual', sigla: 'COM505T', maxIntegrantes: 5, mandato: 'MA' });
G.apiRegistrarEquipo(s1.codigo, { nombreEquipo: 'Halcones', pin: 'clave1', integrantes: [{ apPaterno: 'P', apMaterno: 'R', nombres: 'Ana', registro: '316001', celular: '' }] });
G.apiAdmin(adm, 'abrir', { simId: s1.simId });
const tk = G.apiLogin('316001', 'clave1', s1.simId).token;
const base = { hipotesis: 'Hipótesis del trimestre uno para probar.', productos: {}, decInformes: {} };
let err = ''; try { G.apiGuardar(tk, Object.assign({}, base), true); } catch (e) { err = e.message; }
ok(/completen la Estrategia anual/.test(err) && /las 4P/.test(err) && /la postura/.test(err), 'sin estrategia anual no se puede enviar: ' + err.slice(0, 120));
const blanco = { p4: { producto: '', proceso: '', posicion: '', paradigma: '' }, nucleo: '', adyacente: '', transf: '', postura: '', estructura: '', tiempoLibre: '', incentivo: '', politica: '', composicion: '', capacitacion: '', umbral: '', hipotesis: '' };
const est = G.apiEstimar ? G.apiEstimar(tk, Object.assign({}, base, { anual: blanco })) : null;
if (est) ok(est.costo === 0 && est.avisos.some(a => /Estrategia anual: falta completar/.test(a)), 'con todo en blanco el costo estimado es 0 y avisa lo que falta');
const A = { p4: { producto: 50, proceso: 10, posicion: 30, paradigma: 10 }, nucleo: 60, adyacente: 30, transf: 10, postura: 'ofensiva', estructura: 'autonoma', tiempoLibre: 0, incentivo: 'reconocimiento', politica: 'aprendizaje', composicion: 'multifuncional', capacitacion: 'no', umbral: 'estricto', hipotesis: 'Con 30 % adyacente lanzaremos un producto para S2 antes de T8.' };
err = ''; try { G.apiGuardar(tk, Object.assign({}, base, { anual: Object.assign({}, A, { nucleo: 70 }) }), true); } catch (e) { err = e.message; } ok(/portafolio debe sumar 100/.test(err), 'el portafolio debe sumar 100 %');
const r = G.apiGuardar(tk, Object.assign({}, base, { anual: A }), true); ok(r && !r.error, 'con la estrategia completa se envía');
G.apiAdmin(adm, 'procesar', { simId: s1.simId });
const O = G.apiEstado(tk).estado.org;
ok(O.nucleo === 60 && O.adyacente === 30 && O.estructura === 'autonoma' && O.tiempoLibre === 0 && O.umbral === 'estricto' && O.p4.producto === 50 && !O.capHasta, 'el motor aplica exactamente lo que eligió el equipo (tiempo libre 0, sin capacitación)');
// T2 no exige estrategia anual
const v2 = G.apiEstado(tk); const d2 = { hipotesis: 'Hipótesis del trimestre dos para probar.', productos: {}, decInformes: {} };
v2.estado.informes.filter(x => x.requiere && x.t === 1).forEach(x => { d2.decInformes[x.id] = 'Decisión con el informe.'; });
ok(!G.apiGuardar(tk, d2, true).error, 'en T2 no se pide la estrategia anual');
console.log('ANUAL OK');
