// Etapa 4 (v2.1): evaluación entre equipos, calificación docente, textos, debriefing y lienzo actual.
const { makeGas } = require('./gasmock');
const { decidir3, revisar3 } = require('./p3driver');
const G = makeGas(); G.instalar();
const adm = G.apiLoginDocente(G.cfgGet_('CLAVE_DOCENTE')).token;
const s1 = G.apiAdmin(adm, 'crearSimulacion', { nombre: 'Etapa 4', sigla: 'COM505T', maxIntegrantes: 5, mandato: 'MA' });
const NOM = ['Bueno', 'Gastador', 'Malo', 'Acelera', 'Normal', 'SinPiloto'], PERF = ['bueno', 'gastador', 'malo', 'acelera', 'normal', 'sinPiloto'];
const SEG = ['S2', 'S2', 'S2', 'S3', 'S5', 'S3'];
NOM.forEach((n, i) => G.apiRegistrarEquipo(s1.codigo, { nombreEquipo: n, pin: '1234', integrantes: [{ apPaterno: 'P' + i, apMaterno: 'R', nombres: 'Ana', registro: '31800' + i, celular: '7123456' + i }] }));
G.apiAdmin(adm, 'abrir', { simId: 'S01' });
const tk = i => G.apiLogin('31800' + i, '1234').token;
const fallas = []; const ok = (c, m) => { if (!c) fallas.push(m); };
const ficha = (n, pts) => ({ nombre: n, frase: 'Para clientes que necesitan algo práctico, ' + n + ' es una bebida láctea que resuelve su mañana, a diferencia de la caja de 1 L.', pts, precioObj: 0, tec: 'no', mod: 'no', tipo4p: 'Producto', externa: '', test: true });
const http = require('http'), fs = require('fs'), path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', 'fuente', f), 'utf8');
const shim = `<script>window.google={script:{get run(){var ok=function(){},ko=function(){};var p=new Proxy({}, {get:function(_,k){
 if(k==='withSuccessHandler')return function(f){ok=f;return p;}; if(k==='withFailureHandler')return function(f){ko=f;return p;};
 return function(){var a=Array.prototype.slice.call(arguments);fetch('/api/'+k,{method:'POST',body:JSON.stringify(a)}).then(r=>r.json()).then(r=>r.error?ko({message:r.error}):ok(r.result));};}});return p;}}};</script>`;

