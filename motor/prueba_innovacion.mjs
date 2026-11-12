// Prueba de un proyecto completo: node motor/prueba_innovacion.mjs
import fs from 'fs'; import vm from 'vm'; import path from 'path'; import { fileURLToPath } from 'url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const ctx = { module: undefined, console, Math, JSON }; vm.createContext(ctx);
for (const f of ['DatosVR.gs', 'MotorVR.gs', 'InnovacionVR.gs']) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
const D = ctx.VR_DATOS, fmt = (x) => Math.round(x).toLocaleString('es-BO');
let fallas = 0; const ok = (c, m) => { if (!c) { fallas++; console.log('FALLA:', m); } else console.log('ok  ', m); };

let E = ctx.vrCrearPartida(D, 5);
const banco = ctx.vrBanco(D, E);
const precio = E.equipos[0].productos[0].precioEmpresa, pubRef = E.equipos[0].productos[0].publicidadRef;
const proyecto = {
  id: 'P1', nombre: 'Chiquitano con menos azúcar', clase: 'incremental', justificacionClase: 'Cambia la fórmula del producto actual',
  idea: { problema: 'El producto actual tiene mucha azúcar', paraQuien: 'Consumidores de lo natural', propuesta: 'Chocolatada con 4 g de azúcar añadida por porción' },
  segmentoObjetivo: 'natural', muestra: 400,
  producto: { endulzante: ['azucar_cana'], azucarAnadida100ml: 1.67, grasa100ml: 1.6, proteina100ml: 3.1, tamanoMl: 1000, conservacion: 'uht' },
  hoja: [
    { descripcion: 'Leche cruda', categoria: 'contenido', tipo: 'variable', rubro: 'leche_cruda', cantidad: 1 },
    { descripcion: 'Azúcar 16,7 g/L', categoria: 'contenido', tipo: 'variable', rubro: 'azucar', cantidad: 0.0167 },
    { descripcion: 'Cacao 10 g/L', categoria: 'contenido', tipo: 'variable', rubro: 'cacao', cantidad: 0.010 },
    { descripcion: 'Envase e insumos', categoria: 'envase', tipo: 'variable', rubro: 'insumos_envase_actual', cantidad: 1 },
    { descripcion: 'Planta actual', categoria: 'mano_de_obra', tipo: 'variable', rubro: 'mano_obra_planta_actual', cantidad: 1 },
    { descripcion: 'Formulación (1 mes de profesional)', categoria: 'otro', tipo: 'desarrollo', rubro: 'sueldo_profesional', cantidad: 1 }
  ],
  plan: { precioEmpresa: precio, mezcla: { supermercado: 1, tienda: 0, mercado: 0 }, publicidad: pubRef, produccionSemanal: 20000 },
  gantt: [
    { nombre: 'Estudio del consumidor', tipo: 'estudio_consumidor', inicio: 1, duracion: 5, responsable: 1, carga: 0.2 },
    { nombre: 'Prueba de concepto', tipo: 'prueba_concepto', inicio: 6, duracion: 5, responsable: 1, carga: 0.2 },
    { nombre: 'Formulación', tipo: 'desarrollo', inicio: 12, duracion: 8, responsable: 1, carga: 0.4 },
    { nombre: 'Registro sanitario', tipo: 'registro_sanitario', inicio: 12, duracion: 9, responsable: 0, carga: 0.1 },
    { nombre: 'Prueba de producto', tipo: 'prueba_producto', inicio: 20, duracion: 5, responsable: 1, carga: 0.2 },
    { nombre: 'Lanzamiento', tipo: 'lanzamiento', inicio: 27, duracion: 1, responsable: 0, carga: 0.1 }
  ],
  compuerta1: { semana: 11, continuar: true }, compuerta2: { semana: 25, continuar: true }
};
const proyecto2 = JSON.parse(JSON.stringify(proyecto));
proyecto2.gantt = proyecto2.gantt.map((a) => a.tipo === 'prueba_producto' ? { ...a, inicio: 30 } : a.tipo === 'lanzamiento' ? { ...a, inicio: 40 } : a);
proyecto2.compuerta2 = { semana: 36, continuar: true };
let I = { E2: { comite: [{ nombre: 'Jefe', cargo: 'jefe', dedicacion: 0.1 }, { nombre: 'Analista', cargo: 'profesional', dedicacion: 0.45 }], proyectos: [proyecto2], rubrosAprobados: {} },
  E1: { comite: [{ nombre: 'Jefa', cargo: 'jefe', dedicacion: 0.1 }, { nombre: 'Analista', cargo: 'profesional', dedicacion: 0.45 }], proyectos: [proyecto], rubrosAprobados: {} } };
