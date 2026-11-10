// Fases del proyecto (v3.1): Definir con síntesis, regla de selección antes del test, hipótesis y criterio
// del prototipo, y decisión registrada en cada punto de aprendizaje (seguir, cambiar la solución,
// cambiar el segmento o el reto, esperar, detener).
process.env.FASES_ESTRICTO = '1';
const { makeGas } = require('./gasmock');
const G = makeGas(); G.instalar();
const adm = G.apiLoginDocente(G.cfgGet_('CLAVE_DOCENTE')).token;
const sim = G.apiAdmin(adm, 'crearSimulacion', { nombre: 'Fases', sigla: 'COM505T', maxIntegrantes: 5, mandato: 'MA' });
G.apiRegistrarEquipo(sim.codigo, { nombreEquipo: 'Halcones', pin: '1234', integrantes: [{ apPaterno: 'P', apMaterno: 'R', nombres: 'Ana', registro: '218001', celular: '71234561' }] });
G.apiAdmin(adm, 'abrir', { simId: 'S01' });
const tk = () => G.apiLogin('218001', '1234').token;
let fallas = 0; function ok(c, m) { console.log((c ? 'OK  ' : 'MAL ') + m); if (!c) fallas++; }

// ---------- funciones puras ----------
const P = G.getParams_();
const ses = G.sess_(tk(), 'equipo'), pa = G.partida_(ses.simId);
const S = G.migrar_(G.estadoPrevio_(P, G.equipoById_(ses.equipoId), pa.t), P);
S.informes = S.informes || [];
const brief = { cuando: 'salgo temprano', quiero: 'algo que me quite el hambre', para: 'rendir en clases', reto: '¿Cómo podríamos ayudar a los universitarios a alimentarse bien mientras se trasladan?', evidencia: 'INF1', frase: 'Desayuno en el micro con una sola mano libre.', insight: 'Comen en movimiento y con una mano: lo que no se pueda tomar así, no les sirve.', encaje: 'Es adyacente: mismo producto lácteo, segmento nuevo, cabe en nuestra línea.', criterio: '6 % de S2 dos trimestres después del lanzamiento' };
let R = G.revisarBrief_(P, S, brief, 'S2').items;
const item = (txt) => R.filter(r => r.texto.indexOf(txt) >= 0)[0];
ok(item('contacto directo') && !item('contacto directo').ok, 'sin observación ni usuarios extremos, el brief avisa que falta contacto directo con el cliente');
S.informes.push({ id: 'INF900', metodo: 'observacion', nombre: 'Observación etnográfica', t: 1, segs: ['S2'] });
R = G.revisarBrief_(P, S, brief, 'S2').items;
ok(item('contacto directo') && item('contacto directo').ok, 'con observación del segmento, el contacto directo queda cubierto');
ok(G.revisarBrief_(P, S, brief, 'S5').items.some(r => r.texto.indexOf('No tienen un estudio de contacto directo con S5') >= 0), 'la observación de S2 no cubre a S5');
ok(item('insight está escrito') && item('insight está escrito').ok, 'el insight con palabras propias se acepta');
R = G.revisarBrief_(P, S, Object.assign({}, brief, { insight: brief.frase }), 'S2').items;
ok(R.some(r => !r.ok && r.texto.indexOf('Escriban el insight') >= 0), 'copiar la frase del informe como insight no cuenta');
R = G.revisarBrief_(P, S, Object.assign({}, brief, { encaje: '' }), 'S2').items;
ok(R.some(r => !r.ok && r.texto.indexOf('encaja') >= 0), 'falta explicar el encaje con la estrategia');

