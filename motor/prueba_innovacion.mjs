// Prueba de un proyecto completo: node motor/prueba_innovacion.mjs
import fs from 'fs'; import vm from 'vm'; import path from 'path'; import { fileURLToPath } from 'url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const ctx = { module: undefined, console, Math, JSON }; vm.createContext(ctx);
for (const f of ['DatosVR.gs', 'MotorVR.gs', 'InnovacionVR.gs']) vm.runInContext(fs.readFileSync(path.join(dir, '..', 'fuente', f), 'utf8'), ctx, { filename: f });
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

// ---- auditoría, puntos 2 y 5 (aprobados 17-nov) ----
{
  const delta = 5.50 * (0.60 / 5.15);
  ok(E.eventos && E.eventos.some((x) => x.trimestre === 7) && Math.abs(E.precioLeche - 5.50 - delta) < 1e-9, 'la leche cruda sube 11,7 % en el trimestre 7');
  ok(Math.abs(E.equipos[2].productos[0].costoVariable - E.anio0.costoVariable - delta) < 1e-9, 'el costo variable del producto actual sube lo mismo que la leche');
  ok(Math.abs(ctx.vrBanco(D, E).leche_cruda.precio - Math.round((5.50 + delta) * 100) / 100) < 1e-9, 'el banco de referencias usa el precio nuevo de la leche');
  const lanz = E.equipos[1].productos.find((x) => x.id === 'E2-P1');
  ok(lanz && lanz.factorReal > 0 && lanz.factorReal !== 1 && lanz.lecheL === 1, 'el producto lanzado tiene su factor de venta real (' + (lanz && lanz.factorReal.toFixed(2)) + ') y su leche por litro');
  // reacción de Cupesí: frecuencia cercana al 37 % en 400 partidas
  let n = 0;
  for (let k = 0; k < 400; k++) {
    const P0 = ctx.vrCrearPartida(D, 3); P0.semilla = 'S' + k;
    const d = ctx.vrDecisionesNeutras(P0); d.E1.productos['E1-actual'].publicidad *= 2;
    const P1 = ctx.vrSimularTrimestre(D, P0, d);
    if ((P1.reacciones || []).length) n++;
  }
  ok(n / 400 > 0.30 && n / 400 < 0.44, 'Cupesí responde a un aumento de publicidad en ' + (n / 4).toFixed(1) + ' % de las partidas (esperado 37 %)');
  const P0 = ctx.vrCrearPartida(D, 3); const P1 = ctx.vrSimularTrimestre(D, P0, ctx.vrDecisionesNeutras(P0));
  ok(!(P1.reacciones || []).length, 'sin aumento de publicidad no hay reacción');
}
// ---- puntos aprobados el 17-nov ----
// (b1) mensaje frontal: 'premium' sube la utilidad; 'polifenoles' la baja (Brodock et al., 2021, tabla 3)
{
  const base = { endulzante: ['azucar_cana'], azucarAnadida100ml: 1.67, grasa100ml: 1.6, proteina100ml: 3.1, tamanoMl: 1000 };
  const u0 = ctx.vrUtilidad_(D, base, 'natural'), uP = ctx.vrUtilidad_(D, { ...base, mensaje: 'premium' }, 'natural'), uF = ctx.vrUtilidad_(D, { ...base, mensaje: 'polifenoles' }, 'natural');
  ok(uP > u0 && uF < u0, 'el mensaje frontal cambia la utilidad (premium sube, polifenoles baja)');
  const uX = ctx.vrUtilidad_(D, { ...base, extras: [{ u: { natural: 10, calorias: 0, promedio: 0 } }] }, 'natural');
  ok(Math.abs(uX - u0 - 10) < 1e-9, 'un atributo nuevo aprobado suma su utilidad en el segmento');
}
// (c3) coherencia etiqueta ↔ hoja de costos
{
  const q = JSON.parse(JSON.stringify(proyecto)); q.producto.azucarAnadida100ml = 5;
  const h = ctx.vrEvaluarHoja(D, banco, q, {});
  ok(!h.valida && h.errores.some((x) => /az[uú]car/i.test(x)), 'detecta etiqueta con más azúcar que la hoja de costos');
  const q2 = JSON.parse(JSON.stringify(proyecto)); q2.producto.endulzante = ['estevia'];
  const h2b = ctx.vrEvaluarHoja(D, banco, q2, {});
  ok(!h2b.valida, 'exige un rubro para un endulzante distinto del azúcar');
}
// (c7) un estudio de consumidor por segmento y trimestre en el equipo
{
  const st = JSON.parse(JSON.stringify({ comite: [{ nombre: 'J', cargo: 'jefe', dedicacion: 0.5 }, { nombre: 'A', cargo: 'profesional', dedicacion: 1 }], proyectos: [proyecto, { ...JSON.parse(JSON.stringify(proyecto)), id: 'P2' }] }));
  st.proyectos.forEach((x) => { delete x.estado; delete x.resultados; });
  const e = ctx.vrValidarEstudios_(D, st);
  ok(e.length === 1 && e[0].includes('un estudio de consumidor por segmento'), 'no permite dos estudios del mismo segmento en el mismo trimestre');
}
console.log(fallas ? `\n${fallas} FALLAS` : '\nTodas las pruebas pasaron');
process.exit(fallas ? 1 : 0);
