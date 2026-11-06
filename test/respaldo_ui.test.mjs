// Panel docente: 📦 Archivar · 💾 Backup · 📂 Restaurar · ✕ Eliminar, con el servidor de Supabase en memoria.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
import { iniciar } from './servidor.mjs';
const s = await iniciar(8795), U = s.url, OUT = process.env.CAPTURAS || '/tmp';
const br = await chromium.launch(); const ctx = await br.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 950 } }); const pg = await ctx.newPage();
const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
const R = {}; const fila = (txt) => pg.locator('tr', { hasText: txt });
async function ingresar(u, p, c) { await pg.waitForSelector('#axU'); await pg.fill('#axU', u); await pg.fill('#axP', p); if (c) await pg.fill('#axC', c); await pg.click('text=Ingresar →'); await pg.waitForTimeout(1200); }
try {
  await pg.goto(U + '?vista=docente'); await ingresar(s.sa.email, s.sa.temporal);
  await pg.fill('#axN1', 'Clave#2026'); await pg.fill('#axN2', 'Clave#2026'); await pg.click('text=Guardar y continuar →'); await pg.waitForTimeout(1000);
  for (const [n, sg] of [['Grupo Mañana', 'COM505T'], ['Grupo Noche', 'COM512A']]) { await pg.fill('#snom', n); await pg.fill('#ssig', sg); await pg.click('text=Crear simulación y generar código'); await pg.waitForTimeout(900); }
  const sims = s.mem.tablas.simulaciones.map((r) => ({ id: r.sim_id, codigo: r.k1 }));
  // un equipo en la primera
  await pg.click('text=Salir'); await pg.goto(U); await pg.waitForSelector('#axU');
  await pg.click('text=Registrar mi equipo'); await pg.fill('#axRn', 'Halcones'); await pg.fill('#axRp', 'vuelo1'); await pg.fill('#axRp2', 'vuelo1'); await pg.fill('#axRc', sims[0].codigo); await pg.waitForTimeout(800);
  const ins = await pg.$$('#axFilas .ax-fila:nth-child(1) input'); const f = ['QUISPE', 'MAMANI', 'Ana', '218001234', '']; for (let j = 0; j < 5; j++) await ins[j].fill(f[j]);
  await pg.click('text=✓ Registrar Equipo'); await pg.waitForTimeout(1500); await pg.click('text=Salir'); await pg.waitForTimeout(400);
  await pg.goto(U + '?vista=docente'); await ingresar(s.sa.email, 'Clave#2026');
  await pg.click('nav >> text=Simulaciones'); await pg.waitForTimeout(500);
  R.botones = await fila('Grupo Mañana').locator('.sim-acc button').allInnerTexts();
  R.restaurarVisible = await pg.isVisible('text=📂 Restaurar desde un respaldo');
  await pg.screenshot({ path: OUT + '/sim_acciones.png' });
  // 💾 Backup
  const [dl] = await Promise.all([pg.waitForEvent('download'), fila('Grupo Mañana').locator('text=💾 Backup').click()]);
  const ruta = OUT + '/' + dl.suggestedFilename(); await dl.saveAs(ruta); const B = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  R.backup = dl.suggestedFilename() + ' · equipos ' + B.simulacion.equipos + ' · integrantes ' + B.simulacion.integrantes;
  // ✕ Eliminar
  await fila('Grupo Mañana').locator('text=✕ Eliminar').click(); await pg.waitForSelector('#simDC');
  R.eliminarBloqueado = await pg.isDisabled('#simDSi');
  await pg.screenshot({ path: OUT + '/sim_eliminar.png' });
  await pg.fill('#simDC', sims[0].codigo.toLowerCase()); R.eliminarHabilitado = await pg.isEnabled('#simDSi');
  await pg.click('#simDSi'); await pg.waitForTimeout(1200);
  R.eliminada = !(await fila('Grupo Mañana').count()) && s.mem.tablas.equipos.length === 0;
  // 📂 Restaurar
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('text=📂 Restaurar desde un respaldo')]);
  await fc.setFiles(ruta); await pg.waitForSelector('#simRSi'); await pg.screenshot({ path: OUT + '/sim_restaurar.png' });
  await pg.click('#simRSi'); await pg.waitForTimeout(1500);
  R.restaurada = (await fila('Grupo Mañana').count()) === 1 && s.mem.tablas.equipos.length === 1;
  R.codigoIgual = await fila('Grupo Mañana').locator('.ax-codigo').innerText() === sims[0].codigo;
  // activar y entrar como el equipo con su contraseña
  await fila('Grupo Mañana').locator('button:has-text("Activar")').click(); await pg.waitForTimeout(900);
  await pg.click('text=Salir'); await pg.goto(U); await ingresar('Halcones', 'vuelo1', sims[0].codigo);
  await pg.waitForTimeout(800); if (await pg.isVisible('text=¿Quién eres?')) { await pg.click('.ax-quien button >> nth=0').catch(() => {}); await pg.waitForTimeout(800); }
  R.equipoEntra = await pg.isVisible('header >> text=📘 Manual');
  await pg.click('text=Salir'); await pg.waitForTimeout(400);
  // 📦 Archivar y desarchivar
  await pg.goto(U + '?vista=docente'); await ingresar(s.sa.email, 'Clave#2026'); await pg.click('nav >> text=Simulaciones'); await pg.waitForTimeout(500);
  await fila('Grupo Noche').locator('text=📦 Archivar').click(); await pg.click('#axMSi'); await pg.waitForTimeout(1000);
  R.archivadaSeccion = await pg.isVisible('h2:has-text("Simulaciones archivadas (1)")');
  await pg.screenshot({ path: OUT + '/sim_archivadas.png', fullPage: true });
  await fila('Grupo Noche').locator('text=↩ Desarchivar').click(); await pg.waitForTimeout(1000);
  R.desarchivada = !(await pg.isVisible('h2:has-text("Simulaciones archivadas")')) && (await fila('Grupo Noche').locator('text=📦 Archivar').count()) === 1;
} catch (e) { R.falla = e.message; }
console.log(JSON.stringify(R, null, 1)); console.log('Errores JS:', errs.length ? errs : 'ninguno');
const ok = !R.falla && R.botones.join('|').includes('Archivar') && R.restaurarVisible && /respaldo_.*\.json · equipos 1 · integrantes 1/.test(R.backup) && R.eliminarBloqueado && R.eliminarHabilitado && R.eliminada && R.restaurada && R.codigoIgual && R.equipoEntra && R.archivadaSeccion && R.desarchivada && !errs.length;
await br.close(); await s.cerrar(); console.log(ok ? 'RESPALDO UI OK' : 'RESPALDO UI CON FALLAS'); process.exit(ok ? 0 : 1);
