// Pantallas de la ruta de cinco fases (v3.1): Definir el reto con síntesis, regla de selección antes del
// test, caja de decisión con criterio frente a resultado, hipótesis del prototipo y registro en la ficha.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { iniciar } from './servidor.mjs';
const PORT = 8797, s = await iniciar(PORT), U = s.url, OUT = process.env.CAPTURAS || '/tmp';
const br = await chromium.launch(); const pg = await br.newPage({ viewport: { width: 1280, height: 900 } });
const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error' && !/favicon|img\/logo/.test(m.text() + (m.location().url || ''))) errs.push(m.text()); });
const api = async (fn, ...args) => { const r = await (await fetch(U + 'api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fn, args }) })).json(); if (r.ok === false) throw new Error(fn + ': ' + r.error); return r.r; };
async function ingresar(u, p) { await pg.waitForSelector('#axU'); await pg.fill('#axU', u); await pg.fill('#axP', p); await pg.click('text=Ingresar →'); await pg.waitForTimeout(1200); }
const R = {};
let codigo, adm, simId;
async function reentrar() {
  await pg.reload(); await pg.waitForTimeout(1500);
  if (await pg.isVisible('#axU')) { await pg.fill('#axU', 'Halcones'); await pg.fill('#axP', 'vuelo1'); await pg.fill('#axC', codigo); await pg.click('text=Ingresar →'); await pg.waitForTimeout(1500); }
  if (await pg.isVisible('.ax-pick')) { await pg.click('.ax-pick'); await pg.waitForTimeout(1200); }
}
/** Completa lo obligatorio para enviar (señales, cronograma, informes, estrategia anual) y envía por la API. */
async function enviar(dec) {
  const tok = await pg.evaluate(() => TOK), v = await api('apiEstado', tok), t = v.partida.t;
  dec.hipotesis = dec.hipotesis || 'Hipótesis de prueba del equipo para este trimestre.';
  dec.senales = dec.senales || {}; (v.noticias || []).forEach((n) => { dec.senales[n.id] = dec.senales[n.id] || { cred: 'dudosa', postura: 'ignorar' }; });
  dec.decInformes = dec.decInformes || {}; (v.estado.informes || []).filter((x) => x.requiere && x.t === t - 1).forEach((x) => { dec.decInformes[x.id] = 'Con este dato ajustamos el proyecto.'; });
  if ((t - 1) % 4 === 0) dec.anual = Object.assign({ p4: { producto: 40, proceso: 20, posicion: 20, paradigma: 20 }, nucleo: 60, adyacente: 30, transf: 10, postura: 'ofensiva', estructura: 'integrada', tiempoLibre: 10, incentivo: 'reconocimiento', politica: 'aprendizaje', composicion: 'multifuncional', capacitacion: 'no', umbral: 'moderado', hipotesis: 'Hipótesis anual de prueba con más de veinte caracteres.' }, dec.anual || {});
  const est = await api('apiEstimar', tok, dec); dec.cronograma = {}; (est.actividades || []).forEach((a) => { dec.cronograma[a.concepto] = { sem: a.ref, ini: 1, fin: 12 }; });
  await api('apiGuardar', tok, dec, true);
  await api('apiAdmin', adm, 'cerrar', { simId }); await api('apiAdmin', adm, 'procesar', { simId }); await api('apiAdmin', adm, 'abrir', { simId });
  await reentrar();
}
const proyectos = async () => { await pg.click('nav >> text=Decidir'); await pg.waitForTimeout(300); await pg.click('nav .sub >> text=4. Proyectos'); await pg.waitForTimeout(500); };
try {
  await pg.goto(U + '?vista=docente'); await ingresar(s.sa.email, s.sa.temporal);
  await pg.fill('#axN1', 'Clave#2026'); await pg.fill('#axN2', 'Clave#2026'); await pg.click('text=Guardar y continuar →'); await pg.waitForTimeout(1000);
  await pg.fill('#snom', 'Innovación — Fases'); await pg.fill('#ssig', 'COM505T'); await pg.click('text=Crear simulación y generar código'); await pg.waitForTimeout(900);
  codigo = s.mem.tablas.simulaciones[0].k1; simId = s.mem.tablas.simulaciones[0].k0 || 'S01';
  await pg.click('nav >> text=Partida'); await pg.waitForTimeout(600); await pg.click('text=Abrir trimestre'); await pg.waitForTimeout(800);
  await pg.click('text=Salir'); await pg.waitForTimeout(500);
  adm = (await api('apiAXLogin', s.sa.email, 'Clave#2026')).token;
  await pg.goto(U); await pg.waitForSelector('#axU');
  await pg.click('text=Registrar mi equipo'); await pg.fill('#axRn', 'Halcones'); await pg.fill('#axRp', 'vuelo1'); await pg.fill('#axRp2', 'vuelo1'); await pg.fill('#axRc', codigo); await pg.waitForTimeout(800);
  const ins = await pg.$$('#axFilas .ax-fila:nth-child(1) input'); const f = ['QUISPE', 'MAMANI', 'Ana Lucía', '218001234', ''];
  for (let j = 0; j < 5; j++) await ins[j].fill(f[j]);
  await pg.click('text=✓ Registrar Equipo'); await pg.waitForTimeout(1500);
  // T1: encargan observación etnográfica de S2
  await enviar({ investigacion: { metodos: ['observacion'], segs: { observacion: ['S2'] } }, proyectos: {}, nuevosProyectos: [] });
  // T2: Definir el reto en pantalla
  await proyectos();
  R.ruta = await pg.isVisible('.etapas >> text=Definir el reto') && await pg.isVisible('.etapas >> text=Prototipar y probar') && await pg.isVisible('.etapas >> text=Desarrollar y validar');
  R.form = await pg.isVisible('text=Nuevo proyecto · fase 1: Definir el reto') && await pg.isVisible('#npInsight') && await pg.isVisible('#npEncaje') && await pg.isVisible('#npEv2');
  const obs = await pg.$$eval('#npEv option', (o) => o.filter((x) => /Observación/i.test(x.textContent)).map((x) => x.value));
  await pg.fill('#npNom', 'Desayuno en movimiento'); await pg.selectOption('#npSeg', 'S2'); if (obs[0]) await pg.selectOption('#npEv', obs[0]);
  await pg.fill('#npFrase', 'Desayuno en el micro, con una sola mano libre.');
  await pg.fill('#npInsight', 'Comen en movimiento y con una mano: lo que no se pueda tomar así no les sirve.');
  await pg.fill('#npCuando', 'salgo a las 6:30 de casa'); await pg.fill('#npQuiero', 'algo que me quite el hambre'); await pg.fill('#npPara', 'rendir en las clases');
  await pg.fill('#npReto', '¿Cómo podríamos ayudar a los universitarios a alimentarse bien mientras se trasladan?');
  await pg.fill('#npEncaje', 'Es adyacente: mismo tipo de producto y segmento nuevo, cabe en nuestra línea.');
  await pg.fill('#npCrit', '6 % de S2 dos trimestres después del lanzamiento');
  await pg.click('text=Revisar el brief'); await pg.waitForTimeout(300);
  R.contacto = await pg.isVisible('#npRev >> text=Tienen un estudio de contacto directo con S2.');
  R.insightOk = await pg.isVisible('#npRev >> text=Insight escrito con sus palabras.');
  await pg.evaluate(() => document.querySelector('#npRev').scrollIntoView({ block: 'end' }));
  await pg.screenshot({ path: OUT + '/f31_definir.png', fullPage: false });
  await pg.click('text=Agregar proyecto'); await pg.waitForTimeout(500);
  const d2 = await pg.evaluate(() => decisionLimpia());
  R.briefEnviado = !!(d2.nuevosProyectos[0] && d2.nuevosProyectos[0].brief.insight && d2.nuevosProyectos[0].brief.encaje);
  await enviar(d2);
  // T3: Idear con regla de selección (por API) y test
  let tok = await pg.evaluate(() => TOK), v = await api('apiEstado', tok), p = v.estado.proyectos[0];
  await proyectos(); await pg.click('text=3. Fichas de concepto').catch(() => {}); await pg.waitForTimeout(300);
  R.reglaVisible = await pg.isVisible('text=Regla de selección · fíjenla antes del test');
  const fichas = [
    { nombre: 'Bebible', frase: 'Para universitarios que desayunan en el micro, un desayuno bebible con tapa deportiva.', pts: { sab: 2, nut: 3, conv: 5, salud: 0, sost: 0, precio: 0 }, precioObj: 5, tec: 'no', mod: 'no', tipo4p: 'Producto', test: true },
    { nombre: 'Barra', frase: 'Para universitarios que desayunan en el micro, una barra láctea con cereal.', pts: { sab: 3, nut: 4, conv: 3, salud: 0, sost: 0, precio: 0 }, precioObj: 5, tec: 'no', mod: 'no', tipo4p: 'Producto', test: true }
  ];
  await enviar({ proyectos: { [p.id]: { fichas, reglaSel: { minInt: 30, texto: 'Además, precio dentro del rango aceptable.' } } }, nuevosProyectos: [] });
  // T4: caja de decisión
  await proyectos();
  R.cajaDecision = await pg.isVisible('text=Decisión del equipo · test de concepto') && await pg.isVisible('.box.dec >> text=Intención de compra de al menos 30 %');
  R.avisoPie = /sin decisión registrada/.test(await pg.textContent('#pie'));
  await pg.selectOption('.box.dec select', 'segmento'); await pg.waitForTimeout(400);
  R.camposSegmento = await pg.isVisible('.box.dec >> text=Nuevo reto: ¿Cómo podríamos…?');
  await pg.selectOption('.box.dec select', 'seguir'); await pg.waitForTimeout(400);
  await pg.fill('.box.dec textarea', 'El mejor concepto superó nuestra regla de 30 %; seguimos con él.'); await pg.dispatchEvent('.box.dec textarea', 'change'); await pg.waitForTimeout(900);
  R.avisoDesaparece = !/sin decisión registrada/.test(await pg.textContent('#pie'));
  await pg.evaluate(() => document.querySelector('.box.dec').scrollIntoView({ block: 'start' }));
  await pg.screenshot({ path: OUT + '/f31_decision.png', fullPage: false });
  tok = await pg.evaluate(() => TOK); v = await api('apiEstado', tok); p = v.estado.proyectos[0];
  const best = p.fichas.filter((x) => x.test).sort((a, b) => b.test.intencion - a.test.intencion)[0];
  const d4 = await pg.evaluate(() => decisionLimpia());
  d4.proyectos[p.id].elegir = best.id; d4.proyectos[p.id].justificacion = 'Elegimos el de mayor intención: ' + best.test.intencion + ' %.';
  await enviar(d4);
  // T5: prototipo con hipótesis y criterio; ficha con registro
  await proyectos();
  R.hipotesisProto = await pg.isVisible('text=Hipótesis: Creemos que…') && await pg.isVisible('text=Criterio: seguimos si al menos');
  await pg.evaluate(() => document.querySelectorAll('details').forEach((d) => { if (/ficha completa/.test(d.querySelector('summary').textContent)) d.open = true; })); await pg.waitForTimeout(300);
  R.registro = await pg.isVisible('text=REGISTRO DE DECISIONES') && await pg.isVisible('text=REGLA DE SELECCIÓN');
  R.rutaActiva = await pg.isVisible('.etapas span.on:has-text("Prototipar y probar")');
  await pg.evaluate(() => { const x = [...document.querySelectorAll('summary')].find((s) => /ficha completa/.test(s.textContent)); if (x) x.scrollIntoView({ block: 'start' }); });
  await pg.screenshot({ path: OUT + '/f31_registro.png', fullPage: false });
  await pg.click('nav .sub >> text=2. Estrategia anual'); await pg.waitForTimeout(500);
  R.metaReal = await pg.isVisible('text=su meta frente a lo real') && await pg.isVisible('text=4P: dónde dijeron que buscarían');
  await pg.evaluate(() => { const h = [...document.querySelectorAll('h2')].find((x) => /meta frente a lo real/.test(x.textContent)); if (h) h.scrollIntoView({ block: 'start' }); window.scrollBy(0, -120); });
  await pg.screenshot({ path: OUT + '/f32_meta_real.png', fullPage: false });
  await pg.click('nav .sub >> text=4. Proyectos'); await pg.waitForTimeout(400);
  await pg.setViewportSize({ width: 390, height: 844 }); await pg.waitForTimeout(300);
  R.anchoCel = await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  if (!R.anchoCel) R.desborde = await pg.evaluate(() => { const W = window.innerWidth, out = []; document.querySelectorAll('body *').forEach((e) => { const b = e.getBoundingClientRect(); if (b.right > W + 1 && b.width > 0) { let q = e.parentElement, scr = false; while (q && q !== document.body) { if (/auto|scroll|hidden/.test(getComputedStyle(q).overflowX)) { scr = true; break; } q = q.parentElement; } if (!scr) out.push(e.tagName + '.' + e.className + ' w=' + Math.round(b.width) + ' ' + (e.textContent || '').slice(0, 40)); } }); return out.slice(0, 6); });
} catch (e) { R.falla = e.message.split('\n')[0]; }
console.log(JSON.stringify(R, null, 1)); console.log('Errores de página:', errs.length ? errs : 'ninguno');
const ok = !R.falla && R.ruta && R.form && R.contacto && R.insightOk && R.briefEnviado && R.reglaVisible && R.cajaDecision && R.avisoPie && R.camposSegmento && R.avisoDesaparece && R.hipotesisProto && R.registro && R.rutaActiva && R.anchoCel && R.metaReal && !errs.length;
await br.close(); await s.cerrar();
console.log(ok ? 'FASES UI OK' : 'FASES UI CON FALLAS'); process.exit(ok ? 0 : 1);
