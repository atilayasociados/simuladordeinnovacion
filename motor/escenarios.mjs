// Escenarios de comportamiento del motor: node motor/escenarios.mjs
import fs from 'fs'; import vm from 'vm'; import path from 'path'; import { fileURLToPath } from 'url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const ctx = { module: undefined, console, Math, JSON }; vm.createContext(ctx);
for (const f of ['DatosVR.gs', 'MotorVR.gs']) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
const D = ctx.VR_DATOS, fmt = (x) => Math.round(x).toLocaleString('es-BO');
function correr(cambio) {
  let E = ctx.vrCrearPartida(D, 5); const dec = ctx.vrDecisionesNeutras(E); cambio(dec, E);
  E = ctx.vrSimularTrimestre(D, E, dec); const h = E.equipos[0].historial[0], h2 = E.equipos[1].historial[0];
  return { litrosE1: fmt(h.operacion.litrosVendidos), litrosE2: fmt(h2.operacion.litrosVendidos), vencidos: fmt(h.operacion.litrosVencidos),
    perdidas: fmt(h.operacion.ventasPerdidasLitros), utilidadNetaE1: fmt(h.resultados.utilidadNeta), cuotaE1: (h.mercado.cuotas['E1-actual'] * 100).toFixed(2) + ' %' };
}
console.log('Base:', correr(() => {}));
console.log('E1 sube precio 10 %:', correr((d) => { d.E1.productos['E1-actual'].precioEmpresa *= 1.10; }));
console.log('E1 duplica publicidad:', correr((d) => { d.E1.productos['E1-actual'].publicidad *= 2; }));
console.log('E1 sin publicidad:', correr((d) => { d.E1.productos['E1-actual'].publicidad = 0; }));
console.log('E1 vende 100 % en tiendas:', correr((d) => { d.E1.productos['E1-actual'].mezcla = { supermercado: 0, tienda: 1, mercado: 0 }; }));
console.log('E1 produce 50 % más:', correr((d, E) => { const v = E.anio0.litrosPorEquipo / 52; d.E1.productos['E1-actual'].produccionSemanal = v * 1.5; }));
console.log('E1 produce 30 % menos:', correr((d, E) => { const v = E.anio0.litrosPorEquipo / 52; d.E1.productos['E1-actual'].produccionSemanal = v * 0.7; }));
