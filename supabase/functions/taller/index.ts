// @ts-nocheck
// Taller «Tu oficina en el bolsillo» · Edge Function "taller"
// Recibe POST { fn, args } desde las páginas del taller y responde { r } o { error }.
// Datos en el esquema "taller" (no expuesto por la API REST); se conecta con SUPABASE_DB_URL.
// La calificación es la misma del simulador en Apps Script (tallerIA/Code.gs).
import postgres from 'npm:postgres@3.4.4';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL'), { max: 4, prepare: false, idle_timeout: 20 });

var OBJETIVOS = {
  o1: 'Unidad 1 · Oficio con IA dictando (R-T-C-F)',
  o2: 'Unidad 2 · Evitar que la IA invente datos (FIEL)',
  o3: 'Unidad 3 · Consultar un documento con NotebookLM',
  o4: 'Unidad 4 · Escanear y guardar con orden',
  o5: 'Unidad 5 · Semáforo de datos',
  quiz: 'Quiz final'
};
var TITULO = 'Tu oficina en el bolsillo: IA y orden digital';

var DETECTIVES = [
  { ok: 'a', exp: 'Fecha: «31 de noviembre» no existe: noviembre tiene 30 días.' },
  { ok: 'b', exp: 'Cifra: 10 resmas × Bs 40 = Bs 400, no 600. El total correcto es Bs 1.400, no 1.600.' },
  { ok: 'c', exp: 'Artículo: cita el artículo 9, pero el reglamento del Anexo A solo tiene 5 artículos.' }
];
var SEMAFORO = ['V', 'R', 'V', 'R', 'A', 'R', 'A', 'R'];
var SEMAFORO_EXP = [
  'calendario publicado en la web: es público.',
  'notas finales con nombres: identifican a personas.',
  'modelo con [nombre]: no tiene datos reales.',
  'número de teléfono móvil de un docente: dato personal.',
  'acta interna ya sin nombres ni datos personales: interna, con cuidado.',
  'contraseña de un sistema: nunca se comparte.',
  'instructivo interno sin nombres: interno, con cuidado.',
  'foto del carnet de un estudiante: dato de identidad.'
];
var DATOS_REALES = [['Ana', /\bana\b/i], ['Ejemplo', /ejemplo/i], ['Pérez', /p[eé]rez/i], ['registro 12345678', /12345678/], ['número 70000000', /70000000/], ['Carlos', /carlos/i], ['Muestra', /muestra/i]];
var QUIZ = [
  { ok: 'a', exp: 'R-T-C-F: Rol, Tarea, Contexto, Formato.' },
  { ok: 'b', exp: 'Una alucinación es cuando la IA inventa un dato y lo dice con seguridad.' },
  { ok: 'b', exp: 'Los números pequeños llevan al párrafo original para comprobar.' },
  { ok: 'b', exp: 'Buen nombre: 2026-11-18_Oficio_Solicitud-Materiales_v1.' },
  { ok: 'c', exp: 'Una lista de notas de un curso es roja: identifica a personas.' }
];
var REGEX_ARCHIVO = /^(\d{4})-(\d{2})-(\d{2})_[A-Za-z0-9]+_[A-Za-z0-9-]+_v\d+(\.(pdf|jpg|jpeg|png))?$/i;

