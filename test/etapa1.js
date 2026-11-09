// Etapa 1 (v1.8): 6 empresas, 8 trimestres, investigación con informes, respuesta al entorno, negocio actual y estrategia.
const http = require('http'), fs = require('fs'), path = require('path');
const { makeGas } = require('./gasmock');
const G = makeGas(); G.instalar();
const adm = G.apiLoginDocente(G.cfgGet_('CLAVE_DOCENTE')).token;
const s1 = G.apiAdmin(adm, 'crearSimulacion', { nombre: 'Etapa 1', sigla: 'COM505T', maxIntegrantes: 5, mandato: 'MA' });
const NOM = ['Halcones', 'Cóndores', 'Jaguares', 'Pumas', 'Tucanes', 'Londras'];
NOM.forEach((n, i) => G.apiRegistrarEquipo(s1.codigo, { nombreEquipo: n, pin: '1234', integrantes: [{ apPaterno: 'P' + i, apMaterno: 'R', nombres: 'Ana', registro: '21800' + i, celular: '7123456' + i }] }));
G.apiAdmin(adm, 'abrir', { simId: 'S01' });
const fallas = [];
function ok(c, m) { if (!c) fallas.push(m); }
const METS = [['encuesta', 'industria'], ['observacion', 'competidores'], ['percepcion', 'vigilancia'], ['extremos', 'industria'], ['encuesta', 'percepcion'], ['competidores'], ['industria', 'observacion'], ['percepcion']];
for (let t = 1; t <= 8; t++) {
  NOM.forEach((n, i) => {
    const tk = G.apiLogin('21800' + i, '1234').token, v = G.apiEstado(tk);
    const dec = { hipotesis: 'Hipótesis del equipo para el trimestre ' + t, esperado: 'x', noticias: {}, respuestas: {}, productos: {}, investigacion: { metodos: [], segmentos: ['S2', 'S5'] }, decInformes: {} };
    v.noticias.forEach((nn, k) => { dec.noticias[nn.id] = 'amenaza'; dec.respuestas[nn.id] = ['ignorar', 'vigilar', 'preparar'][(k + i) % 3]; });
    if (i < 4) dec.investigacion.metodos = METS[(t - 1 + i) % METS.length];
    if (i === 5) dec.investigacion.metodos = ['competidores']; // repite para probar el recargo
    v.estado.informes.filter(x => x.requiere && x.t === t - 1).forEach(x => { dec.decInformes[x.id] = 'Con este dato ajustamos el precio y el segmento del proyecto.'; });
    v.estado.productos.forEach(p => { dec.productos[p.id] = { precio: p.precio, comunicacion: i === 3 ? 0 : 20000, segPub: i === 1 ? 'S5' : 'todos', promo: i === 2 ? 30000 : 0, pronostico: 1500000, canales: p.canales }; });
    if ((t - 1) % 4 === 0) dec.anual = { p4: { producto: 40, proceso: 20, posicion: 20, paradigma: 20 }, nucleo: 60 - i * 5, adyacente: 30, transf: 10 + i * 5, postura: ['ofensiva', 'defensiva', 'imitativa', 'tradicional', 'oportunista', 'dependiente'][i], tiempoLibre: 10, incentivo: 'reconocimiento', politica: 'aprendizaje', composicion: 'multifuncional', estructura: 'integrada', capacitacion: false, umbral: 'moderado', hipotesis: 'Hipótesis anual' };
    const est = G.apiEstimar(tk, dec);
    if (i === 5 && t > 1) ok(!est.avisos.some(a => /50 %/.test(a)), 'T' + t + ': repetir un estudio ya no tiene recargo');
    try { G.apiGuardar(tk, dec, true); } catch (e) { fallas.push('T' + t + ' ' + n + ': ' + e.message); }
  });
  const r = G.apiAdmin(adm, 'procesar', { simId: 'S01' }); ok(/procesado/.test(r.mensaje), 'procesar T' + t);
}
// verificación
const lines = [];
NOM.forEach((n, i) => {
  const tk = G.apiLogin('21800' + i, '1234').token, v = G.apiEstado(tk), E = v.estado, h = E.hist[E.hist.length - 1];
  const otros = v.empresas.filter(e => !e.yo);
  ok(otros.every(e => e.ventas === null && e.cuota === null), n + ': ve datos de otras empresas');
  const tipos = {}; E.informes.forEach(x => tipos[x.metodo] = (tipos[x.metodo] || 0) + 1);
  lines.push(n + ' ventas ' + Math.round(h.ventas / 1000) + 'k cuota ' + h.cuotaTotal + '% AW ' + E.productos[0].AW + ' saldo ' + E.saldo + ' informes ' + JSON.stringify(tipos) + ' coherencia ' + E.coherencia.length + ' postura ' + E.org.postura + ' portafolio ' + [E.org.nucleo, E.org.adyacente, E.org.transf].join('/') + ' rad ' + E.org.rad + ' nue ' + E.org.nue);
  E.informes.forEach(x => ok(x.pregunta && x.ficha && x.limites, n + ' informe incompleto ' + x.id));
});
const v3 = G.apiEstado(G.apiLogin('218003', '1234').token);
ok(v3.estado.productos[0].AW < 0.9, 'Sin publicidad no baja el conocimiento: ' + v3.estado.productos[0].AW);
const ind = G.apiEstado(G.apiLogin('218000', '1234').token).estado.informes.filter(x => x.metodo === 'industria' && x.datos)[0];
ok(ind && ind.datos.filas.length >= 6, 'industria sin empresas del curso');
console.log(lines.join('\n'));
if (ind) console.log('Industria:', ind.datos.filas.map(f => f.nombre + ' ' + f.lo + '-' + f.hi).join(' | '));
const st = JSON.stringify(G.apiEstado(G.apiLogin('218000', '1234').token).estado).length;
console.log('Tamaño de la vista del estado:', st);

