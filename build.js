// Simulador de Innovación · Compilación
// Genera, a partir de las fuentes de fuente/ (las mismas de Apps Script):
//   1) supabase/functions/api/gas_codigo.js  → lógica del servidor (se ejecuta en la Edge Function)
//   2) docs/index.html                        → pantalla estática para GitHub Pages
// Uso: node build.js
const fs = require('fs'), path = require('path');
const F = (f) => fs.readFileSync(path.join(__dirname, 'fuente', f), 'utf8');

// ---------- servidor ----------
const GS = ['Params.gs', 'Engine.gs', 'Informes.gs', 'Proyectos.gs', 'Evaluacion.gs', 'Db.gs', 'Setup.gs', 'Code.gs', 'Acceso.gs'];
const codigo = GS.map((f) => '// ===== ' + f + ' =====\n' + F(f)).join('\n');
fs.writeFileSync(path.join(__dirname, 'supabase/functions/api/gas_codigo.js'),
  '// Archivo generado por build.js a partir de fuente/*.gs. No editar a mano.\nexport const CODIGO = ' + JSON.stringify(codigo) + ';\n');

// ---------- pantalla ----------
const puente = `<script src="config.js"></script>
<script>
// Puente: reemplaza google.script.run por llamadas a la Edge Function de Supabase.
(function () {
  var q = new URLSearchParams(location.search);
  window.VISTA = q.get('vista') === 'docente' ? 'docente' : 'estudiante';
  window.AX_INV = (q.get('invitacion') || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 60);
  function llamar(fn, args, ok, ko) {
    fetch(window.SIM_API, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: window.SIM_KEY },
      body: JSON.stringify({ fn: fn, args: args }) })
      .then(function (r) { return r.json(); })
      .then(function (r) {
        if (!r || !r.ok) { ko({ message: (r && r.error) || 'Error del servidor.' }); return; }
        var v = r.r;
        if (fn === 'apiAXInicio' && v && Array.isArray(v.logos)) v.logos = v.logos.map(function (x, i) { return x || ('img/logo' + (i + 1) + '.png'); });
        ok(v);
      })
      .catch(function () { ko({ message: 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.' }); });
  }
  window.google = { script: { get run() {
    var ok = function () {}, ko = function () {};
    var p = new Proxy({}, { get: function (_, k) {
      if (k === 'withSuccessHandler') return function (f) { ok = f; return p; };
      if (k === 'withFailureHandler') return function (f) { ko = f; return p; };
      return function () { llamar(String(k), Array.prototype.slice.call(arguments), ok, ko); };
    } });
    return p;
  } } };
})();
</script>`;
let html = F('Index.html')
  .replace("<?!= include('Styles'); ?>", F('Styles.html'))
  .replace(/<script>var VISTA = '<\?= vista \?>'; var AX_INV = '<\?= invitacion \?>';<\/script>/, puente)
  .replace("<?!= include('App'); ?>", F('App.html'))
  .replace("<?!= include('AccesoUI'); ?>", F('AccesoUI.html'))
  .replace("<?!= include('InformesUI'); ?>", F('InformesUI.html'))
  .replace("<?!= include('ProyectosUI'); ?>", F('ProyectosUI.html'))
  .replace("<?!= include('EvaluacionUI'); ?>", F('EvaluacionUI.html'))
  .replace("<?!= include('Aprender'); ?>", F('Aprender.html'))
  .replace('<head>', '<head>\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>Simulador de Innovación</title>')
  .replace('<base target="_top">', '');
if (/<\?/.test(html)) throw new Error('Quedó una plantilla de Apps Script sin reemplazar en index.html');
fs.mkdirSync(path.join(__dirname, 'docs'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'docs/index.html'), html);
if (!fs.existsSync(path.join(__dirname, 'docs/.nojekyll'))) fs.writeFileSync(path.join(__dirname, 'docs/.nojekyll'), '');
console.log('Listo: gas_codigo.js (' + Math.round(codigo.length / 1024) + ' KB) y docs/index.html (' + Math.round(html.length / 1024) + ' KB)');
