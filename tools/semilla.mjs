// Simulador de Innovación · Datos iniciales para una base de datos vacía.
// Ejecuta instalar() de Setup.gs (el mismo de Apps Script) sobre una base en memoria y escribe
// las filas resultantes como SQL listo para pegar en Supabase (SQL Editor) o aplicar con execute_sql.
// Crea las filas de Config y Parametros y el superadministrador con una contraseña temporal aleatoria.
// La contraseña temporal SOLO se muestra en pantalla: el SQL guarda su hash SHA-256 con sal.
// Uso: node tools/semilla.mjs [archivo.sql] [correo]
// (No subas el archivo .sql al repositorio público; contiene el hash de la contraseña temporal.)
import fs from 'node:fs';
import { crearNucleo } from '../supabase/functions/api/nucleo.js';
import { CODIGO } from '../supabase/functions/api/gas_codigo.js';
import { crearMemoria } from '../test/memoria.mjs';

export async function sembrar(mem, correo) {
  const n = crearNucleo({ codigo: CODIGO, adaptador: mem, entorno: { correoSuperadmin: correo, urlPublica: '' } });
  const { resultado } = await n.ejecutar('instalar', [], { interno: true });
  return resultado && resultado.superadmin; // { email, temporal }
}

export function aSQL(mem) {
  const q = (v) => (v == null ? 'null' : "'" + String(v).replace(/'/g, "''") + "'");
  const out = ['-- Datos iniciales del Simulador de Innovación (generado por tools/semilla.mjs)', 'begin;'];
  Object.keys(mem.tablas).forEach((t) => {
    mem.tablas[t].forEach((r) => {
      out.push(`insert into public.${t} (sim_id, k1, k2, ts, fila) values (${q(r.sim_id)}, ${q(r.k1)}, ${r.k2 == null ? 'null' : Number(r.k2)}, ${r.ts ? q(r.ts) + '::timestamptz' : 'null'}, ${q(JSON.stringify(r.fila))}::jsonb);`);
    });
  });
  out.push('commit;');
  return out.join('\n') + '\n';
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const archivo = process.argv[2] || 'semilla.sql', correo = process.argv[3] || 'jdavidatila@gmail.com';
  const mem = crearMemoria();
  const sa = await sembrar(mem, correo);
  fs.writeFileSync(archivo, aSQL(mem));
  console.log('SQL escrito en ' + archivo);
  console.log('Superadministrador: ' + sa.email + ' · contraseña temporal: ' + sa.temporal + ' (deberá cambiarla al ingresar)');
}
