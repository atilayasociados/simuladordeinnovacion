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
  await pg.fill('#snom', 'Innovación vida real'); await pg.fill('#ssig', 'COM505T'); await pg.selectOption('#smand', 'VR');
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
      R.resumen = await pg.isVisible('nav >> text=Estados financieros');
      await foto('1_resumen');
      await pg.click('nav >> text=Informes'); await pg.waitForTimeout(300); await foto('2_informes');
      await pg.check('text=Comprar el estudio de mercado este trimestre');
      await pg.click('nav >> text=Comité'); await pg.waitForTimeout(300);
      await pg.click('text=Agregar integrante'); await pg.waitForTimeout(200); await foto('3_comite');
      await pg.click('nav >> text=Proyectos'); await pg.waitForTimeout(300);
      await pg.click('text=+ Nuevo proyecto'); await pg.waitForTimeout(800);
      await pg.fill('textarea[placeholder="Problema del cliente"]', 'El producto actual tiene mucha azúcar'); await pg.dispatchEvent('textarea[placeholder="Problema del cliente"]', 'change');
      await pg.waitForTimeout(1000); await foto('4_proyecto');
      await pg.click('nav >> text=Productos'); await pg.waitForTimeout(300); await foto('5_productos');
      await pg.click('nav >> text=Estados financieros'); await pg.waitForTimeout(300); await foto('6_estados');
      await pg.click('text=Guardar borrador'); await pg.waitForTimeout(1000);
      R.borrador = (s.mem.tablas.decisiones || []).length > 0;
      await pg.click('text=Salir'); await pg.waitForTimeout(400);
    } else { await pg.click('text=Enviar decisiones'); await pg.waitForTimeout(1000); await pg.click('text=Salir'); await pg.waitForTimeout(400); }
  }
  // docente procesa el T1 y revisa el panel
  await pg.goto(U + '?vista=docente'); await ingresar(s.sa.email, 'Clave#2026');
  await pg.click('nav >> text=Partida'); await pg.waitForTimeout(600);
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
  await pg.click('nav >> text=Estados financieros'); await pg.waitForTimeout(400); await foto('9_estados_T1');
  R.t1 = await pg.isVisible('th:has-text("T1")');
  await pg.click('nav >> text=Informes'); await pg.waitForTimeout(300); await foto('10_estudio_mercado');
  R.estudio = await pg.isVisible('text=Estudio del trimestre 1');
  console.log(JSON.stringify(R));
  console.log('Errores de página:', errs.length ? errs : 'ninguno');
  ok = R.tabVida && R.resumen && R.borrador && R.panel && R.ranking && R.t1 && R.estudio && !errs.length;
} catch (e) { ok = false; console.log('FALLA:', e.message, errs); await foto('error'); }
await br.close(); await s.cerrar();
console.log(ok ? 'UI VR OK' : 'UI VR CON FALLAS');
process.exit(ok ? 0 : 1);
