// Pruebas del motor "vida real": node motor/prueba.mjs
import fs from 'fs'; import vm from 'vm'; import path from 'path'; import { fileURLToPath } from 'url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const ctx = { module: undefined, console, Math, JSON };
vm.createContext(ctx);
for (const f of ['DatosVR.gs', 'MotorVR.gs']) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
const D = ctx.VR_DATOS;
let fallas = 0;
const ok = (c, m) => { if (!c) { fallas++; console.log('FALLA:', m); } else console.log('ok  ', m); };
const cerca = (a, b, tol) => Math.abs(a - b) <= tol;
const fmt = (x) => Math.round(x).toLocaleString('es-BO');

for (const N of [1, 3, 5, 8]) {
  // 1) participaciones del Año 0 (banco §9)
  const dem = ctx.vrDemanda_(D, ctx.vrProductosMercadoAnio0_(D, N), N);
  let chiq = 0; for (let i = 1; i <= N; i++) chiq += dem['E' + i + '-actual'].cuota;
  ok(cerca(chiq, 0.3356, 0.0005) && cerca(dem.cupesi.cuota, 0.5644, 0.0005) && cerca(dem.motacu.cuota, 0.100, 0.0005),
    `N=${N}: participaciones Chiquitano ${(chiq * 100).toFixed(1)} %, Cupesí ${(dem.cupesi.cuota * 100).toFixed(1)} %, Motacú ${(dem.motacu.cuota * 100).toFixed(1)} %`);

  // 2) empresa del Año 0 y 3) 12 trimestres sin cambios
  let E = ctx.vrCrearPartida(D, N);
  const V = E.anio0.litrosPorEquipo, S = E.anio0.ventasPorEquipo;
  ok(cerca(V * N, 3585368, 400), `N=${N}: litros Chiquitano total ${fmt(V * N)} L/año (aprobado 3.585.368)`);
  for (let t = 1; t <= 12; t++) E = ctx.vrSimularTrimestre(D, E, ctx.vrDecisionesNeutras(E));
  const eq = E.equipos[0], h = eq.historial;
  const cuadres = h.every((x) => Math.abs(x.balance.cuadre) < 1e-4);
  ok(cuadres, `N=${N}: el balance cuadra en los 12 trimestres`);
  const conc = h.every((x) => Math.abs(x.costeoVariable.conciliacion - (x.costeoVariable.fijoEnInventarioFinal - x.costeoVariable.fijoEnInventarioInicial)) < 1e-4);
  ok(conc, `N=${N}: conciliación absorción–variable = variación de costos fijos en inventario`);
  const q2 = h[1].resultados;
  ok(cerca(q2.ventas * 4 / S, 1, 1e-6), `N=${N}: ventas anuales estables = ${fmt(q2.ventas * 4)}`);
  ok(cerca(q2.costoVentas / q2.ventas, 0.7782, 1e-4), `N=${N}: costo de ventas ${(q2.costoVentas / q2.ventas * 100).toFixed(2)} % (aprobado 77,82 %)`);
  ok(cerca(q2.utilidadOperativa / q2.ventas, 0.0901, 1e-4), `N=${N}: margen operativo ${(q2.utilidadOperativa / q2.ventas * 100).toFixed(2)} % (aprobado 9,01 %)`);
  ok(h.every((x) => x.operacion.litrosVencidos < 1e-6 && x.operacion.ventasPerdidasLitros < 1e-6), `N=${N}: sin vencimientos ni ventas perdidas con las decisiones del Año 0`);
}

// Informe del Año 0 y del primer año para 5 equipos
let E = ctx.vrCrearPartida(D, 5);
const b0 = E.equipos[0];
console.log('\n--- 5 equipos: balance inicial por equipo ---');
const inv0 = b0.productos[0].lotes.reduce((s, l) => s + l.litros * l.costoUnit, 0);
console.log({ caja: fmt(b0.caja), cxc: fmt(b0.cxc), inventario: fmt(inv0), activoFijo: fmt(b0.activoFijo),
  totalActivo: fmt(b0.caja + b0.cxc + inv0 + b0.activoFijo), cxp: fmt(b0.cxp), deuda: fmt(b0.deuda), patrimonio: fmt(b0.capital) });
for (let t = 1; t <= 4; t++) E = ctx.vrSimularTrimestre(D, E, ctx.vrDecisionesNeutras(E));
const H = E.equipos[0].historial;
console.log('--- trimestres 1 a 4 (equipo 1) ---');
for (const x of H) console.log(`T${x.t}: ventas ${fmt(x.resultados.ventas)} | utilidad neta ${fmt(x.resultados.utilidadNeta)} | caja ${fmt(x.balance.caja)} | CxC ${fmt(x.balance.cxc)} | caja disponible lanzamiento ${fmt(x.cajaDisponibleLanzamiento)}`);
console.log(fallas ? `\n${fallas} FALLAS` : '\nTodas las pruebas pasaron');
process.exit(fallas ? 1 : 0);