const errores = ctx.vrValidarInnovacion(D, E, E.equipos[0], I.E1, banco);
ok(errores.length === 0, 'el plan del equipo 1 es válido' + (errores.length ? ': ' + errores.join(' | ') : ''));

// errores esperados
const malo = JSON.parse(JSON.stringify(I.E1));
malo.proyectos[0].gantt[0].duracion = 3; malo.proyectos[0].gantt[2].inicio = 9; malo.proyectos[0].gantt[2].carga = 0.6;
const e2 = ctx.vrValidarInnovacion(D, E, E.equipos[0], malo, banco);
ok(e2.some((x) => x.includes('externa')) && e2.some((x) => x.includes('compuerta 1')) && e2.some((x) => x.includes('sobreasignado')), 'detecta duración externa, desarrollo antes de la compuerta y sobreasignación');

for (let t = 1; t <= 12; t++) {
  const r = ctx.vrTrimestreInnovacion(D, E, I, banco);
  I = r.innov;
  r.eventos.forEach((ev) => console.log('   evento T' + t + ':', JSON.stringify(ev)));
  const dec = ctx.vrUnirDecisiones(ctx.vrDecisionesNeutras(r.estado), r.extras);
  for (const q of ['E1-P1', 'E2-P1']) { const eqid = q.slice(0, 2); if (dec[eqid].productos[q]) dec[eqid].productos[q].produccionSemanal = null; }
  E = ctx.vrSimularTrimestre(D, r.estado, dec);
  const h = E.equipos[0].historial[t - 1];
  console.log(`T${t}: litros ${fmt(h.operacion.litrosVendidos)} | innovación ${fmt(h.resultados.innovacion)} | estudios ${fmt(h.resultados.investigacionMercados)} | utilidad ${fmt(h.resultados.utilidadNeta)} | cuadre ${h.balance.cuadre.toFixed(6)}` +
    (h.operacion.porProducto['E1-P1'] ? ` | nuevo ${fmt(h.operacion.porProducto['E1-P1'].litros)} L` : ''));
}
const p = I.E1.proyectos[0];
ok(p.resultados.compuerta1 && p.resultados.compuerta1.aprobada, 'compuerta 1 aprobada');
console.log('   prueba de concepto:', JSON.stringify(p.resultados.pruebaConcepto.concepto.volumenTrim), 'supera al actual:', p.resultados.pruebaConcepto.superaAlActual);
console.log('   compuerta 2:', JSON.stringify(p.resultados.compuerta2 && p.resultados.compuerta2.requisitos.map((r) => [r.id, r.cumple])));
const p2 = I.E2.proyectos[0];
ok(p2.estado === 'lanzado' && p2.trimestreLanzamiento === 4, 'equipo 2: compuerta 2 aprobada y producto lanzado en el trimestre 4');
const h2 = E.equipos[1].historial;
console.log('   equipo 2, litros por trimestre (actual + nuevo):', h2.map((h) => fmt(h.operacion.litrosVendidos)).join(' | '));
console.log('   equipo 2, utilidad neta por trimestre:', h2.map((h) => fmt(h.resultados.utilidadNeta)).join(' | '));
ok(E.equipos.every((eq) => eq.historial.every((h) => Math.abs(h.balance.cuadre) < 1e-4)), 'todos los balances cuadran');
console.log(fallas ? `\n${fallas} FALLAS` : '\nTodas las pruebas pasaron');
process.exit(fallas ? 1 : 0);