function calificar_(obj, d) {
  var p = 0, det = [], res = '';
  function txt(x) { return limpio_(x); }
  if (obj === 'o1') {
    var of = txt(d.oficio), lis = d.rtcf || [], cmp = txt(d.comparacion), letras = ['Rol', 'Tarea', 'Contexto', 'Formato'], n = 0;
    if (of.length >= 150) { p += 6; det.push('✔ Oficio pegado (6/6)'); } else det.push('✘ Pegue el oficio completo (al menos 150 caracteres; tiene ' + of.length + ')');
    letras.forEach(function (l, i) { if (lis[i] === true) n++; });
    p += n * 2; det.push((n === 4 ? '✔' : '•') + ' Su prompt tuvo ' + n + ' de 4 partes de R-T-C-F (' + n * 2 + '/8)' + (n < 4 ? '. Faltó: ' + letras.filter(function (l, i) { return lis[i] !== true; }).join(', ') : ''));
    if (cmp.length >= 15) { p += 6; det.push('✔ Comparó con «hazme un oficio» (6/6)'); } else det.push('✘ Escriba cuál salió mejor y por qué');
    res = 'Oficio ' + of.length + ' caracteres; R-T-C-F ' + n + '/4';
  } else if (obj === 'o2') {
    var q = d.detectives || [], bien = 0, rep = txt(d.reparado), low = rep.toLowerCase();
    DETECTIVES.forEach(function (x, k) { var ok = q[k] === x.ok; if (ok) { p += 4; bien++; } det.push((ok ? '✔ ' : '✘ ') + x.exp); });
    if (rep.length >= 60) { p += 4; det.push('✔ Escribió su pedido reescrito (4/4)'); } else det.push('✘ Pegue el pedido que reescribió con FIEL (al menos 60 caracteres)');
    var fiel = /falta dato|no tengo ese dato|no inventes|solo (con )?(este|el) texto|solo datos del texto|entre comillas/.test(low);
    if (rep.length >= 60 && fiel) { p += 4; det.push('✔ Su pedido incluye reglas FIEL (4/4)'); } else det.push('✘ Agregue reglas FIEL: «Usa solo datos del texto», «Si falta un dato, escribe [FALTA DATO]», «No inventes…»');
    res = 'Detectives ' + bien + '/3; FIEL ' + (fiel ? 'sí' : 'no');
  } else if (obj === 'o3') {
    var p1 = txt(d.pregunta1), fr = txt(d.frase), p2 = txt(d.pregunta2);
    if (p1.length >= 10) { p += 4; det.push('✔ Pregunta con respuesta en el documento (4/4)'); } else det.push('✘ Escriba la pregunta cuya respuesta sí está en el documento');
    if (d.comprobado === 'si') { p += 4; det.push('✔ Tocó el número de cita y comprobó (4/4)'); } else det.push('✘ Toque el número pequeño de la respuesta y compare con el párrafo');
    if (fr.length >= 10) { p += 4; det.push('✔ Copió la frase del párrafo original (4/4)'); } else det.push('✘ Copie una frase del párrafo original que respalda la respuesta');
    if (p2.length >= 10) { p += 4; det.push('✔ Pregunta cuya respuesta no está en el documento (4/4)'); } else det.push('✘ Escriba la pregunta cuya respuesta no está en el documento');
    if (d.reaccion) { p += 4; det.push('✔ Anotó qué hizo NotebookLM con esa pregunta (4/4)'); } else det.push('✘ Indique qué hizo NotebookLM con la pregunta sin respuesta');
    res = 'Comprobó: ' + (d.comprobado || '—') + '; sin respuesta: ' + (d.reaccion || '—') + (d.pareja ? ' · con ' + limpio_(d.pareja).slice(0, 40) : '');
  } else if (obj === 'o4') {
    var arch = txt(d.archivo).replace(/\s+/g, ''), m = arch.match(REGEX_ARCHIVO), fechaOk = m && Number(m[2]) >= 1 && Number(m[2]) <= 12 && Number(m[3]) >= 1 && Number(m[3]) <= 31;
    if (m && fechaOk) { p += 10; det.push('✔ El nombre cumple las 4 partes: fecha, tipo, asunto y versión (10/10)'); } else det.push('✘ El nombre debe ser AAAA-MM-DD_Tipo_Asunto_v1, sin tildes ni espacios. Ejemplo: 2026-11-18_Oficio_Solicitud-Materiales_v1');
    var anio = /^\d{4}$/.test(txt(d.carpAnio)), uni = txt(d.carpUnidad).length >= 2, tip = txt(d.carpTipo).length >= 3;
    if (anio && uni && tip) { p += 5; det.push('✔ Carpetas Año › Unidad › Tipo (5/5)'); } else det.push('✘ Complete las carpetas: Año (por ejemplo 2026) › su unidad › tipo (por ejemplo Oficios)');
    if (d.anexoB === true) { p += 5; det.push('✔ Escaneó la hoja del Anexo B (5/5)'); } else det.push('✘ Escanee la hoja del Anexo B (no use documentos reales)');
    res = arch.slice(0, 80) + ' en ' + [txt(d.carpAnio), txt(d.carpUnidad), txt(d.carpTipo)].join(' › ').slice(0, 80);
  } else if (obj === 'o5') {
    var r5 = d.casos || [], b5 = 0;
    SEMAFORO.forEach(function (ok, k) { var bien5 = r5[k] === ok; if (bien5) b5++; det.push((bien5 ? '✔ ' : '✘ ') + 'Caso ' + (k + 1) + ' es ' + { V: 'VERDE', A: 'AMARILLO', R: 'ROJO' }[ok] + ': ' + SEMAFORO_EXP[k]); });
    p += Math.round(b5 * 1.5);
    var an = txt(d.anonimizado), quedan = DATOS_REALES.filter(function (x) { return x[1].test(an); }).map(function (x) { return x[0]; });
    if (an.length < 40) det.push('✘ Pegue su texto anonimizado (Ejercicio 3)');
    else if (quedan.length) { p += 4; det.push('• Texto anonimizado pegado, pero todavía tiene datos reales: ' + quedan.join(', ') + ' (4/8)'); }
    else { p += 8; det.push('✔ Texto anonimizado sin datos reales (8/8)'); }
    res = 'Semáforo ' + b5 + '/8; anonimizado: ' + (an.length < 40 ? 'no' : (quedan.length ? 'con datos: ' + quedan.join(', ') : 'correcto'));
  } else if (obj === 'quiz') {
    var rq = d.respuestas || [], bq = 0;
    QUIZ.forEach(function (x, k) { var ok = rq[k] === x.ok; if (ok) bq++; det.push((ok ? '✔ ' : '✘ ') + 'Pregunta ' + (k + 1) + ': ' + x.exp); });
    return { puntos: bq, detalle: det, resumen: 'Quiz ' + bq + '/5' };
  }
  return { puntos: Math.min(20, p), detalle: det, resumen: res };
}

