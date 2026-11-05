// Etapa 2 (v1.9): proyectos Definir → Idear → Evaluar con 6 empresas durante 8 trimestres, privacidad de ideas y vistas sin errores JS.
const http = require('http'), fs = require('fs'), path = require('path');
const { makeGas } = require('./gasmock');
const G = makeGas(); G.instalar();
const adm = G.apiLoginDocente(G.cfgGet_('CLAVE_DOCENTE')).token;
const s1 = G.apiAdmin(adm, 'crearSimulacion', { nombre: 'Etapa 2', sigla: 'COM505T', maxIntegrantes: 5, mandato: 'MA' });
const NOM = ['Halcones', 'Cóndores', 'Jaguares', 'Pumas', 'Tucanes', 'Londras'];
NOM.forEach((n, i) => {
  G.apiRegistrarEquipo(s1.codigo, { nombreEquipo: n, pin: '1234', integrantes: [{ apPaterno: 'P' + i, apMaterno: 'R', nombres: 'Ana', registro: '21800' + i, celular: '7123456' + i }, { apPaterno: 'Q' + i, apMaterno: 'S', nombres: 'Luis', registro: '21900' + i, celular: '7223456' + i }] });
  G.apiActivar(s1.codigo, '21900' + i, '4321');
});
G.apiAdmin(adm, 'abrir', { simId: 'S01' });
const fallas = []; function ok(c, m) { if (!c) fallas.push(m); }
const TEC = ['scamper', 'flor', 'morfo', 'scamper', 'flor', 'morfo'];
const SEG = ['S2', 'S5', 'S3', 'S1', 'S4', 'S2'];
const tkA = i => G.apiLogin('21800' + i, '1234').token, tkB = i => G.apiLogin('21900' + i, '4321').token;
function base(v, t) {
  const dec = { hipotesis: 'Hipótesis del equipo para el trimestre ' + t, noticias: {}, respuestas: {}, productos: {}, investigacion: { metodos: [], segmentos: [] }, decInformes: {}, proyectos: {}, nuevosProyectos: [] };
  v.estado.informes.filter(x => x.requiere && x.t === t - 1).forEach(x => { dec.decInformes[x.id] = 'Con este dato ajustamos el proyecto y el precio objetivo.'; });
  v.estado.productos.forEach(p => { dec.productos[p.id] = { precio: p.precio, comunicacion: 20000, segPub: 'todos', promo: 0, pronostico: 1500000, canales: p.canales }; });
  if ((t - 1) % 4 === 0) dec.anual = { p4: { producto: 40, proceso: 20, posicion: 20, paradigma: 20 }, nucleo: 50, adyacente: 35, transf: 15, postura: 'ofensiva', tiempoLibre: 10, incentivo: 'reconocimiento', politica: 'aprendizaje', composicion: 'multifuncional', estructura: 'autonoma', capacitacion: false, umbral: 'moderado', hipotesis: 'Hipótesis anual del equipo' };
  return dec;
}
function individuales(tec, k) {
  if (tec === 'scamper') return { campos: { S: 'Botella chica ' + k, C: 'Con avena ' + k, A: 'Tapa deportiva ' + k, M: 'Más espesa ' + k, E: 'Sin vaso ' + k } };
  if (tec === 'flor') return { temas: ['envase', 'horario', 'canal', 'precio', 'nutrición', 'sabor', 'pago', 'frío'], ideas: [1, 2, 3, 4, 5, 6, 7].map(x => 'Idea flor ' + k + '-' + x).concat(['', '', '', '', '']) };
  return { params: [['botella', 'caja', 'vaso'], ['leche', 'yogur', 'avena'], ['vainilla', 'cacao', 'frutas'], ['campus', 'tienda', 'app'], ['QR', 'efectivo', 'suscripción'], ['mañana', 'tarde', 'noche']], combos: [['0', '2', '0', '0', '0', '0'], ['1', '1', '1', '1', '1', '1'], ['2', '0', '2', '2', '2', '2']] };
}
const ficha = (n, pts, test, extra) => Object.assign({ nombre: n, frase: 'Para clientes del segmento que necesitan algo práctico, ' + n + ' es una bebida láctea que resuelve su mañana, a diferencia de la caja de 1 L.', pts, precioObj: 4.5, tec: 'no', mod: 'no', tipo4p: 'Producto', externa: '', test }, extra || {});
let privOk = null, revealOk = null, vistaT3 = null;

