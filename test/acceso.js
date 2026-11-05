// Pruebas de aceptación del acceso v2.3 (sección F de la especificación).
const fs = require('fs'), path = require('path'), http = require('http');
const { makeGas } = require('./gasmock');
const OUT = '/mnt/user-data/outputs/capturas_acceso';
fs.mkdirSync(OUT, { recursive: true });
const R = []; let fallos = 0;
function prueba(n, nombre, fn) { try { const det = fn(); R.push([n, nombre, 'OK', det || '']); } catch (e) { fallos++; R.push([n, nombre, 'FALLA', e.message]); } }
function exige(c, m) { if (!c) throw new Error(m); }
function falla(fn, txt) { try { fn(); } catch (e) { if (txt && !String(e.message).includes(txt)) throw new Error('error distinto: ' + e.message); return e.message; } throw new Error('se esperaba un error'); }

// ---------- datos de la versión anterior (v2.2) para probar la migración ----------
const G = makeGas();
const ss = G.SpreadsheetApp.getActive();
function hoja(n, head, filas) { const s = ss.insertSheet(n); s.appendRow(head); (filas || []).forEach(f => s.appendRow(f)); }
hoja('Config', ['clave', 'valor', 'descripcion'], [['CLAVE_DOCENTE', 'docente1234', '']]);
hoja('Simulaciones', ['simId', 'codigo', 'nombre', 'sigla', 'semilla', 'trimestre', 'estado', 'mandato', 'maxIntegrantes', 'registroAbierto', 'creada'], [['S01', 'ABC234', 'Innovación — Grupo T', 'COM505T', '123', 1, 'cerrado', 'MA', 5, true, new Date()]]);
hoja('Equipos', ['equipoId', 'simId', 'nombre', 'mandato', 'creado', 'registradoPor'], [['S01-E01', 'S01', 'Antiguos', 'MA', new Date(), '218900']]);
hoja('Integrantes', ['simId', 'equipoId', 'registro', 'apPaterno', 'apMaterno', 'nombres', 'celular', 'pin', 'creado'], [['S01', 'S01-E01', '218900', 'VACA', 'ROCA', 'ANA', '71234567', "'2468", new Date()]]);
const mig = G.instalar();
prueba(0, 'Migración desde v2.2 (datos existentes)', () => {
  const sa = G.rows_('Docentes')[0];
  exige(sa && sa.rol === 'superadmin' && sa.email === 'docente@test.bo', 'superadmin no creado');
  exige(mig.superadmin.temporal === 'docente1234', 'la contraseña temporal del superadmin debe ser la clave docente anterior');
  const e = G.rows_('Equipos')[0];
  exige(e.claveHash && e.claveTemporal === true, 'el equipo existente no recibió contraseña temporal');
  exige(G._props['AX_TMP_S01-E01'], 'la contraseña temporal del equipo no queda para el docente');
  exige(G.rows_('Integrantes').every(i => !i.pin), 'quedaron PIN legibles');
  exige(G.rows_('Simulaciones')[0].docenteId === 'D01' && G.rows_('Simulaciones')[0].acceso === 'activa', 'simulación sin dueño o sin estado de acceso');
  exige(/retirada/.test(G.cfgGet_('CLAVE_DOCENTE')), 'la clave docente sigue legible en Config');
  const L = G.apiAXLogin('antiguos', G._props['AX_TMP_S01-E01'], 'abc234');
  exige(L.cambiarClave, 'el equipo migrado no está obligado a cambiar la contraseña');
  return 'superadmin ' + sa.email + ' (temporal = clave docente anterior); equipo "Antiguos" con temporal; PIN retirados';
});
// superadmin cambia su contraseña temporal
const Lsa = G.apiAXLogin('docente@test.bo', 'docente1234');
G.apiAXCambiarClave(Lsa.token, 'docente1234', 'Super#2026');
const adm = G.apiAXLogin('docente@test.bo', 'Super#2026').token;
const sim = G.apiAdmin(adm, 'crearSimulacion', { nombre: 'Innovación — Grupo U', sigla: 'COM505T', maxIntegrantes: 5, mandato: 'MA' });
const est = (n, reg, cel) => ({ apPaterno: 'Pérez', apMaterno: 'Rojas', nombres: 'Ana ' + n, registro: reg, celular: cel || '' });

