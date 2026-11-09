// Contrato continuo ampliado: estudios de clientes (B) en el contrato, reserva del presupuesto de innovación,
// entregas cada trimestre pactado, usuarios líderes sin proyecto (entrega perdida) e informe de Mercado del T0.
const { makeGas } = require('./gasmock');
const G = makeGas(); G.instalar();
const adm = G.apiLoginDocente(G.cfgGet_('CLAVE_DOCENTE')).token;
const ok = (c, m) => { if (!c) { console.log('FALLA: ' + m); process.exit(1); } console.log('OK  ' + m); };
const s1 = G.apiAdmin(adm, 'crearSimulacion', { nombre: 'Contrato', sigla: 'COM505T', maxIntegrantes: 5, mandato: 'MA' });
G.apiRegistrarEquipo(s1.codigo, { nombreEquipo: 'Cóndores', pin: 'clave1', integrantes: [{ apPaterno: 'P', apMaterno: 'R', nombres: 'Ana', registro: '31600001', celular: '' }] });
G.apiAdmin(adm, 'abrir', { simId: s1.simId });
const tk = () => G.apiLogin('31600001', 'clave1', s1.simId).token;
let v = G.apiEstado(tk());
const i0 = v.estado.informes.find((i) => i.t === 0);
ok(i0 && i0.metodo === 'industria' && i0.requiere === false && i0.datos.n1, 'la empresa abre el T1 con el informe de Mercado del T0 (contrato heredado)');
ok(v.noticias.some((n) => n.fuente === 'informe' && /cierre del Año 0/.test(n.texto)), 'su hallazgo aparece como señal en 1. Entorno del T1');
const anual = { p4: { producto: 40, proceso: 20, posicion: 20, paradigma: 20 }, nucleo: 60, adyacente: 30, transf: 10, postura: 'ofensiva', estructura: 'integrada', tiempoLibre: 0, incentivo: 'reconocimiento', politica: 'aprendizaje', composicion: 'multifuncional', umbral: 'moderado', capacitacion: 'no', hipotesis: 'Con información continua de S2 idearemos mejor desde el T2.',
  contrato: { industria: { veces: 4 }, encuesta: { veces: 4, segs: ['S2'] }, lideres: { veces: 2 } } };
const est = G.apiEstimar(tk(), { anual, investigacion: { metodos: [] } });
ok(est.reservaContrato === 40800 + 34000, 'la estimación muestra la reserva de clientes del contrato: Bs ' + est.reservaContrato);
ok(est.operativo.contrato === 15300, 'el seguimiento (Mercado) sigue en el presupuesto operativo: Bs ' + est.operativo.contrato);
G.apiGuardar(tk(), { hipotesis: 'Probamos el contrato continuo ampliado.', anual, investigacion: { metodos: [] }, productos: {}, decInformes: {} }, true);
G.apiAdmin(adm, 'procesar', { simId: s1.simId });
v = G.apiEstado(tk());
const E = v.estado, h = E.hist[0];
ok(E.saldo <= 400000 - 74800, 'se reservaron Bs 74.800 del presupuesto de innovación al firmar (saldo Bs ' + E.saldo + ')');
ok(E.informes.some((i) => i.t === 1 && i.metodo === 'encuesta' && i.origen === 'contrato' && i.requiere === false && i.segs[0] === 'S2'), 'la encuesta de S2 llegó por contrato y no exige decisión');
ok(E.feedback.some((f) => /Usuarios líderes \(contrato\).*se perdió/.test(f)), 'usuarios líderes sin proyecto activo: la entrega se pierde (y se paga)');
ok(h.investigacionContinua === 15300 && h.gastosInnovacion >= 10200 + 17000, 'estado de resultados: seguimiento Bs 15.300 (operativo) y clientes en gastos de innovación');
ok(v.noticias.some((n) => n.fuente === 'informe' && n.metodo === 'encuesta'), 'en el T2 la encuesta del contrato aparece como señal');
G.apiGuardar(tk(), { hipotesis: 'Segundo trimestre con contrato continuo.', investigacion: { metodos: [] }, productos: {}, decInformes: {} }, true);
G.apiAdmin(adm, 'procesar', { simId: s1.simId });
const E2 = G.apiEstado(tk()).estado;
ok(E2.informes.filter((i) => i.metodo === 'encuesta' && i.origen === 'contrato').length === 2, 'en el T2 llegó la segunda ola de la encuesta, sin encargarla de nuevo');
ok(E2.saldo === E.saldo, 'las entregas no vuelven a descontar presupuesto (ya estaba reservado)');
console.log('CONTRATO OK');
