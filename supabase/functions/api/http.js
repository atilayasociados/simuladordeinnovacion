// Simulador de Innovación · Atención de peticiones HTTP (Request → Response estándar).
// Lo usan la Edge Function (index.ts) y el servidor local de pruebas (test/servidor.mjs).
export function crearManejador({ nucleo, origenes }) {
  function cors(origen) {
    const permitido = origen && (origenes.includes(origen) || origenes.includes('*')) ? origen : origenes[0];
    return {
      'Access-Control-Allow-Origin': permitido,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Vary': 'Origin',
    };
  }
  return async function (req) {
    const h = cors(req.headers.get('origin'));
    if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
    if (req.method !== 'POST') return new Response('Método no permitido', { status: 405, headers: h });
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...h, 'Content-Type': 'application/json' } });
    let cuerpo;
    try { cuerpo = await req.json(); } catch { return json({ ok: false, error: 'Solicitud no válida.' }, 400); }
    try {
      const { resultado, medidas } = await nucleo.ejecutar(String((cuerpo && cuerpo.fn) || ''), Array.isArray(cuerpo && cuerpo.args) ? cuerpo.args : []);
      return json({ ok: true, r: resultado, ms: medidas.ms });
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  };
}