prueba(1, 'Registrar un equipo con código válido y 3 integrantes', () => {
  exige(/^INN-[A-Z0-9]{4}$/.test(sim.codigo), 'código sin formato INN-XXXX');
  const info = G.apiAXInfoCodigo(sim.codigo.toLowerCase());
  exige(info.ok && /Grupo U/.test(info.nombre), 'validación en vivo del código');
  const r = G.apiRegistrarEquipo(sim.codigo, { nombreEquipo: 'Halcones', clave: 'vuelo1', confirmar: 'vuelo1', integrantes: [est(1, '218001', '71234567'), est(2, '218002'), est(3, '218003')] });
  const eq = G.equiposDe_(sim.simId).filter(e => e.nombre === 'Halcones')[0];
  exige(eq && G.integrantesDe_(sim.simId, eq.equipoId).length === 3, 'no quedó guardado en las hojas');
  const v = G.apiEstado(r.token);
  exige(v.equipo.nombre === 'Halcones' && v.usuario.registro === '218001', 'no entra directamente');
  return 'equipo ' + eq.equipoId + ' con 3 integrantes; entra directo como 218001';
});
prueba(2, 'Código inválido o nombre repetido: error y no crea nada', () => {
  const antes = G.rows_('Equipos').length, ia = G.rows_('Integrantes').length;
  exige(!G.apiAXInfoCodigo('INN-ZZZZ').ok, 'código inválido aceptado en vivo');
  const m1 = falla(() => G.apiRegistrarEquipo('INN-ZZZZ', { nombreEquipo: 'Otro', clave: '1234', integrantes: [est(7, '218007')] }), 'no es válido');
  const m2 = falla(() => G.apiRegistrarEquipo(sim.codigo, { nombreEquipo: 'HALCONES', clave: '1234', integrantes: [est(8, '218008')] }), 'Ya existe');
  exige(G.rows_('Equipos').length === antes && G.rows_('Integrantes').length === ia, 'se creó algo');
  return '«' + m1 + '» · «' + m2 + '»';
});
prueba(3, '5 intentos fallidos: bloqueo temporal', () => {
  for (let i = 0; i < 5; i++) falla(() => G.apiAXLogin('Halcones', 'mala' + i, sim.codigo), 'no son correctos');
  const m = falla(() => G.apiAXLogin('Halcones', 'vuelo1', sim.codigo), 'Demasiados intentos');
  const md = [];
  for (let i = 0; i < 5; i++) md.push(falla(() => G.apiAXLogin('docente@test.bo', 'x' + i)));
  falla(() => G.apiAXLogin('docente@test.bo', 'Super#2026'), 'Demasiados intentos');
  exige(md.every(x => x === md[0]), 'los mensajes revelan algo distinto');
  // vencida la ventana de 15 minutos, vuelve a entrar
  G.rows_('IntentosLogin').forEach(r => { r.fecha = new Date(Date.now() - 16 * 60000); G.updateRow_('IntentosLogin', r); });
  exige(!!G.apiAXLogin('Halcones', 'vuelo1', sim.codigo).token, 'no se desbloquea después de 15 minutos');
  return 'mensaje: «' + m + '»; el error de usuario o contraseña es el mismo («' + md[0] + '»)';
});
prueba(4, 'Contraseña temporal: obliga a cambiarla', () => {
  const eq = G.equiposDe_(sim.simId).filter(e => e.nombre === 'Halcones')[0];
  const t = G.apiAXEquipos(adm, 'claveTemporal', { simId: sim.simId, equipoId: eq.equipoId }).clave;
  const L = G.apiAXLogin('halcones', t, sim.codigo);
  exige(L.cambiarClave, 'no marca el cambio obligatorio');
  falla(() => G.apiEstado(L.token), 'temporal');
  falla(() => G.apiAXElegir(L.token, '218002'), 'temporal');
  G.apiAXCambiarClave(L.token, t, 'nueva22');
  G.apiAXElegir(L.token, '218002');
  exige(G.apiEstado(L.token).usuario.registro === '218002', 'no entra después de cambiarla');
  falla(() => G.apiAXLogin('Halcones', t, sim.codigo), 'no son correctos');
  return 'la temporal ' + t + ' solo sirve para crear una nueva; después elige integrante y entra';
});
let tokProf = null;
prueba(5, 'Invitación usada o vencida: se rechaza', () => {
  const inv = G.apiAXDocentes(adm, 'invitar', { pregunta: '¿Ciudad donde nació?', rol: 'profesor' });
  const tok = inv.enlace.split('invitacion=')[1];
  exige(G.apiAXInvitacion(tok).ok, 'invitación nueva no válida');
  const a = G.apiAXAlta(tok, { nombre: 'Prof. Luis Rojas', email: 'luis@uagrm.edu.bo', clave: 'Profe#01', confirmar: 'Profe#01', respuesta: 'Montero' });
  tokProf = a.token;
  const m1 = falla(() => G.apiAXAlta(tok, { nombre: 'Otra Persona', email: 'otra@uagrm.edu.bo', clave: 'Profe#02', respuesta: 'x y' }), 'ya fue usado');
  const inv2 = G.apiAXDocentes(adm, 'invitar', { pregunta: '¿Color favorito?', rol: 'profesor' });
  const tok2 = inv2.enlace.split('invitacion=')[1];
  const fila = G.rows_('Invitaciones').filter(r => r.invId === 'INV002')[0]; fila.vence = new Date(Date.now() - 60000); G.updateRow_('Invitaciones', fila);
  const e2 = G.apiAXInvitacion(tok2);
  exige(!e2.ok && /venció/.test(e2.mensaje), 'la vencida no se rechaza');
  const e3 = G.apiAXInvitacion('no-existe');
  exige(!e3.ok, 'un enlace inventado se acepta');
  // recuperación por pregunta de seguridad
  exige(G.apiAXPregunta('luis@uagrm.edu.bo').pregunta === '¿Ciudad donde nació?', 'no muestra la pregunta');
  falla(() => G.apiAXRecuperar('luis@uagrm.edu.bo', 'Warnes', 'Nueva#99'), 'no es correcta');
  G.apiAXRecuperar('luis@uagrm.edu.bo', '  montero ', 'Nueva#99');
  tokProf = G.apiAXLogin('luis@uagrm.edu.bo', 'Nueva#99').token;
  return '«' + m1 + '» · «' + e2.mensaje + '»; recuperación por pregunta probada';
});
prueba(6, 'Ninguna contraseña legible en las hojas', () => {
  const secretos = ['docente1234', 'Super#2026', 'vuelo1', 'nueva22', 'Profe#01', 'Nueva#99', 'Montero', 'montero', '2468', G._props['AX_TMP_S01-E01']];
  const hallados = [];
  Object.keys(G._sheets).forEach(n => G._sheets[n].data.forEach((row, i) => row.forEach(c => { const v = String(c); secretos.forEach(s => { if (s && v.indexOf(s) >= 0) hallados.push(n + '!' + (i + 1) + ': ' + s); }); })));
  exige(!hallados.length, 'texto legible: ' + hallados.join(', '));
  const d = G.rows_('Docentes')[0], e = G.rows_('Equipos')[0];
  exige(/^[0-9a-f]{64}$/.test(d.claveHash) && d.claveSal && /^[0-9a-f]{64}$/.test(e.claveHash), 'no son hash SHA-256 con sal');
  return Object.keys(G._sheets).length + ' hojas revisadas; contraseñas y respuestas solo como SHA-256 con sal';
});
prueba(7, 'Un profesor no ve las simulaciones de otro', () => {
  const propia = G.apiAdmin(tokProf, 'crearSimulacion', { nombre: 'Juego de Negocios — D', sigla: 'COM540D', maxIntegrantes: 3, mandato: 'MA' });
  const lp = G.apiAdmin(tokProf, 'simulaciones', {}).lista.map(s => s.simId);
  exige(lp.length === 1 && lp[0] === propia.simId, 'el profesor ve otras simulaciones: ' + lp.join(','));
  falla(() => G.apiAdmin(tokProf, 'resumen', { simId: sim.simId }), 'no encontrada');
  falla(() => G.apiAXEquipos(tokProf, 'listar', { simId: sim.simId }), 'no encontrada');
  falla(() => G.apiAXDocentes(tokProf, 'listar'), 'superadministrador');
  const ls = G.apiAdmin(adm, 'simulaciones', {}).lista.map(s => s.simId);
  exige(ls.length === 3, 'el superadmin no ve todas');
  return 'profesor ve 1 (la suya); superadmin ve ' + ls.length;
});
prueba(8, 'Después de ingresar se llega a la pantalla de trabajo y el simulador funciona igual', () => {
  const tk = G.apiAXLogin('Halcones', 'nueva22', sim.codigo).token; G.apiAXElegir(tk, '218003');
  G.apiAdmin(adm, 'abrir', { simId: sim.simId });
  const v = G.apiEstado(tk);
  exige(v.partida && v.estado && v.cat && v.usuario.registro === '218003', 'falta la pantalla de trabajo');
  G.apiGuardar(tk, { noticias: {}, proyectos: {}, productos: {}, hipotesis: 'Hipótesis de prueba del acceso nuevo para el trimestre 1' }, true);
  const p = G.apiAdmin(adm, 'procesar', { simId: sim.simId });
  exige(p.ok, 'no procesó: ' + p.mensaje);
  const v2 = G.apiEstado(tk);
  exige(v2.partida.t === 2 && v2.estado.hist.length === 1, 'no avanzó el trimestre');
  const dec = G.rows_('Decisiones').filter(d => Number(d.trimestre) === 1)[0];
  exige(String(dec.enviadoPor) === '218003', 'no conserva quién envió');
  G.apiAXSalir(tk); falla(() => G.apiEstado(tk), 'expiró');
  return 'T1 enviado por 218003 y procesado; al salir la sesión se cierra';
});

