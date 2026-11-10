// Simulación completa de dos trimestres con dos equipos (Alfa y Beta) conducida por las pantallas,
// como lo haría un estudiante. El docente procesa por la API. Registra errores de página, avisos y la
// retroalimentación de cada trimestre para revisar problemas.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
import { iniciar } from './servidor.mjs';
const PORT = 8799, s = await iniciar(PORT), U = s.url, OUT = process.env.CAPTURAS || '/tmp';
const br = await chromium.launch();
const api = async (fn, ...args) => { const r = await (await fetch(U + 'api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fn, args }) })).json(); if (r.ok === false) throw new Error(fn + ': ' + r.error); return r.r; };
const R = { errores: [], pasos: [] };
const EQ = [
  { nombre: 'Alfa', clave: 'alfa123', reg: '210001', ap: ['ROJAS', 'VACA', 'Ana'], seg: 'S2', inv: 'observacion', post: 'ofensiva', port: [60, 30, 10], p4: ['producto', 'posicion'] },
  { nombre: 'Beta', clave: 'beta123', reg: '210002', ap: ['SUAREZ', 'PEÑA', 'Luis'], seg: 'S5', inv: 'extremos', post: 'defensiva', port: [80, 20, 0], p4: ['producto', 'proceso'] }
];
let codigo, adm, simId;
async function nueva() {
  const pg = await br.newPage({ viewport: { width: 1280, height: 900 } });
  pg.on('pageerror', (e) => R.errores.push('página: ' + e.message));
  pg.on('console', (m) => { if (m.type() === 'error' && !/favicon|img\/logo/.test(m.text() + (m.location().url || ''))) R.errores.push('consola: ' + m.text()); });
  return pg;
}
const clic = (pg, sel) => pg.evaluate((sel) => { const e = document.querySelector(sel); if (e) e.click(); return !!e; }, sel);
const llenar = async (pg, sel, v) => { await pg.fill(sel, String(v)); await pg.dispatchEvent(sel, 'change'); await pg.waitForTimeout(120); };
async function ir(pg, menu, sub) { await pg.click('nav >> text=' + menu); await pg.waitForTimeout(250); if (sub) { await pg.click('nav .sub >> text=' + sub); await pg.waitForTimeout(450); } }
async function entrar(pg, e) {
  await pg.goto(U); await pg.waitForSelector('#axU');
  await pg.fill('#axU', e.nombre); await pg.fill('#axP', e.clave); await pg.fill('#axC', codigo); await pg.click('text=Ingresar →'); await pg.waitForTimeout(1500);
  if (await pg.isVisible('.ax-pick')) { await pg.click('.ax-pick'); await pg.waitForTimeout(1200); }
}
async function entorno(pg, e, t) {
  await ir(pg, 'Decidir', '1. Entorno');
  const ids = await pg.$$eval('.ent-not input[value="real"]', (x) => x.map((el) => el.name.slice(2)));
  for (let k = 0; k < ids.length; k++) {
    const cred = ['real', 'dudosa', 'rumor'][(k + t) % 3], post = k === 0 ? 'preparar' : 'ignorar';
    await clic(pg, 'input[name="c_' + ids[k] + '"][value="' + cred + '"]'); await clic(pg, 'input[name="p_' + ids[k] + '"][value="' + post + '"]'); await pg.waitForTimeout(150);
    if (post === 'preparar') {
      for (const [c, v] of [['sig', 'amenaza'], ['plazo', '1-2'], ['impacto', 'medio']]) { const sel = 'select[data-p="senales.' + ids[k] + '.' + c + '"]'; if (await pg.$(sel)) { await pg.selectOption(sel, v).catch(() => {}); await pg.waitForTimeout(100); } }
      const pq = 'input[data-p="senales.' + ids[k] + '.porque"]'; if (await pg.$(pq)) await llenar(pg, pq, 'Nos preparamos porque afecta a nuestros costos y clientes.');
    }
  }
  R.pasos.push(e.nombre + ' T' + t + ': Entorno con ' + ids.length + ' señales');
}
async function anual(pg, e) {
  await ir(pg, 'Decidir', '2. Estrategia anual');
  for (const k of e.p4) await clic(pg, 'input[data-p="anual.mapa4p.' + k + '"]');
  await pg.waitForTimeout(200);
  await llenar(pg, 'input[data-p="anual.mapa4p.porque"]', 'Buscaremos en ' + e.p4.join(' y ') + ' para el segmento ' + e.seg + '.');
  for (const [k, v] of [['nucleo', e.port[0]], ['adyacente', e.port[1]], ['transf', e.port[2]]]) await llenar(pg, 'input[data-p="anual.' + k + '"]', v);
  for (const [k, v] of [['postura', e.post], ['estructura', 'integrada'], ['tiempoLibre', '10'], ['incentivo', 'reconocimiento'], ['politica', 'aprendizaje'], ['composicion', 'multifuncional'], ['umbral', 'moderado'], ['capacitacion', 'no']]) { await pg.selectOption('select[data-p="anual.' + k + '"]', v); await pg.waitForTimeout(100); }
  await llenar(pg, 'textarea[data-p="anual.hipotesis"]', 'Si conocemos a ' + e.seg + ' de cerca, lanzaremos un producto que ellos usen antes de T8.');
}
async function investigacion(pg, e) {
  await ir(pg, 'Decidir', '3. Investigación');
  await clic(pg, 'input[data-arr="investigacion.metodos"][value="' + e.inv + '"]'); await pg.waitForTimeout(300);
  await clic(pg, 'input[data-arr="investigacion.segs.' + e.inv + '"][value="' + e.seg + '"]'); await pg.waitForTimeout(300);
}
async function cronograma(pg) {
  await ir(pg, 'Decidir', '4. Proyectos'); await pg.waitForTimeout(1200);
  const n = (await pg.$$('#cronoCard input[data-campo="sem"]')).length;
  for (let i = 0; i < n; i++) {
    const inp = (await pg.$$('#cronoCard input[data-campo="sem"]'))[i];
    const ref = await inp.evaluate((x) => { const tr = x.closest('tr'); const m = /(\d+(?:,\d+)?)/.exec(tr.children[1].textContent); return m ? m[1].replace(',', '.') : '1'; });
    await inp.fill(ref); await inp.dispatchEvent('change'); await pg.waitForTimeout(150);
    const ini = (await pg.$$('#cronoCard select[data-campo="ini"]'))[i]; await ini.selectOption(String(1 + (i * 2) % 8)); await pg.waitForTimeout(150);
    const fin = (await pg.$$('#cronoCard select[data-campo="fin"]'))[i]; await fin.selectOption(String(Math.min(12, 4 + (i * 2) % 8))); await pg.waitForTimeout(150);
  }
  return n;
}
async function hipotesisYEnviar(pg, e, t) {
  await ir(pg, 'Decidir', '6. Hipótesis y envío');
  await llenar(pg, 'textarea[data-p="hipotesis"]', 'Si observamos a ' + e.seg + ' en el trimestre ' + t + ', definiremos un reto con evidencia.');
  await pg.waitForTimeout(900);
  const pie = await pg.textContent('#pie');
  await pg.click('text=Enviar decisiones'); await pg.waitForTimeout(1500);
  const msg = await pg.evaluate(() => [...document.querySelectorAll('.toast,.aviso,.msg')].map((x) => x.textContent).join(' | ').slice(0, 400));
  const enviado = (s.mem.tablas.decisiones || []).some((d) => d.fila.includes('enviado') && JSON.stringify(d.fila).indexOf(t === 1 ? '' : '') >= 0);
  R.pasos.push(e.nombre + ' T' + t + ': enviar → ' + (msg || '(sin mensaje)'));
  return { pie, msg, enviado };
}
async function procesar(t) {
  await api('apiAdmin', adm, 'cerrar', { simId }); const pr = await api('apiAdmin', adm, 'procesar', { simId }); await api('apiAdmin', adm, 'abrir', { simId });
  R.pasos.push('Docente procesó T' + t + ': ' + JSON.stringify(pr).slice(0, 200));
}
try {
  // Docente: crear simulación y abrir
  const pd = await nueva();
  await pd.goto(U + '?vista=docente'); await pd.waitForSelector('#axU'); await pd.fill('#axU', s.sa.email); await pd.fill('#axP', s.sa.temporal); await pd.click('text=Ingresar →'); await pd.waitForTimeout(1200);
  await pd.fill('#axN1', 'Clave#2026'); await pd.fill('#axN2', 'Clave#2026'); await pd.click('text=Guardar y continuar →'); await pd.waitForTimeout(1000);
  await pd.fill('#snom', 'Prueba 2 trimestres'); await pd.fill('#ssig', 'COM505T'); await pd.click('text=Crear simulación y generar código'); await pd.waitForTimeout(900);
  codigo = s.mem.tablas.simulaciones[0].k1; simId = s.mem.tablas.simulaciones[0].k0 || 'S01';
  await pd.click('nav >> text=Partida'); await pd.waitForTimeout(600); await pd.click('text=Abrir trimestre'); await pd.waitForTimeout(800);
  adm = (await api('apiAXLogin', s.sa.email, 'Clave#2026')).token;
  // Registro de los dos equipos
  const P = {};
  for (const e of EQ) {
    const pg = P[e.nombre] = await nueva();
    await pg.goto(U); await pg.waitForSelector('#axU');
    await pg.click('text=Registrar mi equipo'); await pg.fill('#axRn', e.nombre); await pg.fill('#axRp', e.clave); await pg.fill('#axRp2', e.clave); await pg.fill('#axRc', codigo); await pg.waitForTimeout(800);
    const ins = await pg.$$('#axFilas .ax-fila:nth-child(1) input'); const f = [e.ap[0], e.ap[1], e.ap[2], e.reg, ''];
    for (let j = 0; j < 5; j++) await ins[j].fill(f[j]);
    await pg.click('text=✓ Registrar Equipo'); await pg.waitForTimeout(1500);
    R.pasos.push('Registrado ' + e.nombre + ': ' + (await pg.isVisible('nav >> text=Decidir')));
  }
  // ---------- T1 ----------
  for (const e of EQ) {
    const pg = P[e.nombre];
    await entorno(pg, e, 1); await anual(pg, e); await investigacion(pg, e);
    // proyecto en T1: con el informe de mercado heredado como evidencia
    await ir(pg, 'Decidir', '4. Proyectos');
    const ev = await pg.$$eval('#npEv option', (o) => o.map((x) => x.value).filter(Boolean));
    await pg.fill('#npNom', e.nombre === 'Alfa' ? 'Desayuno en movimiento' : 'Leche fácil de abrir'); await pg.selectOption('#npSeg', e.seg); if (ev[0]) await pg.selectOption('#npEv', ev[0]);
    await pg.fill('#npFrase', e.nombre === 'Alfa' ? 'Los universitarios son el segmento que más crece.' : 'Los adultos mayores compran en la tienda del barrio.');
    await pg.fill('#npInsight', e.nombre === 'Alfa' ? 'Comen apurados y en movimiento; necesitan algo que se tome con una mano.' : 'Les cuesta abrir los envases actuales y dependen de que alguien los ayude.');
    await pg.fill('#npCuando', e.nombre === 'Alfa' ? 'salgo temprano a clases' : 'quiero tomar leche a media tarde');
    await pg.fill('#npQuiero', e.nombre === 'Alfa' ? 'algo que me quite el hambre' : 'abrirla sin ayuda');
    await pg.fill('#npPara', e.nombre === 'Alfa' ? 'rendir en las clases' : 'no depender de nadie');
    await pg.fill('#npReto', e.nombre === 'Alfa' ? '¿Cómo podríamos ayudar a los universitarios a alimentarse bien mientras se trasladan?' : '¿Cómo podríamos ayudar a los adultos mayores a servirse leche sin ayuda?');
    await pg.fill('#npEncaje', e.nombre === 'Alfa' ? 'Es adyacente: segmento nuevo con nuestra misma línea de producción.' : 'Es núcleo: clientes actuales, mejora del producto que ya vendemos.');
    await pg.fill('#npCrit', '5 % de ' + e.seg + ' dos trimestres después del lanzamiento');
    await pg.selectOption('#npPort', e.nombre === 'Alfa' ? 'adyacente' : 'nucleo');
    await pg.click('text=Revisar el brief'); await pg.waitForTimeout(300);
    R.pasos.push(e.nombre + ' T1 brief: ' + (await pg.$$eval('#npRev li', (l) => l.filter((x) => /mejorar/.test(x.textContent)).map((x) => x.textContent.trim()))).join(' / '));
    await pg.click('text=Agregar proyecto'); await pg.waitForTimeout(600);
    const nAct = await cronograma(pg);
    R.pasos.push(e.nombre + ' T1 cronograma: ' + nAct + ' actividades');
    const r = await hipotesisYEnviar(pg, e, 1);
    R['envioT1_' + e.nombre] = r;
    await pg.screenshot({ path: OUT + '/sim_T1_' + e.nombre + '.png', fullPage: false });
  }
  await procesar(1);
  // ---------- T2 ----------
  for (const e of EQ) {
    const pg = P[e.nombre]; await pg.reload(); await pg.waitForTimeout(1500);
    if (await pg.isVisible('#axU')) await entrar(pg, e);
    await ir(pg, 'Resultados', 'Resumen del trimestre');
    R['fbT1_' + e.nombre] = (await pg.textContent('#app')).replace(/\s+/g, ' ').slice(0, 3000);
    await pg.screenshot({ path: OUT + '/sim_T1res_' + e.nombre + '.png', fullPage: true });
    // decisiones sobre informes recibidos
    await ir(pg, 'Resultados', 'Informes de investigación');
    const tx = await pg.$$('textarea[data-p^="decInformes."]');
    for (const x of tx) { await x.fill('Con este informe ajustamos el reto y elegimos el segmento del proyecto.'); await x.dispatchEvent('change'); await pg.waitForTimeout(120); }
    R.pasos.push(e.nombre + ' T2: ' + tx.length + ' informes con decisión');
    await entorno(pg, e, 2);
    // Idear: técnica, ideas propias, fichas, regla de selección y test
    await ir(pg, 'Decidir', '4. Proyectos');
    const pid = await pg.evaluate(() => V.estado.proyectos[0] && V.estado.proyectos[0].id);
    const etapa = await pg.evaluate(() => V.estado.proyectos[0] && V.estado.proyectos[0].etapa);
    R.pasos.push(e.nombre + ' T2 proyecto ' + pid + ' en etapa ' + etapa);
    if (pid && etapa === 'idear') {
      await pg.selectOption('select[data-p="proyectos.' + pid + '.tecnica"]', 'scamper'); await pg.waitForTimeout(400);
      for (const [k, v] of [['S', 'Botella más chica'], ['C', 'Con avena'], ['A', 'Tapa deportiva'], ['E', 'Sin vaso']]) await llenar(pg, 'textarea[data-p$=".campos.' + k + '"]', v + ' para ' + e.seg);
      await pg.click('text=3. Fichas de concepto'); await pg.waitForTimeout(400);
      const fichas = e.nombre === 'Alfa' ? [['Bebible de avena', { conv: 5, nut: 3, sab: 2 }], ['Barra láctea', { nut: 4, conv: 4, sab: 2 }]] : [['Botella con pestaña', { conv: 6, sab: 2, nut: 2 }], ['Porción chica', { nut: 4, salud: 3, sab: 3 }]];
      for (let i = 0; i < fichas.length; i++) {
        const b = 'proyectos.' + pid + '.fichas.' + i + '.';
        await llenar(pg, 'input[data-p="' + b + 'nombre"]', fichas[i][0]);
        await llenar(pg, 'input[data-p="' + b + 'precioObj"]', '9');
        await llenar(pg, 'textarea[data-p="' + b + 'frase"]', 'Para ' + e.seg + ' que necesita algo práctico, ' + fichas[i][0] + ' es una bebida láctea que resuelve su momento de consumo, a diferencia de la caja de un litro.');
        for (const [k, v] of Object.entries(fichas[i][1])) await llenar(pg, 'input[data-p="' + b + 'pts.' + k + '"]', v);
        await clic(pg, 'input[data-p="' + b + 'test"]'); await pg.waitForTimeout(250);
      }
      await llenar(pg, 'input[data-p="proyectos.' + pid + '.reglaSel.minInt"]', '30');
    }
    const n2 = await cronograma(pg);
    R.pasos.push(e.nombre + ' T2 cronograma: ' + n2 + ' actividades');
    const r = await hipotesisYEnviar(pg, e, 2);
    R['envioT2_' + e.nombre] = r;
  }
  await procesar(2);
  for (const e of EQ) {
    const pg = P[e.nombre]; await pg.reload(); await pg.waitForTimeout(1500);
    if (await pg.isVisible('#axU')) await entrar(pg, e);
    await ir(pg, 'Resultados', 'Resumen del trimestre');
    R['fbT2_' + e.nombre] = (await pg.textContent('#app')).replace(/\s+/g, ' ').slice(0, 3000);
    await pg.screenshot({ path: OUT + '/sim_T2res_' + e.nombre + '.png', fullPage: true });
    await ir(pg, 'Decidir', '4. Proyectos');
    R['proyT3_' + e.nombre] = await pg.evaluate(() => { const p = V.estado.proyectos[0]; return p ? { etapa: p.etapa, fichas: (p.fichas || []).map((f) => f.nombre + ':' + (f.test ? f.test.intencion + '%' : 'sin test')), decision: p.decision } : null; });
    await pg.screenshot({ path: OUT + '/sim_T3proy_' + e.nombre + '.png', fullPage: false });
    await ir(pg, 'Resultados', 'Estados financieros e indicadores');
    await pg.screenshot({ path: OUT + '/sim_T2ef_' + e.nombre + '.png', fullPage: true });
  }
} catch (e) { R.falla = e.message.split('\n')[0]; }
fs.writeFileSync(OUT + '/sim2_resultado.json', JSON.stringify(R, null, 1));
console.log(JSON.stringify({ falla: R.falla, errores: R.errores, pasos: R.pasos, envioT1: [R.envioT1_Alfa && R.envioT1_Alfa.msg, R.envioT1_Beta && R.envioT1_Beta.msg], envioT2: [R.envioT2_Alfa && R.envioT2_Alfa.msg, R.envioT2_Beta && R.envioT2_Beta.msg], proy: [R.proyT3_Alfa, R.proyT3_Beta] }, null, 1));
await br.close(); await s.cerrar();
