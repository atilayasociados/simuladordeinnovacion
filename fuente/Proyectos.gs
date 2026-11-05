/**
 * Simulador de Innovación — Proyectos: Definir, Idear y Evaluar (v1.9).
 * Funciones puras usadas por Engine.gs y Code.gs.
 * Fases: definir → idear → evaluar → (prototipo, piloto y lanzamiento del motor anterior).
 */

var TIPOS_NOM_ = { rutinaria: 'Rutinaria', disruptiva: 'Disruptiva', radical: 'Radical', arquitectonica: 'Arquitectónica' };
var PORTAFOLIO_NOM_ = { nucleo: 'Núcleo', adyacente: 'Adyacente', transformacional: 'Transformacional' };
var PTS_KEYS_ = ['sab', 'nut', 'conv', 'salud', 'sost', 'precio'];
var PTS_NOM_ = { sab: 'Sabor', nut: 'Nutrición', conv: 'Conveniencia', salud: 'Saludable', sost: 'Sostenibilidad', precio: 'Precio' };

var TECNICAS_ = {
  scamper: { nombre: 'SCAMPER', sem: 1, desc: 'Siete preguntas sobre su producto actual: Sustituir, Combinar, Adaptar, Modificar, Poner otro uso, Eliminar y Reordenar. Da sobre todo mejoras incrementales.' },
  flor: { nombre: 'Flor de loto', sem: 2, desc: 'El reto al centro, ocho temas alrededor y varias ideas por tema. Da cantidad y variedad alrededor de un mismo reto.' },
  morfo: { nombre: 'Análisis morfológico', sem: 2, desc: 'Dividir el producto en parámetros, listar opciones y combinarlas. Da combinaciones nuevas; muchas no son viables.' }
};
var SCAMPER_ = [['S', 'Sustituir', '¿Qué material, ingrediente o formato podemos cambiar?'], ['C', 'Combinar', '¿Qué podemos unir al producto?'], ['A', 'Adaptar', '¿Qué idea de otro producto sirve aquí?'], ['M', 'Modificar', '¿Qué agrandamos, achicamos o cambiamos de forma?'], ['P', 'Poner otro uso', '¿Dónde, cuándo o para quién más se puede usar?'], ['E', 'Eliminar', '¿Qué sobra?'], ['R', 'Reordenar', '¿Qué pasa si invertimos el orden o la forma de comprarlo?']];
var MORFO_PARAMS_ = ['Envase', 'Base', 'Sabor', 'Lugar de venta', 'Forma de pago', 'Momento de consumo'];

var FUENTES_EXT_ = {
  concurso: { nombre: 'Concurso abierto de ideas', costo: 8000, sem: 2, desc: 'Muchas propuestas muy variadas; varias poco viables.', premios: { bajo: { extra: 0, n: 6, mu: -0.6, sd: 1.3 }, medio: { extra: 7000, n: 9, mu: 0, sd: 1.2 }, alto: { extra: 17000, n: 6, mu: 0.2, sd: 0.7 } } },
  intra: { nombre: 'Intraemprendimiento', costo: 10000, sem: 3, n: 4, mu: 0.2, sd: 0.6, pref: 'Proceso', desc: 'Pocas propuestas de su propio personal, viables y a menudo de proceso.' },
  startups: { nombre: 'Reto con startups', costo: 20000, sem: 2, n: 3, mu: 0.3, sd: 0.9, pref: 'tecmod', desc: 'Pocas propuestas, a menudo con tecnología o modelo de negocio nuevos.' }
};

// Clase de Kano de cada atributo por segmento (básico, de desempeño o de entusiasmo).
var KANO_ = {
  S1: { sab: 'basico', nut: 'desempeno', conv: 'entusiasmo', salud: 'desempeno', sost: 'entusiasmo', precio: 'desempeno' },
  S2: { sab: 'desempeno', nut: 'desempeno', conv: 'basico', salud: 'entusiasmo', sost: 'entusiasmo', precio: 'desempeno' },
  S3: { sab: 'desempeno', nut: 'desempeno', conv: 'basico', salud: 'entusiasmo', sost: 'entusiasmo', precio: 'desempeno' },
  S4: { sab: 'desempeno', nut: 'desempeno', conv: 'entusiasmo', salud: 'basico', sost: 'entusiasmo', precio: 'desempeno' },
  S5: { sab: 'desempeno', nut: 'basico', conv: 'entusiasmo', salud: 'desempeno', sost: 'entusiasmo', precio: 'desempeno' }
};
var KANO_NOM_ = { basico: 'Básico', desempeno: 'De desempeño', entusiasmo: 'De entusiasmo' };

var FRASES_ = {
  sab: { pos: ['“Está muy rica; la tomaría todos los días.”', '“El sabor me convenció desde el primer sorbo.”'], neg: ['“No sé si el sabor me va a gustar todos los días.”', '“Suena bien, pero temo que no sea rica.”'] },
  nut: { pos: ['“Me quitaría el hambre hasta el mediodía.”', '“Se nota que alimenta de verdad.”'], neg: ['“Parece una golosina, no un alimento.”', '“No me queda claro si me va a llenar.”'] },
  conv: { pos: ['“La podría tomar en el micro sin problema.”', '“Práctica: la llevo en la mochila.”'], neg: ['“Si tengo que servirla en vaso, no me sirve.”', '“No veo cómo la llevaría conmigo.”'] },
  salud: { pos: ['“Me gusta que tenga poca azúcar.”', '“La tomaría después de entrenar.”'], neg: ['“Me preocupa cuánta azúcar tendrá.”', '“No parece algo saludable.”'] },
  sost: { pos: ['“Me gusta que el envase se pueda reciclar.”', '“Prefiero marcas que cuidan el ambiente.”'], neg: ['“Otro envase plástico más…”', '“No dice nada sobre el cuidado del ambiente.”'] },
  precio: { pos: ['“A ese precio la compraría seguido.”'], caro: ['“Está bien, pero a ese precio no la compraría todos los días.”'], barato: ['“Tan barata me hace dudar de la calidad.”'] }
};

// Banco de propuestas externas: [texto, autor, 4P, novedad, tecnología nueva (1/0), modelo nuevo (1/0), segmentos, puntos]
var BANCO_EXT_ = [
  ['Leche con avena en botella de 300 ml para tomar camino a clases', 'Estudiante de Ingeniería, 20 años', 'Producto', 2, 0, 0, 'S2 S3', 'conv5 nut3 sab2'],
  ['Yogur bebible en sobre que se congela y se descongela en la mochila', 'Estudiante de Nutrición, 22 años', 'Producto', 3, 1, 0, 'S2', 'conv5 sab3 nut2'],
  ['Leche con café en lata para quienes trabajan de noche', 'Guardia de seguridad, 52 años', 'Producto', 3, 0, 0, 'S3', 'conv4 sab4 nut2'],
  ['Bebida proteica sin azúcar con sabor a cacao local', 'Entrenador de gimnasio, 31 años', 'Producto', 3, 0, 0, 'S4', 'salud5 nut4 sab1'],
  ['Leche con más calcio y vitamina D en porción chica', 'Enfermera, 45 años', 'Producto', 2, 0, 0, 'S5', 'nut6 salud2 precio2'],
  ['Envase que se abre levantando una pestaña, sin girar', 'Jubilado, 71 años', 'Producto', 2, 0, 0, 'S5', 'conv6 nut2 sab2'],
  ['Pack de 6 mini botellas para la lonchera escolar', 'Madre de dos niños, 35 años', 'Producto', 2, 0, 0, 'S1', 'conv4 precio3 sab3'],
  ['Sabores de frutas amazónicas por temporada', 'Vendedora de mercado, 48 años', 'Producto', 2, 0, 0, 'S1 S2', 'sab7 sost3'],
  ['Leche fermentada con probióticos para la digestión', 'Médica general, 39 años', 'Producto', 4, 1, 0, 'S5 S4', 'salud5 nut4 sab1'],
  ['Batido de leche y banana listo para el desayuno', 'Estudiante de Economía, 19 años', 'Producto', 2, 0, 0, 'S2 S1', 'nut4 sab4 conv2'],
  ['Bebida láctea con quinua y amaranto', 'Ingeniera de alimentos, 33 años', 'Producto', 4, 1, 0, 'S4 S5', 'nut6 salud3 sost1'],
  ['Mezcla de leche y bebida de almendra para quienes evitan la lactosa', 'Nutricionista, 29 años', 'Producto', 4, 1, 0, 'S4 S2', 'salud4 sost3 nut3'],
  ['Versión con 40 % menos azúcar del producto actual', 'Profesor de colegio, 50 años', 'Producto', 2, 0, 0, 'S1 S5', 'salud6 sab2 precio2'],
  ['Leche chocolatada con cacao del Beni', 'Chef local, 41 años', 'Producto', 3, 0, 0, 'S1 S2', 'sab7 sost2 nut1'],
  ['Bebida isotónica a base de suero de leche', 'Corredor de maratones, 27 años', 'Producto', 4, 1, 0, 'S4', 'salud5 nut3 conv2'],
  ['Postre lácteo bebible en vaso con tapa para la oficina', 'Secretaria, 38 años', 'Producto', 3, 0, 0, 'S3', 'sab5 conv4 nut1'],
  ['Leche saborizada sin lactosa para toda la familia', 'Farmacéutico, 44 años', 'Producto', 3, 1, 0, 'S1 S5', 'salud4 nut3 sab3'],
  ['Botella con medidor para controlar cuánto se toma', 'Diseñadora gráfica, 26 años', 'Producto', 3, 0, 0, 'S4 S5', 'salud3 conv4 nut3'],
  ['Kéfir suave para quienes no toleran el yogur ácido', 'Abuela de un estudiante, 68 años', 'Producto', 3, 1, 0, 'S5', 'salud4 nut4 sab2'],
  ['Leche con colágeno para deportistas mayores de 40', 'Fisioterapeuta, 36 años', 'Producto', 4, 1, 0, 'S4 S5', 'salud5 nut3 precio2'],
  ['Envase de cartón compostable en lugar de plástico', 'Activista ambiental, 24 años', 'Proceso', 3, 1, 0, 'S2 S4', 'sost7 conv2 sab1'],
  ['Reutilizar el suero de la quesería para una bebida proteica', 'Jefe de planta, 47 años', 'Proceso', 3, 1, 0, 'S4 S3', 'nut4 salud3 precio3'],
  ['Comprar leche directo a cooperativas para bajar el costo', 'Encargado de compras, 43 años', 'Proceso', 2, 0, 0, 'S1 S5', 'precio6 sost2 sab2'],
  ['Llenar en botellas más livianas para ahorrar material', 'Técnico de mantenimiento, 39 años', 'Proceso', 2, 0, 0, 'S1', 'precio5 sost4 conv1'],
  ['Pasteurizar a menor temperatura para conservar el sabor', 'Supervisora de calidad, 34 años', 'Proceso', 3, 1, 0, 'S3 S4', 'sab5 nut3 salud2'],
  ['Energía solar para las cámaras de frío', 'Electricista de la planta, 51 años', 'Proceso', 3, 0, 0, 'S2 S4', 'sost6 precio4'],
  ['Turno de producción nocturno para entregar más fresco', 'Operario de línea, 29 años', 'Proceso', 2, 0, 0, 'S3 S1', 'sab4 conv3 precio3'],
  ['Etiqueta con letra grande y alto contraste', 'Optometrista, 55 años', 'Proceso', 1, 0, 0, 'S5', 'conv5 sab2 nut3'],
  ['Sensores en la línea para que el sabor sea siempre igual', 'Ingeniero de procesos, 32 años', 'Proceso', 2, 1, 0, 'S1 S3', 'sab6 precio2 nut2'],
  ['Envase retornable con descuento al devolverlo', 'Dueña de una tienda de barrio, 46 años', 'Proceso', 3, 0, 1, 'S1 S2', 'sost6 precio3 sab1'],
  ['Kioscos de desayuno en la puerta de las facultades', 'Estudiante de Administración, 21 años', 'Posición', 3, 0, 0, 'S2', 'conv6 nut2 precio2'],
  ['Máquinas refrigeradas en oficinas con pago por QR', 'Administrador de un edificio, 40 años', 'Posición', 3, 0, 1, 'S3', 'conv6 sab2 nut2'],
  ['Venta en farmacias junto a productos para adultos mayores', 'Farmacéutica, 50 años', 'Posición', 3, 0, 0, 'S5', 'nut4 conv4 salud2'],
  ['Presencia en apps de delivery con combos de desayuno', 'Repartidor, 25 años', 'Posición', 3, 0, 0, 'S2 S3', 'conv6 sab2 precio2'],
  ['Alianza con gimnasios para vender después de entrenar', 'Dueño de gimnasio, 37 años', 'Posición', 3, 0, 0, 'S4', 'salud4 conv4 nut2'],
  ['Comunicar la marca como orgullo cruceño', 'Publicista, 30 años', 'Posición', 1, 0, 0, 'S1 S5', 'sab5 precio3 nut2'],
  ['Reposicionar la leche como bebida para la tarde con té', 'Abuelo de una integrante, 73 años', 'Posición', 2, 0, 0, 'S5', 'sab4 nut4 conv2'],
  ['Influenciadores universitarios que la prueban en clase', 'Estudiante de Comunicación, 20 años', 'Posición', 2, 0, 0, 'S2', 'sab4 conv4 precio2'],
  ['Venta en ferias deportivas y maratones', 'Organizadora de eventos, 34 años', 'Posición', 2, 0, 0, 'S4', 'salud4 nut4 conv2'],
  ['Desayuno escolar en alianza con los municipios', 'Concejal municipal, 49 años', 'Posición', 3, 0, 1, 'S1', 'nut5 precio4 salud1'],
  ['Exhibidor junto a la caja de las tiendas de barrio', 'Tendero, 58 años', 'Posición', 1, 0, 0, 'S1 S5', 'conv5 precio3 sab2'],
  ['Mensaje “sin azúcar añadida” en el frente del envase', 'Madre deportista, 33 años', 'Posición', 2, 0, 0, 'S4 S1', 'salud6 sab2 nut2'],
  ['Suscripción semanal con entrega en residencias estudiantiles', 'Startup de reparto en bicicleta', 'Paradigma', 4, 0, 1, 'S2', 'conv6 precio2 nut2'],
  ['Plan corporativo de desayunos para empresas', 'Startup de beneficios para empleados', 'Paradigma', 4, 0, 1, 'S3', 'conv5 nut3 precio2'],
  ['App propia con pedidos y puntos canjeables', 'Startup de software local', 'Paradigma', 4, 1, 1, 'S2 S3', 'conv6 precio2 sab2'],
  ['Bebidas personalizadas: el cliente elige sabor y nutrientes por app', 'Startup de nutrición personalizada', 'Paradigma', 5, 1, 1, 'S4 S2', 'nut4 salud4 sab2'],
  ['Puntos por devolver envases, canjeables en tiendas', 'Startup de reciclaje', 'Paradigma', 3, 0, 1, 'S2 S4', 'sost7 precio3'],
  ['Plataforma para que las tiendas de barrio pidan sin intermediarios', 'Startup de logística', 'Paradigma', 3, 1, 1, 'S1 S5', 'precio6 conv3 sab1'],
  ['Venta a cafeterías universitarias como insumo para sus bebidas', 'Dueña de una cafetería, 39 años', 'Paradigma', 2, 0, 1, 'S2', 'conv4 sab4 precio2'],
  ['Franquicia de kioscos saludables operados por estudiantes', 'Incubadora universitaria', 'Paradigma', 5, 0, 1, 'S2', 'conv5 salud3 nut2'],
  ['Entrega a domicilio de leche fresca para adultos mayores', 'Startup de cuidado de mayores', 'Paradigma', 4, 0, 1, 'S5', 'conv6 nut3 salud1'],
  ['Máquina que prepara batidos frescos en el campus', 'Startup de equipos de vending', 'Paradigma', 5, 1, 1, 'S2 S4', 'conv4 sab4 nut2'],
  ['Club de padres con descuentos por compra mensual', 'Padre de familia, 42 años', 'Paradigma', 3, 0, 1, 'S1', 'precio6 sab2 nut2'],
  ['Leche en polvo instantánea en sobres individuales', 'Estudiante de Química, 23 años', 'Producto', 3, 1, 0, 'S2 S3', 'conv5 precio3 nut2'],
  ['Bebida relajante de leche tibia con canela para la noche', 'Enfermera de turno, 37 años', 'Producto', 3, 0, 0, 'S5 S3', 'sab5 salud3 nut2'],
  ['Mini yogur con cereal en vaso doble para la oficina', 'Contador, 35 años', 'Producto', 3, 0, 0, 'S3', 'nut4 conv4 sab2'],
  ['Leche con hierro para niños en edad escolar', 'Pediatra, 46 años', 'Producto', 3, 1, 0, 'S1', 'nut6 salud3 precio1'],
  ['Barra de leche y cereal para comer caminando', 'Estudiante de Arquitectura, 21 años', 'Producto', 4, 1, 0, 'S2', 'conv6 nut3 sab1'],
  ['Bebida con electrolitos y sabor a maracuyá', 'Futbolista amateur, 28 años', 'Producto', 3, 0, 0, 'S4', 'salud4 sab4 nut2'],
  ['Envase con asa para cargar seis botellas desde la tienda', 'Abuela que vive sola, 76 años', 'Producto', 1, 0, 0, 'S5 S1', 'conv6 precio2 sab2']
];

