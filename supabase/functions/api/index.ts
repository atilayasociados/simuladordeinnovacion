// Simulador de Innovación · Edge Function "api"
// Recibe POST { fn, args } desde la pantalla (docs/) y ejecuta la función del simulador con el mismo
// contrato que google.script.run. Autenticación propia: tokens de sesión del simulador (Acceso.gs),
// por eso verify_jwt = false. La service role key solo existe aquí, en el servidor.
import { crearNucleo, sha256Bytes } from './nucleo.js';
import { CODIGO_URL, CODIGO_SHA256 } from './origen_codigo.js';
import { crearManejador } from './http.js';

// Orígenes permitidos (CORS). Cambie esta lista si cambia la dirección pública del simulador,
// o defina la variable de entorno ORIGENES_PERMITIDOS (separados por comas). "*" permite cualquiera.
const ORIGENES = (Deno.env.get('ORIGENES_PERMITIDOS') || 'https://jhonnyatilalijeron-ui.github.io,*').split(',').map((s) => s.trim());
const URL_PUBLICA = Deno.env.get('URL_PUBLICA') || 'https://jhonnyatilalijeron-ui.github.io/simulador-innovacion/';
const CORREO_SUPERADMIN = Deno.env.get('CORREO_SUPERADMIN') || 'jdavidatila@gmail.com';

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function rpc(nombre: string, cuerpo: unknown) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${nombre}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    body: JSON.stringify(cuerpo),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Base de datos (${nombre}): ${txt.slice(0, 300)}`);
  return txt ? JSON.parse(txt) : null;
}

const adaptador = {
  cargar: (p: unknown) => rpc('sim_cargar', { p }),
  aplicar: (p: unknown) => rpc('sim_aplicar', { p }),
  tomarBloqueo: (n: string, t: string, s: number) => rpc('sim_tomar_bloqueo', { p_nombre: n, p_token: t, p_seg: s }),
  soltarBloqueo: (n: string, t: string) => rpc('sim_soltar_bloqueo', { p_nombre: n, p_token: t }),
};

// La lógica del simulador (gas_codigo.js, generado por build.js) se descarga de GitHub en el commit fijado
// por tools/origen.mjs y se verifica con SHA-256 antes de usarla. Se descarga una vez por instancia.
let nucleoListo: Promise<{ ejecutar: (fn: string, args: unknown[]) => Promise<{ resultado: unknown; medidas: { ms: number } }> }> | null = null;
function obtenerNucleo() {
  if (!nucleoListo) {
    nucleoListo = (async () => {
      const r = await fetch(CODIGO_URL);
      if (!r.ok) throw new Error('No se pudo descargar la lógica del simulador (' + r.status + ').');
      const txt = await r.text();
      const h = sha256Bytes(txt).map((b: number) => b.toString(16).padStart(2, '0')).join('');
      if (h !== CODIGO_SHA256) throw new Error('La lógica descargada no coincide con la versión esperada.');
      const m = /^export const CODIGO = (".*");\s*$/m.exec(txt);
      if (!m) throw new Error('Formato de gas_codigo.js no reconocido.');
      const codigo = JSON.parse(m[1]);
      return crearNucleo({ codigo, adaptador, entorno: { correoSuperadmin: CORREO_SUPERADMIN, urlPublica: URL_PUBLICA } });
    })();
    nucleoListo.catch(() => { nucleoListo = null; });
  }
  return nucleoListo;
}
const nucleo = { ejecutar: async (fn: string, args: unknown[]) => (await obtenerNucleo()).ejecutar(fn, args) };

Deno.serve(crearManejador({ nucleo, origenes: ORIGENES }));
