// Decisiones automáticas para las fases de la etapa 3 (Prototipar → Lanzar → Revisión). perfil: 'bueno' | 'gastador' | 'malo' | 'acelera' | 'normal' | 'sinPiloto'
const BEST = { S1: '1000', S2: '330', S3: '330', S4: '330', S5: '200' };
const CAN = { S1: ['tienda', 'super'], S2: ['kiosco', 'tienda'], S3: ['maquina', 'super'], S4: ['super', 'maquina'], S5: ['tienda', 'super'] };
function decidir3(p, a, perfil, n) {
  const seg = p.segmento, porc = { '200': 0.8, '330': 1.32, '1000': 4 }[(p.protoCar || {}).tamano || BEST[seg]] || 1.32;
  if (perfil === 'acelera' || perfil === 'gastador') a.acelerar = true;
  if (p.etapa === 'prototipar') {
    const V = (p.proto && p.proto.versiones) || [], ult = V[V.length - 1];
    if (V.length && (p.iter || 0) >= (p.iterMin || 1) && (ult.confirma || V.length >= 3)) { a.proto = { siguiente: 'avanzar' }; a.aprendizaje = 'Aprendimos que ' + ult.solos + ' de ' + ult.n + ' lo abrieron solos.'; return; }
    const malo = perfil === 'malo';
    a.proto = { supuesto: 'uso', pregunta: '¿Pueden abrirlo y tomarlo solos en menos de 30 segundos?', formato: malo && V.length < 1 ? 'envase' : 'maqueta', apertura: malo ? 'rosca' : (perfil === 'gastador' ? 'deportiva' : (V.length ? 'pestana' : 'ancha')), senal: perfil === 'gastador' ? 'nada' : (V.length || perfil === 'bueno' ? 'flecha' : 'nada'), tamano: malo ? '1000' : (perfil === 'gastador' ? '1000' : BEST[seg]), recierre: 'si', desc: 'Prototipo de ' + n, n: perfil === 'gastador' ? 12 : 8, lugar: 'En su casa' };
    if (V.length) a.aprendizaje = 'En la versión anterior ' + ult.solos + ' de ' + ult.n + ' lo abrieron solos; cambiamos la apertura.';
  }
  if (p.etapa === 'especificar') {
    const ref = p.ref || { med: 20000 }, vw = p.vw;
    const precioU = vw ? Math.round(vw.pme * porc * (perfil === 'gastador' ? 1.1 : 0.85) * 10) / 10 : 5;
    a.esp = { envase: 'botella', base: 'entera', azucar: 'reducida', conserv: 'uht', etiqueta: 'estandar', prod: perfil === 'gastador' ? 'maquina' : 'linea', precioU, volumen: perfil === 'malo' || perfil === 'gastador' ? Math.round(ref.p90 * 1.5) : ref.med, publicidad: perfil === 'gastador' ? 60000 : 20000,
      lienzo: { soc: ['Distribuidor mayorista'].concat(perfil === 'gastador' ? [] : []), act: ['Producir', 'Distribuir a tiendas'], rec: ['Planta y línea actual', 'Marca de la empresa'].concat(perfil === 'gastador' ? ['Máquina nueva'] : []), rel: 'auto', can: CAN[seg] },
      causas: perfil === 'malo' ? ['copia', 'canib'] : ['dist', 'precio'], mitig: perfil === 'malo' ? '' : 'Haremos el piloto en los canales que más usa el segmento y fijaremos el precio dentro del rango aceptable del test.' };
  }
  if (p.etapa === 'piloto') {
    if (perfil === 'sinPiloto') { a.pil = { saltar: true }; return; }
    const pu = {}; (p.esp.lienzo.can || []).forEach(c => { pu[c] = perfil === 'gastador' ? 40 : 15; });
    a.pil = { puntos: pu, precioU: p.esp.caso.precioU, apoyo: perfil === 'gastador' ? 2 : 1, producir: Math.round((p.esp.caso.volumen || 20000) * (perfil === 'gastador' ? 0.6 : 0.25)), pronostico: Math.round((p.esp.caso.volumen || 20000) * 0.25), limite: 30 };
  }
  if (p.etapa === 'lanzar') {
    a.lan = { confirmar: true, nombre: 'Nuevo ' + n, mensaje: perfil === 'malo' ? 'El mejor precio del mercado' : 'Fácil de abrir y práctico para tu día', precioU: (p.pil ? p.pil.precioU : p.esp.caso.precioU), publicidad: perfil === 'gastador' ? 60000 : 25000, segPub: seg, canales: p.esp.lienzo.can, reemplaza: false };
  }
}
function revisar3(p, a) {
  if (p.flujo === 2 && p.etapa === 'lanzado' && p.resLanz && !p.aar) a.aar = { causas: ['optimista', 'precio'], porque: 'Pronosticamos ' + ((p.acta && p.acta.caso.volumen) || 0) + ' unidades y vendimos ' + p.resLanz.unidades + '.', tipo: 'inteligente', d1: 'Bajar el precio por unidad.', d2: 'Partir de la clase de referencia.', referencia: true };
}
module.exports = { decidir3, revisar3 };