// ---------- utilidades ----------
function tipoPisano_(tec, mod) { return tec ? (mod ? 'arquitectonica' : 'radical') : (mod ? 'disruptiva' : 'rutinaria'); }
function siNo_(x) { return x === true || x === 'si' || x === 1 || x === '1'; }
function ptsLimpios_(pts) {
  var o = {}; pts = pts || {};
  PTS_KEYS_.forEach(function (k) { o[k] = Math.max(0, Math.min(10, Math.round(Number(pts[k]) || 0))); });
  return o;
}
function ptsDeTexto_(s) {
  var o = {}; PTS_KEYS_.forEach(function (k) { o[k] = 0; });
  String(s).split(' ').forEach(function (x) { var m = /^([a-z]+)(\d+)$/.exec(x); if (m) o[m[1]] = Number(m[2]); });
  return o;
}
function sumaPts_(p) { return PTS_KEYS_.reduce(function (s, k) { return s + (p[k] || 0); }, 0); }
function maxAttrPts_(p) { return Math.max.apply(null, ATTRS.map(function (k) { return p[k] || 0; })); }
function attrTop_(p) { var best = null; PTS_KEYS_.forEach(function (k) { if (best === null || (p[k] || 0) > (p[best] || 0)) best = k; }); return best; }
/** Efectos del concepto sobre el producto: atributos (0–10) y costo por porción. */
function efConcepto_(p) {
  var ef = {}; ATTRS.forEach(function (k) { if (p[k]) ef[k] = r1_(p[k] * 0.6); });
  var sAttr = ATTRS.reduce(function (s, k) { return s + (p[k] || 0); }, 0), mx = maxAttrPts_(p);
  ef.cu = r2_(0.03 * sAttr + 0.01 * mx * mx - 0.05 * (p.precio || 0));
  return ef;
}
function iterMinDe_(tipo, mx, combinado) {
  var n = { rutinaria: 1, disruptiva: 1, radical: mx >= 7 ? 3 : 2, arquitectonica: 3 }[tipo] || 1;
  if (mx >= 6) n = Math.max(n, 2);
  if (combinado) n++;
  return Math.min(4, n);
}
function arr_(x) { if (Array.isArray(x)) return x; if (!x || typeof x !== 'object') return []; return Object.keys(x).sort(function (a, b) { return Number(a) - Number(b); }).map(function (k) { return x[k]; }); }
function claveIdea_(reg, i, txt) { return 'k' + hashStr_(reg + '|' + i + '|' + txt).toString(36); }

/** Textos de idea que salen de la plantilla individual de un integrante. */
function textosIdeas_(tecnica, e) {
  e = e || {}; var out = [];
  if (tecnica === 'scamper') SCAMPER_.forEach(function (s) { var v = String((e.campos || {})[s[0]] || '').trim(); if (v) out.push(s[1] + ': ' + v.slice(0, 200)); });
  else if (tecnica === 'flor') arr_(e.ideas).forEach(function (x) { x = String(x || '').trim(); if (x) out.push(x.slice(0, 200)); });
  else if (tecnica === 'morfo') {
    var par = arr_(e.params).map(arr_);
    arr_(e.combos).forEach(function (c) {
      c = arr_(c); if (c.length < MORFO_PARAMS_.length) return;
      var partes = []; for (var i = 0; i < MORFO_PARAMS_.length; i++) { var op = (c[i] === '' || c[i] === null || c[i] === undefined) ? null : (par[i] && par[i][Number(c[i])]); if (op && String(op).trim()) partes.push(String(op).trim()); }
      if (partes.length === MORFO_PARAMS_.length) out.push(partes.join(' + ').slice(0, 240));
    });
  }
  return out;
}
function minimoTecnica_(tecnica) { return { scamper: 4, flor: 6, morfo: 2 }[tecnica] || 1; }

/** Ideas de todos los integrantes, sin autor y en orden mezclado (para la votación). */
function ideasReveladas_(a) {
  var L = [];
  Object.keys((a && a.ind) || {}).forEach(function (reg) {
    textosIdeas_(a.tecnica, a.ind[reg]).forEach(function (txt, i) { L.push({ key: claveIdea_(reg, i, txt), texto: txt }); });
  });
  return L.sort(function (x, y) { return x.key < y.key ? -1 : 1; });
}

// ---------- Definir ----------
var PAL_SOLUCION_ = ['botella', 'envase', 'sabor', 'yogur', 'caja', 'app', 'aplicación', 'máquina', 'maquina', 'descuento', 'tapa', 'lata', 'sobre', 'pack', 'kiosco', 'suscripción', 'suscripcion', 'batido', 'pajilla'];
var PAL_CLIENTE_ = ['universitari', 'estudiant', 'jóven', 'joven', 'familia', 'madre', 'padre', 'niñ', 'oficin', 'trabajador', 'empleado', 'deportist', 'atleta', 'adulto', 'mayor', 'abuel', 'jubilad', 'persona', 'cliente', 'consumidor'];
function revisarBrief_(P, S, b) {
  b = b || {}; var R = [], reto = String(b.reto || '').trim(), low = reto.toLowerCase();
  var formula = /^¿?\s*c[oó]mo podr[ií]amos/i.test(reto);
  R.push({ ok: formula, texto: formula ? 'El reto empieza con “¿Cómo podríamos…?”.' : 'El reto debe empezar con “¿Cómo podríamos…?” para formularlo como una pregunta abierta.' });
  var cli = PAL_CLIENTE_.some(function (w) { return low.indexOf(w) >= 0; });
  R.push({ ok: cli, texto: cli ? 'El reto nombra al cliente.' : 'El reto no nombra al cliente: digan para quién es (por ejemplo, “los universitarios”).' });
  var sol = PAL_SOLUCION_.filter(function (w) { return new RegExp('(^|[^a-záéíóúñ])' + w).test(low); });
  R.push({ ok: !sol.length, texto: sol.length ? 'El reto ya trae la solución (“' + sol[0] + '”): eso limita las ideas. Describan la necesidad, no el producto.' : 'El reto describe la necesidad sin traer la solución.' });
  var jtbd = ['cuando', 'quiero', 'para'].every(function (k) { return String(b[k] || '').trim().length >= 5; });
  R.push({ ok: jtbd, texto: jtbd ? 'El trabajo por hacer está completo (cuando, quiero, para).' : 'Completen las tres partes del trabajo por hacer: cuando…, quiero…, para….' });
  var inf = (S.informes || []).filter(function (i) { return i.id === b.evidencia; })[0];
  var ev = !!inf && String(b.frase || '').trim().length >= 10;
  R.push({ ok: ev, texto: ev ? 'El insight está respaldado por evidencia: ' + inf.nombre + ' (T' + inf.t + ').' : 'El insight no tiene evidencia: elijan un informe de investigación y copien una frase. Sin evidencia es una suposición.' });
  var crit = String(b.criterio || ''), cOk = /\d/.test(crit) && /(trimestre|T\d|año|anio|mes)/i.test(crit);
  R.push({ ok: cOk, texto: cOk ? 'El criterio de éxito tiene una cifra y un plazo.' : 'El criterio de éxito debe tener una cifra y un plazo (por ejemplo, “8 % de S2 dos trimestres después del lanzamiento”).' });
  return { items: R, retoOk: formula && cli && !sol.length, evidencia: ev };
}
function crearProyecto2_(P, S, np, t) {
  var seg = segById_(P, np.segmento) || P.segmentos[0], b = np.brief || {};
  var tec = siNo_(np.tec), mod = siNo_(np.mod), tipo = tipoPisano_(tec, mod);
  var port = PORTAFOLIO_NOM_[np.portafolio] ? np.portafolio : 'nucleo';
  var rev = revisarBrief_(P, S, b);
  return {
    id: 'PR' + (S.nextId++), flujo: 2, nombre: String(np.nombre || 'Proyecto').slice(0, 60), segmento: seg.id,
    base: (port === 'nucleo' && tipo === 'rutinaria') ? 'P0' : 'nuevo', enfoque: tipo === 'rutinaria' ? 'incremental' : (tipo === 'disruptiva' ? 'disruptiva' : 'radical'),
    reto: String(b.reto || '').slice(0, 300), tec: tec, mod: mod, tipoDecl: tipo, portafolio: port,
    brief: { cuando: String(b.cuando || '').slice(0, 200), quiero: String(b.quiero || '').slice(0, 200), para: String(b.para || '').slice(0, 200), evidencia: b.evidencia || '', frase: String(b.frase || '').slice(0, 300), criterio: String(b.criterio || '').slice(0, 200) },
    revisionBrief: rev.items, retoOk: rev.retoOk,
    etapa: 'idear', estado: 'activo', inicio: t, pool: [], ideaSel: null, concepto: null, Q: 0, iter: 0, calProto: 0, calObs: null, fact: 0, viab: 0, puerta: 0, capAcum: 0, gastoAcum: 0, piloto: null, validadoSel: false, revisado: false,
    ideas: [], externas: [], fichas: [], nextK: 1, historial: [{ t: t, fase: 'Definir', texto: 'Brief y reto definidos.' }]
  };
}

// ---------- calidad de un concepto ----------
function ajusteConcepto_(P, pj, p, t) {
  var seg = segById_(P, pj.segmento), w = segWeights_(seg, t), mx = 0, s = 0;
  PTS_KEYS_.forEach(function (k) { var wk = (w[k] || 0) / 100; mx = Math.max(mx, wk); s += wk * (p[k] || 0) / 10; });
  return mx > 0 ? clamp_(s / mx, 0, 1) : 0;
}
function calidadConcepto_(P, S, pj, f, t, rng) {
  var O = S.org, aj = ajusteConcepto_(P, pj, f.pts, t), kano = KANO_[pj.segmento] || {}, notas = [];
  var q = 1.5 + 6.5 * aj + 1.2 * (O.MI - 0.5) + 0.8 * (O.AE - 0.5);
  var lat = segById_(P, pj.segmento).latentes || [];
  if (S.conocimiento.latentes && S.conocimiento.latentes[pj.segmento] && lat.some(function (k) { return (f.pts[k] || 0) >= 2; })) { q += 0.4; notas.push('latente'); }
  PTS_KEYS_.forEach(function (k) { if (kano[k] === 'basico' && !(f.pts[k] > 0)) { q -= 0.5; notas.push('basico:' + k); } });
  if (PTS_KEYS_.some(function (k) { return kano[k] === 'entusiasmo' && (f.pts[k] || 0) >= 3; })) q += 0.3;
  if (String(f.frase || '').length >= 60 && /para /i.test(f.frase)) q += 0.3;
  if (f.origen === 'propia') {
    var fit = ajusteTecnica_(P, pj, f.tecnica, O);
    q += fit.delta; if (fit.delta < 0) notas.push('tecnica');
    q += Math.min(0.4, 0.1 * (f.participantes || 0));
  }
  if (f.externaQ) q = 0.5 * q + 0.5 * f.externaQ;
  q += rng.normal(0, 0.6);
  return { aj: aj, Q: r1_(clamp_(q, 1, 9)), notas: notas };
}
function ajusteTecnica_(P, pj, tecnica, O) {
  var tipo = pj.tipoDecl;
  if (tecnica === 'scamper') return (tipo === 'radical' || tipo === 'arquitectonica') ? { delta: -0.5, texto: 'SCAMPER parte del producto actual y da mejoras incrementales; para un proyecto ' + TIPOS_NOM_[tipo].toLowerCase() + ' conviene el análisis morfológico.' } : { delta: 0, texto: 'SCAMPER ajusta con un proyecto ' + TIPOS_NOM_[tipo].toLowerCase() + ': parte de lo que ya venden.' };
  if (tecnica === 'morfo') return tipo === 'rutinaria' ? { delta: -0.5, texto: 'El análisis morfológico produce combinaciones muy nuevas, muchas poco viables, para un proyecto rutinario; SCAMPER ajustaba mejor.' } : { delta: O.DIV >= 0.6 ? 0.3 : 0, texto: 'El análisis morfológico ajusta con un proyecto ' + TIPOS_NOM_[tipo].toLowerCase() + (O.DIV >= 0.6 ? ', y un equipo diverso le saca más provecho.' : '.') };
  if (tecnica === 'flor') return pj.retoOk ? { delta: 0, texto: 'La flor de loto rinde con un reto bien escrito como el suyo.' } : { delta: -0.5, texto: 'La flor de loto parte del reto, y su reto tiene problemas (revisen el brief): las ideas salieron menos enfocadas.' };
  return { delta: 0, texto: '' };
}
function tipoRealFicha_(f) {
  var tec = !!f.tec || maxAttrPts_(f.pts) >= 6 || !!f.extTec, mod = !!f.mod || f.tipo4p === 'Paradigma' || !!f.extMod;
  return tipoPisano_(tec, mod);
}
function devolucionFicha_(P, S, pj, f, t) {
  var seg = segById_(P, pj.segmento), w = segWeights_(seg, t), kano = KANO_[pj.segmento] || {}, D = [];
  var orden = PTS_KEYS_.slice().sort(function (a, b) { return (w[b] || 0) - (w[a] || 0); });
  var top = attrTop_(f.pts), rk = orden.indexOf(top) + 1, nivel = f.aj >= 0.65 ? 'alto' : (f.aj >= 0.4 ? 'medio' : 'bajo');
  D.push('Ajuste con el cliente: ' + nivel + ' (estimado, sin validar; calidad ' + Number(f.qObs).toFixed(1) + ' ±' + String(f.margen).replace('.', ',') + '). Su concepto apuesta sobre todo por ' + PTS_NOM_[top].toLowerCase() + (rk <= 2 ? ', uno de los atributos que más pesan para ' + seg.id + '.' : (rk >= 5 ? ', que para ' + seg.id + ' pesa poco.' : ', que para ' + seg.id + ' tiene un peso intermedio.')));
  PTS_KEYS_.forEach(function (k) { if (kano[k] === 'basico' && !(f.pts[k] > 0)) D.push(PTS_NOM_[k] + ' es un atributo básico para ' + seg.id + ': si falta, el cliente lo rechaza aunque no lo diga. Su concepto no le asignó puntos.'); });
  var mx = maxAttrPts_(f.pts), it = iterMinDe_(tipoRealFicha_(f), mx, f.combinado), ef = efConcepto_(f.pts);
  D.push('Riesgo: el atributo con más puntos tiene ' + mx + '. Calculamos ' + it + (it === 1 ? ' iteración' : ' iteraciones') + ' de prototipo y un costo por porción ' + (ef.cu >= 0 ? '+' : '') + 'Bs ' + ef.cu.toFixed(2).replace('.', ',') + '.');
  var tr = tipoRealFicha_(f);
  D.push('Tipo de innovación según el contenido del concepto: ' + TIPOS_NOM_[tr].toLowerCase() + (tr !== pj.tipoDecl ? ' (el proyecto se declaró ' + TIPOS_NOM_[pj.tipoDecl].toLowerCase() + ').' : ', igual que lo declarado para el proyecto.'));
  if (f.origen === 'propia') { var fit = ajusteTecnica_(P, pj, f.tecnica, S.org); if (fit.texto) D.push('Técnica: ' + fit.texto); }
  if (f.origen === 'externa') D.push('Origen: propuesta externa (' + f.fuente + '), traducida a concepto por el equipo.');
  D.push('Siguiente paso: envíenlo al test de concepto para medir la intención de compra y el precio aceptable.');
  return D;
}

