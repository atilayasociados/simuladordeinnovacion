// Etapa 3 (v2.0): 6 empresas llevan un proyecto de Definir a Lanzar y Revisión en 12 trimestres.
const { makeGas } = require('./gasmock');
const { decidir3, revisar3 } = require('./p3driver');
const G = makeGas(); G.instalar();
const adm = G.apiLoginDocente(G.cfgGet_('CLAVE_DOCENTE')).token;
const s1 = G.apiAdmin(adm, 'crearSimulacion', { nombre: 'Etapa 3', sigla: 'COM505T', maxIntegrantes: 5, mandato: 'MA' });
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
const vistos = {}, errs = [], shots = [];
async function mirar(pg) {
  for (let i = 0; i < NOM.length; i++) {
    await pg.goto('http://localhost:8771/'); await pg.waitForTimeout(200); await pg.waitForSelector('#axU'); await pg.evaluate(t => { TOK = t; ROL = 'equipo'; TAB = 'inicio'; AX_cerrar(); cargar(); }, G.apiLogin('31800' + i, '1234').token); await pg.waitForTimeout(600);
    await pg.evaluate(() => irTab('proyectos')); await pg.waitForTimeout(250);
    const txt = await pg.evaluate(() => document.body.innerText);
    [['Prototipar', /Tarea de este trimestre · Prototipar/i], ['Informe de prueba', /Informe de prueba · versión/], ['Malla', /Malla receptora/], ['Especificar', /Tarea de este trimestre · Especificar/i], ['Lienzo', /Lienzo del modelo de negocio/], ['Acta', /Acta del comité/], ['Piloto', /Tarea de este trimestre · Piloto/i], ['Informe piloto', /Informe del piloto/], ['Lanzar', /Tarea de este trimestre · Lanzar/i], ['Revisión', /Revisión después de la acción/], ['Resultados lanzamiento', /Canibalización/]].forEach(x => { if (x[1].test(txt) && !vistos[x[0]]) { vistos[x[0]] = true; shots.push(x[0]); } });
    for (const k of shots.splice(0)) await pg.screenshot({ path: 'test/e3_' + k.replace(/ /g, '_') + '.png', fullPage: true });
  }
}
(async () => {
const srv = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) { let b = ''; req.on('data', c => b += c); req.on('end', () => { let out; try { out = { result: G[req.url.slice(5)].apply(null, JSON.parse(b)) }; } catch (e) { out = { error: e.message }; } res.end(JSON.stringify(out)); }); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(read('Index.html').replace("<?!= include('Styles'); ?>", read('Styles.html')).replace("<?= vista ?>", 'estudiante').replace("<?!= include('App'); ?>", shim + read('App.html')).replace("<?!= include('InformesUI'); ?>", read('InformesUI.html')).replace("<?!= include('ProyectosUI'); ?>", read('ProyectosUI.html')).replace("<?!= include('EvaluacionUI'); ?>", read('EvaluacionUI.html')).replace("<?!= include('Aprender'); ?>", read('Aprender.html')).replace("<?!= include('AccesoUI'); ?>", read('AccesoUI.html')).replace("<?= invitacion ?>", '').replace(/<link[^>]*fonts\.(googleapis|gstatic)[^>]*>/g, ''));
}).listen(8771);
const { chromium } = require('playwright'); const br = await chromium.launch(); const pg = await br.newPage({ viewport: { width: 1200, height: 800 } });
pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
for (let t = 1; t <= 12; t++) {
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
  if (t >= 3) await mirar(pg);
}
await br.close(); srv.close();
console.log('Pantallas vistas:', Object.keys(vistos).join(', '));
['Prototipar', 'Informe de prueba', 'Malla', 'Especificar', 'Lienzo', 'Acta', 'Piloto', 'Informe piloto', 'Lanzar', 'Revisión', 'Resultados lanzamiento'].forEach(k => ok(vistos[k], 'no se vio la pantalla ' + k));
ok(!errs.length, 'errores JS: ' + errs.slice(0, 5).join(' | '));
const res = NOM.map((n, i) => {
  const v = G.apiEstado(tk(i)), E = v.estado, p = E.proyectos[0], H = E.hist;
  const util = H.reduce((s, h) => s + h.utilidadNeta, 0);
  console.log(n.padEnd(10), 'etapa', p.etapa.padEnd(11), 'gasto', String(p.gastoAcum).padStart(7), 'iter', p.iter, 'fit', p.protoFit, 'actas', JSON.stringify((p.actas || []).map(a => a.veredicto)), 'piloto', p.pil ? p.pil.vendidas + ' rec ' + p.pil.recompra : '-', 'lanz', p.resLanz ? p.resLanz.unidades + 'u ' + p.resLanz.cuota + '% canib ' + p.resLanz.canib : '-', 'AAR', p.aar ? 'sí' : 'no', 'utilAcum', Math.round(util / 1000) + 'k', 'madurez', E.org.madurez);
  return { n, util, p, E };
});
const lanz = res.filter(r => r.p.etapa === 'lanzado').length;
ok(lanz >= 4, 'menos de 4 lanzamientos: ' + lanz);
ok(res.some(r => r.p.aar), 'ninguna revisión después de la acción');
const roi = r => r.p.resLanz ? r.p.resLanz.utilidad / r.p.gastoAcum : -9;
res.forEach(r => console.log('Rentabilidad del proyecto', r.n, roi(r).toFixed(2)));
ok(roi(res[0]) > roi(res[1]), 'el que gasta más y gestiona mal rinde más que el buen gestor');
ok(roi(res[0]) > roi(res[2]), 'el que gestiona mal rinde más que el buen gestor');
ok(res[2].p.proto.versiones.some(x => !x.observable), 'el formato no observable no se marcó');
ok(res.some(r => r.p.acta && r.p.acta.obs.some(o => /clase de referencia/.test(o))), 'el comité no observa volúmenes fuera de la clase de referencia');
const pr = res[0].p.proto.versiones[0];
ok(pr.filas.length === pr.n && pr.malla.gusto.length + pr.malla.criticas.length > 0, 'informe del prototipo incompleto');
const nn = res[4].p; if (nn.acta) console.log(JSON.stringify(nn.acta.criterios.map(c => c[0].slice(0, 12) + ' ' + c[1] + ' ' + c[2])), nn.acta.caso, nn.acta.costoReal, nn.vw, nn.acta.umbral, nn.acta.obs);
console.log('Acelera vs Bueno (utilidad acumulada):', Math.round(res[3].util / 1000) + 'k', 'vs', Math.round(res[0].util / 1000) + 'k');
console.log(fallas.length ? 'FALLAS:\n' + fallas.join('\n') : 'ETAPA 3 OK');
})();
