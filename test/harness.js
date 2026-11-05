// Carga los archivos .gs en un contexto común (como Apps Script) y simula equipos automáticos.
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = { console, Math, JSON, Date, Number, String, Object, Array };
vm.createContext(ctx);
for (const f of ['Params.gs', 'Engine.gs', 'Informes.gs', 'Proyectos.gs']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'fuente', f), 'utf8'), ctx, { filename: f });
module.exports = ctx;