// ---------- externas ----------
function generarExternas_(P, S, pj, fuenteId, premio, factorN, rng, t) {
  var F = FUENTES_EXT_[fuenteId]; if (!F) return 0;
  var cfg = F.premios ? (F.premios[premio] || F.premios.medio) : F;
  var n = Math.max(1, Math.round(cfg.n * (factorN || 1)));
  var usados = (pj.externas || []).map(function (x) { return x.banco; });
  var cand = [], pesos = [];
  BANCO_EXT_.forEach(function (b, i) {
    if (usados.indexOf(i) >= 0) return;
    var w = b[6].split(' ').indexOf(pj.segmento) >= 0 ? 3 : 1;
    if (F.pref === 'Proceso') w *= b[2] === 'Proceso' ? 3 : 0.6;
    if (F.pref === 'tecmod') w *= (b[4] || b[5]) ? 3 : 0.4;
    cand.push(i); pesos.push(w);
  });
  var creadas = 0;
  for (var k = 0; k < n && cand.length; k++) {
    var pick = rng.pickWeighted(cand.map(function (x, j) { return j; }), pesos), bi = cand[pick], b = BANCO_EXT_[bi];
    cand.splice(pick, 1); pesos.splice(pick, 1);
    var pts = ptsDeTexto_(b[7]);
    var Q = r1_(clamp_(1.5 + 6.5 * ajusteConcepto_(P, pj, pts, t) + cfg.mu + rng.normal(0, cfg.sd), 1, 9));
    pj.externas.push({ id: 'X' + (pj.nextK++), banco: bi, texto: b[0], autor: b[1], tipo4p: b[2], nov: b[3], tec: !!b[4], mod: !!b[5], pts: pts, Q: Q, qObs: r1_(clamp_(Q + rng.normal(0, 1.5), 1, 9)), fuente: F.nombre, t: t });
    creadas++;
  }
  return creadas;
}

// ---------- test de concepto ----------
function vanWestendorp_(P, seg, aj, rng) {
  var R = [];
  for (var i = 0; i < 100; i++) {
    var c = seg.pref * (0.8 + 0.4 * aj) * Math.exp(rng.normal(0, 0.18));
    R.push({ tb: c * (0.45 + 0.15 * rng()), b: c * (0.7 + 0.15 * rng()), c: c * (1.0 + 0.15 * rng()), tc: c * (1.25 + 0.2 * rng()) });
  }
  var grid = [], k;
  for (k = 0; k < 13; k++) grid.push(r2_(seg.pref * (0.3 + 0.125 * k)));
  function cuenta(f) { return grid.map(function (p) { return Math.round(R.filter(function (r) { return f(r, p); }).length); }); }
  var muyBarato = cuenta(function (r, p) { return r.tb >= p; }), barato = cuenta(function (r, p) { return r.b >= p; }), caro = cuenta(function (r, p) { return r.c <= p; }), muyCaro = cuenta(function (r, p) { return r.tc <= p; });
  function cruce(a, b) { // primer precio donde la curva a deja de estar por encima de b
    for (var j = 1; j < grid.length; j++) { var d0 = a[j - 1] - b[j - 1], d1 = a[j] - b[j]; if (d0 >= 0 && d1 <= 0) { var f = d0 === d1 ? 0 : d0 / (d0 - d1); return r2_(grid[j - 1] + f * (grid[j] - grid[j - 1])); } }
    return null;
  }
  var noBarato = barato.map(function (x) { return 100 - x; }), noCaro = caro.map(function (x) { return 100 - x; });
  var pmc = cruce(muyBarato, noBarato), pme = cruce(noCaro, muyCaro);
  if (pmc === null) pmc = r2_(seg.pref * 0.6); if (pme === null) pme = r2_(seg.pref * 1.3);
  return { precios: grid, muyBarato: muyBarato, barato: barato, caro: caro, muyCaro: muyCaro, pmc: pmc, pme: pme };
}
function testConcepto_(P, S, pj, f, t, rng, margen) {
  var seg = segById_(P, pj.segmento), vw = vanWestendorp_(P, seg, f.aj, rng), kano = KANO_[pj.segmento] || {};
  var pr = Number(f.precioObj) || seg.pref;
  var priceAdj = pr > vw.pme ? -0.15 * Math.min(1, (pr - vw.pme) / vw.pme * 3) : (pr < vw.pmc ? -0.05 : 0.03);
  var real = clamp_(0.10 + 0.5 * (f.Q - 1) / 8 + priceAdj, 0.03, 0.8);
  var decl = Math.min(0.95, real * (1.3 + 0.2 * rng()));
  var fr = [], top = attrTop_(f.pts);
  if (top !== 'precio') fr.push(FRASES_[top].pos[Math.floor(rng() * 2)]);
  var faltaBas = PTS_KEYS_.filter(function (k) { return kano[k] === 'basico' && k !== 'precio' && !(f.pts[k] > 0); })[0];
  if (faltaBas) fr.push(FRASES_[faltaBas].neg[0]);
  else { var low = ATTRS.filter(function (k) { return k !== top; }).sort(function (a, b) { return (segWeights_(seg, t)[b] || 0) * (10 - (f.pts[b] || 0)) - (segWeights_(seg, t)[a] || 0) * (10 - (f.pts[a] || 0)); })[0]; fr.push(FRASES_[low].neg[1]); }
  fr.push(pr > vw.pme ? FRASES_.precio.caro[0] : (pr < vw.pmc ? FRASES_.precio.barato[0] : FRASES_.precio.pos[0]));
  var kanoOut = {}; PTS_KEYS_.forEach(function (k) { kanoOut[k] = kano[k]; });
  var qCorr = r1_(clamp_(f.Q + rng.normal(0, margen === 1 ? 0.8 : 0.35), 1, 9));
  return { t: t, intencion: Math.round(decl * 100), intencionReal: Math.round(real * 100), vw: vw, kano: kanoOut, frases: fr, qCorr: qCorr, margen: margen, precioObj: pr };
}
function informeTest_(P, S, pj, fichas, t) {
  var seg = segById_(P, pj.segmento);
  return {
    pregunta: '¿Cuánto interés despiertan los conceptos del proyecto “' + pj.nombre + '” en ' + seg.id + ' (' + seg.nombre + ') y a qué precio los aceptan?',
    ficha: 'Tarjeta de concepto mostrada a 60 clientes del segmento por concepto. Intención de compra (respuestas “seguro” y “probablemente”), medidor de precios de Van Westendorp con 100 respuestas y clasificación de Kano.',
    limites: 'La intención de compra declarada exagera la compra real: la gente dice que comprará más de lo que compra. Sirve para comparar conceptos entre sí, no para pronosticar ventas.',
    datos: { proyecto: pj.nombre, pid: pj.id, seg: seg.id, conceptos: fichas.map(function (f) { return { id: f.id, nombre: f.nombre, intencion: f.test.intencion, pmc: f.test.vw.pmc, pme: f.test.vw.pme, qCorr: f.test.qCorr, margen: f.test.margen }; }) },
    resumen: 'Test de concepto de ' + fichas.length + ' conceptos para “' + pj.nombre + '”.'
  };
}

// ---------- Evaluar: elegir ----------
function combinarFichas_(pj, A, B) {
  var pts = {}; PTS_KEYS_.forEach(function (k) { pts[k] = Math.max(A.pts[k] || 0, B.pts[k] || 0); });
  return { id: 'K' + (pj.nextK++), nombre: (A.nombre + ' + ' + B.nombre).slice(0, 80), frase: A.frase, pts: pts, precioObj: Math.max(Number(A.precioObj) || 0, Number(B.precioObj) || 0), tec: A.tec || B.tec, mod: A.mod || B.mod, extTec: A.extTec || B.extTec, extMod: A.extMod || B.extMod, tipo4p: A.tipo4p, origen: 'combinada', combinado: true, Q: r1_(clamp_((A.Q + B.Q) / 2 + 0.5, 1, 9)), qObs: r1_(((A.test ? A.test.qCorr : A.qObs) + (B.test ? B.test.qCorr : B.qObs)) / 2 + 0.5), margen: 1, aj: Math.max(A.aj, B.aj), test: null, devolucion: ['Concepto combinado de “' + A.nombre + '” y “' + B.nombre + '”: suma los puntos fuertes de ambos y exige una iteración más de prototipo.'], t: A.t };
}
function elegirConcepto_(P, S, pj, f, a, t, fb) {
  var O = S.org, seg = segById_(P, pj.segmento), tipo = tipoRealFicha_(f), mx = maxAttrPts_(f.pts), ef = efConcepto_(f.pts);
  var nov = Math.min(5, 2 + (tipo === 'radical' || tipo === 'arquitectonica' ? 1 : 0) + (tipo === 'disruptiva' || tipo === 'arquitectonica' ? 1 : 0) + (mx >= 6 ? 1 : 0) + (f.extNov ? 0 : 0));
  if (f.extNov) nov = Math.max(nov, f.extNov);
  pj.concepto = { id: f.id, nombre: f.nombre, desc: f.frase || '', tipo: f.tipo4p || 'Producto', nov: nov, riesgo: Math.min(9, 2 + nov + (mx >= 6 ? 2 : 0)), costo: 15000 + 5000 * mx + (tipo === 'radical' || tipo === 'arquitectonica' ? 30000 : 0) + (tipo === 'disruptiva' || tipo === 'arquitectonica' ? 20000 : 0), trim: 1, ef: ef, seg: [pj.segmento], pts: f.pts, precioObj: f.precioObj };
  pj.tipoReal = tipo; pj.iterMin = iterMinDe_(tipo, mx, f.combinado); pj.factPiloto = tipo === 'arquitectonica' ? 1.5 : 1; pj.disruptiva = tipo === 'disruptiva';
  pj.Q = f.Q; pj.validadoSel = !!f.test; pj.etapa = 'prototipar'; pj.concepto.vw = f.test ? { pmc: f.test.vw.pmc, pme: f.test.vw.pme } : null;
  var mejor = Math.max.apply(null, pj.fichas.map(function (x) { return x.Q; }).concat([f.Q]));
  pj.errorSeleccion = r1_(mejor - f.Q);
  pj.fact = r1_(clamp_(6 + (O.composicion === 'multifuncional' ? 1.5 : (O.composicion === 'externos' ? 1.0 : 0)) + 0.5 * (O.madurez - 1) - 0.5 * (nov - 3), 1, 10));
  var cu = (pj.base === 'P0' ? S.world.productos[0].costUnit : P.general.costoUnitNuevo) + ef.cu;
  var pe = Number(f.precioObj) || (pj.base === 'P0' ? S.world.productos[0].precio : seg.pref * 0.95);
  pj.viab = r1_(clamp_(5 + 10 * ((pe - cu) / pe - 0.30), 1, 10));
  pj.pugh = a.pugh || null; pj.justificacion = String(a.justificacion || '').slice(0, 1000);
  pj.comparacionTipo = 'Declararon ' + TIPOS_NOM_[pj.tipoDecl].toLowerCase() + '; el concepto elegido es ' + TIPOS_NOM_[tipo].toLowerCase() + (tipo === pj.tipoDecl ? '. Coherente.' : (tipo === 'disruptiva' ? ': cambia la forma de vender o cobrar. Esperen una participación baja al inicio y un crecimiento posterior más rápido.' : (tipo === 'radical' || tipo === 'arquitectonica' ? ': exige tecnología nueva, más iteraciones y más costo.' : ': es más simple de lo que declararon.')));
  fb.push('“' + pj.nombre + '”: eligieron el concepto “' + f.nombre + '”. ' + pj.comparacionTipo + ' Necesita al menos ' + pj.iterMin + (pj.iterMin === 1 ? ' versión' : ' versiones') + ' de prototipo antes de la Puerta.');
  if (!/\d/.test(pj.justificacion)) fb.push('“' + pj.nombre + '”: eligieron sin citar un dato del test de concepto en la justificación.');
  pj.historial.push({ t: t, fase: 'Evaluar', texto: 'Eligieron “' + f.nombre + '”. ' + pj.comparacionTipo });
}

