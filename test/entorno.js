// Entorno: el equipo clasifica, elige postura y, si actúa, una acción del menú general con su justificación.
const { makeGas } = require('./gasmock');
const G = makeGas(); G.instalar();
const adm = G.apiLoginDocente(G.cfgGet_('CLAVE_DOCENTE')).token;
const ok = (c, m) => { if (!c) { console.log('FALLA: ' + m); process.exit(1); } console.log('OK  ' + m); };
const s1 = G.apiAdmin(adm, 'crearSimulacion', { nombre: 'Entorno', sigla: 'COM505T', maxIntegrantes: 5, mandato: 'MA' });
const NOM = ['Acierta', 'Equivoca', 'Ignora', 'Parcial'];
NOM.forEach((n, i) => G.apiRegistrarEquipo(s1.codigo, { nombreEquipo: n, pin: 'clave' + i, integrantes: [{ apPaterno: 'P' + i, apMaterno: 'R', nombres: 'Ana', registro: '31700' + i, celular: '' }] }));
G.apiAdmin(adm, 'abrir', { simId: s1.simId });
const tk = (i) => G.apiLogin('31700' + i, 'clave' + i, s1.simId).token;
const MEJOR = { N06: ['etiqueta'], N07: ['etiqueta'], N09: ['envases'], N05: ['competidor', 'S2'], N08: ['competidor', 'S2'], N10: ['competidor', 'S2'], N02: ['estudio', 'S2'], N04: ['campana', 'S2'], N03: ['estudio', 'S3'], N11: ['estudio', 'S1'], N12: ['campana', 'S4'], N13: ['campana', 'S4'], NSEQ: ['leche'] };
const PARCIAL = { N09: ['rutas'], NSEQ: ['rutas'], N05: ['competidor', 'S3'] };
let gastoEnt = [0, 0, 0, 0], est = null;
for (let t = 1; t <= 16; t++) {
  NOM.forEach((n, i) => {
    const v = G.apiEstado(tk(i)), dec = { hipotesis: 'Hipótesis del trimestre ' + t, noticias: {}, respuestas: {}, acciones: {}, productos: {}, decInformes: {} };
    v.estado.informes.filter(x => x.requiere && x.t === t - 1).forEach(x => { dec.decInformes[x.id] = 'Decisión tomada con el informe.'; });
    v.noticias.forEach(x => {
      dec.noticias[x.id] = 'amenaza';
      if (i === 2) { dec.respuestas[x.id] = 'ignorar'; return; }
      const real = MEJOR[x.id] || (/^NBLQ/.test(x.id) ? ['rutas'] : null);
      let a = i === 0 ? real : i === 1 ? ['campana', 'S5'] : (PARCIAL[x.id] || real);
      if (i === 0 && !real) return; // el que acierta ignora el ruido
      if (!a) return;
      dec.respuestas[x.id] = 'actuar'; dec.acciones[x.id] = { a: a[0], seg: a[1] || '', porque: 'Porque esta acción responde a lo que anuncia la noticia.' };
    });
    if (t === 1 && i === 0) { const e = G.apiEstimar ? null : null; }
    G.apiGuardar(tk(i), dec, true);
  });
  G.apiAdmin(adm, 'procesar', { simId: s1.simId });
}
const E = NOM.map((n, i) => G.apiEstado(tk(i)).estado);
// mensajes de la lectura del último trimestre y del historial de efectos
const todos = [];
NOM.forEach((n, i) => { const W = G.getJson_('Estados', s1.simId + '-E0' + (i + 1), 16); todos.push(W); });
console.log('Ejemplos de lo que reciben:');
E.forEach((e, i) => (e.noticiasEval || []).filter(x => x.efecto).slice(0, 2).forEach(x => console.log('  ' + NOM[i] + ': ' + x.efecto)));
const h = E.map(e => e.hist);
const costo = (i) => h[i].reduce((s, x) => s + x.utilidadNeta, 0);
console.log('Utilidad acumulada:', NOM.map((n, i) => n + ' ' + Math.round(costo(i))).join(' · '));
ok(E[1].noticiasEval.some(x => /no responde|no la aprovecha|rumor/.test(x.efecto || '')), 'la acción equivocada se explica y no tiene efecto');
const W0 = G.getJson_('Estados', s1.simId + '-E01', 16), W3 = G.getJson_('Estados', s1.simId + '-E04', 16);
console.log('Preparación Acierta:', JSON.stringify(W0.world ? W0.world.prep : W0.W && W0.W.prep), ' Parcial:', JSON.stringify(W3.world ? W3.world.prep : W3.W && W3.W.prep));
console.log('ENTORNO OK');
