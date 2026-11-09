// Pantallas nuevas: 1. Entorno (señales y herramientas), 3. Investigación (catálogo A-D, precio por segmento),
// 2. Estrategia anual (contrato continuo) y Resultados (Año 0 y línea de investigación continua).
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { iniciar } from './servidor.mjs';
const P = 8793, s = await iniciar(P), U = s.url, OUT = process.env.CAPTURAS || '/tmp';
const br = await chromium.launch(); const pg = await br.newPage({ viewport: { width: 1280, height: 900 } });
const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error' && !/favicon|img\/logo/.test(m.text() + (m.location().url || ''))) errs.push(m.text()); });
async function ingresar(u, p) { await pg.waitForSelector('#axU'); await pg.fill('#axU', u); await pg.fill('#axP', p); await pg.click('text=Ingresar →'); await pg.waitForTimeout(1200); }
const clic = (sel) => pg.evaluate((sel) => { const e = document.querySelector(sel); if (e) e.click(); return !!e; }, sel);
const R = {};
try {
  await pg.goto(U + '?vista=docente'); await ingresar(s.sa.email, s.sa.temporal);
  await pg.fill('#axN1', 'Clave#2026'); await pg.fill('#axN2', 'Clave#2026'); await pg.click('text=Guardar y continuar →'); await pg.waitForTimeout(1000);
  await pg.fill('#snom', 'Innovación — Grupo E'); await pg.fill('#ssig', 'COM505T'); await pg.click('text=Crear simulación y generar código'); await pg.waitForTimeout(900);
  const codigo = s.mem.tablas.simulaciones[0].k1;
  await pg.click('nav >> text=Partida'); await pg.waitForTimeout(600); await pg.click('text=Abrir trimestre'); await pg.waitForTimeout(800);
  await pg.click('text=Salir'); await pg.waitForTimeout(500);
  await pg.goto(U); await pg.waitForSelector('#axU');
  await pg.click('text=Registrar mi equipo'); await pg.fill('#axRn', 'Halcones'); await pg.fill('#axRp', 'vuelo1'); await pg.fill('#axRp2', 'vuelo1'); await pg.fill('#axRc', codigo); await pg.waitForTimeout(800);
  const ins = await pg.$$('#axFilas .ax-fila:nth-child(1) input'); const f = ['QUISPE', 'MAMANI', 'Ana Lucía', '218001234', ''];
  for (let j = 0; j < 5; j++) await ins[j].fill(f[j]);
  await pg.click('text=✓ Registrar Equipo'); await pg.waitForTimeout(1500);
  // Resultados: Año 0 antes de decidir
  await pg.click('nav >> text=Resultados'); await pg.waitForTimeout(300); await pg.click('nav .sub >> text=Estados financieros'); await pg.waitForTimeout(400);
  R.anio0 = await pg.isVisible('text=Año 0 (T-3 a T0)') && await pg.isVisible('th:has-text("T-3")') && await pg.isVisible('text=Investigación de mercados continua (contrato)');
  await pg.screenshot({ path: OUT + '/v3_resultados_anio0.png', fullPage: true });
  // 1. Entorno
  await pg.click('nav >> text=Decidir'); await pg.waitForTimeout(300); await pg.click('nav .sub >> text=1. Entorno'); await pg.waitForTimeout(400);
  R.senales = await pg.$$eval('.ent-not', (x) => x.length);
  R.herramientas = await pg.$$eval('table tr td b', (x) => x.map((b) => b.textContent).filter((t) => /Proveedor de leche|Rutas|Campaña/.test(t)).length);
  R.etiquetaBloq = await pg.isVisible('text=Disponible cuando exista una norma de etiquetado');
  // primera señal: creíble y vigilada con un estudio; segunda: actuar con todos los campos
  const ids = await pg.$$eval('.ent-not input[value="real"]', (x) => x.map((e) => e.name.slice(2)));
  await clic('input[name="c_' + ids[0] + '"][value="real"]'); await clic('input[name="p_' + ids[0] + '"][value="vigilar"]'); await pg.waitForTimeout(200);
  R.vigilarPide = await pg.isVisible('text=c. ¿Con qué estudio la vigilan?');
  const opts = await pg.$$eval('select[data-p="senales.' + ids[0] + '.estudio"] option', (o) => o.map((x) => x.value).filter(Boolean));
  await pg.selectOption('select[data-p="senales.' + ids[0] + '.estudio"]', opts[0]); await pg.waitForTimeout(250);
  R.sinComprar = await pg.isVisible('text=Aún no la compran');
  await clic('input[name="c_' + ids[1] + '"][value="dudosa"]'); await clic('input[name="p_' + ids[1] + '"][value="actuar"]'); await pg.waitForTimeout(200);
  R.actuarPide = await pg.isVisible('text=d. ¿Qué significa para su empresa?') && await pg.isVisible('text=h. ¿Por qué?');
  await pg.selectOption('select[data-p="senales.' + ids[1] + '.sig"]', 'amenaza'); await pg.selectOption('select[data-p="senales.' + ids[1] + '.plazo"]', '1-2'); await pg.selectOption('select[data-p="senales.' + ids[1] + '.impacto"]', 'medio');
  await clic('input[data-arr="senales.' + ids[1] + '.resp"][value="h:campana"]');
  await pg.fill('input[data-p="senales.' + ids[1] + '.porque"]', 'Queremos adelantar nuestra marca antes que los rivales.'); await pg.dispatchEvent('input[data-p="senales.' + ids[1] + '.porque"]', 'change');
  for (let k = 2; k < ids.length; k++) { await clic('input[name="c_' + ids[k] + '"][value="rumor"]'); await clic('input[name="p_' + ids[k] + '"][value="ignorar"]'); await pg.waitForTimeout(120); }
  await clic('input[data-p="herramientas.campana.on"]'); await pg.waitForTimeout(250);
  await pg.selectOption('select[data-p="herramientas.campana.seg"]', 'S2'); await pg.waitForTimeout(900);
  R.pieOperativo = /herramientas Bs 10\.000/.test(await pg.textContent('#pie'));
  await pg.screenshot({ path: OUT + '/v3_entorno.png', fullPage: true });
  // 3. Investigación
  await pg.click('nav .sub >> text=3. Investigación'); await pg.waitForTimeout(400);
  R.grupos = await pg.$$eval('h2', (h) => h.map((x) => x.textContent).filter((t) => /^[ABCD]\. /.test(t)));
  R.contratoTxt = await pg.isVisible('text=Su contrato de investigación continua:');
  await clic('input[data-arr="investigacion.metodos"][value="encuesta"]'); await pg.waitForTimeout(250);
  for (const sg of ['S1', 'S2', 'S3']) { await clic('input[data-arr="investigacion.segs.encuesta"][value="' + sg + '"]'); await pg.waitForTimeout(150); }
  R.precioEncuesta3 = await pg.isVisible('td.n:has-text("Bs 20.000")');
  R.ref = await pg.isVisible('text=entre 0,02 % y 0,4 % de sus ventas');
  await pg.screenshot({ path: OUT + '/v3_investigacion.png', fullPage: true });
  // 2. Estrategia anual: contrato
  await pg.click('nav .sub >> text=2. Estrategia anual'); await pg.waitForTimeout(400);
  R.bloqueC = await pg.isVisible('text=Bloque C. Contrato de investigación continua');
  R.heredado = (await pg.inputValue('select[data-p="anual.contrato.industria.veces"]')) === '4';
  await pg.selectOption('select[data-p="anual.contrato.competidores.veces"]', '2'); await pg.waitForTimeout(300);
  R.totalContrato = await pg.isVisible('th.n:has-text("Bs 85.000")'); // 15.300×4 + 11.900×2
  for (const [k, v] of [['producto', '40'], ['proceso', '20'], ['posicion', '20'], ['paradigma', '20']]) await pg.fill('input[data-p="anual.p4.' + k + '"]', v);
  for (const [k, v] of [['nucleo', '60'], ['adyacente', '30'], ['transf', '10']]) await pg.fill('input[data-p="anual.' + k + '"]', v);
  for (const [k, v] of [['postura', 'ofensiva'], ['estructura', 'integrada'], ['tiempoLibre', '10'], ['incentivo', 'reconocimiento'], ['politica', 'aprendizaje'], ['composicion', 'multifuncional'], ['umbral', 'moderado'], ['capacitacion', 'no']]) await pg.selectOption('select[data-p="anual.' + k + '"]', v);
  await pg.fill('textarea[data-p="anual.hipotesis"]', 'Con 30 % adyacente lanzaremos un producto para universitarios antes de T8.'); await pg.dispatchEvent('textarea[data-p="anual.hipotesis"]', 'change'); await pg.waitForTimeout(300);
  await pg.screenshot({ path: OUT + '/v3_contrato.png', fullPage: false, clip: { x: 0, y: 0, width: 1280, height: 900 } });
  await pg.evaluate(() => { const h = [...document.querySelectorAll('h2')].find((x) => /Bloque C/.test(x.textContent)); if (h) h.scrollIntoView(); }); await pg.screenshot({ path: OUT + '/v3_contrato.png' });
  await pg.click('nav .sub >> text=Hipótesis'); await pg.fill('textarea[data-p="hipotesis"]', 'Si leemos bien el entorno evitaremos golpes de costos.'); await pg.dispatchEvent('textarea[data-p="hipotesis"]', 'change');
  await pg.waitForTimeout(800); await pg.click('text=Enviar decisiones'); await pg.waitForTimeout(1200);
  R.enviado = (s.mem.tablas.decisiones || []).some((d) => d.fila.includes('enviado'));
  // procesar como docente
  const api = async (fn, ...args) => { const r = await (await fetch(U + 'api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fn, args }) })).json(); if (r.ok === false) throw new Error(fn + ': ' + r.error); return r.r; };
  const adm = (await api('apiAXLogin', s.sa.email, 'Clave#2026')).token, simId = s.mem.tablas.simulaciones[0].k0 || 'S01';
  await api('apiAdmin', adm, 'cerrar', { simId }); const pr = await api('apiAdmin', adm, 'procesar', { simId }); R.procesado = !!(pr && pr.ok);
  await pg.reload(); await pg.waitForTimeout(1500);
  if (await pg.isVisible('#axU')) { await pg.fill('#axU', 'Halcones'); await pg.fill('#axP', 'vuelo1'); await pg.fill('#axC', codigo); await pg.click('text=Ingresar →'); await pg.waitForTimeout(1500); }
  if (await pg.isVisible('.ax-pick')) { await pg.click('.ax-pick'); await pg.waitForTimeout(1200); }
  await pg.click('nav >> text=Resultados'); await pg.waitForTimeout(300); await pg.click('nav .sub >> text=Estados financieros'); await pg.waitForTimeout(300);
  R.lineaT1 = await pg.isVisible('th:has-text("T1")');
  await pg.click('nav .sub >> text=Resumen del trimestre'); await pg.waitForTimeout(300);
  R.fbContrato = await pg.isVisible('text=Contrato de investigación continua: se entregaron');
  R.fbCampana = await pg.isVisible('text=Contrataron "Campaña anticipada de marca" en S2');
  await pg.screenshot({ path: OUT + '/v3_resumen.png', fullPage: true });
  await pg.click('nav >> text=Decidir'); await pg.waitForTimeout(300); await pg.click('nav .sub >> text=1. Entorno'); await pg.waitForTimeout(400);
  R.lecturaAnt = await pg.isVisible('text=Su lectura del trimestre anterior');
  R.senalInforme = await pg.isVisible('.ent-tags >> text=Informe:');
  await pg.screenshot({ path: OUT + '/v3_entorno_t2.png', fullPage: true });
  await pg.setViewportSize({ width: 390, height: 844 }); await pg.waitForTimeout(300);
  R.anchoCel = await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  await pg.screenshot({ path: OUT + '/v3_entorno_cel.png' });
} catch (e) { R.falla = e.message.split('\n')[0]; }
console.log(JSON.stringify(R, null, 1)); console.log('Errores de página:', errs.length ? errs : 'ninguno');
const ok = !R.falla && R.anio0 && R.senales >= 2 && R.herramientas >= 3 && R.etiquetaBloq && R.vigilarPide && R.sinComprar && R.actuarPide && R.pieOperativo && R.grupos.length === 4 && R.contratoTxt && R.precioEncuesta3 && R.ref && R.bloqueC && R.heredado && R.totalContrato && R.enviado && R.lineaT1 && R.fbContrato && R.fbCampana && R.lecturaAnt && R.senalInforme && !errs.length;
await br.close(); await s.cerrar();
console.log(ok ? 'ENTORNO UI OK' : 'ENTORNO UI CON FALLAS'); process.exit(ok ? 0 : 1);