async function trimestre(t) {
  NOM.forEach((n, i) => {
    let v = G.apiEstado(tkA(i)), dec = base(v, t);
    const P2 = v.estado.proyectos.filter(p => p.flujo === 2 && p.estado === 'activo');
    if (t === 1) {
      dec.nuevosProyectos.push({ nombre: 'Proyecto ' + n, segmento: SEG[i], tec: i === 2 ? 'si' : 'no', mod: i === 5 ? 'si' : 'no', portafolio: ['nucleo', 'adyacente', 'transformacional'][i % 3], brief: { cuando: 'salgo temprano de casa', quiero: 'algo que me quite el hambre', para: 'rendir en la mañana', reto: i === 1 ? 'Botella de leche para todos' : '¿Cómo podríamos ofrecer a los clientes un desayuno que se tome con una mano?', evidencia: '', frase: '', criterio: '8 % del segmento en dos trimestres' } });
      dec.investigacion = { metodos: ['observacion'], segmentos: [SEG[i]] };
    }
    if (t === 2 && i === 5) { dec.nuevosProyectos.push({ nombre: 'Segundo ' + n, segmento: 'S3', tec: 'no', mod: 'no', portafolio: 'nucleo', brief: { cuando: 'x', quiero: 'y', para: 'z', reto: '¿Cómo podríamos ayudar a los oficinistas?', criterio: '5 % en un año' } }); dec.nuevosProyectos.push({ nombre: 'Tercero ' + n, segmento: 'S4', brief: { reto: '¿Cómo podríamos ayudar a los deportistas?' } }); }
    P2.forEach(p => {
      const a = dec.proyectos[p.id] = {};
      if (p.etapa === 'idear') {
        a.tecnica = TEC[i];
        // integrante A guarda sus ideas
        a.ind = {}; a.ind['21800' + i] = individuales(TEC[i], 'A');
        G.apiGuardar(tkA(i), JSON.parse(JSON.stringify(dec)), false);
        // integrante B no ve las ideas de A antes de la votación
        const vb = G.apiEstado(tkB(i)), bb = vb.borrador.proyectos[p.id];
        if (i === 0) privOk = !bb.ind['21800' + i] && !JSON.stringify(vb.borrador).includes('Botella chica A');
        const decB = JSON.parse(JSON.stringify(vb.borrador)); decB.proyectos[p.id].ind = {}; decB.proyectos[p.id].ind['21900' + i] = individuales(TEC[i], 'B'); decB.proyectos[p.id].tecnica = TEC[i];
        G.apiGuardar(tkB(i), decB, false);
        // A abre la votación; B ve todas las ideas sin autor
        const va = G.apiEstado(tkA(i)), da = JSON.parse(JSON.stringify(va.borrador)); da.proyectos[p.id].abrirVoto = true; G.apiGuardar(tkA(i), da, false);
        const vb2 = G.apiEstado(tkB(i)), L = vb2.borrador.proyectos[p.id]._ideas || [];
        if (i === 0) revealOk = L.length >= 8 && !JSON.stringify(L).includes('218000') && L.some(x => /Botella chica A/.test(x.texto));
        const db = JSON.parse(JSON.stringify(vb2.borrador)); db.proyectos[p.id].votos = { ['21900' + i]: { [L[0].key]: 2, [L[1].key]: 1 } }; G.apiGuardar(tkB(i), db, false);
        // el equipo arma las fichas y las manda al test
        const nps = dec.nuevosProyectos; v = G.apiEstado(tkA(i)); dec = Object.assign(base(v, t), { proyectos: JSON.parse(JSON.stringify(v.borrador.proyectos || {})), nuevosProyectos: nps });
        const b = dec.proyectos[p.id];
        if (t === 2 && p.nombre.startsWith('Proyecto')) {
          b.externas = i % 2 ? [{ id: 'concurso', premio: 'medio' }] : (i === 2 ? [{ id: 'startups' }] : []);
          b.fichas = [ficha('Concepto A' + i, { conv: 5, nut: 3, sab: 2, salud: 0, sost: 0, precio: 0 }, true), ficha('Concepto B' + i, { sab: 4, salud: 3, precio: 3, nut: 0, conv: 0, sost: 0 }, true, { tec: i === 2 ? 'si' : 'no' }), ficha('Concepto C' + i, { sost: 6, conv: 4, sab: 0, nut: 0, salud: 0, precio: 0 }, i !== 3, { tipo4p: 'Paradigma' })];
          if (i === 4) b.acelerar = true;
        } else { b.cerrarIdear = true; b.fichas = [ficha('Ficha ' + n, { nut: 4, conv: 4, sab: 2, salud: 0, sost: 0, precio: 0 }, false)]; }
      }
      if (p.etapa === 'evaluar') {
        const F = p.fichas; a.pugh = {}; F.forEach((f, k) => { a.pugh[f.id] = { ajuste: k === 0 ? '1' : '0', viab: '1', costo: '0', nov: '0', estr: '1' }; });
        a.justificacion = 'Elegimos este concepto porque tiene ' + (F[0].test ? F[0].test.intencion : 50) + ' % de intención y gana la matriz.';
        if (i === 3 && F.length >= 2) { a.elegir = 'COMB'; a.combinar = [F[0].id, F[1].id]; } else a.elegir = F[0].id;
        if (i === 1) a.acelerar = true, a.proto = { supuesto: 'uso', pregunta: '¿Pueden abrirlo solos?', formato: 'maqueta', apertura: 'pestana', senal: 'flecha', tamano: '330', recierre: 'si', n: 8 };
      }
    });
    v.estado.proyectos.filter(p => p.estado === 'activo' && ['prototipar', 'especificar', 'piloto', 'lanzar'].indexOf(p.etapa) >= 0).forEach(p => {
      const a = dec.proyectos[p.id] = dec.proyectos[p.id] || {};
      require('./p3driver').decidir3(p, a, i === 2 ? 'sinPiloto' : 'acelera', n);
    });
    const est = G.apiEstimar(tkA(i), dec);
    if (t === 2 && i === 5) ok(est.avisos.some(x => /máximo 2 proyectos/.test(x)), 'no avisa máximo de proyectos en año 1');
    try { G.apiGuardar(tkA(i), dec, true); } catch (e) { fallas.push('T' + t + ' ' + n + ': ' + e.message); }
  });
  const r = G.apiAdmin(adm, 'procesar', { simId: 'S01' }); ok(/procesado/.test(r.mensaje), 'procesar T' + t);
}

