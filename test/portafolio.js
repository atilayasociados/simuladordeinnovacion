// Estrategia anual v3.2: el portafolio es una meta (sin bloqueo del 20 %) y las 4P son un mapa de búsqueda,
// no un reparto. Al cierre se compara la meta con el gasto real por tipo de proyecto y con las P de los conceptos.
process.env.ANUAL_ESTRICTO = '1';
const { makeGas } = require('./gasmock');
const G = makeGas(); G.instalar();
const adm = G.apiLoginDocente(G.cfgGet_('CLAVE_DOCENTE')).token;
const sim = G.apiAdmin(adm, 'crearSimulacion', { nombre: 'Portafolio', sigla: 'COM505T', maxIntegrantes: 5, mandato: 'MA' });
G.apiRegistrarEquipo(sim.codigo, { nombreEquipo: 'Halcones', pin: '1234', integrantes: [{ apPaterno: 'P', apMaterno: 'R', nombres: 'Ana', registro: '218001', celular: '71234561' }] });
G.apiAdmin(adm, 'abrir', { simId: 'S01' });
const tk = () => G.apiLogin('218001', '1234').token;
let fallas = 0; function ok(c, m) { console.log((c ? 'OK  ' : 'MAL ') + m); if (!c) fallas++; }
const base = (v, t) => { const d = { hipotesis: 'Hipótesis de prueba del trimestre ' + t + '.', productos: {}, decInformes: {}, proyectos: {}, nuevosProyectos: [] }; (v.estado.informes || []).filter(x => x.requiere && x.t === t - 1).forEach(x => { d.decInformes[x.id] = 'Con este dato ajustamos el proyecto.'; }); return d; };
const anual = { mapa4p: { producto: true, proceso: false, posicion: true, paradigma: false, porque: '' }, nucleo: 90, adyacente: 10, transf: 0, postura: 'defensiva', estructura: 'integrada', tiempoLibre: 0, incentivo: 'reconocimiento', politica: 'aprendizaje', composicion: 'multifuncional', capacitacion: 'no', umbral: 'moderado', hipotesis: 'Hipótesis anual de prueba con más de veinte caracteres.' };
let v = G.apiEstado(tk()), d = base(v, 1); d.anual = JSON.parse(JSON.stringify(anual));
let err = ''; try { G.apiGuardar(tk(), d, true); } catch (e) { err = e.message; }
ok(/por qué buscan en esas P/.test(err), 'el mapa de las 4P pide explicar por qué buscan en esas direcciones');
d.anual.mapa4p = { producto: false, proceso: false, posicion: false, paradigma: false, porque: 'Por razones de prueba suficientes.' };
err = ''; try { G.apiGuardar(tk(), d, true); } catch (e) { err = e.message; }
ok(/las 4P \(marquen al menos una/.test(err), 'sin ninguna P marcada no se puede enviar');
d.anual.mapa4p = { producto: true, proceso: false, posicion: true, paradigma: false, porque: 'Buscaremos en producto y en posición para S2.' };
d.nuevosProyectos.push({ nombre: 'Desayuno', segmento: 'S2', tec: 'no', mod: 'no', portafolio: 'adyacente', brief: { cuando: 'salgo temprano', quiero: 'algo rápido', para: 'rendir en clases', reto: '¿Cómo podríamos ayudar a los universitarios a alimentarse bien mientras se trasladan?', criterio: '6 % de S2 en dos trimestres' } });
ok(!G.apiGuardar(tk(), d, true).error, 'con el mapa completo se envía');
G.apiAdmin(adm, 'procesar', { simId: 'S01' });
v = G.apiEstado(tk());
const O = v.estado.org;
ok(O.mapa4p && O.mapa4p.producto && O.mapa4p.posicion && !O.mapa4p.proceso && /posición/.test(O.mapa4p.porque), 'el motor guarda el mapa de las 4P');
ok(O.p4.producto === 50 && O.p4.posicion === 50 && O.p4.proceso === 0, 'para el flujo antiguo de ideas, las P marcadas pesan igual');
const pj = v.estado.proyectos[0];
ok(pj && pj.segmento === 'S2', 'con solo 10 % en adyacente + transformacional el proyecto para un segmento nuevo se crea (sin bloqueo)');
const fb = (v.estado.feedback || []).join(' ');
ok(/meta del año pone menos de 20 %/.test(fb), 'el equipo recibe un aviso factual sobre su meta');
// T2: Idear con ficha de P principal y otras P
d = base(v, 2);
d.proyectos[pj.id] = { fichas: [{ nombre: 'Kiosco', frase: 'Para universitarios que desayunan en el micro, un desayuno en kioscos del campus.', pts: { sab: 2, nut: 3, conv: 5, salud: 0, sost: 0, precio: 0 }, precioObj: 5, tec: 'no', mod: 'no', tipo4p: 'Posición', otras4p: ['Producto', 'Posición', 'Inventada'], test: true }], reglaSel: { minInt: 1 } };
G.apiGuardar(tk(), d, true); G.apiAdmin(adm, 'procesar', { simId: 'S01' });
v = G.apiEstado(tk());
const f = v.estado.proyectos[0].fichas[0];
ok(f && f.tipo4p === 'Posición' && JSON.stringify(f.otras4p) === '["Producto"]', 'la ficha guarda su P principal y las otras P válidas');
d = base(v, 3); d.proyectos[pj.id] = { elegir: f.id, justificacion: 'Elegimos el único concepto, con ' + f.test.intencion + ' %.' };
G.apiGuardar(tk(), d, true); G.apiAdmin(adm, 'procesar', { simId: 'S01' });
v = G.apiEstado(tk());
const R = (v.estado.portafolioAnios || []).filter(x => x.anio === 1)[0];
ok(R && R.meta && R.meta.nucleo === 90 && R.meta.adyacente === 10, 'la meta del año queda registrada');
ok(R && R.total > 0 && R.real.adyacente === 100 && R.gasto.adyacente === R.total, 'el gasto real del año se atribuye al lugar del proyecto en el portafolio (100 % adyacente)');
ok(R && R.p4['Posición'] === 1 && R.p4.Producto === 1 && R.p4.Proceso === 0, 'el mapa real cuenta el concepto elegido en su P principal y en las otras');
console.log(fallas ? 'PORTAFOLIO CON ' + fallas + ' FALLAS' : 'PORTAFOLIO OK');
process.exit(fallas ? 1 : 0);
