// Fija qué versión de la lógica del simulador (gas_codigo.js) carga la Edge Function.
// La función descarga gas_codigo.js de GitHub (commit exacto) al arrancar y verifica su SHA-256,
// así lo que se despliega en Supabase es pequeño (index.ts, nucleo.js, http.js, origen_codigo.js).
// Uso (después de node build.js, commit y push): node tools/origen.mjs  → luego commit, push y desplegar.
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { sha256Bytes } from '../supabase/functions/api/nucleo.js';
const REPO = 'jhonnyatilalijeron-ui/simulador-innovacion';
const RUTA = 'supabase/functions/api/gas_codigo.js';
const commit = execSync('git log -n 1 --format=%H -- ' + RUTA).toString().trim();
const cambios = execSync('git status --porcelain -- ' + RUTA).toString().trim();
if (cambios) throw new Error('gas_codigo.js tiene cambios sin commit: haz commit y push primero.');
const contenido = execSync('git show ' + commit + ':' + RUTA).toString();
const hash = sha256Bytes(contenido).map((b) => b.toString(16).padStart(2, '0')).join('');
fs.writeFileSync('supabase/functions/api/origen_codigo.js',
  '// Generado por tools/origen.mjs. Versión de la lógica que carga la Edge Function.\n' +
  'export const CODIGO_URL = ' + JSON.stringify('https://raw.githubusercontent.com/' + REPO + '/' + commit + '/' + RUTA) + ';\n' +
  'export const CODIGO_SHA256 = ' + JSON.stringify(hash) + ';\n');
console.log('origen_codigo.js → commit ' + commit.slice(0, 7) + ' · sha256 ' + hash.slice(0, 12) + '…');
