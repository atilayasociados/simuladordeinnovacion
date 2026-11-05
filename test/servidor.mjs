// Servidor local que imita GitHub Pages (docs/) + la Edge Function "api" (mismo manejador HTTP),
// con base de datos en memoria. Uso en pruebas: const s = await iniciar(8790); ... s.cerrar()
// Uso manual: node test/servidor.mjs  → http://localhost:8790/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearNucleo } from '../supabase/functions/api/nucleo.js';
import { CODIGO } from '../supabase/functions/api/gas_codigo.js';
import { crearManejador } from '../supabase/functions/api/http.js';
import { crearMemoria } from './memoria.mjs';
import { sembrar } from '../tools/semilla.mjs';

const DOCS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css' };

export async function iniciar(puerto, opciones = {}) {
  const mem = crearMemoria();
  const sa = await sembrar(mem, 'jdavidatila@gmail.com');
  const url = 'http://localhost:' + puerto + '/';
  const nucleo = crearNucleo({ codigo: CODIGO, adaptador: mem, entorno: { correoSuperadmin: 'jdavidatila@gmail.com', urlPublica: url } });
  const manejar = crearManejador({ nucleo, origenes: [url.slice(0, -1)] });
  const llamadas = { total: 0, sinClave: 0 };
  const srv = http.createServer(async (req, res) => {
    const u = new URL(req.url, url);
    if (u.pathname === '/api') {
      let b = ''; for await (const c of req) b += c;
      llamadas.total++; if (req.method === 'POST' && req.headers.apikey !== 'local') llamadas.sinClave++;
      if (opciones.latencia) await new Promise((r) => setTimeout(r, opciones.latencia));
      const r = await manejar(new Request(url + 'api', { method: req.method, headers: req.headers, body: req.method === 'POST' ? b : undefined }));
      res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(await r.text()); return;
    }
    if (u.pathname === '/config.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); res.end("window.SIM_API='" + url + "api';window.SIM_KEY='local';"); return; }
    const f = path.join(DOCS, u.pathname === '/' ? 'index.html' : path.normalize(u.pathname).replace(/^\/+/, ''));
    if (!f.startsWith(DOCS) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no existe'); return; }
    let cuerpo = fs.readFileSync(f);
    // sin internet en el contenedor de pruebas: se quitan las fuentes de Google
    if (f.endsWith('.html')) cuerpo = cuerpo.toString().replace(/<link[^>]*fonts\.(googleapis|gstatic)[^>]*>/g, '');
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); res.end(cuerpo);
  });
  await new Promise((r) => srv.listen(puerto, r));
  return { url, mem, sa, llamadas, cerrar: () => new Promise((r) => srv.close(r)) };
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const s = await iniciar(Number(process.argv[2]) || 8790);
  console.log('Simulador local en ' + s.url + ' · superadmin ' + s.sa.email + ' / ' + s.sa.temporal);
}
