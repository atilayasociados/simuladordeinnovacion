// Simulación mínima de Apps Script (SpreadsheetApp, CacheService, LockService, Utilities, HtmlService) en memoria.
const fs = require('fs'), vm = require('vm'), path = require('path'), crypto = require('crypto');
function makeSheet(name) {
  const data = []; // filas (arrays)
  const sh = {
    name, data,
    getName: () => name,
    getLastRow: () => data.length,
    getLastColumn: () => data.reduce((m, r) => Math.max(m, r.length), 0),
    appendRow: (row) => { data.push(row.map(v => v === undefined ? '' : v)); },
    deleteRow: (r) => { data.splice(r - 1, 1); },
    deleteRows: (r, n) => { data.splice(r - 1, n); },
    setFrozenRows: () => { },
    getRange: (r, c, nr, nc) => {
      nr = nr || 1; nc = nc || 1;
      const rng = {
        getValues: () => { const out = []; for (let i = 0; i < nr; i++) { const row = data[r - 1 + i] || []; const o = []; for (let j = 0; j < nc; j++) o.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]); out.push(o); } return out; },
        setValues: (vals) => { for (let i = 0; i < nr; i++) { while (data.length < r + i) data.push([]); const row = data[r - 1 + i]; for (let j = 0; j < nc; j++) row[c - 1 + j] = vals[i][j]; } return rng; },
        setValue: (v) => { while (data.length < r) data.push([]); data[r - 1][c - 1] = v; return rng; },
        setFontWeight: () => rng, setBackground: () => rng, setFontColor: () => rng
      };
      return rng;
    }
  };
  return sh;
}
function makeGas() {
  const sheets = {};
  const ss = {
    getSheetByName: (n) => sheets[n] || null,
    insertSheet: (n) => (sheets[n] = makeSheet(n)),
    getSheets: () => Object.values(sheets), getNumSheets: () => Object.keys(sheets).length,
    deleteSheet: (s) => { delete sheets[s.name]; },
    setActiveSheet: () => { }
  };
  const cache = {}, props = {};
  const ctx = {
    console, Math, JSON, Date, Number, String, Object, Array, RegExp, Error, Promise,
    SpreadsheetApp: { getActive: () => Object.assign(ss, { toast: () => { }, getId: () => 'X' }), openById: () => ss, getUi: () => ({ alert: (m) => { ctx._alerts.push(m); }, createMenu: () => ({ addItem() { return this; }, addToUi() { } }) }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache[k] || null, put: (k, v) => { cache[k] = v; }, remove: (k) => { delete cache[k]; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: (k) => { delete props[k]; } }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'docente@test.bo' }) },
    ScriptApp: { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/TEST/exec' }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => { }, releaseLock: () => { } }) },
    Utilities: { getUuid: () => crypto.randomUUID(), DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' }, computeDigest: (alg, s) => Array.from(crypto.createHash('sha256').update(s, 'utf8').digest()).map(b => b > 127 ? b - 256 : b) },
    HtmlService: {}, Logger: { log: () => { } },
    _alerts: [], _sheets: sheets, _cache: cache, _props: props
  };
  vm.createContext(ctx);
  // FUENTE: carpeta alternativa de fuentes (pruebas de equivalencia). AZAR_FIJO: Math.random reproducible.
  if (process.env.AZAR_FIJO) vm.runInContext('(function(){var a=' + Number(process.env.AZAR_FIJO) + ';Math.random=function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};})()', ctx);
  const DIR = process.env.FUENTE || path.join(__dirname, '..', 'fuente');
  for (const f of ['Params.gs', 'Engine.gs', 'Informes.gs', 'Proyectos.gs', 'Evaluacion.gs', 'Db.gs', 'Setup.gs', 'Code.gs', 'Acceso.gs']) vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f });
  // Atajos SOLO para pruebas (no existen en el servidor): permiten que las pruebas antiguas obtengan sesiones sin pasar por la pantalla.
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'legacy.js'), 'utf8'), ctx, { filename: 'legacy.js' });
  // Las pruebas antiguas no completan la Estrategia anual (obligatoria desde v2.6): se completa con valores
  // de prueba solo los campos que falten. ANUAL_ESTRICTO=1 desactiva este relleno.
  // Las pruebas antiguas no registran la lectura de señales (obligatoria desde v3): se completa con
  // "dudosa / ignorar" solo en las señales que falten. SENALES_ESTRICTO=1 desactiva este relleno.
  if (!process.env.SENALES_ESTRICTO) {
    const orig0 = ctx.apiGuardar;
    ctx.apiGuardar = function (tok, dec, enviar) {
      try {
        if (enviar) {
          const ses = ctx.sess_(tok, 'equipo'), pa = ctx.partida_(ses.simId), P = ctx.getParams_();
          const S = ctx.migrar_(ctx.estadoPrevio_(P, ctx.equipoById_(ses.equipoId), pa.t), P);
          const SEN = dec.senales = dec.senales || {};
          const Cr = dec.cronograma = dec.cronograma || {};
          ctx.actividadesPlan_(P, S, dec, pa.t, pa.semilla, ctx.scheduleEvents_(pa.semilla)).forEach((a) => { if (!Cr[a.concepto]) Cr[a.concepto] = { sem: a.ref, ini: 1, fin: 12 }; });
          ctx.senalesPara_(P, pa.t, S, ctx.scheduleEvents_(pa.semilla)).forEach((n) => { const r = SEN[n.id] = SEN[n.id] || {}; if (!r.cred) r.cred = 'dudosa'; if (!r.postura) r.postura = 'ignorar'; if ((r.postura === 'preparar' || r.postura === 'actuar') && String(r.porque || '').length < 10) r.porque = 'Respuesta de prueba ante la señal.'; });
        }
      } catch (e) { }
      return orig0(tok, dec, enviar);
    };
  }
  if (!process.env.ANUAL_ESTRICTO) {
    const orig = ctx.apiGuardar;
    ctx.apiGuardar = function (tok, dec, enviar) {
      try {
        const ses = ctx.sess_(tok, 'equipo'), pa = ctx.partida_(ses.simId);
        if (enviar && ctx.esInicioAnio_(pa.t)) {
          const A = dec.anual = dec.anual || {}, D = { nucleo: 70, adyacente: 20, transf: 10, postura: 'ofensiva', estructura: 'integrada', tiempoLibre: 10, incentivo: 'reconocimiento', politica: 'aprendizaje', composicion: 'multifuncional', capacitacion: 'no', umbral: 'moderado', hipotesis: 'Hipótesis anual de prueba con más de veinte caracteres.' };
          if (!A.p4 || ['producto', 'proceso', 'posicion', 'paradigma'].some((k) => A.p4[k] === undefined || A.p4[k] === '')) A.p4 = { producto: 40, proceso: 20, posicion: 20, paradigma: 20 };
          Object.keys(D).forEach((k) => { if (A[k] === undefined || A[k] === '' || (k === 'hipotesis' && String(A[k]).length < 20)) A[k] = D[k]; });
          if (A.capacitacion === false) A.capacitacion = 'no'; if (A.capacitacion === true) A.capacitacion = 'si';
        }
      } catch (e) { }
      return orig(tok, dec, enviar);
    };
  }
  return ctx;
}
module.exports = { makeGas };