function nivel_(p) { p = Number(p); if (p >= 16) return 'Logrado'; if (p > 0) return 'En proceso'; return 'No iniciado'; }

function limpio_(x) { return String(x === undefined || x === null ? '' : x).trim().slice(0, 6000); }
function norm_(x) { return limpio_(x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' '); }

async function hash_(s) {
  const b = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('tallerIA|' + String(s || ''))));
  let t = ''; b.forEach((x) => { t += String.fromCharCode(x); }); return btoa(t);
}
const hoyLaPaz = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const horaLaPaz = (d) => new Intl.DateTimeFormat('es-BO', { timeZone: 'America/La_Paz', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(d);

let listo = null;
function preparar() {
  if (!listo) {
    listo = (async () => {
      await sql.unsafe(`
        create schema if not exists taller;
        revoke all on schema taller from anon, authenticated;
        create table if not exists taller.config (k text primary key, v text not null default '');
        create table if not exists taller.part (
          id text primary key, clave_norm text unique not null, creado timestamptz not null default now(),
          codigo text not null, nombre text not null, unidad text not null, ruta text not null default 'A',
          pareja text not null default '', equipo text not null default '',
          o1 int, o2 int, o3 int, o4 int, o5 int, quiz int, total int not null default 0,
          actualizado timestamptz not null default now());
        create table if not exists taller.evid (
          id bigserial primary key, fecha timestamptz not null default now(),
          pid text not null references taller.part(id) on delete cascade, obj text not null, objetivo text not null,
          puntos int not null, nivel text not null, detalle text not null default '', datos jsonb not null default '{}'::jsonb);
        create index if not exists evid_pid on taller.evid(pid, id);
        alter table taller.part add column if not exists ap_paterno text not null default '';
        alter table taller.part add column if not exists ap_materno text not null default '';
        alter table taller.part add column if not exists nombres text not null default '';
        alter table taller.part add column if not exists codigo_adm text not null default '';
        alter table taller.part add column if not exists telefono text not null default '';
      `);
      const defs = [['codigo_taller', 'IA893'], ['titulo', TITULO], ['nombre_documento', ''], ['url_documento', ''], ['url_presentacion', ''], ['fecha_taller', '2026-11-18'], ['clave_fac', await hash_(Deno.env.get('CLAVE_TALLER') || 'Taller2026')]];
      for (const [k, v] of defs) await sql`insert into taller.config (k, v) values (${k}, ${v}) on conflict (k) do nothing`;
    })();
    listo.catch(() => { listo = null; });
  }
  return listo;
}
async function config() { const o = {}; (await sql`select k, v from taller.config`).forEach((r) => { o[r.k] = r.v; }); return o; }
async function clave_(c) { const cf = await config(); if (!cf.clave_fac || (await hash_(c)) !== cf.clave_fac) throw new Error('Contraseña incorrecta.'); return cf; }
async function estado(id) {
  const f = (await sql`select * from taller.part where id = ${String(id)}`)[0];
  if (!f) throw new Error('No encontramos su registro. Vuelva a ingresar.');
  const ult = {};
  (await sql`select distinct on (obj) obj, datos from taller.evid where pid = ${f.id} order by obj, id desc`).forEach((e) => { ult[e.obj] = e.datos; });
  return { id: f.id, nombre: f.nombre, unidad: f.unidad, ruta: f.ruta, pareja: f.pareja, equipo: f.equipo,
    puntos: { o1: f.o1, o2: f.o2, o3: f.o3, o4: f.o4, o5: f.o5 }, quiz: f.quiz, total: f.total || 0, evidencias: ult };
}
function panelDe(cf, filas) {
  const ahora = Date.now();
  return { codigo: cf.codigo_taller, nombreDocumento: cf.nombre_documento || '', urlDocumento: cf.url_documento || '', urlPresentacion: cf.url_presentacion || '', urlHoja: '',
    participantes: filas.map((f) => ({ id: f.id, nombre: f.ap_paterno ? (f.ap_paterno + ' ' + f.ap_materno + ', ' + f.nombres) : f.nombre, telefono: f.telefono || '', codigoAdm: f.codigo_adm || '', unidad: f.unidad, ruta: f.ruta, pareja: f.pareja, equipo: f.equipo,
      o: [f.o1, f.o2, f.o3, f.o4, f.o5], quiz: f.quiz, total: f.total || 0, minutos: Math.round((ahora - new Date(f.actualizado).getTime()) / 60000) })),
    hora: horaLaPaz(new Date()) };
}

const API = {
  async iniciar() { const c = await config(); return { titulo: c.titulo || TITULO, urlDocumento: c.url_documento || '', nombreDocumento: c.nombre_documento || '', urlPresentacion: c.url_presentacion || '', fecha: /^\d{4}-\d{2}-\d{2}$/.test(c.fecha_taller || '') ? c.fecha_taller : hoyLaPaz() }; },
  async ingresar(d) {
    d = d || {};
    const c = await config();
    const codigo = limpio_(d.codigo).toUpperCase(), ruta = d.ruta === 'B' ? 'B' : 'A', equipo = limpio_(d.equipo).slice(0, 20);
    const apP = limpio_(d.apPaterno).slice(0, 60), apM = limpio_(d.apMaterno).slice(0, 60), noms = limpio_(d.nombres).slice(0, 80);
    const codAdm = limpio_(d.codigoAdm).slice(0, 30), tel = limpio_(d.telefono).replace(/[\s-]/g, '').slice(0, 20), unidad = limpio_(d.unidad).slice(0, 120);
    if (!codigo || codigo !== String(c.codigo_taller || '').toUpperCase()) throw new Error('El código del taller no es correcto. Revíselo en la pantalla del facilitador.');
    if (apP.length < 2) throw new Error('Escriba su apellido paterno.');
    if (apM.length < 2) throw new Error('Escriba su apellido materno.');
    if (noms.length < 2) throw new Error('Escriba su nombre o nombres.');
    if (!/^\+?\d{7,15}$/.test(tel)) throw new Error('Escriba su número de teléfono (solo números, por ejemplo 71234567).');
    if (unidad.length < 2) throw new Error('Escriba su unidad o dependencia.');
    const nombre = (noms + ' ' + apP + ' ' + apM).replace(/\s+/g, ' ').trim();
    const clave = norm_(apP) + '|' + norm_(apM) + '|' + norm_(noms) + '|' + codigo;
    const id = 'P' + crypto.randomUUID().replace(/-/g, '').slice(0, 10);
    const r = await sql`insert into taller.part (id, clave_norm, codigo, nombre, unidad, ruta, equipo, ap_paterno, ap_materno, nombres, codigo_adm, telefono)
      values (${id}, ${clave}, ${codigo}, ${nombre}, ${unidad}, ${ruta}, ${equipo}, ${apP}, ${apM}, ${noms}, ${codAdm}, ${tel})
      on conflict (clave_norm) do update set ruta = excluded.ruta, actualizado = now(), unidad = excluded.unidad, telefono = excluded.telefono,
        codigo_adm = case when excluded.codigo_adm <> '' then excluded.codigo_adm else taller.part.codigo_adm end,
        equipo = case when excluded.equipo <> '' then excluded.equipo else taller.part.equipo end
      returning id`;
    return estado(r[0].id);
  },
  async volver(id) { if (!id) throw new Error('Sin sesión'); return estado(id); },
  async cambiarRuta(id, ruta, pareja) {
    const r = await sql`update taller.part set ruta = ${ruta === 'B' ? 'B' : 'A'}, pareja = ${limpio_(pareja).slice(0, 80)}, actualizado = now() where id = ${String(id)} returning id`;
    if (!r.length) throw new Error('No encontramos su registro. Vuelva a ingresar.');
    return estado(id);
  },
  async guardar(id, obj, datos) {
    if (!OBJETIVOS[obj]) throw new Error('Unidad no válida.');
    const cal = calificar_(obj, datos || {}), esQuiz = obj === 'quiz', nivel = esQuiz ? cal.puntos + ' de 5' : nivel_(cal.puntos);
    const f = (await sql`select id, nombre from taller.part where id = ${String(id)}`)[0];
    if (!f) throw new Error('No encontramos su registro. Vuelva a ingresar con el mismo nombre y unidad.');
    await sql`update taller.part set ${sql(obj)} = ${cal.puntos}, actualizado = now() where id = ${f.id}`;
    if (obj === 'o3' && datos && datos.pareja) await sql`update taller.part set pareja = ${limpio_(datos.pareja).slice(0, 80)} where id = ${f.id}`;
    await sql`update taller.part set total = coalesce(o1,0)+coalesce(o2,0)+coalesce(o3,0)+coalesce(o4,0)+coalesce(o5,0) where id = ${f.id}`;
    const txt = JSON.stringify(datos || {}), guardado = txt.length <= 45000 ? JSON.parse(txt) : {};
    await sql`insert into taller.evid (pid, obj, objetivo, puntos, nivel, detalle, datos) values (${f.id}, ${obj}, ${OBJETIVOS[obj]}, ${cal.puntos}, ${nivel}, ${cal.resumen}, ${sql.json(guardado)})`;
    return { puntos: cal.puntos, nivel, detalle: cal.detalle, estado: await estado(f.id) };
  },
  async fcEstado() { return { tieneClave: true }; },
  async fcCrearClave() { throw new Error('La contraseña ya fue creada.'); },
  async fcPanel(c) { const cf = await clave_(c); return panelDe(cf, await sql`select * from taller.part order by ap_paterno, ap_materno, nombres, creado`); },
  async fcEvidencias(c, id) {
    await clave_(c);
    return (await sql`select * from taller.evid where pid = ${String(id)} order by id`).map((e) => ({ fecha: horaLaPaz(new Date(e.fecha)).slice(0, 5), objetivo: e.objetivo, puntos: e.puntos, nivel: e.nivel, detalle: e.detalle, datos: JSON.stringify(e.datos) }));
  },
  async fcConfig(c, d) {
    await clave_(c); d = d || {};
    if (d.codigo !== undefined) { const cod = limpio_(d.codigo).toUpperCase().replace(/\s+/g, ''); if (cod.length < 3) throw new Error('El código debe tener al menos 3 caracteres.'); await sql`update taller.config set v = ${cod} where k = 'codigo_taller'`; }
    if (d.nombreDocumento !== undefined) await sql`update taller.config set v = ${limpio_(d.nombreDocumento)} where k = 'nombre_documento'`;
    if (d.urlDocumento !== undefined) await sql`update taller.config set v = ${limpio_(d.urlDocumento)} where k = 'url_documento'`;
    if (d.urlPresentacion !== undefined) await sql`update taller.config set v = ${limpio_(d.urlPresentacion)} where k = 'url_presentacion'`;
    return API.fcPanel(c);
  },
  async fcCSV(c) {
    await clave_(c);
    const filas = await sql`select * from taller.part order by ap_paterno, ap_materno, nombres, creado`;
    const cab = ['Apellido paterno', 'Apellido materno', 'Nombres', 'Código administrativo', 'Teléfono', 'Unidad', 'Equipo', 'Ruta', 'Pareja', 'U1', 'U2', 'U3', 'U4', 'U5', 'Total', 'Quiz (de 5)', 'Nivel U1', 'Nivel U2', 'Nivel U3', 'Nivel U4', 'Nivel U5'];
    const out = [cab].concat(filas.map((f) => { const o = [f.o1, f.o2, f.o3, f.o4, f.o5]; return [f.ap_paterno, f.ap_materno, f.nombres || f.nombre, f.codigo_adm, f.telefono, f.unidad, f.equipo, f.ruta === 'B' ? 'Sin cuenta de Google' : 'Con cuenta de Google', f.pareja].concat(o.map((x) => x ?? 0)).concat([f.total, f.quiz ?? '']).concat(o.map((x) => nivel_(x ?? 0))); }));
    return out.map((r) => r.map((x) => { const s = String(x ?? ''); return /[";\n,]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';')).join('\r\n');
  },
};

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const json = (o) => new Response(JSON.stringify(o), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' });
  let b; try { b = JSON.parse(await req.text()); } catch { return json({ error: 'Solicitud no válida.' }); }
  const fn = String((b && b.fn) || ''), args = Array.isArray(b && b.args) ? b.args : [];
  if (!Object.prototype.hasOwnProperty.call(API, fn)) return json({ error: 'Función no válida.' });
  try { await preparar(); return json({ r: await API[fn](...args) }); }
  catch (e) { console.error(fn, e); return json({ error: e instanceof Error ? e.message : String(e) }); }
});