// ---------- procesamiento de un trimestre (fases definir, idear, evaluar) ----------
/** ctx: { gastar, rng, fb, t, O }. Devuelve true si el proyecto pasó a prototipo en este trimestre. */
function procesarFases2_(P, S, pj, a, ctx) {
  var g = P.general, rng = ctx.rng, fb = ctx.fb, t = ctx.t, O = ctx.O, acel = a.acelerar ? 1 + (g.recargoAcelerar || 0.5) : 1;
  pj.ideas = pj.ideas || []; pj.externas = pj.externas || []; pj.fichas = pj.fichas || []; pj.historial = pj.historial || [];
  if (pj.etapa === 'idear') {
    // 1. ideas individuales
    var tec = TECNICAS_[a.tecnica] ? a.tecnica : null, part = 0, total = 0;
    if (tec && a.ind) {
      var regs = Object.keys(a.ind), conIdeas = regs.filter(function (r) { return textosIdeas_(tec, a.ind[r]).length > 0; });
      if (conIdeas.length && ctx.gastar(0, semMadurez_(O, TECNICAS_[tec].sem) * acel, TECNICAS_[tec].nombre + ' (' + pj.nombre + ')')) {
        conIdeas.forEach(function (r) { var L = textosIdeas_(tec, a.ind[r]); total += L.length; if (L.length >= minimoTecnica_(tec)) part++; pj.ideas.push({ t: t, autor: r, tecnica: tec, textos: L }); });
        pj.tecnica = tec; pj.participantes = part;
        fb.push('“' + pj.nombre + '”: ' + conIdeas.length + ' integrantes aportaron ' + total + ' ideas con ' + TECNICAS_[tec].nombre + '.');
      }
    }
    // 2. ideas de afuera
    (a.externas || []).slice(0, 3).forEach(function (x) {
      var F = FUENTES_EXT_[x.id]; if (!F) return;
      var extra = F.premios ? ((F.premios[x.premio] || F.premios.medio).extra) : 0;
      if (!ctx.gastar((F.costo + extra) * factorMadurez_(O) * acel, semMadurez_(O, F.sem) * acel, F.nombre + ' (' + pj.nombre + ')')) return;
      var n = generarExternas_(P, S, pj, x.id, x.premio, a.acelerar ? 0.7 : 1, rng, t);
      fb.push('“' + pj.nombre + '”: ' + F.nombre.toLowerCase() + ' trajo ' + n + ' propuestas. Están en la tarjeta del proyecto.');
    });
    // 3. fichas de concepto
    if (a.fichas && a.fichas.length) {
      var conTest = pj.fichas.filter(function (f) { return f.test; });
      var nuevas = [];
      a.fichas.slice(0, 3).forEach(function (fd) {
        if (!fd || !String(fd.nombre || '').trim()) return;
        var pts = ptsLimpios_(fd.pts); if (sumaPts_(pts) !== 10) { fb.push('“' + pj.nombre + '”: la ficha “' + fd.nombre + '” no reparte exactamente 10 puntos; no se guardó.'); return; }
        var ext = fd.externa ? pj.externas.filter(function (x) { return x.id === fd.externa; })[0] : null;
        var f = { id: 'K' + (pj.nextK++), nombre: String(fd.nombre).slice(0, 80), frase: String(fd.frase || '').slice(0, 400), pts: pts, precioObj: Number(fd.precioObj) || 0, tec: siNo_(fd.tec), mod: siNo_(fd.mod), tipo4p: ['Producto', 'Proceso', 'Posición', 'Paradigma'].indexOf(fd.tipo4p) >= 0 ? fd.tipo4p : 'Producto', origen: ext ? 'externa' : 'propia', fuente: ext ? ext.fuente : (pj.tecnica ? TECNICAS_[pj.tecnica].nombre : 'Equipo'), tecnica: pj.tecnica || null, participantes: pj.participantes || 0, externaQ: ext ? ext.Q : 0, extTec: ext ? ext.tec : false, extMod: ext ? ext.mod : false, extNov: ext ? ext.nov : 0, ideaKey: fd.ideaKey || '', t: t, test: null };
        var c = calidadConcepto_(P, S, pj, f, t, rng);
        f.aj = r2_(c.aj); f.Q = c.Q;
        f.margen = r1_(Math.max(0.8, ((S.conocimiento.latentes && S.conocimiento.latentes[pj.segmento]) ? 1 : 1.5) - 0.1 * ((S.org.madurez || 1) - 1)));
        f.qObs = r1_(clamp_(f.Q + rng.normal(0, f.margen), 1, 9));
        f.devolucion = devolucionFicha_(P, S, pj, f, t);
        f._test = !!fd.test;
        nuevas.push(f);
      });
      if (nuevas.length) { pj.fichas = conTest.concat(nuevas).slice(-6); fb.push('“' + pj.nombre + '”: recibieron la devolución de ' + nuevas.length + (nuevas.length === 1 ? ' ficha' : ' fichas') + ' de concepto.'); pj.historial.push({ t: t, fase: 'Idear', texto: (pj.tecnica ? TECNICAS_[pj.tecnica].nombre + ', ' : '') + nuevas.length + ' fichas de concepto.' }); }
    }
    // 4. test de concepto y paso a Evaluar
    var aTest = pj.fichas.filter(function (f) { return f._test || (Array.isArray(a.test) && a.test.indexOf(f.id) >= 0); });
    pj.fichas.forEach(function (f) { delete f._test; });
    aTest = aTest.filter(function (f) { return f && !f.test; }).slice(0, 3);
    if (aTest.length) {
      if (ctx.gastar(aTest.length * g.costoTestConcepto * factorMadurez_(O) * acel, semMadurez_(O, 1) * acel, 'Test de concepto (' + pj.nombre + ')')) {
        aTest.forEach(function (f) { f.test = testConcepto_(P, S, pj, f, t, rng, a.acelerar ? 1 : 0.5); });
        var inf = nuevoInforme_(S, { id: 'testConcepto', nombre: 'Test de concepto', fam: 'A' }, t, informeTest_(P, S, pj, aTest, t));
        inf.segs = [pj.segmento];
        pj.etapa = 'evaluar';
        fb.push('“' + pj.nombre + '”: el test de concepto de ' + aTest.length + ' conceptos llegó en Resultados → Informes. El proyecto pasa a Evaluar.');
        pj.historial.push({ t: t, fase: 'Evaluar', texto: 'Test de concepto de ' + aTest.length + ' conceptos.' });
      }
    } else if (a.cerrarIdear && pj.fichas.length) {
      pj.etapa = 'evaluar';
      fb.push('“' + pj.nombre + '”: pasa a Evaluar sin test de concepto; la calidad de sus conceptos tiene un margen de error de ±1,5.');
    }
    if (pj.etapa === 'evaluar' && a.acelerar) {
      var cand = pj.fichas.filter(function (f) { return f.test; }).sort(function (x, y) { return y.test.qCorr - x.test.qCorr; })[0] || pj.fichas.slice().sort(function (x, y) { return y.qObs - x.qObs; })[0];
      if (cand) { fb.push('“' + pj.nombre + '”: por acelerar, el comité eligió directamente el concepto con mejor calidad medida, sin matriz de Pugh.'); elegirConcepto_(P, S, pj, cand, { justificacion: 'Elección automática por acelerar: mayor calidad medida ' + (cand.test ? cand.test.qCorr : cand.qObs) }, t, fb); }
      return pj.etapa === 'prototipar';
    }
    return false;
  }
  if (pj.etapa === 'evaluar') {
    var f = null;
    if (a.elegir === 'COMB' && a.combinar && a.combinar.length === 2) {
      var A = pj.fichas.filter(function (x) { return x.id === a.combinar[0]; })[0], B = pj.fichas.filter(function (x) { return x.id === a.combinar[1]; })[0];
      if (A && B && A !== B) { f = combinarFichas_(pj, A, B); pj.fichas.push(f); }
      else fb.push('“' + pj.nombre + '”: para combinar elijan dos conceptos distintos.');
    } else if (a.elegir) f = pj.fichas.filter(function (x) { return x.id === a.elegir; })[0];
    if (a.volverIdear) { pj.etapa = 'idear'; fb.push('“' + pj.nombre + '”: volvieron a Idear para buscar mejores conceptos.'); pj.historial.push({ t: t, fase: 'Evaluar', texto: 'Volvieron a Idear.' }); return false; }
    if (f) {
      if (String(a.justificacion || '').trim().length < 20) { fb.push('“' + pj.nombre + '”: escriban por qué eligen ese concepto (al menos 20 caracteres) para poder elegirlo.'); return false; }
      elegirConcepto_(P, S, pj, f, a, t, fb);
      if (a.acelerar) pj._acel = t;
      return !!a.acelerar;
    }
  }
  return false;
}

// ---------- estimación de costos (pie de pantalla) ----------
function estimarProyecto2_(P, S, pj, a, O, t) {
  var g = P.general, costo = 0, sem = 0, av = [], acel = a.acelerar ? 1 + (g.recargoAcelerar || 0.5) : 1;
  if (pj.etapa === 'idear') {
    if (a.tecnica && TECNICAS_[a.tecnica] && a.ind && Object.keys(a.ind).length) sem += semMadurez_(O, TECNICAS_[a.tecnica].sem) * acel;
    (a.externas || []).slice(0, 3).forEach(function (x) { var F = FUENTES_EXT_[x.id]; if (!F) return; costo += (F.costo + (F.premios ? (F.premios[x.premio] || F.premios.medio).extra : 0)) * factorMadurez_(O) * acel; sem += semMadurez_(O, F.sem) * acel; });
    (a.fichas || []).forEach(function (fd) { if (fd && String(fd.nombre || '').trim() && sumaPts_(ptsLimpios_(fd.pts)) !== 10) av.push('“' + pj.nombre + '”: la ficha “' + fd.nombre + '” debe repartir exactamente 10 puntos.'); });
    var nT = (a.fichas || []).filter(function (fd) { return fd && fd.test && String(fd.nombre || '').trim(); }).length;
    if (nT) { costo += Math.min(3, nT) * g.costoTestConcepto * factorMadurez_(O) * acel; sem += semMadurez_(O, 1) * acel; }
  }
  if (pj.etapa === 'evaluar' && a.elegir && String(a.justificacion || '').trim().length < 20) av.push('“' + pj.nombre + '”: escriban la justificación de la elección (al menos 20 caracteres).');
  return { costo: costo, sem: sem, avisos: av };
}

/** Datos del proyecto que ve el equipo (sin calidades reales ni atributos ocultos). */
function vistaProyecto2_(pj) {
  return {
    flujo: 2, tec: pj.tec, mod: pj.mod, tipoDecl: pj.tipoDecl, tipoReal: pj.tipoReal || null, portafolio: pj.portafolio, brief: pj.brief, revisionBrief: pj.revisionBrief, retoOk: pj.retoOk,
    tecnica: pj.tecnica || null, gastoAcum: Math.round(pj.gastoAcum || 0), iterMin: pj.iterMin || 1, comparacionTipo: pj.comparacionTipo || '', justificacion: pj.justificacion || '', pugh: pj.pugh || null, historial: pj.historial || [],
    concepto: pj.concepto ? { nombre: pj.concepto.nombre, desc: pj.concepto.desc, pts: pj.concepto.pts, precioObj: pj.concepto.precioObj } : null,
    nIdeas: (pj.ideas || []).reduce(function (s, x) { return s + x.textos.length; }, 0),
    externas: (pj.externas || []).map(function (x) { return { id: x.id, texto: x.texto, autor: x.autor, tipo4p: x.tipo4p, nov: x.nov, qObs: x.qObs, fuente: x.fuente, t: x.t }; }),
    fichas: (pj.fichas || []).map(function (f) { return { id: f.id, nombre: f.nombre, frase: f.frase, pts: f.pts, precioObj: f.precioObj, tec: f.tec, mod: f.mod, tipo4p: f.tipo4p, origen: f.origen, fuente: f.fuente, qObs: f.qObs, margen: f.margen, devolucion: f.devolucion, test: f.test ? { intencion: f.test.intencion, vw: f.test.vw, kano: f.test.kano, frases: f.test.frases, qCorr: f.test.qCorr, margen: f.test.margen, precioObj: f.test.precioObj } : null, t: f.t, combinado: !!f.combinado }; })
  };
}

/** Idea o concepto en desarrollo de un proyecto (catálogo anterior o concepto del flujo nuevo). */
function ideaDe_(P, pj) { return pj.concepto || ideaById_(P, pj.ideaSel); }


