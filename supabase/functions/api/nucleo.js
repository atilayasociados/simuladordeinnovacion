/**
 * Simulador de Innovación · Núcleo del servidor en Supabase.
 *
 * Ejecuta SIN CAMBIOS la lógica de la versión de Apps Script (Engine, Params, Informes, Proyectos,
 * Evaluacion, Acceso, Code, Db) dentro de un entorno que imita los servicios de Google:
 *   - SpreadsheetApp: hojas en memoria cargadas desde Postgres al inicio de cada petición
 *     (solo las filas que la petición necesita) y guardadas en lote al final (sim_aplicar).
 *   - Utilities, CacheService, PropertiesService, LockService, Session, ScriptApp.
 * Si el código pide datos que no se cargaron (por ejemplo, el estado completo de otra empresa),
 * la petición se repite cargando esos datos ("NEED"). Nada se guarda hasta el final.
 *
 * Archivo ESM sin dependencias: lo usan la Edge Function (Deno) y las pruebas (Node).
 */

// ---------- SHA-256 síncrono (Apps Script es síncrono) ----------
const K256 = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
export function sha256Bytes(texto) {
  const msg = new TextEncoder().encode(String(texto));
  const l = msg.length, nb = ((l + 9 + 63) >> 6) << 6, b = new Uint8Array(nb);
  b.set(msg); b[l] = 0x80;
  const dv = new DataView(b.buffer); dv.setUint32(nb - 4, (l * 8) >>> 0); dv.setUint32(nb - 8, Math.floor(l / 0x20000000));
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]), w = new Uint32Array(64);
  const r = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < nb; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) { const s0 = r(w[i - 15], 7) ^ r(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = r(w[i - 2], 17) ^ r(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0; }
    let [a, bb, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K256[i] + w[i]) >>> 0;
      const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = bb; bb = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += bb; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  const out = []; for (let i = 0; i < 8; i++) out.push(H[i] >>> 24, (H[i] >>> 16) & 255, (H[i] >>> 8) & 255, H[i] & 255);
  return out;
}
const hex = (bytes) => bytes.map((x) => (x & 255).toString(16).padStart(2, '0')).join('');
/** Igual que AX_hash_ de Acceso.gs. */
export function hashAX(texto, sal) { return hex(sha256Bytes(String(sal) + '|' + String(texto))); }

// ---------- hojas ↔ tablas ----------
export const TABLAS = { Config: 'config', Parametros: 'parametros', Propiedades: 'propiedades', Simulaciones: 'simulaciones', Equipos: 'equipos', Integrantes: 'integrantes', Decisiones: 'decisiones', Estados: 'estados', Resultados: 'resultados', Bitacora: 'bitacora', Evaluaciones: 'evaluaciones', Log: 'log', Docentes: 'docentes', Invitaciones: 'invitaciones', Sesiones: 'sesiones', IntentosLogin: 'intentos_login' };
const GLOBALES = ['Config', 'Parametros', 'Propiedades', 'Simulaciones', 'Equipos', 'Integrantes', 'Docentes', 'Invitaciones'];
const POR_SIM = ['Decisiones', 'Resultados', 'Bitacora', 'Evaluaciones', 'Estados'];
const PARCIAL_ESTADOS = 3; // equipoId, trimestre, partes

export function encCelda(v) { if (v instanceof Date) return { $d: isNaN(v.getTime()) ? null : v.toISOString() }; return v === undefined ? '' : v; }
export function decCelda(v) { if (v && typeof v === 'object' && !Array.isArray(v) && '$d' in v) return v.$d ? new Date(v.$d) : ''; return v; }
const iso = (v) => { if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString(); if (v === '' || v == null) return null; const d = new Date(v); return isNaN(d.getTime()) ? null : d.toISOString(); };
const simDe = (x) => { const m = /(^|\|)(S\d+)(-|$)/.exec(String(x || '')); return m ? m[2] : null; };
const ent = (v) => { const n = Math.round(Number(v)); return isFinite(n) && v !== '' ? n : null; };

/** Columnas de filtro de cada fila según su hoja. */
export function clavesFila(hoja, head, f) {
  const c = (n) => f[head.indexOf(n)];
  switch (hoja) {
    case 'Simulaciones': return { sim_id: String(c('simId') || '') || null, k1: String(c('codigo') || ''), k2: null, ts: null };
    case 'Equipos': return { sim_id: String(c('simId') || '') || null, k1: String(c('equipoId') || ''), k2: null, ts: null };
    case 'Integrantes': return { sim_id: String(c('simId') || '') || null, k1: String(c('registro') || ''), k2: null, ts: null };
    case 'Decisiones': case 'Estados': case 'Evaluaciones': case 'Bitacora': return { sim_id: simDe(f[0]), k1: String(f[0] || ''), k2: ent(f[1]), ts: null };
    case 'Resultados': return { sim_id: String(c('simId') || '') || simDe(f[0]), k1: String(f[0] || ''), k2: ent(c('trimestre')), ts: null };
    case 'Sesiones': return { sim_id: null, k1: String(c('tokenHash') || ''), k2: null, ts: iso(c('vence')) };
    case 'IntentosLogin': return { sim_id: null, k1: String(c('clave') || ''), k2: null, ts: iso(c('fecha')) };
    case 'Log': return { sim_id: null, k1: String(c('accion') || ''), k2: null, ts: iso(c('fecha')) };
    case 'Docentes': return { sim_id: null, k1: String(c('email') || '').toLowerCase(), k2: null, ts: null };
    case 'Invitaciones': return { sim_id: null, k1: String(c('tokenHash') || ''), k2: null, ts: iso(c('vence')) };
    default: return { sim_id: null, k1: String(f[0] || ''), k2: null, ts: null };
  }
}

class NecesitaDatos extends Error { constructor(req) { super('NECESITA_DATOS'); this.req = req; } }

// ---------- funciones que solo leen (no toman bloqueo) ----------
const SIN_BLOQUEO = new Set(['apiEstado', 'apiEstimar', 'apiMiBitacora', 'apiMisEvaluaciones', 'apiPares', 'apiAXInfoCodigo', 'apiAXPregunta', 'apiAXInvitacion', 'apiMiEquipo', 'apiAXLogin', 'apiAXSalir', 'apiInfoSimulacion']);
const BLOQUEO_GLOBAL = new Set(['apiRegistrarEquipo', 'apiAXAlta', 'apiAXRecuperar', 'apiAXInicio', 'apiAXDocentes', 'apiAXCuenta', 'apiActivar']);
const esToken = (x) => typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);