const t = 2, fb = [];
const ctx = { gastar: () => true, rng: G.makeRng_('fases|1'), fb, t, O: S.org };
const pj = G.crearProyecto2_(P, S, { nombre: 'Desayuno', segmento: 'S2', tec: 'no', mod: 'no', portafolio: 'adyacente', brief }, 1);
ok(pj.brief.insight === brief.insight && pj.brief.encaje === brief.encaje, 'el proyecto guarda el insight y el encaje');
ok(Array.isArray(pj.decisiones) && pj.pivotes === 0, 'el proyecto nace con registro de decisiones vacío');
const fichas = [
  { nombre: 'Bebible', frase: 'Para universitarios que desayunan en el micro, un desayuno bebible.', pts: { sab: 2, nut: 3, conv: 5, salud: 0, sost: 0, precio: 0 }, precioObj: 5, tec: 'no', mod: 'no', tipo4p: 'Producto', test: true },
  { nombre: 'Barra', frase: 'Para universitarios que desayunan en el micro, una barra láctea.', pts: { sab: 3, nut: 4, conv: 3, salud: 0, sost: 0, precio: 0 }, precioObj: 5, tec: 'no', mod: 'no', tipo4p: 'Producto', test: true }
];
G.procesarFases2_(P, S, pj, { fichas: JSON.parse(JSON.stringify(fichas)) }, ctx);
ok(pj.etapa === 'idear' && !pj.fichas.some(f => f.test), 'sin regla de selección el test de concepto no se hace');
ok(fb.some(x => x.indexOf('regla de selección') >= 0), 'el equipo recibe el aviso de la regla de selección');
G.procesarFases2_(P, S, pj, { reglaSel: { minInt: 99 }, test: pj.fichas.map(f => f.id) }, ctx);
ok(pj.etapa === 'evaluar' && pj.reglaSel && pj.reglaSel.minInt === 99, 'con regla fijada antes, el test se hace y queda guardada la regla');

let pd = G.puntoDecision_(pj);
ok(pd && pd.clave === 'test@2' && pd.cumple === false, 'punto de decisión del test: criterio 99 % frente al resultado, no cumple');
ok(G.aplicarDecision_(P, S, pj, { opcion: 'seguir', clave: 'otra', porque: 'Seguimos con el mejor concepto.' }, t, fb) === null, 'una decisión de un resultado anterior no se aplica');
ok(G.aplicarDecision_(P, S, pj, { opcion: 'seguir', clave: pd.clave, porque: 'corto' }, t, fb) === null && pj.decisiones.length === 0, 'sin explicación la decisión no se registra');
ok(G.aplicarDecision_(P, S, pj, { opcion: 'seguir', clave: pd.clave, porque: 'El de mayor intención nos parece suficiente.' }, t, fb) === 'seguir', 'seguir se aplica');
ok(pj.decisiones.length === 1 && pj.decisiones[0].coherente === false && fb.some(x => x.indexOf('sentido contrario a su propio criterio') >= 0), 'seguir sin cumplir el propio criterio queda registrado como no coherente, con aviso factual');
ok(G.aplicarDecision_(P, S, pj, { opcion: 'detener', clave: pd.clave, porque: 'Otra vez sobre el mismo resultado.' }, t, fb) === null, 'no se decide dos veces sobre el mismo resultado');

// elegir y prototipar
const elegido = pj.fichas.filter(f => f.test).sort((a, b) => b.test.intencion - a.test.intencion)[0];
G.procesarFases2_(P, S, pj, { elegir: elegido.id, justificacion: 'Elegimos el de mayor intención: ' + elegido.test.intencion + ' %.' }, Object.assign({}, ctx, { t: 3 }));
ok(pj.etapa === 'prototipar' && pj.eleccionVsRegla && pj.eleccionVsRegla.cumple === false, 'la elección se compara con la regla del equipo');
const proto = { supuesto: 'uso', pregunta: '¿Pueden abrirlo solos con una mano?', formato: 'maqueta', apertura: 'pestana', senal: 'flecha', tamano: '330', recierre: 'si', n: 8 };
G.procesarFases3_(P, S, pj, { proto: Object.assign({}, proto) }, Object.assign({}, ctx, { t: 4 }));
ok(!(pj.proto.versiones || []).length && fb.some(x => x.indexOf('escriban su hipótesis') >= 0), 'sin hipótesis ni criterio, el prototipo no se prueba');
G.procesarFases3_(P, S, pj, { proto: Object.assign({}, proto, { creemos: 'Creemos que lo abrirán con una mano sin ayuda.', criterio: 6 }) }, Object.assign({}, ctx, { t: 4 }));
const v1 = pj.proto.versiones[0];
ok(v1 && v1.criterio === 6 && typeof v1.logrados === 'number' && v1.cumpleCriterio === (v1.logrados >= 6), 'la versión guarda hipótesis, criterio y si lo cumple');
pd = G.puntoDecision_(pj);
ok(pd && pd.clave === 'v1@4' && pd.criterio.indexOf('Al menos 6 de 8') === 0, 'punto de decisión del prototipo con el criterio del equipo');