// =====================================================================
// ETAPA 3 (v2.0): Prototipar, Especificar y Puerta, Piloto, Lanzar, Revisión
// =====================================================================
var P3_TAM_ = { '200': { nom: '200 ml', porc: 0.8 }, '330': { nom: '330 ml', porc: 1.32 }, '1000': { nom: '1 litro', porc: 4 } };
var P3_SUP_ = { uso: 'Pueden abrirlo y tomarlo solos (uso)', comp: 'Entienden cómo se usa sin explicación (comprensión)', rut: 'Encaja en su rutina diaria (rutina)' };
var P3_FMT_ = {
  maqueta: { nom: 'Maqueta física', desc: 'Los clientes la tocan y la usan.', obs: ['uso', 'comp', 'rut'] },
  envase: { nom: 'Envase falso', desc: 'Se mira pero no se abre.', obs: ['comp'] },
  guion: { nom: 'Guion gráfico', desc: 'Viñetas del día del cliente; el resto son opiniones.', obs: ['rut'] }
};
// características del prototipo: [id, nombre, puntaje general, ajustes por segmento]
var P3_CAR_ = {
  apertura: { nom: 'Cómo se abre o se toma', ops: [['rosca', 'Tapa de rosca estándar', 0.45, { S5: 0.3 }], ['ancha', 'Tapa de rosca ancha', 0.6, { S5: 0.5 }], ['deportiva', 'Tapa deportiva', 0.8, { S2: 0.9, S3: 0.85, S4: 0.9, S5: 0.55 }], ['pestana', 'Pestaña que se levanta con un dedo', 0.85, { S5: 0.9 }], ['pajilla', 'Pajilla que perfora el sello', 0.65, { S1: 0.8, S5: 0.5 }]] },
  senal: { nom: 'Cómo se ve la forma de abrir', ops: [['nada', 'Sin indicación', 0.5, { S5: 0.35 }], ['icono', 'Ícono pequeño', 0.65, { S5: 0.5 }], ['flecha', 'Color contrastante y flecha “abrir aquí”', 0.9, {}], ['frase', 'Frase grande con el beneficio', 0.8, {}]] },
  tamano: { nom: 'Tamaño de la porción', ops: [['200', '200 ml', 0.6, { S1: 0.6, S2: 0.6, S3: 0.6, S4: 0.5, S5: 0.9 }], ['330', '330 ml', 0.7, { S1: 0.5, S2: 0.9, S3: 0.9, S4: 0.85, S5: 0.6 }], ['1000', '1 litro', 0.5, { S1: 0.9, S2: 0.2, S3: 0.3, S4: 0.4, S5: 0.5 }]] },
  recierre: { nom: 'Se puede volver a cerrar', ops: [['no', 'No', 0, {}], ['si', 'Sí', 0.1, {}]] }
};
var P3_PERS_ = {
  S1: ['Madre de dos niños, 34 años', 'Padre que lleva a sus hijos al colegio, 38 años', 'Abuela que cuida a sus nietos, 61 años', 'Madre que trabaja en una tienda, 29 años', 'Padre comerciante, 42 años', 'Madre profesora, 36 años', 'Padre taxista, 40 años', 'Madre emprendedora, 31 años', 'Tía que cuida a dos sobrinos, 45 años', 'Padre ingeniero, 37 años', 'Madre enfermera, 33 años', 'Padre albañil, 39 años'],
  S2: ['Estudiante de Ingeniería, 20 años', 'Estudiante de Medicina, 22 años', 'Estudiante de Economía, 19 años', 'Estudiante que trabaja de tarde, 23 años', 'Estudiante de Derecho, 21 años', 'Estudiante de Arquitectura, 24 años', 'Estudiante de primer año, 18 años', 'Estudiante de Enfermería, 20 años', 'Estudiante de Sistemas, 22 años', 'Estudiante de Comercio, 21 años', 'Estudiante que vive lejos del campus, 20 años', 'Estudiante de Agronomía, 23 años'],
  S3: ['Contadora, 41 años', 'Cajero de banco, 28 años', 'Secretaria, 35 años', 'Vendedor de oficina, 32 años', 'Analista de sistemas, 30 años', 'Recepcionista, 26 años', 'Abogado, 44 años', 'Jefa de compras, 39 años', 'Auxiliar administrativo, 25 años', 'Gerente de sucursal, 47 años', 'Asistente contable, 29 años', 'Ejecutiva de ventas, 34 años'],
  S4: ['Corredor aficionado, 29 años', 'Instructora de gimnasio, 27 años', 'Ciclista de fin de semana, 35 años', 'Futbolista amateur, 22 años', 'Nadadora, 31 años', 'Persona que hace dieta saludable, 38 años', 'Entrenador de básquet, 33 años', 'Estudiante que va al gimnasio, 21 años', 'Maratonista, 40 años', 'Practicante de yoga, 36 años', 'Levantador de pesas, 26 años', 'Caminante diario, 52 años'],
  S5: ['Jubilado, 72 años', 'Ama de casa, 68 años', 'Abuelo que vive solo, 80 años', 'Jubilada que usa anteojos para leer, 71 años', 'Exprofesor, 75 años', 'Señora con poca fuerza en las manos, 77 años', 'Jubilado que camina cada mañana, 69 años', 'Abuela que vive con su hija, 83 años', 'Exchofer, 70 años', 'Jubilada que asiste a un centro del adulto mayor, 74 años', 'Portero del edificio, 66 años', 'Comerciante retirado, 78 años']
};
var P3_FICHA_ = {
  envase: { nom: 'Envase', ops: [['botella', 'Botella', 0.70, 'u'], ['caja', 'Caja de cartón', 0.35, 'u'], ['vaso', 'Vaso sellado', 0.55, 'u']] },
  base: { nom: 'Base líquida', ops: [['entera', 'Leche entera', 1.20, 'p'], ['semi', 'Leche semidescremada', 1.20, 'p'], ['sinlac', 'Leche sin lactosa', 1.60, 'p'], ['mixta', 'Mezcla láctea y vegetal', 1.50, 'p']] },
  azucar: { nom: 'Azúcar', ops: [['normal', 'Normal', 0.08, 'p'], ['reducida', 'Reducida', 0.12, 'p'], ['sin', 'Sin azúcar añadida', 0.15, 'p']] },
  conserv: { nom: 'Conservación', ops: [['pasteurizada', 'Pasteurizada · 12 días', 0.05, 'p'], ['uht', 'UHT · 90 días', 0.20, 'p']] },
  etiqueta: { nom: 'Etiqueta', ops: [['estandar', 'Estándar', 0.08, 'u'], ['grande', 'Letra grande y alto contraste', 0.10, 'u']] },
  prod: { nom: 'Producción', ops: [['linea', 'Línea actual', 0.25, 'p'], ['maquina', 'Máquina nueva (inversión Bs 60.000)', 0.15, 'p'], ['maquila', 'Maquila tercerizada', 0.55, 'p']] }
};
var P3_COSTO_AP_ = { rosca: 0.10, ancha: 0.18, deportiva: 0.30, pestana: 0.35, pajilla: 0.05 };
var P3_COSTO_SEN_ = { nada: 0, icono: 0.01, flecha: 0.02, frase: 0.01 };
var P3_CAP_ = { linea: 120000, maquina: 300000, maquila: 200000 }; // porciones por trimestre
var P3_LIENZO_ = {
  soc: ['Distribuidor mayorista', 'Maquila tercerizada', 'Empresa de reparto', 'Universidades o empresas', 'Proveedor de envases'],
  act: ['Producir', 'Distribuir a tiendas', 'Entregar a domicilio', 'Operar máquinas o kioscos', 'Atender pedidos por app'],
  rec: ['Planta y línea actual', 'Máquina nueva', 'Flota de reparto', 'Marca de la empresa', 'App o plataforma'],
  rel: { auto: 'Autoservicio en la tienda', pers: 'Atención personal (recomendación del vendedor)', sus: 'Suscripción semanal' }
};
var P3_HOY_ = { soc: ['Distribuidor mayorista'], act: ['Producir', 'Distribuir a tiendas'], rec: ['Planta y línea actual', 'Marca de la empresa'], rel: 'auto', can: ['tienda', 'super'] };
var P3_RIESGOS_ = {
  dist: 'Los clientes no lo encuentran donde compran',
  precio: 'El precio les parece caro para comprarlo seguido',
  cap: 'No alcanzamos a producir lo que se vende',
  copia: 'Un rival lanza algo parecido más barato',
  canib: 'Le quita ventas a nuestra leche saborizada',
  vida: 'El producto vence antes de venderse'
};
var P3_COSTO_PUNTO_ = { tienda: 300, super: 800, kiosco: 400, maquina: 1200, app: 2000, delivery: 1000 };
var P3_REF_DEF_ = [15000, 20000, 26000, 32000, 38000, 45000, 55000, 70000]; // porciones en el primer trimestre (lanzamientos de referencia)
var P3_CLAVES_ = { sab: ['sabor', 'rico', 'delicios', 'gusto'], nut: ['nutri', 'energ', 'saci', 'hambre', 'proteín', 'protein', 'avena'], conv: ['fácil', 'facil', 'práctic', 'practic', 'una mano', 'llevar', 'abr', 'rápid', 'rapid', 'camino'], salud: ['salud', 'sano', 'azúcar', 'azucar', 'liviano', 'ligero'], sost: ['planeta', 'recicl', 'sostenib', 'ambiente', 'verde'], precio: ['precio', 'barato', 'ahorr', 'económic', 'economic', 'conviene'] };