// ---------- 9. diseño en Chromium ----------
const read = f => fs.readFileSync(path.join(__dirname, '..', 'fuente', f), 'utf8');
function pagina(vista, inv) {
  let h = read('Index.html').replace(/<link[^>]*fonts\.(googleapis|gstatic)[^>]*>/g, '');
  h = h.replace(/<\?!= include\('([A-Za-z]+)'\); \?>/g, (m, f) => (f === 'App' ? shim : '') + read(f + '.html'));
  return h.replace("<?= vista ?>", vista).replace("<?= invitacion ?>", inv || '');
}
const shim = `<script>window.google={script:{get run(){var ok=function(){},ko=function(){};var p=new Proxy({}, {get:function(_,k){
 if(k==='withSuccessHandler')return function(f){ok=f;return p;}; if(k==='withFailureHandler')return function(f){ko=f;return p;};
 return function(){var a=Array.prototype.slice.call(arguments);fetch('/api/'+k,{method:'POST',body:JSON.stringify(a)}).then(r=>r.json()).then(r=>r.error?ko({message:r.error}):ok(r.result));};}});return p;}}};</script>`;
const PUERTO = 8781;
const srv = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    let b = ''; req.on('data', c => b += c); req.on('end', () => {
      const fn = req.url.slice(5); let out;
      try { if (!/^api[A-Z]/.test(fn)) throw new Error('no permitido'); out = { result: G[fn].apply(null, JSON.parse(b)) }; } catch (e) { out = { error: e.message }; }
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(out));
    }); return;
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (req.url.startsWith('/sites')) { res.end('<!doctype html><html><body style="margin:0;background:#f1f3f4;font-family:Arial"><div style="height:64px;background:#fff;border-bottom:1px solid #ddd;display:flex;align-items:center;padding:0 24px;color:#333">Google Sites · simuladordeinnovacionatila</div><iframe src="/" style="width:100%;height:820px;border:0" sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-downloads"></iframe></body></html>'); return; }
  const inv = (req.url.match(/invitacion=([A-Za-z0-9-]+)/) || [])[1];
  res.end(pagina(req.url.includes('vista=docente') ? 'docente' : 'estudiante', inv));
}).listen(PUERTO);
(async () => {
  const { chromium } = require('playwright');
  const br = await chromium.launch(), errs = [];
  const U = 'http://localhost:' + PUERTO;
  try {
    const pc = await br.newPage({ viewport: { width: 1280, height: 1000 } }); pc.on('pageerror', e => errs.push(e.message));
    await pc.goto(U + '/'); await pc.waitForSelector('#axU');
    const pwFondo = await pc.evaluate(() => getComputedStyle(document.querySelector('#axP')).backgroundColor);
    const est1 = await pc.evaluate(() => { const c = document.querySelector('.ax-card'), cs = getComputedStyle(c), b = getComputedStyle(document.querySelector('#ax')), l = document.querySelector('.ax-logo'), t = getComputedStyle(document.querySelector('.ax-title')), inp = getComputedStyle(document.querySelector('#axC'));
      return { ancho: c.getBoundingClientRect().width, radio: cs.borderRadius, padding: cs.paddingTop, blur: cs.backdropFilter || cs.webkitBackdropFilter, fondoSvg: /svg/.test(b.backgroundImage), logo: l.getBoundingClientRect().width, tituloFuente: t.fontFamily, tituloEsp: t.letterSpacing, codigoFuente: inp.fontFamily, codigoMay: inp.textTransform, pie: document.querySelector('.ax-foot').textContent, ojo: !!document.querySelector('.ax-eye') }; });
    await pc.screenshot({ path: OUT + '/1_ingresar_1280.png' });
    await pc.fill('#axU', 'Halcones'); await pc.fill('#axP', 'mala'); await pc.fill('#axC', sim.codigo); await pc.click('text=Ingresar →'); await pc.waitForTimeout(500);
    const errRojo = await pc.evaluate(() => { const e = document.querySelector('#axErr'); return { txt: e.textContent, color: getComputedStyle(e).color }; });
    await pc.screenshot({ path: OUT + '/2_error_1280.png' });
    await pc.click('text=Registrar mi equipo'); await pc.waitForSelector('#axRn');
    await pc.fill('#axRn', 'Cóndores'); await pc.fill('#axRp', 'andes1'); await pc.fill('#axRp2', 'andes1'); await pc.fill('#axRc', sim.codigo.toLowerCase()); await pc.waitForTimeout(800);
    const codOk = await pc.textContent('#axRcm');
    await pc.click('text=+ Agregar integrante'); await pc.click('text=+ Agregar integrante');
    const filas = [['QUISPE', 'MAMANI', 'Ana Lucía', '218101', '71234567'], ['Rojas', 'Vaca', 'Luis', '218102', ''], ['Suárez', '', 'Marta', '218103', '']];
    for (let i = 0; i < 3; i++) { const ins = await pc.$$('#axFilas .ax-fila:nth-child(' + (i + 1) + ') input'); for (let j = 0; j < 5; j++) await ins[j].fill(filas[i][j]); }
    const anchoReg = await pc.evaluate(() => document.querySelector('.ax-card').getBoundingClientRect().width);
    await pc.evaluate(() => { document.getElementById('ax').scrollTop = 0; });
    await pc.screenshot({ path: OUT + '/3_registro_1280.png', fullPage: true });
    await pc.click('text=✓ Registrar Equipo'); await pc.waitForTimeout(1500);
    const enTrabajo = await pc.isVisible('nav >> text=Situación');
    await pc.screenshot({ path: OUT + '/4_pantalla_de_trabajo_tras_registro.png' });
    // ingreso del equipo con varios integrantes: ¿Quién eres?
    await pc.click('text=Salir'); await pc.waitForSelector('#axU');
    await pc.fill('#axU', 'cóndores'); await pc.fill('#axP', 'andes1'); await pc.fill('#axC', sim.codigo); await pc.click('text=Ingresar →'); await pc.waitForSelector('.ax-pick');
    await pc.screenshot({ path: OUT + '/5_quien_eres_1280.png' });
    await pc.click('.ax-pick >> nth=1'); await pc.waitForTimeout(1200);
    const quien = await pc.evaluate(() => V && V.usuario && V.usuario.registro);
    // docente
    await pc.click('text=Salir'); await pc.waitForSelector('#axU');
    await pc.fill('#axU', 'docente@test.bo'); await pc.waitForTimeout(100);
    const codOculto = await pc.evaluate(() => getComputedStyle(document.querySelector('#axCodBox')).display === 'none');
    await pc.fill('#axP', 'Super#2026'); await pc.click('text=Ingresar →'); await pc.waitForTimeout(1200);
    await pc.click('nav >> text=Simulaciones'); await pc.waitForTimeout(600);
    await pc.screenshot({ path: OUT + '/6_docente_simulaciones.png', fullPage: true });
    await pc.evaluate(id => elegirSim(id), sim.simId); await pc.waitForTimeout(800);
    await pc.click('nav >> text=Equipos'); await pc.waitForTimeout(900);
    await pc.screenshot({ path: OUT + '/7_docente_equipos.png', fullPage: true });
    await pc.click('#axEq button:has-text("Eliminar") >> nth=0'); await pc.waitForTimeout(300);
    const modal = await pc.isVisible('.ax-modal');
    await pc.screenshot({ path: OUT + '/8_docente_modal_eliminar.png' });
    await pc.click('#axMNo');
    await pc.click('#axEq button:has-text("Contraseña temporal") >> nth=0'); await pc.click('#axMSi'); await pc.waitForTimeout(700);
    const tempVis = await pc.textContent('.ax-modal .ax-codigo');
    await pc.screenshot({ path: OUT + '/9_docente_contrasena_temporal.png' });
    await pc.click('#axMOk');
    await pc.click('nav >> text=Docentes'); await pc.waitForTimeout(700);
    await pc.screenshot({ path: OUT + '/10_docente_docentes.png', fullPage: true });
    await pc.click('nav >> text=Textos y calificación'); await pc.waitForTimeout(700);
    await pc.screenshot({ path: OUT + '/11_docente_textos_tema.png' });
    // celular
    const pm = await br.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); pm.on('pageerror', e => errs.push(e.message));
    await pm.goto(U + '/'); await pm.waitForSelector('#axU');
    const mov = await pm.evaluate(() => ({ logo: document.querySelector('.ax-logo').getBoundingClientRect().width, ancho: document.querySelector('.ax-card').getBoundingClientRect().width, scroll: document.documentElement.scrollWidth > innerWidth }));
    await pm.screenshot({ path: OUT + '/12_ingresar_390.png' });
    await pm.click('text=Registrar mi equipo'); await pm.waitForSelector('#axRn');
    const unaCol = await pm.evaluate(() => getComputedStyle(document.querySelector('.ax-2col')).gridTemplateColumns.split(' ').length === 1);
    await pm.screenshot({ path: OUT + '/13_registro_390.png', fullPage: true });
    // invitación vencida
    const fila = G.rows_('Invitaciones')[1];
    await pm.goto(U + '/?invitacion=no-existe-123'); await pm.waitForTimeout(900);
    const invMsg = await pm.textContent('.ax-card');
    await pm.screenshot({ path: OUT + '/14_invitacion_invalida_390.png' });
    // dentro de Google Sites (iframe)
    const ps = await br.newPage({ viewport: { width: 1280, height: 900 } }); ps.on('pageerror', e => errs.push(e.message));
    await ps.goto(U + '/sites'); await ps.waitForTimeout(1500);
    const fr = ps.frames()[1]; await fr.waitForSelector('#axU');
    await ps.screenshot({ path: OUT + '/15_dentro_de_google_sites.png' });
    const det = 'tarjeta ' + est1.ancho + ' px, radio ' + est1.radio + ', padding ' + est1.padding + ', desenfoque ' + est1.blur + ', fondo SVG ' + est1.fondoSvg + ', logos ' + est1.logo + ' px (' + mov.logo + ' px en celular), título ' + est1.tituloFuente + ' / ' + est1.tituloEsp + ', código ' + est1.codigoFuente + ' en ' + est1.codigoMay + ', registro ' + anchoReg + ' px; celular: tarjeta ' + Math.round(mov.ancho) + ' px, sin desplazamiento lateral ' + !mov.scroll + ', registro en una columna ' + unaCol;
    const ok9 = est1.ancho === 380 && est1.radio === '14px' && est1.fondoSvg && est1.logo === 80 && mov.logo === 60 && anchoReg === 560 && /Space Mono/.test(est1.tituloFuente) && est1.tituloEsp === '3px' && /Space Mono/.test(est1.codigoFuente) && est1.codigoMay === 'uppercase' && !mov.scroll && unaCol && est1.ojo && /COM505T Innovación/.test(est1.pie) && /rgb\(255, 114, 114\)/.test(errRojo.color) && /✓ Simulación encontrada/.test(codOk) && enTrabajo && quien === '218102' && codOculto && modal && /^[A-Z0-9]{6}$/.test(tempVis) && /no es válido/.test(invMsg) && !/255, 255, 255\)$/.test(pwFondo) && !errs.length;
    if (!ok9) fallos++;
    R.push([9, 'Diseño SMAA en computadora, celular y dentro de Google Sites', ok9 ? 'OK' : 'FALLA', det + '; error en rojo «' + errRojo.txt + '»; validación «' + codOk.trim() + '»; registro entra a la pantalla de trabajo ' + enTrabajo + '; ¿Quién eres? → ' + quien + '; código oculto para docentes ' + codOculto + '; modal propio ' + modal + '; errores JS ' + (errs.length ? errs.join(' | ') : 'ninguno')]);
  } catch (e) { fallos++; R.push([9, 'Diseño SMAA en computadora, celular y dentro de Google Sites', 'FALLA', e.message + (errs.length ? ' · ' + errs.join(' | ') : '')]); }
  await br.close(); srv.close();
  R.forEach(r => console.log('Prueba ' + r[0] + ' · ' + r[1] + ': ' + r[2] + (r[3] ? ' — ' + r[3] : '')));
  console.log(fallos ? 'ACCESO CON FALLAS: ' + fallos : 'ACCESO OK');
})();