// navegador: vistas nuevas sin errores
const read = f => fs.readFileSync(path.join(__dirname, '..', 'fuente', f), 'utf8');
const shim = `<script>window.google={script:{get run(){var ok=function(){},ko=function(){};var p=new Proxy({}, {get:function(_,k){
 if(k==='withSuccessHandler')return function(f){ok=f;return p;}; if(k==='withFailureHandler')return function(f){ko=f;return p;};
 return function(){var a=Array.prototype.slice.call(arguments);fetch('/api/'+k,{method:'POST',body:JSON.stringify(a)}).then(r=>r.json()).then(r=>r.error?ko({message:r.error}):ok(r.result));};}});return p;}}};</script>`;
const srv = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) { let b = ''; req.on('data', c => b += c); req.on('end', () => { let out; try { out = { result: G[req.url.slice(5)].apply(null, JSON.parse(b)) }; } catch (e) { out = { error: e.message }; } res.end(JSON.stringify(out)); }); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(read('Index.html').replace("<?!= include('Styles'); ?>", read('Styles.html')).replace("<?= vista ?>", 'estudiante').replace("<?!= include('App'); ?>", shim + read('App.html')).replace("<?!= include('InformesUI'); ?>", read('InformesUI.html')).replace("<?!= include('ProyectosUI'); ?>", read('ProyectosUI.html')).replace("<?!= include('EvaluacionUI'); ?>", read('EvaluacionUI.html')).replace("<?!= include('Aprender'); ?>", read('Aprender.html')).replace("<?!= include('Manual'); ?>", read('Manual.html')).replace("<?!= include('AccesoUI'); ?>", read('AccesoUI.html')).replace("<?= invitacion ?>", '').replace(/<link[^>]*fonts\.(googleapis|gstatic)[^>]*>/g, ''));
}).listen(8769);
(async () => {
  const { chromium } = require('playwright');
  const br = await chromium.launch(); const pg = await br.newPage({ viewport: { width: 1200, height: 800 } }); const errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await pg.goto('http://localhost:8769/'); await pg.waitForTimeout(300);
  await pg.waitForSelector('#axU'); await pg.evaluate(t => { TOK = t; ROL = 'equipo'; TAB = 'inicio'; AX_cerrar(); cargar(); }, G.apiLogin('218000', '1234').token); await pg.waitForTimeout(900);
  for (const [m, t] of [['Resultados', 'Informes de investigación'], ['Resultados', 'Resumen del trimestre'], ['Situación', 'Mercado y competencia'], ['Decidir', '1. Entorno'], ['Decidir', '2. Estrategia anual'], ['Decidir', '3. Investigación'], ['Decidir', '5. Productos'], ['Aprender', 'Mi bitácora']]) {
    await pg.click('nav .menu >> text=' + m); await pg.waitForTimeout(200); await pg.click('nav .sub >> text="' + t + '"'); await pg.waitForTimeout(400);
    await pg.screenshot({ path: 'test/e1_' + t.replace(/[^a-z0-9]/gi, '_') + '.png', fullPage: true });
  }
  const nInf = await pg.evaluate(() => { irTab('informes'); return document.querySelectorAll('.informe').length; });
  ok(nInf > 0, 'no se ven informes');
  console.log('Informes en pantalla:', nInf, '| errores JS:', errs.length ? errs : 'ninguno');
  if (errs.length) fallas.push('errores JS');
  await br.close(); srv.close();
  console.log(fallas.length ? 'FALLAS:\n' + fallas.join('\n') : 'ETAPA 1 OK');
})();