function p3Op_(grupo, id) { var g = P3_CAR_[grupo]; for (var i = 0; i < g.ops.length; i++) if (g.ops[i][0] === id) return g.ops[i]; return g.ops[0]; }
function p3Score_(grupo, id, segId) { var o = p3Op_(grupo, id); return o[3][segId] !== undefined ? o[3][segId] : o[2]; }
function p3Fop_(grupo, id) { var g = P3_FICHA_[grupo]; for (var i = 0; i < g.ops.length; i++) if (g.ops[i][0] === id) return g.ops[i]; return g.ops[0]; }
function p3Num_(x, d) { var n = Number(x); return isFinite(n) && x !== '' && x !== null ? n : d; }
function p3Pct_(x) { return Math.round(x * 100) + ' %'; }
function p3Bs_(x, d) { return 'Bs ' + Number(x).toLocaleString('es-BO', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
function p3Car_(c, segId) {
  c = c || {};
  var ap = P3_CAR_.apertura.ops.some(function (o) { return o[0] === c.apertura; }) ? c.apertura : 'rosca';
  var se = P3_CAR_.senal.ops.some(function (o) { return o[0] === c.senal; }) ? c.senal : 'nada';
  var ta = P3_TAM_[c.tamano] ? String(c.tamano) : '330', re = c.recierre === 'si' ? 'si' : 'no';
  var uso = p3Score_('apertura', ap, segId), comp = p3Score_('senal', se, segId), rut = clamp_(p3Score_('tamano', ta, segId) + (re === 'si' && ta !== '200' ? 0.1 : 0), 0, 1);
  return { apertura: ap, senal: se, tamano: ta, recierre: re, uso: uso, comp: comp, rut: rut, fit: r2_((uso + comp + rut) / 3) };
}

// ---------- Prototipar ----------
function prototipoPrueba_(P, S, pj, v, rng, t, acel) {
  var segId = pj.segmento, car = p3Car_(v, segId), fmt = P3_FMT_[v.formato] ? v.formato : 'maqueta', F = P3_FMT_[fmt];
  var n = [5, 8, 12].indexOf(Number(v.n)) >= 0 ? Number(v.n) : 8, sup = P3_SUP_[v.supuesto] ? v.supuesto : 'uso';
  var per = P3_PERS_[segId] || P3_PERS_.S1, filas = [], solos = 0, ayuda = 0, no = 0, tiempos = [], rutOk = 0;
  var off = Math.floor(rng() * per.length);
  for (var i = 0; i < n; i++) {
    var f = 0.85 + 0.3 * rng(), ve = rng() < car.comp, abre = rng() < Math.min(0.98, car.uso * f), encaja = rng() < car.rut, r, s, fr;
    if (encaja) rutOk++;
    if (fmt === 'maqueta') {
      if (ve && abre) { r = 'solo'; solos++; s = Math.round(8 + rng() * 14 / f); fr = car.apertura === 'pestana' ? 'Levantó la pestaña con el pulgar al primer intento.' : (car.apertura === 'deportiva' ? 'Abrió la tapa deportiva con una mano y tomó sin derramar.' : (car.apertura === 'pajilla' ? 'Perforó el sello con la pajilla al segundo intento.' : 'Giró la tapa con esfuerzo, pero la abrió.')); }
      else if (!ve && abre) { r = 'ayuda'; ayuda++; s = Math.round(35 + rng() * 25); fr = 'No encontró por dónde abrir; cuando se le mostró, lo abrió solo.'; }
      else { r = 'no'; no++; s = 60; fr = (car.apertura === 'rosca' || car.apertura === 'ancha') ? '“Se me resbala, no puedo girarla.”' : 'Encontró la apertura, pero no tuvo fuerza o destreza para usarla.'; }
      if (encaja && rng() < 0.3) fr += ' “Lo tomaría ' + (segId === 'S2' ? 'camino a clases' : (segId === 'S3' ? 'en la oficina' : (segId === 'S5' ? 'a media tarde' : 'en la mañana'))) + '.”';
      tiempos.push(s);
    } else if (fmt === 'envase') { r = '—'; s = null; fr = ve ? '“Se entiende por dónde se abre.”' : '“No sé por dónde se abre esto.”'; }
    else { r = '—'; s = null; fr = encaja ? '“Me sirve para mi día; lo llevaría conmigo.”' : '“No sé en qué momento del día lo tomaría.”'; }
    filas.push({ quien: per[(off + i) % per.length], res: r, seg: s, frase: fr });
  }
  var malla = { gusto: [], criticas: [], preguntas: [], ideas: [] };
  if (fmt === 'maqueta') {
    if (car.uso >= 0.8) malla.gusto.push('“No tuve que pedirle ayuda a nadie.”');
    if (car.rut >= 0.8) malla.gusto.push('“La porción es justa para mí.”');
    if (car.comp < 0.7) malla.criticas.push('“No vi por dónde se abre.” (' + ayuda + ' de ' + n + ' necesitaron ayuda)');
    if (car.uso < 0.6) malla.criticas.push('“Hay que hacer fuerza; se me resbala.”');
    if (car.rut < 0.6) malla.criticas.push('“Es ' + (car.tamano === '1000' ? 'demasiado grande' : 'muy poco') + ' para lo que necesito.”');
    if (car.recierre === 'no') malla.preguntas.push('“¿Se puede volver a cerrar si no me lo tomo todo?”');
    malla.preguntas.push('“¿Cuánto dura una vez abierto?”');
    var lat = (segById_(P, segId).latentes || []);
    if (n >= 8 && lat.length) malla.ideas.push('Una persona propuso algo que no estaba en el concepto: ' + (lat[0] === 'conv' ? 'poder comprarlo justo donde pasa todos los días.' : (lat[0] === 'nut' ? 'que le quite el hambre por más horas.' : 'que sea más fácil de llevar.')));
    if (car.comp >= 0.85) malla.ideas.push('“Si vinieran de a seis con un asa, las cargaría de la tienda.”');
  } else {
    malla.gusto.push(fmt === 'guion' ? 'Les gusta la idea dentro de su día.' : 'La forma y el tamaño parecen cómodos.');
    malla.criticas.push('No pudieron usarlo: las críticas son suposiciones, no conducta observada.');
    malla.preguntas.push('“¿Cómo se abre de verdad?”');
  }
  if (!malla.ideas.length) malla.ideas.push('Ninguna idea nueva esta vez: prueben con más personas o con otro formato.');
  var observable = F.obs.indexOf(sup) >= 0, antes = pj.protoFit || 0;
  var rinde = acel ? 0.6 : 1, conc, mejora = 0;
  var tasa = fmt === 'maqueta' ? solos / n : (sup === 'comp' ? (n - Math.round(n * (1 - car.comp))) / n : rutOk / n);
  var confirma = tasa >= 0.75;
  if (observable) {
    pj.iter = r1_((pj.iter || 0) + rinde);
    pj.protoFit = car.fit; pj.protoCar = car;
    var gIt = (1 - Math.exp(-0.8 * Math.max(1, pj.iter))) / (1 - Math.exp(-3.2));
    var calAntes = pj.calProto || 0;
    pj.calProto = r1_(clamp_(pj.Q * gIt * (0.6 + 0.4 * car.fit), 0, 10));
    mejora = r1_(pj.calProto - calAntes);
    conc = confirma ? 'El supuesto se confirma (' + Math.round(tasa * n) + ' de ' + n + '). La calidad del prototipo sube a ' + pj.calProto.toFixed(1) + ' (antes ' + calAntes.toFixed(1) + '). Pueden iterar sobre las críticas o avanzar a Especificar.'
      : 'El supuesto no se confirma (' + Math.round(tasa * n) + ' de ' + n + '). ' + (car.comp < 0.7 && car.uso >= 0.8 ? 'La forma de abrir funciona, pero no se ve: el problema es encontrarla.' : (car.uso < 0.6 ? 'Abrirlo exige demasiada fuerza o destreza para este segmento.' : 'Revisen la característica que más falló en la malla.')) + ' Calidad del prototipo: ' + pj.calProto.toFixed(1) + '.';
    if (acel) conc += ' Por acelerar, esta versión rindió menos.';
  } else conc = 'Con ' + F.nom.toLowerCase() + ' los clientes no pueden comprobar “' + P3_SUP_[sup].toLowerCase() + '”. El informe solo trae opiniones: esta versión no mejora el producto. Para un supuesto de uso, construyan una maqueta física.';
  return { v: (pj.proto && pj.proto.versiones ? pj.proto.versiones.length : 0) + 1, t: t, supuesto: sup, pregunta: String(v.pregunta || '').slice(0, 300), formato: fmt, car: car, desc: String(v.desc || '').slice(0, 300), foto: String(v.foto || '').slice(0, 300), n: n, lugar: String(v.lugar || '').slice(0, 80),
    solos: solos, ayuda: ayuda, no: no, mediana: tiempos.length ? tiempos.sort(function (a, b) { return a - b; })[Math.floor(tiempos.length / 2)] : null, filas: filas, malla: malla, observable: observable, confirma: observable && confirma, conclusion: conc, mejora: mejora, fitAntes: antes };
}

// ---------- Especificar ----------
function p3Ficha_(P, pj, e) {
  e = e || {}; var car = pj.protoCar || p3Car_({}, pj.segmento), porc = P3_TAM_[car.tamano].porc, cu = (pj.concepto && pj.concepto.ef ? pj.concepto.ef.cu : 0) || 0;
  var sel = {}, porU = 0, porP = 0, det = [];
  Object.keys(P3_FICHA_).forEach(function (k) { var o = p3Fop_(k, e[k]); sel[k] = o[0]; if (o[3] === 'u') porU += o[2]; else porP += o[2]; det.push([P3_FICHA_[k].nom, o[1], o[3] === 'u' ? o[2] : o[2] * porc]); });
  porU += P3_COSTO_AP_[car.apertura] || 0; porU += P3_COSTO_SEN_[car.senal] || 0;
  det.push(['Apertura probada', p3Op_('apertura', car.apertura)[1], P3_COSTO_AP_[car.apertura] || 0]);
  porP += cu; if (cu) det.push(['Ingredientes del concepto', 'según la ficha de concepto', cu * porc]);
  var costoU = r2_(porU + porP * porc), vida = sel.conserv === 'uht' ? 90 : 12, capP = P3_CAP_[sel.prod];
  return { sel: sel, porc: porc, tam: P3_TAM_[car.tamano].nom, costoU: costoU, costoP: r2_(costoU / porc), vida: vida, capP: capP, capU: Math.round(capP / porc), inversion: sel.prod === 'maquina' ? 60000 : 0, det: det };
}
function p3RefClase_(P, S, porc) {
  var L = [];
  (MKT_.rivales || []).forEach(function (p) { if (p.u1) L.push(p.u1); });
  ((S.world && S.world.productos) || []).forEach(function (p) { if (p.u1) L.push(p.u1); });
  var real = L.length;
  L = L.concat(P3_REF_DEF_).sort(function (a, b) { return a - b; });
  function q(f) { return Math.round(L[Math.min(L.length - 1, Math.floor(f * (L.length - 1)))] / porc); }
  return { p10: q(0.1), med: q(0.5), p90: q(0.9), n: L.length, reales: real };
}
function p3Lienzo_(P, pj, l) {
  l = l || {};
  function arr(x, opc) { return (Array.isArray(x) ? x : []).filter(function (v) { return opc.indexOf(v) >= 0; }); }
  var can = (Array.isArray(l.can) ? l.can : []).filter(function (c) { return !!canalById_(P, c); });
  var L = { soc: arr(l.soc, P3_LIENZO_.soc), act: arr(l.act, P3_LIENZO_.act), rec: arr(l.rec, P3_LIENZO_.rec), rel: P3_LIENZO_.rel[l.rel] ? l.rel : 'auto', can: can.length ? can : ['tienda'] };
  function same(a, b) { return a.length === b.length && a.every(function (x) { return b.indexOf(x) >= 0; }); }
  var chg = { soc: !same(L.soc, P3_HOY_.soc), act: !same(L.act, P3_HOY_.act), rec: !same(L.rec, P3_HOY_.rec), rel: L.rel !== 'auto', can: !same(L.can, P3_HOY_.can) };
  L.cambios = Object.keys(chg).filter(function (k) { return chg[k]; });
  L.cambiaModelo = L.rel === 'sus' || L.can.indexOf('app') >= 0;
  return L;
}
function p3Riesgos_(P, S, pj, F, caso, L, t) {
  var seg = pj.segmento, R = [];
  var afMax = Math.max.apply(null, L.can.map(function (c) { var ch = canalById_(P, c); return ch ? (ch.af[seg] || 0) : 0; }));
  R.push(['dist', afMax < 0.6 ? 2 : 0.5]);
  var vw = pj.concepto && pj.concepto.vw, pPorc = caso.precioU / F.porc;
  R.push(['precio', vw && pPorc > vw.pme ? 2 : (vw ? 0.6 : 1)]);
  R.push(['cap', F.capU < caso.volumen ? 2.2 : 0.3]);
  R.push(['copia', (pj.concepto && pj.concepto.nov <= 2) ? 1.2 : 0.6]);
  R.push(['canib', pj.base === 'nuevo' && (seg === 'S1' || seg === 'S5') ? 1.5 : 0.4]);
  R.push(['vida', F.vida < 21 && (L.can.indexOf('tienda') >= 0 || L.can.indexOf('super') >= 0) ? 1.6 : 0.2]);
  return R.sort(function (a, b) { return b[1] - a[1]; });
}
function p3Acta_(P, S, pj, e, F, real, t, rng) {
  var O = S.org, g = P.general, caso = { precioU: p3Num_(e.precioU, 0), volumen: Math.max(0, Math.round(p3Num_(e.volumen, 0))), publicidad: Math.max(0, p3Num_(e.publicidad, 0)) };
  var L = p3Lienzo_(P, pj, e.lienzo), ref = p3RefClase_(P, S, F.porc), obs = [];
  var mU = caso.precioU - real, util = caso.volumen * mU - caso.publicidad - g.costoGestionProducto;
  var inv = Math.round(g.costoPiloto * (pj.factPiloto || 1) + F.inversion + g.costoLanzamiento + ((pj.concepto && pj.concepto.costo) || 0));
  var rec = util > 0 ? inv / util : Infinity;
  var cli = clamp_(2 + 7 * (0.5 * (pj.protoFit || 0.5) + 0.5 * (pj.Q - 1) / 8), 1, 9);
  var share = { nucleo: O.nucleo, adyacente: O.adyacente, transformacional: O.transf }[pj.portafolio] || 0;
  var est = share >= 20 ? 7 : (share >= 10 ? 5.5 : 4);
  var costoOk = real <= caso.precioU * 0.6, capOk = F.capU >= caso.volumen, vidaOk = !(F.vida < 21 && (L.can.indexOf('tienda') >= 0 || L.can.indexOf('super') >= 0));
  var tec = clamp_(3 + (costoOk ? 2.5 : 1) + (capOk ? 2 : 0.5) + (vidaOk ? 1.5 : 0.5), 1, 9);
  var rent = rec <= 4 ? 8 : (rec <= 6 ? 6 : (isFinite(rec) ? 4 : 2)); if (caso.volumen > ref.p90) rent -= 2; rent = clamp_(rent, 1, 9);
  var R = p3Riesgos_(P, S, pj, F, caso, L, t), princ = [R[0][0], R[1][0]], causas = (Array.isArray(e.causas) ? e.causas : []).slice(0, 2);
  var hits = causas.filter(function (c) { return princ.indexOf(c) >= 0; }).length, mitig = String(e.mitig || '').trim();
  var rie = clamp_(4 + 1.5 * hits + (mitig.length > 40 ? 1.5 : 0), 1, 9);
  var C = [
    ['Atractivo para el cliente', r1_(cli), 'Prototipo con ajuste ' + p3Pct_(pj.protoFit || 0) + ' al segmento; ' + (pj.validadoSel ? 'concepto validado con test.' : 'concepto sin test de concepto.')],
    ['Ajuste estratégico', r1_(est), 'Proyecto ' + (PORTAFOLIO_NOM_[pj.portafolio] || '').toLowerCase() + ': su Estrategia anual le asigna ' + share + ' % del esfuerzo.'],
    ['Viabilidad técnica', r1_(tec), [costoOk ? 'costo real dentro del 60 % del precio' : 'costo real sobre el 60 % del precio', capOk ? 'capacidad suficiente' : 'capacidad menor al volumen esperado', vidaOk ? 'vida útil adecuada al canal' : 'vida útil corta para tiendas y supermercados'].join(', ') + '.'],
    ['Rentabilidad estimada', r1_(rent), (isFinite(rec) ? 'Recupera lo que falta invertir en ' + rec.toFixed(1).replace('.', ',') + ' trimestres' : 'Con estos números no recupera la inversión') + (caso.volumen > ref.p90 ? ', pero con un volumen más optimista que 9 de cada 10 lanzamientos.' : '.')],
    ['Riesgo (9 = bajo)', r1_(rie), (hits ? 'Identificaron ' + hits + ' de los 2 riesgos principales. ' : 'No identificaron los riesgos principales según el comité: ' + princ.map(function (k) { return P3_RIESGOS_[k].toLowerCase(); }).join(' y ') + '. ') + (mitig.length > 40 ? 'Proponen cómo evitarlos.' : 'Falta explicar cómo los evitarían.')]
  ];
  var prom = r1_(sum_(C.map(function (c) { return c[1]; })) / 5), min = Math.min.apply(null, C.map(function (c) { return c[1]; }));
  var umbral = (P.umbrales[O.umbral] || 6) + ((O.estructura !== 'autonoma' && pj.base === 'nuevo' && O.rad > 40) ? 1 : 0);
  var ver = (prom >= umbral && min >= 4) ? 'pasa' : (prom >= umbral - 1 ? 'reiterar' : 'detener');
  if ((pj.iter || 0) < (pj.iterMin || 1)) { ver = 'reiterar'; obs.push('Su tipo de innovación exige al menos ' + pj.iterMin + ' versiones de prototipo que hayan observado el uso; llevan ' + (pj.iter || 0) + '.'); }
  if (caso.volumen > ref.p90) obs.push('El volumen de ' + caso.volumen.toLocaleString('es-BO') + ' unidades está fuera de la clase de referencia. Usen el piloto para corregirlo.');
  if (!capOk) obs.push('Con la producción elegida no alcanzan a cubrir su propio pronóstico.');
  if (F.inversion && caso.volumen < 20000) obs.push('Comprar la máquina antes del piloto es apostar Bs 60.000 sin saber el volumen real.');
  if (F.sel.prod === 'maquila' && L.soc.indexOf('Maquila tercerizada') < 0) obs.push('Eligieron producir con maquila, pero no la incluyeron como socio clave en su lienzo.');
  if (F.sel.prod === 'maquina' && L.rec.indexOf('Máquina nueva') < 0) obs.push('Eligieron comprar la máquina, pero no figura entre sus recursos clave.');
  if (causas.indexOf('dist') >= 0 && Math.max.apply(null, L.can.map(function (c) { return (canalById_(P, c).af[pj.segmento] || 0); })) < 0.6) obs.push('Su pre-mortem teme que no lo encuentren, pero sus canales llegan poco a ' + pj.segmento + '.');
  if (L.act.indexOf('Entregar a domicilio') >= 0 && L.rec.indexOf('Flota de reparto') < 0 && L.soc.indexOf('Empresa de reparto') < 0) obs.push('El lienzo incluye entregar a domicilio sin flota propia ni empresa de reparto como socio.');
  if (L.can.indexOf('app') >= 0 && L.rec.indexOf('App o plataforma') < 0) obs.push('Venden por app propia, pero la app no figura entre sus recursos clave.');
  if (F.sel.envase === 'caja' && (pj.protoCar || {}).apertura !== 'pajilla') obs.push('La apertura que probaron en el prototipo no existe para caja de cartón: lo aprendido en el prototipo pierde valor.');
  var tipoAntes = pj.tipoReal;
  if (L.cambiaModelo && (pj.tipoReal === 'rutinaria' || pj.tipoReal === 'radical')) { pj.tipoReal = pj.tipoReal === 'rutinaria' ? 'disruptiva' : 'arquitectonica'; pj.disruptiva = pj.tipoReal === 'disruptiva'; if (pj.tipoReal === 'arquitectonica') pj.factPiloto = 1.5; }
  if (tipoAntes !== pj.tipoReal) obs.push('Su lienzo cambia el modelo de negocio: el tipo real pasa de ' + TIPOS_NOM_[tipoAntes].toLowerCase() + ' a ' + TIPOS_NOM_[pj.tipoReal].toLowerCase() + '. Esperen una participación baja al inicio y más tiempo para crecer.');
  if (S.compromisos && S.compromisos.referencia) obs.push(caso.volumen <= ref.med * 1.3 ? 'Cumplieron su compromiso de partir de la clase de referencia.' : 'Se comprometieron a partir de la clase de referencia y su volumen la supera en más de 30 %.');
  obs.push('Lo ya invertido (' + p3Bs_(pj.gastoAcum || 0) + ') no se tuvo en cuenta: solo cuenta lo que falta invertir.');
  if (ver === 'pasa') obs.push('Se autoriza el piloto.');
  return { t: t, criterios: C, promedio: prom, umbral: umbral, veredicto: ver, obs: obs, caso: caso, margenU: r2_(mU), utilidad: Math.round(util), inversion: inv, recuperacion: isFinite(rec) ? r1_(rec) : null, ref: ref, lienzo: L, riesgos: R.map(function (r) { return r[0]; }), principales: princ, causas: causas, mitig: mitig.slice(0, 500), costoEst: F.costoU, costoReal: real };
}

// ---------- Piloto ----------
function p3Piloto_(P, S, pj, a, rng, t, sched) {
  var W = S.world, seg = segById_(P, pj.segmento), E = pj.esp, porc = E.porc, can = E.lienzo.can;
  var puntos = {}, nP = 0, cov = 0, costoPts = 0;
  can.forEach(function (c) { var n = clamp_(Math.round(p3Num_((a.puntos || {})[c], 0)), 0, 60); if (!n) return; puntos[c] = n; nP += n; var ch = canalById_(P, c); cov += n * (ch.af[seg.id] || 0); costoPts += n * (P3_COSTO_PUNTO_[c] || 500); });
  cov = Math.min(1, cov / 500);
  var precioU = p3Num_(a.precioU, E.caso.precioU), apoyo = clamp_(Math.round(p3Num_(a.apoyo, 1)), 0, 2), prodU = Math.max(0, Math.round(p3Num_(a.producir, 0))), pron = Math.max(0, Math.round(p3Num_(a.pronostico, 0))), lim = clamp_(p3Num_(a.limite, 30), 0, 100);
  var prov = productoProspectivo_(P, W, pj, { precio: precioU / porc, canales: can }, false);
  prov.AW = 0.55 + 0.1 * apoyo; prov.desde = t; prov.costUnit = E.costoReal / porc;
  var Wp = copy_(W); Wp.productos.push(prov);
  var sh = marketShares_(P, Wp, seg, t).filter(function (o) { return o.id === prov.id; })[0], cuota = sh ? sh.cuota : 0;
  var dem = demanda_(P, seg, t, sched) * MKT_.N * cuota * cov * 0.9 / porc;
  var vend = Math.round(Math.min(dem, prodU));
  var vw = pj.concepto && pj.concepto.vw, pP = precioU / porc;
  var recomp = clamp_(0.12 + 0.45 * (pj.calProto || 0) / 9 + 0.15 * ((pj.protoFit || 0.5) - 0.5) - (vw ? 0.1 * Math.max(0, (pP - vw.pme) / vw.pme * 3) : 0) + (apoyo === 2 ? 0.04 : 0) + rng.normal(0, 0.03), 0.05, 0.7);
  var compr = Math.round(vend / (1 + recomp * 1.5));
  var porCanal = can.filter(function (c) { return puntos[c]; }).map(function (c) { var ch = canalById_(P, c), w = puntos[c] * (ch.af[seg.id] || 0); return { canal: c, nombre: ch.nombre, puntos: puntos[c], vendidas: Math.round(vend * (cov > 0 ? w / (cov * 500) : 0)) }; });
  var sobra = prodU - dem, stock;
  if (prodU > dem * 1.05) stock = { tipo: 'sobrante', u: Math.round(prodU - dem), texto: 'Sobraron ' + Math.round(prodU - dem).toLocaleString('es-BO') + ' unidades. ' + (E.vida >= 60 ? 'Con UHT no vencen, pero inmovilizan ' + p3Bs_((prodU - dem) * E.costoReal) + ' hasta el lanzamiento.' : 'Con 12 días de vida útil vencieron: pérdida de ' + p3Bs_((prodU - dem) * E.costoReal) + '.') };
  else if (dem > prodU * 1.02) stock = { tipo: 'quiebre', u: Math.round(dem - prodU), texto: 'Se agotó antes de terminar el trimestre. Ventas perdidas estimadas: ' + Math.round(dem - prodU).toLocaleString('es-BO') + ' unidades.' };
  else stock = { tipo: 'ok', u: 0, texto: 'La producción coincidió con la demanda; casi sin sobrante.' };
  var fr = ['“' + (recomp >= 0.3 ? 'Ya lo compré varias veces; ' : 'Lo probé una vez; ') + (pj.protoCar && pj.protoCar.uso >= 0.8 ? 'es fácil de usar.”' : 'está bien.”')];
  fr.push(vw && pP > vw.pme ? '“Está rico, pero ' + p3Bs_(precioU, 1) + ' es mucho para todos los días.”' : '“El precio está bien para lo que es.”');
  fr.push(apoyo === 0 ? '“No sabía que existía; lo vi de casualidad.”' : '“' + (apoyo === 2 ? 'Lo probé en la degustación del sábado' : 'El afiche junto a la caja me llamó la atención') + '.”');
  var full = cov > 0 ? dem / cov : 0;
  var costo = Math.max(5000, Math.round((costoPts + [0, 3000, 8000][apoyo] + prodU * E.costoReal - vend * precioU * 0.8) * (pj.factPiloto || 1)));
  var dif = pron ? Math.round((vend - pron) / pron * 100) : null;
  var conc = (Math.round(recomp * 100) >= lim ? 'La recompra de ' + Math.round(recomp * 100) + ' % supera el límite que ustedes fijaron (' + lim + ' %). Hay señales para lanzar.' : 'La recompra de ' + Math.round(recomp * 100) + ' % está bajo el límite que ustedes fijaron (' + lim + ' %). Según su propio criterio, no deberían lanzar todavía.') + (dif !== null && Math.abs(dif) > 15 ? ' Su pronóstico se desvió ' + Math.abs(dif) + ' %: usen las ventas reales del piloto para el lanzamiento.' : '');
  return { t: t, puntos: puntos, nPuntos: nP, precioU: precioU, apoyo: apoyo, producir: prodU, pronostico: pron, limite: lim, vendidas: vend, compradores: compr, recompra: Math.round(recomp * 100), dif: dif, porCanal: porCanal, stock: stock, frases: fr, proyMin: Math.round(full * 0.75), proyMax: Math.round(full * 1.15), costo: costo, conclusion: conc, cuotaEstimada: r2_(cuota * 100) };
}

// ---------- Lanzar ----------
function p3MensajeOk_(pj, msg) {
  var top = pj.concepto && pj.concepto.pts ? attrTop_(pj.concepto.pts) : 'conv', m = String(msg || '').toLowerCase();
  return (P3_CLAVES_[top] || []).some(function (k) { return m.indexOf(k) >= 0; });
}

/** Procesa las fases de la etapa 3 de un proyecto del flujo nuevo. Devuelve { exito, fracaso, capex }. */
function procesarFases3_(P, S, pj, a, ctx) {
  var g = P.general, rng = ctx.rng, fb = ctx.fb, t = ctx.t, O = ctx.O, W = S.world, out = { exito: 0, fracaso: 0, capex: 0 };
  var acel = !!a.acelerar || pj._acel === t, fAc = acel ? 1 + (g.recargoAcelerar || 0.5) : 1, fases = 0;
  pj.proto = pj.proto || { versiones: [] }; pj.historial = pj.historial || [];
  function hist(f, x) { pj.historial.push({ t: t, fase: f, texto: x }); }
  // aprendizaje de la versión anterior
  if (a.aprendizaje && pj.proto.versiones.length) { var ult = pj.proto.versiones[pj.proto.versiones.length - 1]; if (!ult.aprendizaje) ult.aprendizaje = String(a.aprendizaje).slice(0, 600); }
  if (pj.etapa === 'prototipar') {
    var v = a.proto || {};
    if (v.siguiente === 'volver') { pj.etapa = 'evaluar'; fb.push('“' + pj.nombre + '”: volvieron a Evaluar.'); hist('Prototipar', 'Volvieron a Evaluar.'); return out; }
    if (v.siguiente === 'avanzar') {
      if ((pj.iter || 0) < (pj.iterMin || 1)) fb.push('“' + pj.nombre + '”: su tipo de innovación exige ' + pj.iterMin + ' versiones de prototipo que observen el uso; llevan ' + (pj.iter || 0) + '. Sigan prototipando.');
      else { pj.etapa = 'especificar'; fb.push('“' + pj.nombre + '”: pasa a Especificar y presentarse a la Puerta.'); hist('Prototipar', 'Avanzaron a Especificar con ' + pj.proto.versiones.length + ' versiones.'); fases++; }
    } else if (v.formato && String(v.pregunta || '').trim().length >= 10) {
      var n = [5, 8, 12].indexOf(Number(v.n)) >= 0 ? Number(v.n) : 8, costo = (2000 + { 5: 4000, 8: 6000, 12: 9000 }[n]) * factorMadurez_(O) * fAc, sem = semMadurez_(O, n === 12 ? 2 : 1) * fAc;
      if (ctx.gastar(costo, sem, 'Prototipo y prueba de “' + pj.nombre + '”' + (acel ? ' (acelerado)' : ''), pj.fact >= 7)) {
        if (pj.fact >= 7) pj.capAcum += costo;
        var inf = prototipoPrueba_(P, S, pj, v, rng, t, acel);
        pj.proto.versiones.push(inf);
        var it = nuevoInforme_(S, { id: 'prototipo', nombre: 'Prueba de prototipo', fam: 'A' }, t, { pregunta: inf.pregunta, ficha: P3_FMT_[inf.formato].nom + ' probado con ' + inf.n + ' clientes simulados de ' + pj.segmento + (inf.lugar ? ' · ' + inf.lugar : '') + '.', limites: 'Con pocas personas aparecen la mayoría de los problemas de uso, pero el resultado varía de una prueba a otra (Nielsen y Landauer, 1993).', datos: { proyecto: pj.nombre, pid: pj.id, version: inf.v }, resumen: 'Prueba del prototipo de “' + pj.nombre + '” (versión ' + inf.v + ').' });
        it.segs = [pj.segmento];
        fb.push('“' + pj.nombre + '”: la prueba del prototipo (versión ' + inf.v + ') está en la tarjeta del proyecto. ' + inf.conclusion);
        hist('Prototipar', 'Versión ' + inf.v + ' · ' + P3_FMT_[inf.formato].nom + ' · ' + (inf.observable ? (inf.confirma ? 'supuesto confirmado' : 'supuesto no confirmado') : 'no observable'));
        if (acel && inf.confirma && pj.iter >= (pj.iterMin || 1)) { pj.etapa = 'especificar'; fb.push('“' + pj.nombre + '”: por acelerar, pasa a Especificar en este mismo trimestre.'); }
      }
    } else if (v.formato) fb.push('“' + pj.nombre + '”: escriban la pregunta que su prototipo debe responder (al menos 10 caracteres).');
    return out;
  }
  if (pj.etapa === 'especificar') {
    var e = a.esp || {};
    if (e.volverProto) { pj.etapa = 'prototipar'; fb.push('“' + pj.nombre + '”: volvieron a Prototipar.'); hist('Especificar', 'Volvieron a Prototipar.'); return out; }
    if (!(p3Num_(e.precioU, 0) > 0) || !(p3Num_(e.volumen, 0) > 0)) { if (Object.keys(e).length) fb.push('“' + pj.nombre + '”: completen el precio y el volumen del caso de negocio para presentarse a la Puerta.'); return out; }
    if (!ctx.gastar(8000 * factorMadurez_(O) * fAc, semMadurez_(O, 2) * fAc, 'Planta piloto y comité de “' + pj.nombre + '”', pj.fact >= 7)) return out;
    var F = p3Ficha_(P, pj, e), real = r2_(F.costoU * clamp_(1 + rng.normal(0, 0.05), 0.9, 1.1));
    var acta = p3Acta_(P, S, pj, e, F, real, t, rng);
    pj.esp = { t: t, ficha: F, costoReal: real, porc: F.porc, vida: F.vida, capU: F.capU, capP: F.capP, inversion: F.inversion, lienzo: acta.lienzo, caso: acta.caso, sel: F.sel };
    pj.acta = acta; pj.actas = (pj.actas || []).concat([{ t: t, promedio: acta.promedio, veredicto: acta.veredicto }]);
    pj.puerta = acta.promedio;
    fb.push('“' + pj.nombre + '”: el comité de la Puerta dio ' + acta.promedio.toFixed(1) + ' frente a un umbral de ' + acta.umbral.toFixed(1) + ': ' + { pasa: 'pasa al piloto', reiterar: 'reiterar', detener: 'recomienda detener el proyecto' }[acta.veredicto] + '. El acta está en la tarjeta.');
    hist('Puerta', 'Acta: ' + acta.promedio.toFixed(1) + ' · ' + acta.veredicto + '.');
    if (acta.veredicto === 'pasa') pj.etapa = 'piloto';
    return out;
  }
  if (pj.etapa === 'piloto') {
    var b = a.pil || {};
    if (b.saltar) { pj.etapa = 'lanzar'; fb.push('“' + pj.nombre + '”: decidieron lanzar sin piloto. El riesgo de fracaso es mayor.'); hist('Piloto', 'Lo saltaron.'); return out; }
    if (!(p3Num_(b.producir, 0) > 0)) { if (Object.keys(b).length) fb.push('“' + pj.nombre + '”: indiquen cuántas unidades producir para el piloto.'); return out; }
    var inf2 = p3Piloto_(P, S, pj, b, rng, t, ctx.sched);
    if (!ctx.gastar(inf2.costo * factorMadurez_(O) * fAc, semMadurez_(O, g.semPiloto) * fAc, 'Piloto de “' + pj.nombre + '”', pj.fact >= 7)) return out;
    if (pj.fact >= 7) pj.capAcum += inf2.costo;
    pj.pil = inf2; pj.piloto = { t: t, cuotaEstimada: inf2.cuotaEstimada }; pj.pilotoT = t; pj.etapa = 'lanzar';
    var it2 = nuevoInforme_(S, { id: 'piloto', nombre: 'Informe del piloto', fam: 'B' }, t, { pregunta: '¿Cuánto se vende “' + pj.nombre + '” en pocos puntos de venta y vuelven a comprarlo?', ficha: 'Prueba de mercado en ' + inf2.nPuntos + ' puntos de venta durante un trimestre.', limites: 'Se hizo en pocos puntos de una zona: la proyección para todo el mercado tiene un rango amplio.', datos: { proyecto: pj.nombre, pid: pj.id }, resumen: 'Piloto de “' + pj.nombre + '”.' });
    it2.segs = [pj.segmento];
    fb.push('“' + pj.nombre + '”: piloto con ' + inf2.vendidas.toLocaleString('es-BO') + ' unidades vendidas y recompra de ' + inf2.recompra + ' %. ' + inf2.conclusion);
    hist('Piloto', inf2.vendidas + ' vendidas · recompra ' + inf2.recompra + ' %.');
    return out;
  }
  if (pj.etapa === 'lanzar') {
    var L = a.lan || {};
    if (L.volverPiloto) { pj.etapa = 'piloto'; hist('Lanzar', 'Volvieron a hacer un piloto.'); return out; }
    if (!L.confirmar) return out;
    var E = pj.esp, idea = ideaDe_(P, pj);
    var costoL = (g.costoLanzamiento + (idea.costo || 0)) * factorMadurez_(O) + (E.inversion || 0);
    if (!ctx.gastar(costoL, semMadurez_(O, g.semLanzamiento), 'Lanzamiento de “' + pj.nombre + '”')) return out;
    var can = (Array.isArray(L.canales) && L.canales.length ? L.canales : E.lienzo.can).filter(function (c) { return !!canalById_(P, c); });
    var precioU = p3Num_(L.precioU, E.caso.precioU), pub = clamp_(p3Num_(L.publicidad, 20000), 0, 80000), msgOk = p3MensajeOk_(pj, L.mensaje);
    var pF = clamp_(0.30 - 0.03 * ((pj.calProto || 0) - 5) - (pj.pil ? 0.15 : 0) - (pj.validadoSel ? 0.10 : 0) - 0.1 * ((pj.protoFit || 0.5) - 0.5), 0.03, 0.5);
    var falla = rng() < pF;
    var prod = productoProspectivo_(P, W, pj, { precio: precioU / E.porc, canales: can, comunicacion: pub, nombre: L.nombre || pj.nombre }, falla);
    prod.costUnit = r2_(E.costoReal / E.porc); prod.cap = E.capP; prod.porcU = E.porc; prod.lanzT = t + 1; prod.desde = t + 1;
    prod.AW = r2_((pj.pil ? 0.25 : 0.05) * (msgOk ? 1 : 0.8)); prod.segPub = P.segmentos.some(function (s) { return s.id === L.segPub; }) ? L.segPub : pj.segmento;
    prod.precio = r2_(clamp_(prod.precio, 0.5, 20));
    if (pj.disruptiva) { prod.AW = r2_(prod.AW * 0.5); prod.disruptiva = true; }
    var p0u = W.productos[0].unidades || 0;
    if (pj.base === 'P0' && L.reemplaza) {
      var p0 = W.productos[0];
      p0.attrs = prod.attrs; p0.costUnit = prod.costUnit; p0.canales = can; p0.relanz = t + 1; p0.nombre = String(L.nombre || p0.nombre).slice(0, 60);
      p0.precio = r2_(clamp_(prod.precio, p0.precio * 0.7, p0.precio * 1.3)); p0.comunicacion = pub;
      pj.productoId = 'P0';
    } else {
      prod.id = 'N' + (S.nextProd++); W.productos.push(prod); pj.productoId = prod.id;
      out.capex += E.sel.prod === 'linea' ? g.capexEscalamiento : 0;
      if (L.reemplaza) fb.push('“' + pj.nombre + '” es un producto nuevo: convive con la leche saborizada, que sigue a la venta para los demás segmentos.');
    }
    if (pj.capAcum > 0) W.fin.intang.push({ concepto: pj.nombre, monto: pj.capAcum, restante: pj.capAcum, desde: t + 1 });
    pj.lan = { t: t, nombre: String(L.nombre || pj.nombre).slice(0, 60), mensaje: String(L.mensaje || '').slice(0, 200), mensajeOk: msgOk, precioU: precioU, publicidad: pub, segPub: prod.segPub, canales: can, reemplaza: !!L.reemplaza, p0Antes: Math.round(p0u), riesgo: Math.round(pF * 100), falla: falla };
    pj.etapa = 'lanzado'; pj.estado = 'terminado'; pj.fin = t; pj.falla = falla; pj.lanzT = t + 1;
    if (falla) { out.fracaso++; fb.push('El lanzamiento de “' + pj.lan.nombre + '” rindió por debajo de lo esperado: los atributos logrados fueron menores (riesgo ' + Math.round(pF * 100) + ' %).'); }
    else { out.exito++; fb.push('“' + pj.lan.nombre + '” sale al mercado el próximo trimestre (riesgo de fracaso ' + Math.round(pF * 100) + ' %, no ocurrió).'); }
    if (!msgOk) fb.push('“' + pj.lan.nombre + '”: el mensaje no habla del beneficio principal del concepto; el conocimiento inicial será menor.');
    hist('Lanzar', 'Lanzado como “' + pj.lan.nombre + '”.');
    return out;
  }
  return out;
}

/** Resultados del primer trimestre en el mercado y reacción de los rivales (después de stepWorld). */
function p3PostMercado_(P, S, t, fb, sched) {
  var W = S.world;
  S.proyectos.forEach(function (pj) {
    if (pj.flujo !== 2 || pj.etapa !== 'lanzado' || !pj.lan) return;
    var prod = W.productos.filter(function (p) { return p.id === pj.productoId; })[0]; if (!prod) return;
    if (pj.lanzT === t) {
      var u = prod.unidades || 0, porc = prod.porcU || 1, sh = (prod.cuotaPorSeg || {})[pj.segmento] || 0;
      var canib = 0;
      if (pj.productoId !== 'P0') {
        var segO = segById_(P, pj.segmento), D = demanda_(P, segO, t, sched) * MKT_.N, Wsin = copy_(W);
        Wsin.productos = Wsin.productos.filter(function (x) { return x.id !== prod.id; });
        var con = marketShares_(P, W, segO, t).filter(function (o) { return o.id === 'P0'; })[0], sin = marketShares_(P, Wsin, segO, t).filter(function (o) { return o.id === 'P0'; })[0];
        canib = Math.round(Math.max(0, D * ((sin ? sin.cuota : 0) - (con ? con.cuota : 0))) / porc);
      }
      var util = Math.round((prod.ventas || 0) - u * prod.costUnit - (prod.comunicacion || 0) - P.general.costoGestionProducto);
      pj.resLanz = { t: t, unidades: Math.round(u / porc), cuota: r2_(sh * MKT_.N), utilidad: util, canib: canib, quiebre: prod.quiebre ? Math.round(prod.quiebre / porc) : 0 };
      fb.push('Primer trimestre de “' + pj.lan.nombre + '”: ' + pj.resLanz.unidades.toLocaleString('es-BO') + ' unidades, ' + String(pj.resLanz.cuota).replace('.', ',') + ' % de ' + pj.segmento + '. ' + (canib ? canib.toLocaleString('es-BO') + ' unidades equivalentes salieron de su propia leche saborizada (canibalización).' : ''));
    }
    if (!pj.reaccion && t >= pj.lanzT && ((prod.cuotaPorSeg || {})[pj.segmento] || 0) * MKT_.N >= 4) {
      var c = W.comps.filter(function (x) { return x.activo && x.id !== 'C4' && (x.pres[pj.segmento] || 0) > 0; }).sort(function (a, b) { return (b.pres[pj.segmento] || 0) - (a.pres[pj.segmento] || 0); })[0];
      if (c) { c.precio = r2_(c.precio * 0.95); c.precio0 = r2_((c.precio0 || c.precio) * 0.95); pj.reaccion = { t: t, comp: c.nombre }; fb.push(c.nombre + ' bajó 5 % su precio en respuesta a “' + pj.lan.nombre + '”. Vigilen si responde con un producto parecido.'); }
    }
  });
}

// ---------- Revisión después de la acción ----------
var P3_CAUSAS_ = { optimista: 'Nuestro volumen fue más optimista que la clase de referencia', canal: 'No llegamos a suficientes puntos de venta', precio: 'El precio fue alto para comprarlo seguido', pub: 'La publicidad no llegó al segmento', rival: 'Un rival reaccionó con precio', canib: 'Le quitamos ventas a nuestro propio producto', producto: 'El producto no resolvió bien la necesidad' };
var P3_TIPOFR_ = { exito: 'Éxito', evitable: 'Fracaso evitable', complejo: 'Fracaso por complejidad', inteligente: 'Éxito parcial con aprendizaje' };
function p3TablaAAR_(P, S, pj) {
  var T = [], r = pj.resLanz || {}, ac = pj.acta || {}, pl = pj.pil || {};
  T.push(['Criterio de éxito', 'Definir', pj.brief ? pj.brief.criterio : '', r.cuota !== undefined ? String(r.cuota).replace('.', ',') + ' % de ' + pj.segmento : '—', '']);
  if (pl.pronostico) T.push(['Ventas del piloto', 'Piloto · pronóstico', pl.pronostico, pl.vendidas, Math.round((pl.vendidas - pl.pronostico) / pl.pronostico * 100) + ' %']);
  if (ac.caso) T.push(['Ventas por trimestre', 'Puerta · caso de negocio', ac.caso.volumen, r.unidades !== undefined ? r.unidades : '—', r.unidades !== undefined && ac.caso.volumen ? Math.round((r.unidades - ac.caso.volumen) / ac.caso.volumen * 100) + ' %' : '']);
  if (pl.limite !== undefined) T.push(['Recompra', 'Piloto · límite para lanzar', '≥ ' + pl.limite + ' %', pl.recompra + ' %', pl.recompra >= pl.limite ? 'cumple' : 'no cumple']);
  if (ac.costoEst) T.push(['Costo por unidad', 'Especificar · estimado', p3Bs_(ac.costoEst, 2), p3Bs_(ac.costoReal, 2), Math.round((ac.costoReal - ac.costoEst) / ac.costoEst * 100) + ' %']);
  T.push(['Tipo de innovación', 'Definir · declarado', TIPOS_NOM_[pj.tipoDecl] || '', TIPOS_NOM_[pj.tipoReal] || '', pj.tipoDecl === pj.tipoReal ? 'igual' : 'distinto']);
  T.push(['Canibalización', 'No se estimó', '—', r.canib !== undefined ? r.canib : '—', '']);
  return T;
}
function p3CausasMotor_(P, S, pj) {
  var C = [], r = pj.resLanz || {}, ac = pj.acta || {}, pl = pj.pil || {}, lan = pj.lan || {};
  if (ac.caso && r.unidades !== undefined && ac.caso.volumen > r.unidades * 1.3) C.push(['optimista', 3]);
  var vw = pj.concepto && pj.concepto.vw; if (vw && pj.esp && lan.precioU / pj.esp.porc > vw.pme) C.push(['precio', 2.5]); else if (pl.recompra !== undefined && pl.recompra < 30) C.push(['precio', 1.2]);
  if ((lan.canales || []).length < 2) C.push(['canal', 2]);
  if ((lan.publicidad || 0) < 15000 || (lan.segPub && lan.segPub !== pj.segmento)) C.push(['pub', 2]);
  if (pj.reaccion) C.push(['rival', 1.5]);
  if (r.canib && r.unidades && r.canib > 0.2 * r.unidades) C.push(['canib', 2.2]);
  if ((pj.protoFit || 0) < 0.65 || pj.falla) C.push(['producto', 2.4]);
  return C.sort(function (a, b) { return b[1] - a[1]; }).slice(0, 3).map(function (c) { return c[0]; });
}
function p3Revision_(P, S, pj, a, ctx) {
  var g = P.general, O = S.org, fb = ctx.fb, t = ctx.t, x = a.aar || {};
  var causas = (Array.isArray(x.causas) ? x.causas : []).filter(function (c) { return P3_CAUSAS_[c]; }).slice(0, 3);
  if (!causas.length || String(x.porque || '').trim().length < 20) { fb.push('“' + pj.nombre + '”: para la revisión elijan al menos una causa y explíquenla con datos (al menos 20 caracteres).'); return; }
  if (!ctx.gastar(g.costoRevision, g.semRevision, 'Revisión después de la acción de “' + pj.nombre + '”')) return;
  var reales = p3CausasMotor_(P, S, pj), hit = causas.filter(function (c) { return reales.indexOf(c) >= 0; }), miss = reales.filter(function (c) { return causas.indexOf(c) < 0; }), sobra = causas.filter(function (c) { return reales.indexOf(c) < 0; });
  var tipo = P3_TIPOFR_[x.tipo] ? x.tipo : 'complejo', D = [];
  D.push('Causas: coinciden ' + hit.length + ' de las ' + reales.length + ' causas principales que registró el simulador.' + (miss.length ? ' No mencionaron: ' + miss.map(function (c) { return P3_CAUSAS_[c].toLowerCase(); }).join('; ') + '.' : ' Las identificaron todas.'));
  if (sobra.length) D.push('Revisen: ' + sobra.map(function (c) { return P3_CAUSAS_[c].toLowerCase(); }).join('; ') + ' no aparece como causa importante en los datos.');
  D.push(/\d/.test(x.porque) ? 'La explicación usa datos del proyecto.' : 'La explicación no cita ningún dato: agreguen cifras de la tabla.');
  var cumple = pj.resLanz && pj.acta && pj.acta.caso && pj.resLanz.unidades >= pj.acta.caso.volumen * 0.9;
  if (tipo === 'exito' && !cumple) D.push('Clasificación: no alcanzaron lo que esperaban en el caso de negocio; no corresponde llamarlo éxito.');
  else if (tipo === 'evitable' && pj.acta && pj.acta.obs.length > 2) D.push('Clasificación: razonable; el comité les había advertido varios de estos problemas.');
  else if (tipo === 'complejo' && reales.length && hit.length === reales.length) D.push('Clasificación: identificaron causas concretas y previsibles; no parece un fracaso por complejidad.');
  else D.push('Clasificación: coherente con los datos.');
  if (O.ultRevAnio < anioDe_(t) && O.madurez < 5) { O.madurez++; O.ultRevAnio = anioDe_(t); D.push('Madurez en innovación: sube a ' + O.madurez + ' de 5. El margen de error de sus próximas ideas sin validar baja.'); }
  else D.push('La madurez sube como máximo un nivel por año.');
  if (x.referencia) { S.compromisos = S.compromisos || {}; S.compromisos.referencia = t; D.push('Su compromiso de partir de la clase de referencia se recordará en la próxima Puerta.'); }
  pj.aar = { t: t, tabla: p3TablaAAR_(P, S, pj), causas: causas, reales: reales, porque: String(x.porque).slice(0, 800), tipo: tipo, d1: String(x.d1 || '').slice(0, 400), d2: String(x.d2 || '').slice(0, 400), devolucion: D };
  pj.revisado = true;
  fb.push('Revisión de “' + pj.nombre + '” realizada. La devolución está en la tarjeta del proyecto.');
}

function estimarProyecto3_(P, S, pj, a, O, t) {
  var g = P.general, costo = 0, sem = 0, av = [], acel = a.acelerar ? 1 + (g.recargoAcelerar || 0.5) : 1;
  if (pj.etapa === 'prototipar' && a.proto && a.proto.formato && a.proto.siguiente !== 'avanzar' && a.proto.siguiente !== 'volver') {
    var n = [5, 8, 12].indexOf(Number(a.proto.n)) >= 0 ? Number(a.proto.n) : 8;
    costo += (2000 + { 5: 4000, 8: 6000, 12: 9000 }[n]) * factorMadurez_(O) * acel; sem += semMadurez_(O, n === 12 ? 2 : 1) * acel;
    if (String(a.proto.pregunta || '').trim().length < 10) av.push('“' + pj.nombre + '”: escriban la pregunta del prototipo.');
  }
  if (pj.etapa === 'especificar' && a.esp && p3Num_(a.esp.precioU, 0) > 0) {
    costo += 8000 * factorMadurez_(O) * acel; sem += semMadurez_(O, 2) * acel;
    if ((a.esp.causas || []).length !== 2) av.push('“' + pj.nombre + '”: elijan exactamente 2 causas en el pre-mortem.');
  }
  if (pj.etapa === 'piloto' && a.pil && p3Num_(a.pil.producir, 0) > 0 && pj.esp) {
    var pts = 0; Object.keys(a.pil.puntos || {}).forEach(function (c) { pts += p3Num_(a.pil.puntos[c], 0) * (P3_COSTO_PUNTO_[c] || 500); });
    costo += Math.max(5000, pts + [0, 3000, 8000][p3Num_(a.pil.apoyo, 1)] + p3Num_(a.pil.producir, 0) * pj.esp.costoReal * 0.4) * (pj.factPiloto || 1); sem += semMadurez_(O, g.semPiloto);
  }
  if (pj.etapa === 'lanzar' && a.lan && a.lan.confirmar) { var idea = ideaDe_(P, pj); costo += (g.costoLanzamiento + ((idea && idea.costo) || 0)) * factorMadurez_(O) + ((pj.esp && pj.esp.inversion) || 0); sem += semMadurez_(O, g.semLanzamiento); }
  if (a.aar && (a.aar.causas || []).length) { costo += g.costoRevision; sem += g.semRevision; }
  return { costo: costo, sem: sem, avisos: av };
}

function vistaProyecto3_(P, S, pj) {
  var ref = pj.etapa === 'especificar' ? p3RefClase_(P, S, P3_TAM_[(pj.protoCar || {}).tamano || '330'].porc) : null;
  var fichaPrev = pj.etapa === 'especificar' ? p3Ficha_(P, pj, {}) : null;
  return {
    proto: pj.proto || null, protoCar: pj.protoCar || null, protoFit: pj.protoFit || 0, iter: pj.iter || 0, calProto: pj.calProto || 0,
    esp: pj.esp ? { ficha: pj.esp.ficha, costoReal: pj.esp.costoReal, porc: pj.esp.porc, vida: pj.esp.vida, capU: pj.esp.capU, lienzo: pj.esp.lienzo, caso: pj.esp.caso, sel: pj.esp.sel } : null,
    acta: pj.acta || null, actas: pj.actas || [], pil: pj.pil || null, lan: pj.lan || null, resLanz: pj.resLanz || null, aar: pj.aar || null, reaccion: pj.reaccion || null, lanzT: pj.lanzT || null,
    ref: ref, fichaBase: fichaPrev, cuConcepto: (pj.concepto && pj.concepto.ef && pj.concepto.ef.cu) || 0, vw: pj.concepto && pj.concepto.vw ? { pmc: pj.concepto.vw.pmc, pme: pj.concepto.vw.pme } : null,
    tablaAAR: (pj.etapa === 'lanzado' && pj.resLanz && !pj.aar) ? p3TablaAAR_(P, S, pj) : null
  };
}
var P3_CAT_ = { tam: P3_TAM_, sup: P3_SUP_, fmt: P3_FMT_, car: P3_CAR_, ficha: P3_FICHA_, costoAp: P3_COSTO_AP_, costoSen: P3_COSTO_SEN_, cap: P3_CAP_, lienzo: P3_LIENZO_, hoy: P3_HOY_, riesgos: P3_RIESGOS_, costoPunto: P3_COSTO_PUNTO_, causas: P3_CAUSAS_, tipoFr: P3_TIPOFR_ };

if (typeof module !== 'undefined') module.exports = { BANCO_EXT_: BANCO_EXT_ };