const read = f => fs.readFileSync(path.join(__dirname, '..', 'fuente', f), 'utf8');
const shim = `<script>window.google={script:{get run(){var ok=function(){},ko=function(){};var p=new Proxy({}, {get:function(_,k){
 if(k==='withSuccessHandler')return function(f){ok=f;return p;}; if(k==='withFailureHandler')return function(f){ko=f;return p;};
 return function(){var a=Array.prototype.slice.call(arguments);fetch('/api/'+k,{method:'POST',body:JSON.stringify(a)}).then(r=>r.json()).then(r=>r.error?ko({message:r.error}):ok(r.result));};}});return p;}}};</script>`;
function servidor() {
  return http.createServer((req, res) => {
    if (req.url.startsWith('/api/')) { let b = ''; req.on('data', c => b += c); req.on('end', () => { let out; try { out = { result: G[req.url.slice(5)].apply(null, JSON.parse(b)) }; } catch (e) { out = { error: e.message }; } res.end(JSON.stringify(out)); }); return; }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(read('Index.html').replace("<?!= include('Styles'); ?>", read('Styles.html')).replace("<?= vista ?>", 'estudiante').replace("<?!= include('App'); ?>", shim + read('App.html')).replace("<?!= include('InformesUI'); ?>", read('InformesUI.html')).replace("<?!= include('ProyectosUI'); ?>", read('ProyectosUI.html')).replace("<?!= include('EvaluacionUI'); ?>", read('EvaluacionUI.html')).replace("<?!= include('Aprender'); ?>", read('Aprender.html')).replace("<?!= include('AccesoUI'); ?>", read('AccesoUI.html')).replace("<?= invitacion ?>", '').replace(/<link[^>]*fonts\.(googleapis|gstatic)[^>]*>/g, ''));
  }).listen(8770);
}
async function navegador() {
  const srv = servidor(), { chromium } = require('playwright');
  const br = await chromium.launch(); const pg = await br.newPage({ viewport: { width: 1200, height: 800 } }); const errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  async function entrar(reg, pin) { await pg.goto('http://localhost:8770/'); await pg.waitForTimeout(300); await pg.waitForSelector('#axU'); await pg.evaluate(t => { TOK = t; ROL = 'equipo'; TAB = 'inicio'; AX_cerrar(); cargar(); }, G.apiLogin(reg, pin).token); await pg.waitForTimeout(900); }
  await entrar('218000', '1234');
  await pg.evaluate(() => irTab('proyectos')); await pg.waitForTimeout(400);
  await pg.screenshot({ path: 'test/e2_evaluar.png', fullPage: true });
  const hayPugh = await pg.evaluate(() => /Matriz de Pugh/.test(document.body.innerText) && /Van Westendorp|Rango de precio aceptable/.test(document.body.innerText));
  ok(hayPugh, 'no se ve Evaluar con Pugh y Van Westendorp');
  await entrar('218005', '1234');
  await pg.evaluate(() => irTab('proyectos')); await pg.waitForTimeout(400);
  for (const tb of ['mis', 'voto', 'fichas', 'afuera']) { await pg.evaluate(t => { V.estado.proyectos.filter(p => p.flujo === 2 && p.etapa === 'idear').forEach(p => TABP[p.id] = t); render(); }, tb); await pg.waitForTimeout(250); await pg.screenshot({ path: 'test/e2_idear_' + tb + '.png', fullPage: true }); }
  const hayIdear = await pg.evaluate(() => /Tarea de este trimestre · Idear/i.test(document.body.innerText));
  ok(hayIdear, 'no se ve la tarea Idear');
  await pg.evaluate(() => { irTab('informes'); }); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => /Test de concepto/.test(document.body.innerText)), 'no se ve el informe del test');
  console.log('Errores JS:', errs.length ? errs : 'ninguno'); if (errs.length) fallas.push('errores JS: ' + errs.join(' | '));
  await br.close(); srv.close();
}

