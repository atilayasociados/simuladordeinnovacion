// Prueba del Manual del estudiante: acceso sin sesión (pantalla de ingreso), menú Aprender,
// enlace contextual de cada pantalla, búsqueda, "Ver todo" y vista de celular.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { iniciar } from './servidor.mjs';
const P = 8792, s = await iniciar(P), U = s.url, OUT = process.env.CAPTURAS || '/tmp';
const br = await chromium.launch(); const pg = await br.newPage({ viewport: { width: 1280, height: 900 } });
const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error' && !/favicon|img\/logo/.test(m.text() + (m.location().url || ''))) errs.push(m.text()); });
async function ingresar(u, p, c) { await pg.waitForSelector('#axU'); await pg.fill('#axU', u); await pg.fill('#axP', p); if (c) await pg.fill('#axC', c); await pg.click('text=Ingresar →'); await pg.waitForTimeout(1200); }
const R = {};
try {
  // docente: crear simulación y abrir T1
  await pg.goto(U + '?vista=docente'); await ingresar(s.sa.email, s.sa.temporal);
  await pg.fill('#axN1', 'Clave#2026'); await pg.fill('#axN2', 'Clave#2026'); await pg.click('text=Guardar y continuar →'); await pg.waitForTimeout(1000);
  await pg.fill('#snom', 'Innovación — Grupo T'); await pg.fill('#ssig', 'COM505T'); await pg.click('text=Crear simulación y generar código'); await pg.waitForTimeout(900);
  const codigo = s.mem.tablas.simulaciones[0].k1;
  await pg.click('nav >> text=Partida'); await pg.waitForTimeout(600); await pg.click('text=Abrir trimestre'); await pg.waitForTimeout(800);
  await pg.click('text=Salir'); await pg.waitForTimeout(500);
  // 1) manual sin sesión
  await pg.goto(U); await pg.waitForSelector('#axU');
  await pg.click('text=Ver Manual del Estudiante'); await pg.waitForSelector('#manPub .man-sec');
  R.publico = await pg.isVisible('#manPub >> text=Qué es el simulador');
  R.publicoSinBotonesIr = (await pg.$$('#manPub .man-sec .btn')).length === 0;
  await pg.click('#manPub .man-idx >> text=Registrarse e ingresar'); await pg.waitForTimeout(200);
  R.publicoNavega = await pg.isVisible('#manPub >> text=Registrar el equipo (una sola vez)');
  await pg.screenshot({ path: OUT + '/manual_publico.png' });
  await pg.click('#manPub >> text=Cerrar ✕'); R.cierra = !(await pg.$('#manPub')) && await pg.isVisible('#axU');
  // 2) registrar equipo
  await pg.click('text=Registrar mi equipo'); await pg.fill('#axRn', 'Halcones'); await pg.fill('#axRp', 'vuelo1'); await pg.fill('#axRp2', 'vuelo1'); await pg.fill('#axRc', codigo); await pg.waitForTimeout(800);
  const ins = await pg.$$('#axFilas .ax-fila:nth-child(1) input'); const f = ['QUISPE', 'MAMANI', 'Ana Lucía', '218001234', ''];
  for (let j = 0; j < 5; j++) await ins[j].fill(f[j]);
  await pg.click('text=✓ Registrar Equipo'); await pg.waitForTimeout(1500);
  // 3) enlace contextual desde 4. Proyectos
  await pg.click('nav >> text=Decidir'); await pg.waitForTimeout(300); await pg.click('nav .sub >> text=4. Proyectos'); await pg.waitForTimeout(300);
  R.ctx = await pg.textContent('.man-ctx');
  await pg.click('.man-ctx a'); await pg.waitForTimeout(300);
  R.ctxAbre = await pg.isVisible('.man-sec h2:has-text("Paso 4. Proyectos")');
  R.subMenu = await pg.isVisible('nav .sub button.on:has-text("Manual del estudiante")');
  // botón "Ir a" lleva a la pantalla
  await pg.click('.man-sec >> text=Ir a 4. Proyectos →'); await pg.waitForTimeout(300);
  R.irFunciona = await pg.isVisible('text=Nuevo proyecto · fase Definir');
  // 4) recorrer todas las secciones
  await pg.click('nav >> text=Aprender'); await pg.waitForTimeout(300);
  const n = await pg.$$eval('.man-idx button', (b) => b.length); let todas = true;
  for (let i = 0; i < n; i++) { await pg.click('.man-idx button >> nth=' + i); await pg.waitForTimeout(80); if (!(await pg.$('.man-sec'))) todas = false; }
  R.secciones = n; R.todasAbren = todas;
  // 5) búsqueda
  await pg.fill('#manBus', 'pugh'); await pg.waitForTimeout(200);
  R.busca = await pg.$$eval('.man-cab ~ .card li', (l) => l.map((x) => x.textContent.split(' · ')[0]));
  await pg.fill('#manBus', 'contrasena'); await pg.waitForTimeout(200);
  R.buscaSinTilde = await pg.$$eval('.man-cab ~ .card li', (l) => l.length);
  await pg.fill('#manBus', ''); await pg.waitForTimeout(200);
  // 6) ver todo
  await pg.click('text=Ver todo'); await pg.waitForTimeout(300);
  R.verTodo = await pg.$$eval('.man-sec', (x) => x.length);
  await pg.click('text=Ver por secciones'); await pg.waitForTimeout(200);
  await pg.click('.man-idx >> text=El caso y sus unidades'); await pg.waitForTimeout(200);
  await pg.screenshot({ path: OUT + '/manual_caso.png', fullPage: true });
  // 7) celular
  await pg.setViewportSize({ width: 390, height: 844 }); await pg.waitForTimeout(300);
  R.anchoCel = await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  await pg.selectOption('.man-sel', 'evaluar'); await pg.waitForTimeout(200); R.selCel = await pg.isVisible('.man-sec h2:has-text("Fase 3. Evaluar")');
  await pg.screenshot({ path: OUT + '/manual_celular.png' });
  // botón fijo de la barra superior
  await pg.setViewportSize({ width: 1280, height: 900 });
  await pg.click('nav >> text=Resultados'); await pg.waitForTimeout(200);
  await pg.click('header >> text=📘 Manual'); await pg.waitForTimeout(300);
  R.botonBarra = await pg.isVisible('.man-sec h2:has-text("Leer los resultados")');
  await pg.screenshot({ path: OUT + '/manual_boton.png' });
  // 8) tabla de cinco años del caso
  await pg.setViewportSize({ width: 1280, height: 900 });
  await pg.click('nav >> text=Situación'); await pg.waitForTimeout(300);
  R.anios = await pg.isVisible('text=Renovación: los clientes cambian lo que valoran');
} catch (e) { R.falla = e.message; }
console.log(JSON.stringify(R, null, 1)); console.log('Errores de página:', errs.length ? errs : 'ninguno');
const ok = !R.falla && R.publico && R.publicoSinBotonesIr && R.publicoNavega && R.cierra && /Paso 4/.test(R.ctx || '') && R.ctxAbre && R.subMenu && R.irFunciona && R.todasAbren && R.busca.length >= 1 && R.buscaSinTilde >= 1 && R.verTodo === R.secciones && R.anchoCel && R.selCel && R.botonBarra && R.anios && !errs.length;
await br.close(); await s.cerrar();
console.log(ok ? 'MANUAL OK' : 'MANUAL CON FALLAS'); process.exit(ok ? 0 : 1);
