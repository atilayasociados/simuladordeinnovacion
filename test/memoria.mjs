// Base de datos simulada en memoria con la misma semántica que las funciones SQL
// sim_cargar, sim_aplicar, sim_tomar_bloqueo y sim_soltar_bloqueo (supabase/migrations/0001_esquema.sql).
export function crearMemoria() {
  const tablas = {}, bloqueos = {}; let sec = 0;
  const T = (t) => (tablas[t] = tablas[t] || []);
  const copia = (x) => JSON.parse(JSON.stringify(x));
  const stats = { cargas: 0, aplicar: 0, filasLeidas: 0, bytesLeidos: 0 };
  return {
    tablas, stats,
    async cargar(p) {
      stats.cargas++;
      const res = {};
      for (const it of p) {
        let L = T(it.tabla).slice();
        if (it.sim != null) L = L.filter((r) => r.sim_id === it.sim);
        if (it.k1 != null) L = L.filter((r) => r.k1 === it.k1);
        if (it.desde != null) L = L.filter((r) => r.ts && r.ts >= it.desde);
        if (Array.isArray(it.ids)) L = L.filter((r) => it.ids.includes(r.id));
        const filas = L.sort((a, b) => a.id - b.id).map((r) => [r.id, copia(it.parcial ? r.fila.slice(0, it.parcial) : r.fila)]);
        stats.filasLeidas += filas.length; stats.bytesLeidos += JSON.stringify(filas).length;
        res[it.tabla] = (res[it.tabla] || []).concat(filas);
      }
      return res;
    },
    async aplicar(p) {
      stats.aplicar++;
      for (const it of p) {
        const L = T(it.tabla);
        if (it.op === 'ins') L.push({ id: ++sec, sim_id: it.sim_id ?? null, k1: it.k1 ?? null, k2: it.k2 ?? null, ts: it.ts ?? null, fila: copia(it.fila) });
        else if (it.op === 'upd') { const r = L.find((x) => x.id === it.id); if (r) Object.assign(r, { sim_id: it.sim_id ?? null, k1: it.k1 ?? null, k2: it.k2 ?? null, ts: it.ts ?? null, fila: copia(it.fila) }); }
        else if (it.op === 'del') { const i = L.findIndex((x) => x.id === it.id); if (i >= 0) L.splice(i, 1); }
        else throw new Error('operación no válida');
      }
      return p.length;
    },
    async tomarBloqueo(n, t, s) { const b = bloqueos[n]; if (!b || b.hasta < Date.now()) { bloqueos[n] = { t, hasta: Date.now() + s * 1000 }; } return bloqueos[n].t === t; },
    async soltarBloqueo(n, t) { if (bloqueos[n] && bloqueos[n].t === t) delete bloqueos[n]; }
  };
}
