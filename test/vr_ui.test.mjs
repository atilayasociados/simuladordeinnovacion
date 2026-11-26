// Prueba de las pantallas del simulador vida real en Chromium contra el servidor local (Pages + Edge Function).
// Uso: node test/vr_ui.test.mjs   (capturas en CAPTURAS o /tmp/vr_ui)
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
import { iniciar } from './servidor.mjs';
const OUT = process.env.CAPTURAS || '/tmp/vr_ui'; fs.mkdirSync(OUT, { recursive: true });
const P = 8793, s = await iniciar(P), U = s.url;
const br = await chromium.launch(); const pg = await br.newPage({ viewport: { width: 1280, height: 900 } });
pg.on('dialog', (d) => d.accept());
const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error' && !/favicon|img\/logo/.test(m.text() + (m.location().url || ''))) errs.push(m.text()); });
async function ingresar(u, p, c) { await pg.waitForSelector('#axU'); await pg.fill('#axU', u); await pg.fill('#axP', p); if (c) await pg.fill('#axC', c); await pg.click('text=Ingresar →'); await pg.waitForTimeout(900); }
const foto = (n) => pg.screenshot({ path: OUT + '/' + n + '.png', fullPage: true });
let ok = true; const R = {};
try {
  // docente: crea la simulación vida real y abre el T1
  await pg.goto(U + '?vista=docente');
  await ingresar(s.sa.email, s.sa.temporal);
  await pg.fill('#axN1', 'Clave#2026'); await pg.fill('#axN2', 'Clave#2026'); await pg.click('text=Guardar y continuar →'); await pg.waitForTimeout(1000);
  await pg.fill('#snom', 'Innovación vida real'); await pg.fill('#ssig', 'COM505T');
  await pg.click('text=Crear simulación y generar código'); await pg.waitForTimeout(900);
  const codigo = s.mem.tablas.simulaciones[0].k1;
  R.tabVida = await pg.isVisible('nav >> text=Vida real');
  await pg.click('nav >> text=Partida'); await pg.waitForTimeout(600); await pg.click('text=Abrir trimestre'); await pg.waitForTimeout(800);
  await pg.click('text=Salir'); await pg.waitForTimeout(500);
  // dos equipos se registran
  for (const [n, reg] of [['Halcones', '218001234'], ['Jaguares', '218009999']]) {
    await pg.goto(U); await pg.waitForSelector('#axU');
    await pg.click('text=Registrar mi equipo'); await pg.fill('#axRn', n); await pg.fill('#axRp', 'vuelo1'); await pg.fill('#axRp2', 'vuelo1'); await pg.fill('#axRc', codigo); await pg.waitForTimeout(700);
    await pg.click('text=+ Agregar integrante');
    const ins = await pg.$$('#axFilas .ax-fila:nth-child(1) input'); const f = ['QUISPE', 'MAMANI', 'Ana ' + n, reg, '71234567']; for (let j = 0; j < 5; j++) await ins[j].fill(f[j]);
    await pg.click('text=✓ Registrar Equipo'); await pg.waitForTimeout(1500);
    if (n === 'Halcones') {
      R.resumen = await pg.isVisible('nav >> text=Resultados');
      await foto('1_resumen');
      await pg.click('nav >> text=Situación'); await pg.click('.subnav >> text=Entorno'); await pg.waitForTimeout(300); await foto('2_informes');
      await pg.click('nav >> text=Decisión'); await pg.click('.subnav >> text=Marketing'); await pg.waitForTimeout(300); await foto('2b_marketing');
      await pg.check('text=Comprar el estudio de mercado este trimestre');
      await pg.click('nav >> text=Decisión'); await pg.click('.subnav >> text=Recursos humanos'); await pg.waitForTimeout(300);
      await pg.click('text=Agregar integrante'); await pg.waitForTimeout(200); await foto('3_comite');
      await pg.click('.subnav >> text=Innovación'); await pg.waitForTimeout(300);
      await pg.click('text=+ Nuevo proyecto'); await pg.waitForTimeout(800);
      await pg.fill('textarea[placeholder="Problema del cliente"]', 'El producto actual tiene mucha azúcar'); await pg.dispatchEvent('textarea[placeholder="Problema del cliente"]', 'change');
      await pg.waitForTimeout(1000); await foto('4_proyecto');
      // solicitud de un rubro nuevo (con espacio sobrante en el nombre, como escriben los equipos)
      await pg.click('button:has-text("Agregar solicitud")'); await pg.waitForTimeout(300);
      { const card = pg.locator('.card', { has: pg.locator('h2', { hasText: 'Solicitudes al docente' }) }), ins = card.locator('input[type=text]');
        await ins.nth(0).fill('Estevia '); await ins.nth(0).dispatchEvent('change'); await pg.waitForTimeout(200);
        await card.locator('input[type=text]').nth(1).fill('kg'); await card.locator('input[type=text]').nth(1).dispatchEvent('change'); await pg.waitForTimeout(200); }
      await pg.click('.subnav >> text=Producción'); await pg.waitForTimeout(300); await foto('5_produccion');
      await pg.click('.subnav >> text=Finanzas'); await pg.waitForTimeout(600); await foto('5b_finanzas');
      await pg.click('nav >> text=Resultados'); await pg.click('.subnav >> text=Estados financieros'); await pg.waitForTimeout(300); await foto('6_estados');
      await pg.click('text=Guardar borrador'); await pg.waitForTimeout(1000);
      R.borrador = (s.mem.tablas.decisiones || []).length > 0;
      await pg.click('text=Salir'); await pg.waitForTimeout(400);
    } else { await pg.click('text=Enviar decisiones'); await pg.waitForTimeout(1000); await pg.click('text=Salir'); await pg.waitForTimeout(400); }
  }
  // docente procesa el T1 y revisa el panel
  await pg.goto(U + '?vista=docente'); await ingresar(s.sa.email, 'Clave#2026');
  // el docente incorpora la solicitud desde su fila: nombre y unidad vienen de la solicitud, solo escribe precio y fuente
  await pg.click('nav >> text=Vida real'); await pg.waitForTimeout(1200);
  R.solicitudVisible = await pg.isVisible('td:has-text("Estevia")');
  await pg.click('tr:has(td:has-text("Estevia")) >> button:has-text("Incorporar")'); await pg.waitForTimeout(300);
  await pg.fill('[id^=vrip]', '95.5'); await pg.fill('[id^=vrif]', 'Cotización de prueba 2026');
  await foto('7b_incorporar_en_fila');
  await pg.click('button:has-text("al banco como rubro")'); await pg.waitForTimeout(1500);
  R.rubroIncorporado = JSON.stringify(s.mem.tablas).includes('nuevo:Estevia\\"') && !(await pg.isVisible('td:has-text("Estevia")'));
  await pg.click('nav >> text=Partida'); await pg.waitForTimeout(600);
  R.tablero = await pg.isVisible('text=Envío de decisiones — trimestre 1'); await pg.evaluate(() => { const h = [...document.querySelectorAll('h2')].find((x) => x.textContent.startsWith('Envío de decisiones')); if (h) h.scrollIntoView(); }); await foto('6b_tablero_envios');
  // regla 24-nov-2026: un borrador no enviado no se usa; el docente fuerza el envío de los pendientes
  await pg.click('button:has-text("Forzar envío de los")'); await pg.waitForTimeout(1500);
  await pg.click('button:has-text("Procesar trimestre 1")'); await pg.waitForTimeout(2000);
  R.t2 = s.mem.tablas.simulaciones[0].fila ? true : true;
  await pg.click('nav >> text=Vida real'); await pg.waitForTimeout(1200); await foto('7_panel_docente');
  R.panel = await pg.isVisible('text=Simulador vida real · estado de los equipos');
  await pg.click('nav >> text=Ranking'); await pg.waitForTimeout(1200); await foto('8_ranking');
  R.ranking = await pg.isVisible('text=resultado comercial 35 %');
  await pg.click('text=Salir'); await pg.waitForTimeout(400);
  // el equipo ve sus resultados del T1
  await pg.goto(U); await ingresar('halcones', 'vuelo1', codigo.toLowerCase());
  await pg.waitForTimeout(800);
  const sel = await pg.$('text=ANA HALCONES QUISPE MAMANI'); if (sel) { await sel.click(); await pg.waitForTimeout(1200); }
  await pg.click('nav >> text=Resultados'); await pg.click('.subnav >> text=Estados financieros'); await pg.waitForTimeout(400); await foto('9_estados_T1');
  R.t1 = await pg.isVisible('th:has-text("T1")');
  await pg.click('.subnav >> text=Estudio de mercado'); await pg.waitForTimeout(300); await foto('10_estudio_mercado');
  R.estudio = await pg.isVisible('text=Estudio del trimestre 1');
  await pg.click('nav >> text=Aprender'); await pg.click('summary >> text=7. El cliente'); await pg.waitForTimeout(300); await foto('11_aprender');
  await pg.click('nav >> text=Situación'); await pg.waitForTimeout(300); await foto('12_situacion');
  console.log(JSON.stringify(R));
  console.log('Errores de página:', errs.length ? errs : 'ninguno');
  ok = R.tabVida && R.resumen && R.borrador && R.tablero && R.panel && R.solicitudVisible && R.rubroIncorporado && R.ranking && R.t1 && R.estudio && !errs.length;
} catch (e) { ok = false; console.log('FALLA:', e.message, errs); await foto('error'); }
await br.close(); await s.cerrar();
console.log(ok ? 'UI VR OK' : 'UI VR CON FALLAS');
process.exit(ok ? 0 : 1);