const getS = (i, t) => G.getJson_('Estados', 'S01-E0' + (i + 1), t);
const errs = [];
(async () => {
const srv = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) { let b = ''; req.on('data', c => b += c); req.on('end', () => { let out; try { out = { result: G[req.url.slice(5)].apply(null, JSON.parse(b)) }; } catch (e) { out = { error: e.message }; } res.end(JSON.stringify(out)); }); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const vista = req.url.includes('vista=docente') ? 'docente' : 'estudiante';
  res.end(read('Index.html').replace("<?!= include('Styles'); ?>", read('Styles.html')).replace("<?= vista ?>", vista).replace("<?!= include('App'); ?>", shim + read('App.html')).replace("<?!= include('InformesUI'); ?>", read('InformesUI.html')).replace("<?!= include('ProyectosUI'); ?>", read('ProyectosUI.html')).replace("<?!= include('EvaluacionUI'); ?>", read('EvaluacionUI.html')).replace("<?!= include('Aprender'); ?>", read('Aprender.html')).replace("<?!= include('AccesoUI'); ?>", read('AccesoUI.html')).replace("<?= invitacion ?>", '').replace(/<link[^>]*fonts\.(googleapis|gstatic)[^>]*>/g, ''));
}).listen(8774);
let antesQ = null, keyDoc = null, protoKey = null;
for (let t = 1; t <= 8; t++) {
  // evaluación entre equipos del trimestre
  let asignados = 0;
  NOM.forEach((n, i) => {
    const r = G.apiPares(tk(i)); asignados += r.asignadas.length;
    r.asignadas.forEach(a => ok(!a.key.startsWith('S01-E0' + (i + 1) + '|'), 'un equipo recibió su propia ficha'));
    if (!r.asignadas.length) return;
    const notas = {}; r.asignadas.forEach(a => { const v = i === 2 ? 1 : (i === 0 ? 9 : 7); notas[a.key] = { nov: v, via: v, cla: v, com: 'Comentario de ' + n }; });
    const g = G.apiGuardarPares(tk(i), notas); ok(g.completas === g.total, 'pares incompletos');
  });
  if (t === 3) {
    ok(asignados > 0, 'no hubo fichas asignadas en T3');
    const tx = G.apiAdmin(adm, 'textos', { simId: 'S01' });
    const it = tx.equipos[0].items.filter(x => x.calif === 'ficha')[0]; ok(!!it, 'no hay fichas calificables en textos');
    keyDoc = it.key; antesQ = getS(0, 2).proyectos[0].fichas.filter(f => keyDoc.endsWith('|' + f.id))[0].Q;
    G.apiAdmin(adm, 'calificar', { simId: 'S01', key: keyDoc, tipo: 'ficha', nov: 9, via: 9, cla: 9, com: 'Muy claro' });
    ok(tx.equipos.every(e => e.items.some(x => x.fase === 'Definir')), 'faltan briefs en textos');
    ok(tx.equipos[0].items.some(x => x.fase === 'Idear' && x.autor), 'faltan ideas con autor');
  }

  NOM.forEach((n, i) => {
    const v = G.apiEstado(tk(i)), dec = { hipotesis: 'Hipótesis del trimestre ' + t, noticias: {}, respuestas: {}, productos: {}, investigacion: { metodos: [], segmentos: [] }, decInformes: {}, proyectos: {}, nuevosProyectos: [] };
    v.estado.informes.filter(x => x.requiere && x.t === t - 1).forEach(x => { dec.decInformes[x.id] = 'Con este dato ajustamos el proyecto y el precio objetivo.'; });
    v.estado.productos.forEach(p => { dec.productos[p.id] = { precio: p.precio, comunicacion: p.comunicacion || 20000, segPub: p.segPub || 'todos', promo: 0, pronostico: 1000000, canales: p.canales }; });
    if ((t - 1) % 4 === 0) dec.anual = { p4: { producto: 40, proceso: 20, posicion: 20, paradigma: 20 }, nucleo: 40, adyacente: 40, transf: 20, postura: 'ofensiva', tiempoLibre: 10, incentivo: 'reconocimiento', politica: 'aprendizaje', composicion: 'multifuncional', estructura: 'autonoma', capacitacion: false, umbral: 'moderado', hipotesis: 'Hipótesis anual' };
    if (t === 1) { dec.nuevosProyectos.push({ nombre: 'Proyecto ' + n, segmento: SEG[i], tec: 'no', mod: 'no', portafolio: 'adyacente', brief: { cuando: 'salgo temprano', quiero: 'algo que me quite el hambre', para: 'rendir en la mañana', reto: '¿Cómo podríamos ofrecer a los clientes un desayuno que se tome con una mano?', evidencia: '', frase: '', criterio: '5 % del segmento en dos trimestres' } }); if (PERF[i] !== 'malo' && PERF[i] !== 'gastador') dec.investigacion = { metodos: ['observacion'], segmentos: [SEG[i]] }; }
    v.estado.proyectos.forEach(p => {
      const a = dec.proyectos[p.id] = {};
      if (p.flujo !== 2) return;
      if (p.etapa === 'idear') { a.tecnica = 'scamper'; a.ind = { ['31800' + i]: { campos: { S: 'Botella chica', C: 'Con avena', A: 'Tapa deportiva', M: 'Más espesa' } } }; a.fichas = [ficha('Concepto A' + i, { conv: 5, nut: 3, sab: 2, salud: 0, sost: 0, precio: 0 }), ficha('Concepto B' + i, { sab: 4, salud: 3, precio: 3, nut: 0, conv: 0, sost: 0 })]; }
      else if (p.etapa === 'evaluar') { const F = p.fichas.slice().sort((x, y) => (y.test ? y.test.qCorr : 0) - (x.test ? x.test.qCorr : 0)); a.elegir = F[0].id; a.justificacion = 'Elegimos el concepto con calidad ' + (F[0].test ? F[0].test.qCorr : 5) + ' en el test.'; }
      else if (p.estado === 'activo') decidir3(p, a, PERF[i], n);
      else revisar3(p, a);
    });
    try { G.apiGuardar(tk(i), dec, true); } catch (e) { fallas.push('T' + t + ' ' + n + ': ' + e.message); }
  });
  const r = G.apiAdmin(adm, 'procesar', { simId: 'S01' }); ok(/procesado/.test(r.mensaje), 'procesar T' + t + ': ' + r.mensaje);
  if (t === 3) {
    const f = getS(0, 3).proyectos[0].fichas.filter(f => keyDoc.endsWith('|' + f.id))[0];
    ok(f && f.p4Aj !== undefined && Math.abs(f.p4Aj) <= 0.5 && f.p4Aj > 0, 'ajuste de calidad no aplicado: ' + JSON.stringify(f && f.p4Aj));
    console.log('Ficha calificada: Q antes', antesQ, '→ después', f.Q, '(ajuste', f.p4Aj + ')');
    const mis = G.apiMisEvaluaciones(tk(0)); ok(mis.fichas.length > 0, 'el equipo no ve sus evaluaciones');
    const tx = G.apiAdmin(adm, 'textos', { simId: 'S01' }); console.log('Alertas de divergencia:', tx.alertas.length); ok(tx.alertas.length > 0, 'no se detectó divergencia de pares');
  }
  if (t >= 4 && !protoKey) {
    const tx = G.apiAdmin(adm, 'textos', { simId: 'S01' });
    for (const e of tx.equipos) { const it = e.items.filter(x => x.calif === 'proto')[0]; if (it) { protoKey = it.key; G.apiAdmin(adm, 'calificar', { simId: 'S01', key: it.key, tipo: 'proto', tan: 8, pro: 8, apr: 7, cam: 7, construido: true, com: 'Buen prototipo' }); break; } }
  }
}
ok(!!protoKey, 'no hubo prototipos para calificar');
const db = G.apiAdmin(adm, 'debriefing', { simId: 'S01', anio: 1 });
ok(db.filas.length === 6 && db.preguntas.length === 3, 'debriefing incompleto');
console.log('Debriefing año 1:', db.filas.map(f => f.equipo + ' elegidos ' + f.elegidos + '/val ' + f.validados + ' err ' + f.errorPron).join(' | '));
console.log('Pregunta 1:', db.preguntas[0]);
// pantallas
const { chromium } = require('playwright'); const br = await chromium.launch(); const pg = await br.newPage({ viewport: { width: 1200, height: 800 } });
pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); pg.on('dialog', d => d.accept());
await pg.goto('http://localhost:8774/'); await pg.waitForTimeout(200); await pg.waitForSelector('#axU'); await pg.evaluate(t => { TOK = t; ROL = 'equipo'; TAB = 'inicio'; AX_cerrar(); cargar(); }, G.apiLogin('318000', '1234').token); await pg.waitForTimeout(700);
const vis = {};
for (const [tab, re] of [['caso', /modelo de negocio actual/], ['pares', /Evaluar los conceptos de otros equipos/], ['evaluaciones', /Fichas de concepto|Todavía no hay evaluaciones/], ['temas', /Temas|unidad/i], ['glosario', /Postura|Portafolio/]]) {
  await pg.evaluate(t => irTab(t), tab); await pg.waitForTimeout(500); vis[tab] = re.test(await pg.evaluate(() => document.body.innerText)); await pg.screenshot({ path: 'test/e4_' + tab + '.png', fullPage: true });
}
await pg.goto('http://localhost:8774/?vista=docente'); await pg.waitForTimeout(300); await pg.waitForSelector('#axU'); await pg.evaluate(t => AX_entrarDocente(t), G.apiLoginDocente().token); await pg.waitForTimeout(700);
await pg.click('nav >> text=Textos y calificación'); await pg.waitForTimeout(900); vis.textos = /Textos del curso/.test(await pg.evaluate(() => document.body.innerText)) && /Calificar|Calificada/.test(await pg.evaluate(() => document.body.innerText)); await pg.screenshot({ path: 'test/e4_textos.png', fullPage: true });
await pg.click('nav >> text=Guía de debriefing'); await pg.waitForTimeout(500); await pg.click('text=Generar guía'); await pg.waitForTimeout(800); vis.debriefing = /Preguntas para la discusión/.test(await pg.evaluate(() => document.body.innerText)); await pg.screenshot({ path: 'test/e4_debriefing.png', fullPage: true });
await br.close(); srv.close();
console.log('Pantallas:', JSON.stringify(vis));
Object.keys(vis).forEach(k => ok(vis[k], 'no se vio bien la pantalla ' + k));
ok(!errs.length, 'errores JS: ' + errs.slice(0, 5).join(' | '));
console.log(fallas.length ? 'FALLAS:\n' + fallas.join('\n') : 'ETAPA 4 OK');
})();