/**
 * crearNucleo({ codigo, adaptador, entorno })
 *  codigo: texto concatenado de los .gs (ver build.js)
 *  adaptador: { cargar(spec) → {tabla: [[id, fila]]}, aplicar(cambios), tomarBloqueo(nombre, token, seg) → bool, soltarBloqueo(nombre, token) }
 *  entorno: { correoSuperadmin, urlPublica }
 */
export function crearNucleo({ codigo, adaptador, entorno }) {
  const PARAMS = ['SpreadsheetApp', 'CacheService', 'PropertiesService', 'LockService', 'Utilities', 'Session', 'ScriptApp', 'DriveApp', 'HtmlService', 'Logger', 'UrlFetchApp', 'MailApp'];
  // Se compila una sola vez por instancia; cada petición crea su propio entorno limpio.
  const fabrica = new Function(PARAMS.join(','), codigo + '\n;return function (n) { return eval(n); };');

  // opciones.interno: solo para herramientas locales (tools/semilla.mjs); la Edge Function nunca lo pasa.
  async function ejecutar(fn, args, opciones) {
    const interno = !!(opciones && opciones.interno);
    if (typeof fn !== 'string' || !(/^api[A-Za-z0-9]+$/.test(fn) || (interno && /^[A-Za-z_][A-Za-z0-9_]*$/.test(fn)))) throw new Error('Función no permitida.');
    args = Array.isArray(args) ? args : [];
    const t0 = Date.now(), medidas = { cargas: 0, pasadas: 0 };
    const tok = esToken(args[0]) ? args[0] : null;
    // 1) carga global + sesión
    const spec = [];
    GLOBALES.forEach((h) => spec.push({ hoja: h, modo: 'full' }));
    // Sin token no se leen sesiones (la limpieza de sesiones vencidas la hace la base de datos).
    spec.push({ hoja: 'Sesiones', modo: 'filtro', k1: tok ? hashAX(tok, 'ses') : '-' });
    spec.push({ hoja: 'IntentosLogin', modo: 'filtro', desde: new Date(Date.now() - 30 * 60000).toISOString() });
    let datos = await cargar(spec); medidas.cargas++;
    // 2) ámbito: simulación de la sesión o de los argumentos
    let ses = null;
    const filaSes = (datos.Sesiones || [])[0];
    if (filaSes) { try { ses = JSON.parse(filaSes[1][2]); } catch (e) { ses = null; } }
    let sim = ses && ses.simId ? String(ses.simId) : null;
    if (!sim) for (const a of args) if (a && typeof a === 'object' && typeof a.simId === 'string') { sim = a.simId; break; }
    // 3) bloqueo
    let lockNombre = null; const lockToken = crypto.randomUUID();
    if (!SIN_BLOQUEO.has(fn)) lockNombre = BLOQUEO_GLOBAL.has(fn) || !sim ? 'global' : 'sim:' + sim;
    if (lockNombre) {
      const fin = Date.now() + 25000; let ok = false, espera = 60;
      while (!ok && Date.now() < fin) { ok = await adaptador.tomarBloqueo(lockNombre, lockToken, 40); if (!ok) { await new Promise((r) => setTimeout(r, espera)); espera = Math.min(500, espera * 1.6); } }
      if (!ok) throw new Error('El simulador está ocupado. Intenta de nuevo en unos segundos.');
    }
    try {
      // 4) carga por simulación
      const extra = [];
      if (sim) POR_SIM.forEach((h) => extra.push(h === 'Estados' ? { hoja: h, modo: 'filtro', sim, parcial: PARCIAL_ESTADOS } : { hoja: h, modo: 'filtro', sim }));
      if (extra.length) { Object.assign(datos, await cargar(extra)); medidas.cargas++; }
      spec.push(...extra);
      // 5) ejecución con reintentos si faltan datos
      for (let pasada = 1; pasada <= 8; pasada++) {
        medidas.pasadas = pasada;
        const ctx = crearEntorno(datos, spec, tok);
        let resultado, error = null;
        try { resultado = ctx.llamar(fn, args); }
        catch (e) {
          if (e instanceof NecesitaDatos) {
            const r = e.req;
            const nueva = r.ids ? { hoja: r.hoja, modo: 'filas', ids: r.ids } : { hoja: r.hoja, modo: 'full' };
            if (nueva.modo === 'full') { for (let i = spec.length - 1; i >= 0; i--) if (spec[i].hoja === r.hoja) spec.splice(i, 1); delete datos[r.hoja]; }
            spec.push(nueva);
            const mas = await cargar([nueva]); medidas.cargas++;
            if (nueva.modo === 'filas') { datos.__filas = datos.__filas || {}; (datos.__filas[r.hoja] = datos.__filas[r.hoja] || {}); (mas[r.hoja] || []).forEach(([id, f]) => { datos.__filas[r.hoja][id] = f; }); }
            else datos[r.hoja] = mas[r.hoja] || [];
            continue;
          }
          error = e;
        }
        const cambios = ctx.cambios();
        if (cambios.length) await adaptador.aplicar(cambios);
        medidas.ms = Date.now() - t0; medidas.cambios = cambios.length;
        if (error) { const err = new Error(error && error.message ? error.message : String(error)); err.medidas = medidas; throw err; }
        return { resultado: JSON.parse(JSON.stringify(resultado === undefined ? null : resultado)), medidas };
      }
      throw new Error('No se pudieron cargar los datos necesarios.');
    } finally {
      if (lockNombre) { try { await adaptador.soltarBloqueo(lockNombre, lockToken); } catch (e) { } }
    }
  }

  async function cargar(spec) {
    const req = spec.map((s) => {
      const o = { tabla: TABLAS[s.hoja] };
      if (s.sim) o.sim = s.sim; if (s.k1) o.k1 = s.k1; if (s.desde) o.desde = s.desde; if (s.parcial) o.parcial = s.parcial; if (s.ids) o.ids = s.ids;
      return o;
    });
    const res = await adaptador.cargar(req), out = {};
    spec.forEach((s) => { out[s.hoja] = (out[s.hoja] || []).concat(res[TABLAS[s.hoja]] || []); });
    // si una hoja aparece dos veces en spec, evitar duplicados por id
    Object.keys(out).forEach((h) => { const vistos = new Set(); out[h] = out[h].filter(([id]) => (vistos.has(id) ? false : (vistos.add(id), true))); });
    return out;
  }

  /** Entorno de Apps Script para una pasada. */
  function crearEntorno(datos, spec, tok) {
    let HOJAS_ = null;
    const modos = {}; spec.forEach((s) => { if (s.modo !== 'filas') modos[s.hoja] = s.modo === 'full' ? 'full' : 'filtro'; });
    const hojas = {};
    function hoja(nombre) {
      if (hojas[nombre]) return hojas[nombre];
      if (!TABLAS[nombre]) return null;
      const head = nombre === 'Propiedades' ? ['clave', 'valor'] : (HOJAS_ || {})[nombre];
      if (!head) return null;
      const modo = modos[nombre] || (nombre === 'Log' ? 'append' : 'unloaded');
      const filas = (datos[nombre] || []).map(([id, f]) => ({ id, f: f.map(decCelda), orig: JSON.stringify(f), parcial: nombre === 'Estados' && f.length <= PARCIAL_ESTADOS }));
      // filas completas cargadas después (NEED por ids)
      const extra = (datos.__filas || {})[nombre] || {};
      filas.forEach((r) => { if (extra[r.id]) { r.f = extra[r.id].map(decCelda); r.orig = JSON.stringify(extra[r.id]); r.parcial = false; } });
      const h = { nombre, head, modo, filas, borrados: [] };
      hojas[nombre] = h;
      return h;
    }
    const need = (h, ids) => {
      if (ids) {
        // Al pedir un estado completo se traen también los de las demás empresas del mismo trimestre
        // (al procesar se leen todos), para no repetir la petición una vez por empresa.
        const tri = new Set(h.filas.filter((x) => ids.includes(x.id)).map((x) => String(x.f[1])));
        ids = h.filas.filter((x) => x.parcial && x.id != null && (ids.includes(x.id) || tri.has(String(x.f[1])))).map((x) => x.id);
      }
      throw new NecesitaDatos(ids ? { hoja: h.nombre, ids } : { hoja: h.nombre });
    };
    function chequearLectura(h) { if (h.modo === 'unloaded') need(h); }
    function sheetObj(h) {
      const s = {
        getName: () => h.nombre,
        getLastRow: () => { if (h.modo === 'append') return 1; chequearLectura(h); return h.filas.length + 1; },
        getLastColumn: () => h.head.length,
        appendRow: (row) => { h.filas.push({ id: null, f: row.map((v) => (v === undefined ? '' : v)), orig: null, parcial: false }); },
        deleteRow: (r) => { chequearLectura(h); const x = h.filas.splice(r - 2, 1)[0]; if (x && x.id != null) h.borrados.push(x.id); },
        deleteRows: (r, n) => { for (let i = 0; i < n; i++) s.deleteRow(r); },
        setFrozenRows: () => { }, setTabColor: () => { }, autoResizeColumns: () => { }, setColumnWidth: () => { },
        getRange: (r, c, nr, nc) => {
          nr = nr || 1; nc = nc || 1;
          const filaDe = (i) => r + i - 2; // índice en h.filas (-1 = encabezado)
          const rng = {
            getValues: () => {
              chequearLectura(h);
              const out = [], faltan = [];
              for (let i = 0; i < nr; i++) {
                const k = filaDe(i);
                if (k === -1) { out.push(Array.from({ length: nc }, (_, j) => (h.head[c - 1 + j] === undefined ? '' : h.head[c - 1 + j]))); continue; }
                const x = h.filas[k];
                if (x && x.parcial && c + nc - 1 > PARCIAL_ESTADOS) { faltan.push(x.id); continue; }
                const row = x ? x.f : [];
                out.push(Array.from({ length: nc }, (_, j) => (row[c - 1 + j] === undefined ? '' : row[c - 1 + j])));
              }
              if (faltan.length) need(h, faltan);
              return out;
            },
            getValue: () => rng.getValues()[0][0],
            setValues: (vals) => {
              if (h.modo !== 'append') chequearLectura(h);
              for (let i = 0; i < nr; i++) {
                const k = filaDe(i);
                if (k === -1) continue; // encabezado
                while (h.filas.length <= k) h.filas.push({ id: null, f: [], orig: null, parcial: false });
                const x = h.filas[k];
                if (x.parcial) { if (c <= PARCIAL_ESTADOS + 1 && c + nc - 1 >= h.head.length) x.parcial = false; else need(h, [x.id]); }
                for (let j = 0; j < nc; j++) x.f[c - 1 + j] = vals[i][j];
              }
              return rng;
            },
            setValue: (v) => rng.setValues([[v]]),
            setFontWeight: () => rng, setBackground: () => rng, setFontColor: () => rng, setNumberFormat: () => rng, setWrap: () => rng, clearContent: () => rng
          };
          return rng;
        }
      };
      return s;
    }
    const ss = {
      getSheetByName: (n) => { const h = hoja(n); return h ? sheetObj(h) : null; },
      insertSheet: (n) => { const h = hoja(n); if (!h) throw new Error('Hoja desconocida: ' + n); return sheetObj(h); },
      getSheets: () => Object.keys(TABLAS).map((n) => ss.getSheetByName(n)).filter(Boolean),
      getNumSheets: () => Object.keys(TABLAS).length,
      deleteSheet: () => { }, setActiveSheet: () => { }, getId: () => 'supabase', toast: () => { }
    };
    const cache = {};
    const props = {
      _h: () => hoja('Propiedades'),
      getProperty: (k) => { const h = props._h(); const x = h.filas.find((r) => r.f[0] === k); return x ? String(x.f[1]) : null; },
      setProperty: (k, v) => { const h = props._h(); const x = h.filas.find((r) => r.f[0] === k); if (x) x.f[1] = String(v); else h.filas.push({ id: null, f: [k, String(v)], orig: null, parcial: false }); return props; },
      deleteProperty: (k) => { const h = props._h(); const i = h.filas.findIndex((r) => r.f[0] === k); if (i >= 0) { const x = h.filas.splice(i, 1)[0]; if (x.id != null) h.borrados.push(x.id); } return props; },
      getProperties: () => { const o = {}; props._h().filas.forEach((r) => { o[r.f[0]] = String(r.f[1]); }); return o; }
    };
    const shims = {
      SpreadsheetApp: { getActive: () => ss, getActiveSpreadsheet: () => ss, openById: () => ss, getUi: () => { throw new Error('Sin interfaz de hoja de cálculo.'); } },
      CacheService: { getScriptCache: () => ({ get: (k) => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: (k) => { delete cache[k]; } }) },
      PropertiesService: { getScriptProperties: () => props },
      LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => { }, releaseLock: () => { }, hasLock: () => true }) },
      Utilities: {
        getUuid: () => crypto.randomUUID(),
        DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF_8' },
        computeDigest: (alg, s) => sha256Bytes(s).map((b) => (b > 127 ? b - 256 : b)),
        base64Encode: (x) => { const a = typeof x === 'string' ? new TextEncoder().encode(x) : Uint8Array.from(x, (b) => b & 255); let s = ''; a.forEach((b) => { s += String.fromCharCode(b); }); return btoa(s); },
        formatDate: (d) => new Date(d).toISOString(), sleep: () => { }
      },
      Session: { getEffectiveUser: () => ({ getEmail: () => entorno.correoSuperadmin || '' }), getActiveUser: () => ({ getEmail: () => '' }) },
      ScriptApp: { getService: () => ({ getUrl: () => entorno.urlPublica || '' }), getScriptId: () => 'supabase' },
      DriveApp: { getFileById: () => { throw new Error('Drive no está disponible.'); } },
      HtmlService: {}, Logger: { log: () => { } }, UrlFetchApp: {}, MailApp: {}
    };
    const resolver = fabrica(...PARAMS.map((p) => shims[p]));
    HOJAS_ = resolver('HOJAS');
    return {
      llamar: (fn, args) => {
        let f; try { f = resolver(fn); } catch (e) { f = null; }
        if (typeof f !== 'function') throw new Error('Función no disponible: ' + fn);
        return f.apply(null, args);
      },
      cambios: () => {
        const out = [];
        Object.values(hojas).forEach((h) => {
          const tabla = TABLAS[h.nombre];
          h.borrados.forEach((id) => out.push({ tabla, op: 'del', id }));
          h.filas.forEach((x) => {
            if (x.parcial) return;
            const f = []; for (let j = 0; j < Math.max(h.head.length, x.f.length); j++) f.push(encCelda(x.f[j]));
            while (f.length > h.head.length && (f[f.length - 1] === '' || f[f.length - 1] === undefined)) f.pop();
            const txt = JSON.stringify(f);
            if (x.id == null) out.push(Object.assign({ tabla, op: 'ins', fila: f }, clavesFila(h.nombre, h.head, x.f)));
            else if (txt !== x.orig) out.push(Object.assign({ tabla, op: 'upd', id: x.id, fila: f }, clavesFila(h.nombre, h.head, x.f)));
          });
        });
        return out;
      }
    };
  }

  return { ejecutar };
}