// cambiar el segmento o el reto
ok(G.aplicarDecision_(P, S, pj, { opcion: 'segmento', clave: pd.clave, porque: 'El uso con una mano importa más a oficinistas.' }, 4, fb) === null, 'cambiar el segmento exige segmento y nuevo reto');
ok(G.aplicarDecision_(P, S, pj, { opcion: 'segmento', clave: pd.clave, segmento: 'S3', reto: '¿Cómo podríamos ayudar a los oficinistas a desayunar en su escritorio?', insight: 'Desayunan frente a la computadora y no quieren ensuciar el teclado.', porque: 'El uso con una mano importa más a oficinistas.' }, 4, fb) === 'segmento', 'cambiar el segmento se aplica');
ok(pj.segmento === 'S3' && pj.etapa === 'idear' && pj.pivotes === 1, 'el proyecto pasa a S3, vuelve a Idear y cuenta un cambio');
ok(pj.fichas.length >= 2 && pj.fichas.every(f => !f.test) && !pj.concepto && !pj.reglaSel, 'conserva las fichas, descarta los tests, el concepto y la regla');
ok(pj.protoPrev && pj.protoPrev.length === 1 && pj.proto.versiones.length === 0, 'los prototipos anteriores quedan en el historial');
ok(pj.revisionBrief.some(r => r.texto.indexOf('No tienen un estudio de contacto directo con S3') >= 0), 'el nuevo reto se revisa con la evidencia del nuevo segmento');
const rd = G.resumenDecisiones_(pj);
ok(rd.n === 2 && rd.conCriterio === 2 && rd.pivotes === 1, 'resumen del registro: 2 decisiones con criterio y 1 cambio de segmento');

// ---------- de punta a punta: esperar y detener pasan por el motor ----------
function base(v, tt) {
  const dec = { hipotesis: 'Hipótesis del trimestre ' + tt, noticias: {}, respuestas: {}, productos: {}, investigacion: { metodos: [], segmentos: [] }, decInformes: {}, proyectos: {}, nuevosProyectos: [] };
  v.estado.informes.filter(x => x.requiere && x.t === tt - 1).forEach(x => { dec.decInformes[x.id] = 'Con este dato ajustamos el proyecto.'; });
  v.estado.productos.forEach(p => { dec.productos[p.id] = { precio: p.precio, comunicacion: 20000, segPub: 'todos', promo: 0, pronostico: 1500000, canales: p.canales }; });
  return dec;
}
function procesar() { G.apiAdmin(adm, 'procesar', { simId: 'S01' }); }
let v = G.apiEstado(tk()), dec = base(v, 1);
dec.nuevosProyectos.push({ nombre: 'Desayuno', segmento: 'S2', tec: 'no', mod: 'no', portafolio: 'adyacente', brief });
dec.investigacion = { metodos: ['observacion'], segs: { observacion: ['S2'] } };
G.apiGuardar(tk(), dec, true); procesar();
v = G.apiEstado(tk()); let p = v.estado.proyectos[0];
ok(p && p.brief && p.brief.insight, 'la vista del equipo trae el insight del brief');
dec = base(v, 2); dec.proyectos[p.id] = { fichas: JSON.parse(JSON.stringify(fichas)), reglaSel: { minInt: 20, texto: 'Elegimos el que supere 20 %' } };
G.apiGuardar(tk(), dec, true); procesar();
v = G.apiEstado(tk()); p = v.estado.proyectos[0];
ok(p.etapa === 'evaluar' && p.decision && !p.decidido && p.decision.decidido === false, 'la vista muestra el punto de decisión pendiente');
const est = G.apiEstimar(tk(), base(v, 3));
ok(((est.avisos || est.r && est.r.avisos) || []).some(x => x.indexOf('sin decisión registrada') >= 0), 'el pie avisa del resultado sin decisión');
dec = base(v, 3); dec.proyectos[p.id] = { decision: { clave: p.decision.clave, opcion: 'esperar', porque: 'Esperamos el informe de observación de oficinistas.' } };
G.apiGuardar(tk(), dec, true); procesar();
v = G.apiEstado(tk()); p = v.estado.proyectos[0];
ok(p.etapa === 'evaluar' && p.decisiones.length === 1 && p.decisiones[0].opcion === 'esperar' && p.decision.decidido === true, 'esperar queda registrado y el proyecto no avanza');
dec = base(v, 4); dec.proyectos[p.id] = { decision: { clave: p.decision.clave, opcion: 'detener', porque: 'Otra decisión sobre el mismo resultado.' } };
G.apiGuardar(tk(), dec, true); procesar();
v = G.apiEstado(tk()); p = v.estado.proyectos[0];
ok(p.estado === 'activo' && p.decisiones.length === 1, 'no se puede decidir dos veces sobre el mismo resultado');

console.log(fallas ? 'FASES CON ' + fallas + ' FALLAS' : 'FASES OK');
process.exit(fallas ? 1 : 0);
