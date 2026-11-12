// Simulador de Innovación · Compilación
// Genera, a partir de las fuentes de fuente/ (las mismas de Apps Script):
//   1) supabase/functions/api/gas_codigo.js  → lógica del servidor (se ejecuta en la Edge Function)
//   2) docs/index.html                        → pantalla estática para GitHub Pages
// Uso: node build.js
const fs = require('fs'), path = require('path');
const F = (f) => fs.readFileSync(path.join(__dirname, 'fuente', f), 'utf8');

// ---------- servidor ----------
const GS = ['Params.gs', 'Engine.gs', 'Informes.gs', 'Proyectos.gs', 'Evaluacion.gs', 'Db.gs', 'Setup.gs', 'Code.gs', 'Acceso.gs', 'DatosVR.gs', 'MotorVR.gs', 'InnovacionVR.gs', 'VR.gs'];
const codigo = GS.map((f) => '// ===== ' + f + ' =====\n' + F(f)).join('\n');
fs.writeFileSync(path.join(__dirname, 'supabase/functions/api/gas_codigo.js'),
  '// Archivo generado por build.js a partir de fuente/*.gs. No editar a mano.\nexport const CODIGO = ' + JSON.stringify(codigo) + ';\n');

// ---------- pantalla ----------
const puente = `<script>
// Si GitHub Pages ya tiene una versión más nueva que la guardada en el navegador, recarga una vez.
(function () {
  var V0 = '__VERSION__';
  try {
    fetch('version.txt?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) {
      var v = String(t || '').trim().split(/\\s+/)[0];
      if (!v || v === V0) return;
      var q = new URLSearchParams(location.search);
      if (q.get('v') === v) return;
      q.set('v', v); location.replace(location.pathname + '?' + q.toString() + location.hash);
    }).catch(function () { });
  } catch (e) { }
})();
</script>
<script src="config.js"></script>
<script>
// Puente: reemplaza google.script.run por llamadas a la Edge Function de Supabase.
(function () {
  var q = new URLSearchParams(location.search);
  window.VISTA = q.get('vista') === 'docente' ? 'docente' : 'estudiante';
  window.AX_INV = (q.get('invitacion') || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 60);
  // Logos: si el servidor no envía uno, se usa docs/img/logoN.png cuando ese archivo existe.
  function logosLocales(L, listo) {
    var pend = L.length, out = L.slice(), fin = false;
    function uno() { if (--pend <= 0 && !fin) { fin = true; listo(out); } }
    setTimeout(function () { if (!fin) { fin = true; listo(out); } }, 2500);
    L.forEach(function (x, i) {
      if (x) { uno(); return; }
      var img = new Image(), src = 'img/logo' + (i + 1) + '.png';
      img.onload = function () { out[i] = src; uno(); }; img.onerror = uno; img.src = src;
    });
  }
  function llamar(fn, args, ok, ko) {
    fetch(window.SIM_API, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: window.SIM_KEY },
      body: JSON.stringify({ fn: fn, args: args }) })
      .then(function (r) { return r.json(); })
      .then(function (r) {
        if (!r || !r.ok) { ko({ message: (r && r.error) || 'Error del servidor.' }); return; }
        var v = r.r;
        if (fn === 'apiAXInicio' && v && Array.isArray(v.logos)) { logosLocales(v.logos, function (L) { v.logos = L; ok(v); }); return; }
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
  .replace("<?!= include('Manual'); ?>", F('Manual.html'))
  .replace("<?!= include('VRUI'); ?>", F('VRUI.html'))
  .replace('<head>', '<head>\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>Simulador de Innovación</title>')
  .replace('<base target="_top">', '');
if (/<\?/.test(html)) throw new Error('Quedó una plantilla de Apps Script sin reemplazar en index.html');
fs.mkdirSync(path.join(__dirname, 'docs'), { recursive: true });
const VERSION = require('crypto').createHash('sha256').update(html).digest('hex').slice(0, 12);
html = html.replace('__VERSION__', VERSION);
fs.writeFileSync(path.join(__dirname, 'docs/index.html'), html);
fs.writeFileSync(path.join(__dirname, 'docs/version.txt'), VERSION + '\n');
if (!fs.existsSync(path.join(__dirname, 'docs/.nojekyll'))) fs.writeFileSync(path.join(__dirname, 'docs/.nojekyll'), '');
console.log('Listo: gas_codigo.js (' + Math.round(codigo.length / 1024) + ' KB) y docs/index.html (' + Math.round(html.length / 1024) + ' KB)');
