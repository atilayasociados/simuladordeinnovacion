// Simulador de Innovación · Edge Function "api"
// Recibe POST { fn, args } desde la pantalla (docs/) y ejecuta la función del simulador con el mismo
// contrato que google.script.run. Autenticación propia: tokens de sesión del simulador (Acceso.gs),
// por eso verify_jwt = false. La service role key solo existe aquí, en el servidor.
import { crearNucleo } from './nucleo.js';
import { CODIGO } from './gas_codigo.js';

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

const nucleo = crearNucleo({ codigo: CODIGO, adaptador, entorno: { correoSuperadmin: CORREO_SUPERADMIN, urlPublica: URL_PUBLICA } });

function cors(origen: string | null) {
  const permitido = origen && (ORIGENES.includes(origen) || ORIGENES.includes('*')) ? origen : ORIGENES[0];
  return {
    'Access-Control-Allow-Origin': permitido,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

Deno.serve(async (req) => {
  const h = cors(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  if (req.method !== 'POST') return new Response('Método no permitido', { status: 405, headers: h });
  const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...h, 'Content-Type': 'application/json' } });
  let cuerpo: { fn?: string; args?: unknown[] };
  try { cuerpo = await req.json(); } catch { return json({ ok: false, error: 'Solicitud no válida.' }, 400); }
  try {
    const { resultado, medidas } = await nucleo.ejecutar(String(cuerpo.fn || ''), Array.isArray(cuerpo.args) ? cuerpo.args : []);
    return json({ ok: true, r: resultado, ms: medidas.ms });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});