(async () => {
  for (let t = 1; t <= 2; t++) await trimestre(t);
  vistaT3 = G.apiEstado(tkA(0)).estado.proyectos.filter(p => p.flujo === 2)[0];
  await navegador();
  for (let t = 3; t <= 8; t++) await trimestre(t);
  ok(privOk === true, 'privacidad de ideas antes de votar');
  ok(revealOk === true, 'ideas reveladas sin autor');
  ok(vistaT3 && vistaT3.etapa === 'evaluar' && vistaT3.fichas.length === 3 && vistaT3.fichas[0].test && vistaT3.fichas[0].devolucion.length >= 4, 'T3: fichas, test y devolución');
  ok(vistaT3 && vistaT3.fichas[0].test.vw.pmc < vistaT3.fichas[0].test.vw.pme, 'Van Westendorp con rango válido');
  const lines = [];
  NOM.forEach((n, i) => {
    const E = G.apiEstado(tkA(i)).estado, P2 = E.proyectos.filter(p => p.flujo === 2);
    P2.forEach(p => {
      lines.push(n + ' · ' + p.nombre + ': etapa ' + p.etapa + ' tipo ' + p.tipoDecl + '→' + (p.tipoReal || '-') + ' iterMin ' + p.iterMin + ' iter ' + p.iter + ' gasto ' + p.gastoAcum + ' fichas ' + p.fichas.length + ' externas ' + p.externas.length + (p.fichas[0] ? ' q ' + p.fichas.map(f => f.qObs).join('/') : ''));
      ok(p.gastoAcum >= 0, n + ' gasto acumulado');
      if (p.nombre.startsWith('Proyecto')) ok(['prototipar', 'especificar', 'piloto', 'lanzar', 'lanzado'].indexOf(p.etapa) >= 0, n + ' no avanzó de Evaluar: ' + p.etapa);
    });
    if (i === 1) ok(P2[0].revisionBrief.some(r => !r.ok && /solución|Cómo podríamos/.test(r.texto)), 'revisión del brief no detecta problemas');
    if (i === 5) ok(P2.length === 2, 'Londras debería tener 2 proyectos (máximo año 1): ' + P2.length);
    if (i === 3) ok(P2[0].fichas.some(f => f.combinado), 'no se creó el concepto combinado');
  });
  const lanz = NOM.filter((n, i) => G.apiEstado(tkA(i)).estado.proyectos.some(p => p.flujo === 2 && p.etapa === 'lanzado')).length;
  console.log(lines.join('\n')); console.log('Empresas con un concepto lanzado:', lanz);
  ok(lanz >= 1, 'ningún lanzamiento del flujo nuevo en 8 trimestres');
  const st = G.getJson_('Estados', G.equiposDe_('S01')[0].equipoId, 8); console.log('Tamaño del estado guardado:', JSON.stringify(st).length);
  console.log(fallas.length ? 'FALLAS:\n' + fallas.join('\n') : 'ETAPA 2 OK');
})();
