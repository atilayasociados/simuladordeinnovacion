// Prueba de la pantalla publicada (docs/index.html) en Chromium contra el servidor local que imita
// GitHub Pages + Edge Function. Mismo recorrido que test/ui.js de la versión de Apps Script.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { iniciar } from './servidor.mjs';
const P = 8791, s = await iniciar(P), U = s.url;
const br = await chromium.launch(); const pg = await br.newPage({ viewport: { width: 1280, height: 900 } });
const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error' && !/favicon|img\/logo/.test(m.text() + (m.location().url || ''))) errs.push(m.text()); });
async function ingresar(u, p, c) { await pg.waitForSelector('#axU'); await pg.fill('#axU', u); await pg.fill('#axP', p); if (c) await pg.fill('#axC', c); await pg.click('text=Ingresar →'); await pg.waitForTimeout(900); }
const sim = () => s.mem.tablas.simulaciones[0];
let ok = true; const R = {};
try {
  await pg.goto(U + '?vista=docente');
  await ingresar(s.sa.email, s.sa.temporal);
  const pideCambio = await pg.isVisible('#axN1');
  await pg.fill('#axN1', 'Clave#2026'); await pg.fill('#axN2', 'Clave#2026'); await pg.click('text=Guardar y continuar →'); await pg.waitForTimeout(1000);
  await pg.fill('#snom', 'Innovación — Grupo T'); await pg.fill('#ssig', 'COM505T'); await pg.click('text=Crear simulación y generar código'); await pg.waitForTimeout(900);
  await pg.click('nav >> text=Simulaciones').catch(() => {}); await pg.waitForTimeout(500);
  await pg.click('button:has-text("Cambiar")'); await pg.waitForSelector('#axNC'); await pg.fill('#axNC', 'inno-2026'); await pg.click('#axNCsi'); await pg.waitForTimeout(1200);
  const codCambiado = sim().k1 === 'INNO-2026';
  const codigo = sim().k1;
  await pg.click('nav >> text=Partida'); await pg.waitForTimeout(600); await pg.click('text=Abrir trimestre'); await pg.waitForTimeout(800);
  await pg.click('text=Salir'); await pg.waitForTimeout(500);
  await pg.goto(U); await pg.waitForSelector('#axU');
  const logos = await pg.evaluate(() => Array.from(document.querySelectorAll('.ax-logo')).map((i) => (i.querySelector('img') ? i.querySelector('img').getAttribute('src') : 'texto:' + i.textContent)));
  await pg.click('text=Registrar mi equipo'); await pg.fill('#axRn', 'Halcones'); await pg.fill('#axRp', 'vuelo1'); await pg.fill('#axRp2', 'vuelo1'); await pg.fill('#axRc', codigo); await pg.waitForTimeout(700);
  await pg.click('text=+ Agregar integrante');
  const filas = [['QUISPE', 'MAMANI', 'Ana Lucía', '218001234', '71234567'], ['Rojas', 'Vaca', 'Luis', '218005678', '']];
  for (let i = 0; i < 2; i++) { const ins = await pg.$$('#axFilas .ax-fila:nth-child(' + (i + 1) + ') input'); for (let j = 0; j < 5; j++) await ins[j].fill(filas[i][j]); }
  await pg.click('text=✓ Registrar Equipo'); await pg.waitForTimeout(1500);
  const enTrabajo = await pg.isVisible('nav >> text=Situación');
  await pg.click('nav >> text=Decidir'); await pg.waitForTimeout(300); await pg.click('nav .sub >> text=2. Estrategia anual'); await pg.waitForTimeout(300);
  R.anualEnBlanco = !(await pg.isChecked('input[data-p="anual.mapa4p.producto"]')) && await pg.inputValue('select[data-p="anual.postura"]') === '';
  for (const k of ['producto', 'posicion']) await pg.evaluate((k) => { const e = document.querySelector('input[data-p="anual.mapa4p.' + k + '"]'); if (e && !e.checked) e.click(); }, k); await pg.waitForTimeout(300);
  await pg.fill('input[data-p="anual.mapa4p.porque"]', 'Buscaremos en producto y posición para los universitarios.'); await pg.dispatchEvent('input[data-p="anual.mapa4p.porque"]', 'change');
  for (const [k, v] of [['nucleo', '60'], ['adyacente', '30'], ['transf', '10']]) await pg.fill('input[data-p="anual.' + k + '"]', v);
  for (const [k, v] of [['postura', 'ofensiva'], ['estructura', 'integrada'], ['tiempoLibre', '10'], ['incentivo', 'reconocimiento'], ['politica', 'aprendizaje'], ['composicion', 'multifuncional'], ['umbral', 'moderado'], ['capacitacion', 'no']]) await pg.selectOption('select[data-p="anual.' + k + '"]', v);
  await pg.fill('textarea[data-p="anual.hipotesis"]', 'Con 30 % adyacente lanzaremos un producto para universitarios antes de T8.'); await pg.waitForTimeout(300);
  await pg.click('nav .sub >> text=1. Entorno'); await pg.waitForTimeout(300);
  for (const v of ['dudosa', 'ignorar']) { for (let k = 0; k < 20; k++) { const hay = await pg.evaluate((v) => { const r = document.querySelector('input[type=radio][value="' + v + '"]:not(:checked)'); if (!r) return false; r.click(); return true; }, v); if (!hay) break; await pg.waitForTimeout(120); } }
  await pg.click('nav .sub >> text=Hipótesis'); await pg.fill('textarea[data-p="hipotesis"]', 'Si observamos a los universitarios descubriremos necesidades latentes.'); await pg.dispatchEvent('textarea[data-p="hipotesis"]', 'change');
  await pg.waitForTimeout(700); await pg.click('text=Enviar decisiones'); await pg.waitForTimeout(900);
  const enviado = (s.mem.tablas.decisiones || []).some((d) => d.fila.includes('enviado') && d.fila.map(String).includes('218001234'));
  await pg.click('text=Salir'); await ingresar('halcones', 'vuelo1', codigo.toLowerCase());
  await pg.click('text=LUIS ROJAS VACA'); await pg.waitForTimeout(1200);
  const quien = await pg.evaluate(() => V && V.usuario.registro);
  await pg.screenshot({ path: process.env.CAPTURA || '/tmp/ui_supabase.png' });
  console.log('Superadmin obligado a cambiar la temporal:', pideCambio, '| código cambiado:', codCambiado, '| registro entra a trabajar:', enTrabajo, '| T1 enviado:', enviado, '| reingreso como 218005678:', quien === '218005678');
  console.log('Logos:', logos.join(', '), '| llamadas a la API:', s.llamadas.total, '(sin clave publicable: ' + s.llamadas.sinClave + ')');
  console.log('Errores de página:', errs.length ? errs : 'ninguno');
  console.log('Estrategia anual en blanco al inicio:', R.anualEnBlanco); ok = R.anualEnBlanco && pideCambio && codCambiado && enTrabajo && enviado && quien === '218005678' && !errs.length && !s.llamadas.sinClave;
} catch (e) { ok = false; console.log('FALLA:', e.message, errs); }
await br.close(); await s.cerrar();
console.log(ok ? 'UI OK' : 'UI CON FALLAS');
process.exit(ok ? 0 : 1);
