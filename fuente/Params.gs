/**
 * Simulador de Innovación — Parámetros del modelo (v1.0)
 * Todos los valores son una calibración inicial. Los parámetros generales
 * pueden sobrescribirse desde la hoja "Parametros" (clave / valor).
 */
var ATTRS = ['sab', 'nut', 'conv', 'salud', 'sost'];
var ATTR_NOMBRES = { sab: 'Sabor', nut: 'Nutrición / saciedad', conv: 'Conveniencia', salud: 'Saludable', sost: 'Sostenibilidad' };

var DEF = {
  general: {
    totalTrimestres: 20,
    presupuestoInicial: 400000,
    presupuestoMin: 250000,
    presupuestoMax: 600000,
    semanasTrimestre: 12,
    beta: 6,
    mercadoTotal: 2000000,        // litros por trimestre
    costoUnitBase: 5.84,          // Bs por litro
    precioP0: 9,                  // Bs por litro
    gastosFijos: 500000,          // incluye depreciación
    depreciacion: 60000,
    tasaDeuda: 0.0175,            // trimestral
    tasaEmergencia: 0.04,         // trimestral
    tasaIUE: 0.25,
    cxcPct: 0.30,
    rAnual: 0.14,
    costoUnitNuevo: 12.00,        // costo base por litro de un producto nuevo (formato individual y cadena de frío)
    costoValidacion: 4000,
    semValidacion: 2,
    costoPiloto: 30000,
    semPiloto: 4,
    costoLanzamiento: 50000,
    semLanzamiento: 3,
    capexEscalamiento: 120000,
    costoPatente: 25000,
    semPatente: 2,
    costoRevision: 8000,
    semRevision: 2,
    costoUnidadAutonoma: 40000,   // por año
    costoCapacitacion: 25000,
    semCapacitacion: 2,
    costoTiempoLibrePunto: 750,   // Bs por punto % y por trimestre
    costoAlianzaC4: 60000,
    costoAdquisicionC4: 450000,
    costoGestionProducto: 40000,  // costo fijo trimestral por producto nuevo activo (marca, inventario, distribución)
    maxProyectos: 3,
    costoTestConcepto: 5000,
    recargoAcelerar: 0.5,
    entradaC4: 10,
    invasionC4: 14,
    promoMax: 60000,              // promoción en el punto de venta por producto y trimestre
    publicidadBase: 20000         // publicidad inicial de la leche saborizada (mantiene el conocimiento de marca)
  },

  segmentos: [
    { id: 'S1', nombre: 'Familias con niños', part: 0.45, g: -0.01, w: { sab: 30, nut: 20, conv: 10, salud: 0, sost: 0, precio: 40 }, pref: 10, elas: 1.5, cuota0: 0.18, est: [1.05, 1.00, 0.90, 1.05], nuevo: false, noCompra: 0.5, latentes: [] },
    { id: 'S2', nombre: 'Universitarios (18–25 años)', part: 0.15, g: 0.04, w: { sab: 0, nut: 30, conv: 35, salud: 0, sost: 10, precio: 25 }, pref: 24, elas: 1.2, cuota0: 0.03, est: [0.75, 1.15, 0.95, 1.15], nuevo: true, noCompra: 2.0, latentes: ['conv', 'nut'] },
    { id: 'S3', nombre: 'Oficinistas', part: 0.15, g: 0.01, w: { sab: 20, nut: 30, conv: 40, salud: 0, sost: 0, precio: 10 }, pref: 28, elas: 0.8, cuota0: 0.06, est: [1.00, 1.00, 0.95, 1.05], nuevo: true, noCompra: 2.0, latentes: ['conv'] },
    { id: 'S4', nombre: 'Deportistas y consumidores saludables', part: 0.10, g: 0.05, w: { sab: 0, nut: 40, conv: 0, salud: 50, sost: 0, precio: 10 }, pref: 32, elas: 0.8, cuota0: 0.02, est: [1.10, 0.95, 0.90, 1.05], nuevo: true, noCompra: 1.5, latentes: [] },
    { id: 'S5', nombre: 'Adultos mayores', part: 0.15, g: 0.02, w: { sab: 25, nut: 40, conv: 0, salud: 0, sost: 0, precio: 35 }, pref: 12, elas: 1.4, cuota0: 0.10, est: [1.00, 1.00, 1.00, 1.00], nuevo: false, noCompra: 0.5, latentes: ['nut'] }
  ],

  canales: [
    { id: 'tienda', nombre: 'Tiendas de barrio', costo: 0, af: { S1: 0.9, S2: 0.3, S3: 0.4, S4: 0.2, S5: 0.9 } },
    { id: 'super', nombre: 'Supermercados', costo: 0, af: { S1: 0.8, S2: 0.3, S3: 0.6, S4: 0.7, S5: 0.7 } },
    { id: 'kiosco', nombre: 'Kioscos universitarios', costo: 6000, af: { S1: 0.0, S2: 0.8, S3: 0.1, S4: 0.2, S5: 0.0 } },
    { id: 'maquina', nombre: 'Máquinas expendedoras', costo: 9000, af: { S1: 0.1, S2: 0.5, S3: 0.7, S4: 0.4, S5: 0.0 } },
    { id: 'app', nombre: 'App propia con entrega', costo: 15000, af: { S1: 0.2, S2: 0.7, S3: 0.5, S4: 0.5, S5: 0.1 } },
    { id: 'delivery', nombre: 'App de delivery (terceros)', costo: 12000, af: { S1: 0.3, S2: 0.8, S3: 0.6, S4: 0.4, S5: 0.1 } }
  ],

  competidores: [
    { id: 'C1', nombre: 'Líder nacional', attrs: { sab: 7, nut: 6, conv: 5, salud: 3, sost: 3 }, precio: 9.2, pres: { S1: 1.0, S2: 0.4, S3: 0.6, S4: 0.5, S5: 1.0 } },
    { id: 'C2', nombre: 'Marca regional', attrs: { sab: 6, nut: 5, conv: 5, salud: 3, sost: 2 }, precio: 8, pres: { S1: 0.9, S2: 0.3, S3: 0.4, S4: 0.3, S5: 0.8 } },
    { id: 'C3', nombre: 'Importados premium', attrs: { sab: 7, nut: 7, conv: 6, salud: 7, sost: 5 }, precio: 30, pres: { S1: 0.3, S2: 0.4, S3: 0.9, S4: 0.9, S5: 0.3 } },
    { id: 'C4', nombre: 'Startup de bebidas vegetales por app', attrs: { sab: 5, nut: 5, conv: 8, salud: 7, sost: 7 }, precio: 19.2, pres: { S2: 1.0 }, entrada: 10 }
  ],

  producto0: { id: 'P0', nombre: 'Leche saborizada 1 L', attrs: { sab: 7, nut: 5, conv: 3, salud: 2, sost: 2 }, canales: ['tienda', 'super'] },

  iniciativas: [
    { id: 'taller', nombre: 'Taller interno de ideación', modo: 'Especialista', n0: 5, mu0: 5.8, s0: 0.9, costo: 25000, sem: 3, premio: false },
    { id: 'consultora', nombre: 'Consultora experta', modo: 'Especialista', n0: 3, mu0: 6.6, s0: 0.7, costo: 40000, sem: 4, premio: false },
    { id: 'intra', nombre: 'Grupo intraemprendedor', modo: 'Emprendedor interno', n0: 4, mu0: 5.6, s0: 1.4, costo: 30000, sem: 5, premio: false },
    { id: 'concint', nombre: 'Concurso interno', modo: 'Emprendedor interno', n0: 8, mu0: 5.0, s0: 1.3, costo: 10000, sem: 2, premio: true },
    { id: 'redes', nombre: 'Concurso abierto en redes', modo: 'Comunidad', n0: 15, mu0: 4.3, s0: 1.9, costo: 20000, sem: 3, premio: true },
    { id: 'hack', nombre: 'Hackathon universitario', modo: 'Comunidad', n0: 10, mu0: 4.8, s0: 1.8, costo: 18000, sem: 2, premio: true },
    { id: 'incub', nombre: 'Reto con startups de incubadora', modo: 'Red', n0: 6, mu0: 6.0, s0: 1.6, costo: 45000, sem: 8, premio: false },
    { id: 'prov', nombre: 'Codesarrollo con proveedor', modo: 'Red', n0: 3, mu0: 6.4, s0: 1.0, costo: 50000, sem: 6, premio: false }
  ],
  premios: { bajo: { fN: 0.8, fM: 0.0, fS: 1.0, costo: 5000 }, medio: { fN: 1.3, fM: 0.2, fS: 1.0, costo: 12000 }, alto: { fN: 0.9, fM: 0.5, fS: 0.7, costo: 30000 } },

  // Catálogo de la consultora (precios didácticos, subsidiados: en el mercado boliviano costarían unas 3 veces más).
  // grupo: A macroentorno, B clientes, C industria, D proveedores. modalidad: suscripcion | medida | sindicado.
  // Precio: costo fijo, o base + porSeg por cada segmento elegido (1 a 5). continuo: puede ir en el contrato anual.
  metodos: [
    { id: 'vigilancia', grupo: 'A', inciso: 'A.1', fam: 'B', modalidad: 'suscripcion', nombre: 'Vigilancia del entorno', costo: 22000, err: 0, continuo: true, pregunta: '¿Qué noticias son reales y cuándo llegarán?', proyecto: 'Antes de crear proyectos: anticipa leyes, costos y entrantes que pueden abrir o cerrar oportunidades (las noticias llegan un trimestre antes).', desc: 'Boletín de señales PESTEL con su nivel de confianza y plazo, durante 4 trimestres.' },
    { id: 'encuesta', grupo: 'B', inciso: 'B.1', fam: 'A', modalidad: 'medida', continuo: true, nombre: 'Encuesta', base: 8000, porSeg: 4000, err: 6, pregunta: '¿Qué dicen valorar los clientes?', proyecto: 'Fase Definir: muestra qué dice valorar el segmento, para elegir el problema. Mejora la calidad de las ideas que generen para ese segmento, pero subestima lo que no dicen.', desc: 'Importancia que declaran los clientes de cada segmento elegido, con margen de error. Subestima las necesidades latentes.' },
    { id: 'observacion', grupo: 'B', inciso: 'B.2', fam: 'A', modalidad: 'medida', continuo: true, nombre: 'Observación etnográfica', base: 0, porSeg: 15000, err: 2, pregunta: '¿Qué hacen y qué necesitan sin decirlo?', proyecto: 'Fases Definir e Idear: revela la necesidad latente del segmento; las ideas que la atienden valen más y la evaluación de sus conceptos es más precisa.', desc: 'Persona, citas, recorrido del cliente, mapa de empatía y necesidad latente de cada segmento elegido.' },
    { id: 'extremos', grupo: 'B', inciso: 'B.3', fam: 'A', modalidad: 'medida', continuo: true, nombre: 'Usuarios extremos', costo: 15000, err: 0, pregunta: '¿Qué necesidad puede volverse común?', proyecto: 'Antes de elegir el reto: muestra hacia dónde irá la demanda; mejora un poco su conocimiento de universitarios y deportistas.', desc: 'Una tendencia que puede volverse común, con su fuerza y su horizonte.' },
    { id: 'lideres', grupo: 'B', inciso: 'B.4', fam: 'A', modalidad: 'medida', continuo: true, nombre: 'Usuarios líderes (co-creación)', costo: 20000, err: 0, pregunta: '¿Qué ideas proponen los clientes adelantados?', proyecto: 'Fase Idear: entrega 2 conceptos de alta calidad directamente al proyecto que elijan.', desc: '2 conceptos de alta calidad para un proyecto activo.' },
    { id: 'industria', grupo: 'C', inciso: 'C.1', fam: 'B', modalidad: 'sindicado', nombre: 'Mercado', costo: 18000, err: 0, continuo: true, pregunta: '¿Cuánto vende cada empresa y en qué segmentos?', proyecto: 'Para elegir dónde competir: qué segmentos crecen y cuánto vende cada rival; ayuda a fijar la meta de ventas del proyecto.', desc: 'Participación de cada empresa en rangos y ventas por segmento, con un trimestre de retraso.' },
    { id: 'competidores', grupo: 'C', inciso: 'C.2', fam: 'B', modalidad: 'sindicado', nombre: 'Competidores actuales y potenciales', costo: 14000, err: 0, continuo: true, pregunta: '¿Qué ofrece cada rival y quién se prepara para entrar?', proyecto: 'Fases Definir y Lanzar: contra qué compite su producto (precio, atributos, canales) y quién puede imitarlo o entrar.', desc: 'Precio, atributos, envase, mensaje, canales y presencia de cada rival, y señales de quién prepara su ingreso o una imitación.' },
    { id: 'percepcion', grupo: 'C', inciso: 'C.3', fam: 'C', modalidad: 'medida', nombre: 'Posicionamiento de marcas', base: 8000, porSeg: 4000, err: 0.7, continuo: true, pregunta: '¿Cómo nos perciben los clientes frente a los rivales?', proyecto: 'Fases Definir y Lanzar: muestra espacios vacíos en el mapa de marcas y la curva de valor, para diferenciar el concepto.', desc: 'Mapa perceptual y curva de valor de las marcas en cada segmento elegido.' },
    { id: 'sustitutos', grupo: 'C', inciso: 'C.4', fam: 'B', modalidad: 'sindicado', nombre: 'Sustitutos', costo: 10000, err: 0, continuo: true, pregunta: '¿Qué alternativas ganan terreno?', proyecto: 'Fase Definir: revela alternativas que atienden la misma necesidad (por ejemplo, bebidas vegetales).', desc: 'Precio, crecimiento y atractivo de las bebidas alternativas, como las vegetales.' },
    { id: 'proveedores', grupo: 'D', inciso: 'D.1', fam: 'B', modalidad: 'sindicado', nombre: 'Proveedores', costo: 10000, err: 0, continuo: true, pregunta: '¿Cómo evolucionarán nuestros costos de insumos?', proyecto: 'Fases Especificar y Lanzar: anticipa costos de leche, envases y transporte que afectan el margen del producto nuevo.', desc: 'Tendencia del precio de la leche cruda, de los envases importados y del transporte, y proveedores alternativos.' }
  ],
  gruposInv: { A: 'Macroentorno', B: 'Clientes (demanda)', C: 'Industria (competencia)', D: 'Proveedores' },
  modalidadesInv: { suscripcion: 'Suscripción', medida: 'A medida', sindicado: 'Sindicado' },
  descuentoContrato: 0.15,          // contrato anual de investigación continua
  contratoInicial: { industria: 4 }, // heredado: Mercado (C.1) cada trimestre


  posturas: {
    ofensiva: ['Ofensiva', 'Busca ser la primera en el mercado con productos nuevos; invierte mucho en investigación y proyectos.'],
    defensiva: ['Defensiva', 'Espera a que otro abra el mercado y entra rápido con una versión mejorada.'],
    imitativa: ['Imitativa', 'Copia lo que funciona en otros, con menor costo; vigila mucho a los competidores.'],
    dependiente: ['Dependiente', 'Innova solo cuando un cliente grande o un socio se lo pide.'],
    tradicional: ['Tradicional', 'Casi no innova; mejora la eficiencia de lo que ya hace.'],
    oportunista: ['Oportunista', 'Aprovecha un nicho o una oportunidad puntual que otros no ven.']
  },

  // Textos de los informes cualitativos (observación) por segmento.
  observacion: {
    S1: { persona: ['Mónica, 36 años, mamá de dos niños', 'Hace las compras del mes en el supermercado y completa en la tienda del barrio. Cuida el presupuesto.'],
      citas: ['“Compro lo que mis hijos toman sin reclamar; si no les gusta, se pierde.”', '“Miro el precio por litro antes que la marca.”'],
      recorrido: [['Planificar la compra', 2], ['Elegir en la góndola', 3], ['Servir en casa', 2], ['Lonchera escolar', 4], ['Reponer', 2]],
      empatia: ['“Quiero algo nutritivo y que rinda.”', 'Compra el formato grande y lo sirve en vasos.', 'La leche saborizada es un gusto, no un alimento.', 'Culpa cuando compra bebidas con mucha azúcar.'] },
    S2: { persona: ['Camila, 20 años, estudiante', 'Vive lejos del campus y sale de casa muy temprano. Desayuna en el micro o entre clases.'],
      citas: ['“Si no lo puedo tomar con una mano en el micro, no me sirve.”', '“Una vez se me abrió en la mochila y arruiné mis apuntes.”'],
      recorrido: [['Despertar', 2], ['Salir de casa', 3], ['Viaje en micro', 5], ['Primera clase', 4], ['Recreo', 3]],
      empatia: ['“Quiero algo sano, pero no tengo tiempo.”', 'Compra galletas y gaseosa en el kiosco; casi nunca lácteos.', 'Los lácteos son para tomar en casa, con vaso.', 'Cansancio a media mañana.'] },
    S3: { persona: ['Jorge, 34 años, trabaja en una oficina', 'Llega a las 8 y almuerza tarde. Busca algo que lo sostenga a media mañana.'],
      citas: ['“A las 11 ya tengo hambre y no puedo salir.”', '“Si está en la máquina del piso, lo compro.”'],
      recorrido: [['Llegar a la oficina', 2], ['Primera reunión', 3], ['Media mañana', 5], ['Almuerzo tardío', 3], ['Tarde', 2]],
      empatia: ['“Necesito algo rápido.”', 'Compra en la máquina o pide por delivery.', 'Lo práctico vale más que el precio.', 'Frustración cuando no hay nada cerca.'] },
    S4: { persona: ['Lucía, 27 años, entrena cinco días por semana', 'Lee las etiquetas y compara proteína y azúcar.'],
      citas: ['“Si tiene mucha azúcar, ni lo miro.”', '“Pago más si la etiqueta me convence.”'],
      recorrido: [['Antes de entrenar', 2], ['Entrenamiento', 1], ['Recuperación', 4], ['Comida siguiente', 2], ['Compra semanal', 3]],
      empatia: ['“Quiero proteína y nada de azúcar.”', 'Prepara batidos en casa con leche y avena.', 'Las bebidas lácteas comunes son golosinas.', 'Desconfianza de las promesas de las marcas.'] },
    S5: { persona: ['Don Ernesto, 72 años, jubilado', 'Compra en la tienda de la esquina y en la farmacia. Cuida su salud y su pensión.'],
      citas: ['“La caja de litro se me pasa en la heladera.”', '“Me cuesta abrir algunos envases.”'],
      recorrido: [['Ir a la tienda', 3], ['Elegir', 2], ['Abrir el envase', 5], ['Guardar lo que sobra', 4], ['Volver a comprar', 2]],
      empatia: ['“Quiero algo que me haga bien.”', 'Compra porciones grandes porque son más baratas.', 'Lo nutritivo es lo más importante a su edad.', 'Molestia cuando desperdicia producto.'] }
  },

  fidelidades: {
    baja: { nombre: 'Baja (maquetas, muestras)', costo: 8000, sem: 1, max: 3, err: 0.8 },
    media: { nombre: 'Media (lote de prueba)', costo: 15000, sem: 2, max: 2, err: 0.5 },
    alta: { nombre: 'Alta (producción piloto)', costo: 30000, sem: 3, max: 1, err: 0.2 }
  },

  umbrales: { estricto: 7.0, moderado: 6.0, laxo: 5.0 },

  mandatos: {
    MA: { nombre: 'Alta tolerancia al riesgo, problema abierto', w: { nov: 0.35, riesgo: 0.10, tiempo: 0.15, costo: 0.15, ajuste: 0.25 }, tipos: ['Producto', 'Proceso', 'Posición', 'Paradigma'],
      texto: 'Necesitamos una idea de alto impacto para recuperar crecimiento. Aceptamos riesgo si la apuesta es ambiciosa.' },
    MB: { nombre: 'Baja tolerancia al riesgo, problema abierto', w: { nov: 0.15, riesgo: 0.30, tiempo: 0.20, costo: 0.15, ajuste: 0.20 }, tipos: ['Producto', 'Proceso', 'Posición', 'Paradigma'],
      texto: 'Necesitamos recuperar ventas sin poner en riesgo la empresa. Preferimos apuestas seguras y rápidas.' },
    MC: { nombre: 'Alta tolerancia al riesgo, problema técnico', w: { nov: 0.35, riesgo: 0.10, tiempo: 0.15, costo: 0.15, ajuste: 0.25 }, tipos: ['Proceso', 'Posición', 'Paradigma'],
      texto: 'Nuestra operación y nuestros canales son anticuados. Queremos una transformación ambiciosa de procesos y canales digitales.' },
    MD: { nombre: 'Baja tolerancia al riesgo, problema técnico', w: { nov: 0.15, riesgo: 0.30, tiempo: 0.20, costo: 0.15, ajuste: 0.20 }, tipos: ['Proceso', 'Posición', 'Paradigma'],
      texto: 'Necesitamos mejorar procesos y canales con victorias rápidas y de bajo riesgo.' }
  },

  // Catálogo propio de ideas. efectos: deltas de atributos (sab, nut, conv, salud, sost), cu = delta de costo unitario (Bs por litro),
  // canal = canal que habilita, modelo = 'suscripcion', flags = indicadores especiales. trim = trimestres de desarrollo (1–3).
  ideas: [
    { id: 'I01', nombre: 'Desayuno líquido de avena en botella de 330 ml', tipo: 'Producto', nov: 3, riesgo: 3, costo: 40000, trim: 2, ef: { nut: 3, conv: 3, cu: 1.4 }, seg: ['S2', 'S3'], desc: 'Bebida láctea con avena, saciante, en formato individual con tapa deportiva.' },
    { id: 'I02', nombre: 'Bebida proteica sin azúcar añadida', tipo: 'Producto', nov: 3, riesgo: 3, costo: 35000, trim: 2, ef: { salud: 4, nut: 2, sab: -1, cu: 1.6 }, seg: ['S4', 'S5'], desc: 'Alta en proteína, endulzada con stevia.' },
    { id: 'I03', nombre: 'Línea mixta láctea y vegetal', tipo: 'Producto', nov: 4, riesgo: 6, costo: 60000, trim: 2, ef: { salud: 2, sost: 3, nut: 1, cu: 1.2 }, seg: ['S2', 'S4'], desc: 'Mezcla de leche con bebida de almendra o soya.' },
    { id: 'I04', nombre: 'Fórmula digestiva con probióticos', tipo: 'Producto', nov: 3, riesgo: 4, costo: 45000, trim: 2, ef: { nut: 3, salud: 2, cu: 1.2 }, seg: ['S5'], desc: 'Bebida fermentada suave pensada para adultos mayores.' },
    { id: 'I05', nombre: 'Mini botella escolar de 200 ml antiderrame', tipo: 'Producto', nov: 2, riesgo: 2, costo: 20000, trim: 1, ef: { conv: 2, cu: 0.4 }, seg: ['S1'], desc: 'Formato para la lonchera escolar.' },
    { id: 'I06', nombre: 'Sabores de frutas locales (copoazú, achachairú)', tipo: 'Producto', nov: 2, riesgo: 2, costo: 15000, trim: 1, ef: { sab: 2 }, seg: ['S1', 'S2'], desc: 'Ediciones con frutas del oriente boliviano.' },
    { id: 'I07', nombre: 'Versión reducida en azúcar del producto actual', tipo: 'Producto', nov: 2, riesgo: 3, costo: 25000, trim: 1, ef: { salud: 3, sab: -1 }, seg: ['S1', 'S5'], desc: 'Reformulación con 30 % menos azúcar.' },
    { id: 'I08', nombre: 'Bebida láctea con café para la mañana', tipo: 'Producto', nov: 4, riesgo: 6, costo: 50000, trim: 2, ef: { conv: 2, nut: 1, sab: 1, cu: 1 }, seg: ['S2', 'S3'], desc: 'Café con leche listo para beber.' },
    { id: 'I09', nombre: 'Yogur bebible con granola en vaso doble', tipo: 'Producto', nov: 4, riesgo: 5, costo: 70000, trim: 2, ef: { nut: 3, conv: 2, sab: 1, cu: 1.8 }, seg: ['S3', 'S2'], desc: 'Vaso con compartimento separado para la granola.' },
    { id: 'I10', nombre: 'Pack familiar económico de 2 litros', tipo: 'Producto', nov: 1, riesgo: 2, costo: 15000, trim: 1, ef: { cu: -0.4 }, seg: ['S1'], desc: 'Menor costo por litro para familias.' },
    { id: 'I11', nombre: 'Leche con colágeno para adultos', tipo: 'Producto', nov: 4, riesgo: 7, costo: 60000, trim: 2, ef: { salud: 2, nut: 2, cu: 2 }, seg: ['S5', 'S4'], desc: 'Bebida funcional para articulaciones y piel.' },
    { id: 'I12', nombre: 'Bebida con superalimentos amazónicos', tipo: 'Producto', nov: 5, riesgo: 7, costo: 90000, trim: 3, ef: { salud: 3, sost: 2, sab: 1, cu: 2.2 }, seg: ['S4', 'S2'], desc: 'Con asaí, cacao silvestre y castaña.' },
    { id: 'I13', nombre: 'Botella con forma de personaje infantil propio', tipo: 'Producto', nov: 2, riesgo: 4, costo: 40000, trim: 1, ef: { sab: 1, cu: 0.4 }, seg: ['S1'], desc: 'Envase coleccionable con un personaje creado por la marca.' },
    { id: 'I14', nombre: 'Bebida láctea sin lactosa', tipo: 'Producto', nov: 3, riesgo: 4, costo: 45000, trim: 2, ef: { salud: 2, nut: 2, cu: 1 }, seg: ['S5', 'S4'], desc: 'Para personas con intolerancia a la lactosa.' },
    { id: 'I15', nombre: 'Envase producido en la región', tipo: 'Proceso', nov: 2, riesgo: 3, costo: 30000, trim: 1, ef: { cu: -0.6, flags: { envaseLocal: true } }, seg: ['S1', 'S2', 'S3', 'S4', 'S5'], desc: 'Proveedor local de botellas; elimina la dependencia de importaciones.' },
    { id: 'I16', nombre: 'Envase retornable con depósito', tipo: 'Proceso', nov: 3, riesgo: 5, costo: 50000, trim: 2, ef: { sost: 4, cu: -0.2 }, seg: ['S1', 'S2'], desc: 'El cliente devuelve la botella y recibe un descuento.' },
    { id: 'I17', nombre: 'Pasteurización de alta presión', tipo: 'Proceso', nov: 4, riesgo: 6, costo: 120000, trim: 3, ef: { sab: 1, nut: 1, cu: 0.2 }, seg: ['S3', 'S4'], desc: 'Mayor vida útil y sabor más fresco sin conservantes.' },
    { id: 'I18', nombre: 'Automatizar la línea de llenado', tipo: 'Proceso', nov: 2, riesgo: 3, costo: 90000, trim: 2, ef: { cu: -0.8 }, seg: ['S1', 'S5'], desc: 'Reduce mermas y costo de mano de obra.' },
    { id: 'I19', nombre: 'Contratos de largo plazo con productores lecheros', tipo: 'Proceso', nov: 2, riesgo: 2, costo: 20000, trim: 1, ef: { cu: -0.2, flags: { contratoLeche: true } }, seg: ['S1', 'S5'], desc: 'Precio estable de leche cruda ante sequías.' },
    { id: 'I20', nombre: 'Energía solar en la planta', tipo: 'Proceso', nov: 3, riesgo: 4, costo: 80000, trim: 2, ef: { sost: 2, cu: -0.2 }, seg: ['S2', 'S4'], desc: 'Paneles solares para la operación de frío.' },
    { id: 'I21', nombre: 'Botella de material reciclado', tipo: 'Proceso', nov: 2, riesgo: 3, costo: 25000, trim: 1, ef: { sost: 2, cu: 0.12 }, seg: ['S2', 'S4'], desc: 'PET reciclado en el envase.' },
    { id: 'I22', nombre: 'Control de calidad con sensores', tipo: 'Proceso', nov: 2, riesgo: 2, costo: 40000, trim: 1, ef: { sab: 1 }, seg: ['S1', 'S3', 'S5'], desc: 'Sabor más consistente entre lotes.' },
    { id: 'I23', nombre: 'Reducir el tamaño de la etiqueta', tipo: 'Proceso', nov: 1, riesgo: 2, costo: 5000, trim: 1, ef: { cu: -0.04 }, seg: ['S1'], desc: 'Ahorro menor de material.' },
    { id: 'I24', nombre: 'Cambiar al formato de lata', tipo: 'Proceso', nov: 2, riesgo: 6, costo: 60000, trim: 2, ef: { conv: 1, cu: 1, sost: -1 }, seg: ['S3'], desc: 'Lata de 250 ml; más cara y menos sostenible.' },
    { id: 'I25', nombre: 'Kioscos en universidades', tipo: 'Posición', nov: 2, riesgo: 3, costo: 15000, trim: 1, ef: { conv: 1, canal: 'kiosco' }, seg: ['S2'], desc: 'Puntos de venta propios en campus.' },
    { id: 'I26', nombre: 'Máquinas expendedoras refrigeradas en oficinas', tipo: 'Posición', nov: 3, riesgo: 4, costo: 40000, trim: 1, ef: { conv: 2, canal: 'maquina' }, seg: ['S3'], desc: 'Disponible donde trabaja el cliente.' },
    { id: 'I27', nombre: 'Venta por apps de delivery', tipo: 'Posición', nov: 3, riesgo: 3, costo: 15000, trim: 1, ef: { conv: 2, canal: 'delivery' }, seg: ['S2', 'S3'], desc: 'Presencia en plataformas de terceros.' },
    { id: 'I28', nombre: 'Alianza con gimnasios', tipo: 'Posición', nov: 3, riesgo: 4, costo: 20000, trim: 1, ef: { salud: 1, canal: 'maquina' }, seg: ['S4'], desc: 'Venta en máquinas dentro de gimnasios.' },
    { id: 'I29', nombre: 'Programa de alimentación escolar con municipios', tipo: 'Posición', nov: 3, riesgo: 5, costo: 30000, trim: 1, ef: { nut: 1, flags: { licitacion: true } }, seg: ['S1'], desc: 'Prepara a la empresa para licitaciones públicas.' },
    { id: 'I30', nombre: 'Campaña "orgullo cruceño"', tipo: 'Posición', nov: 1, riesgo: 2, costo: 20000, trim: 1, ef: { sab: 1 }, seg: ['S1', 'S5'], desc: 'Refuerza la identidad regional de la marca.' },
    { id: 'I31', nombre: 'Reposicionar como bebida para deportistas', tipo: 'Posición', nov: 3, riesgo: 5, costo: 30000, trim: 1, ef: { salud: 1, nut: 1 }, seg: ['S4'], desc: 'Nueva comunicación y etiqueta deportiva.' },
    { id: 'I32', nombre: 'Presencia en farmacias para adultos mayores', tipo: 'Posición', nov: 3, riesgo: 4, costo: 25000, trim: 1, ef: { nut: 1, conv: 1 }, seg: ['S5'], desc: 'Venta junto a productos de salud.' },
    { id: 'I33', nombre: 'Influenciadores universitarios', tipo: 'Posición', nov: 2, riesgo: 4, costo: 20000, trim: 1, ef: { conv: 1 }, seg: ['S2'], desc: 'Comunicación con estudiantes conocidos en redes.' },
    { id: 'I34', nombre: 'Patrocinio de eventos deportivos', tipo: 'Posición', nov: 2, riesgo: 4, costo: 35000, trim: 1, ef: { salud: 1 }, seg: ['S4'], desc: 'Marca visible en maratones y torneos.' },
    { id: 'I35', nombre: 'Suscripción semanal con entrega en frío a campus', tipo: 'Paradigma', nov: 4, riesgo: 5, costo: 60000, trim: 2, ef: { conv: 3, canal: 'app', modelo: 'suscripcion' }, seg: ['S2', 'S3'], desc: 'Paquete semanal pagado por adelantado, entregado en residencias y campus.' },
    { id: 'I36', nombre: 'App propia de pedidos con recompensas', tipo: 'Paradigma', nov: 4, riesgo: 6, costo: 70000, trim: 2, ef: { conv: 2, canal: 'app' }, seg: ['S2', 'S3'], desc: 'Pedidos, puntos y promociones personalizadas.' },
    { id: 'I37', nombre: 'Planes corporativos de desayuno para empresas', tipo: 'Paradigma', nov: 3, riesgo: 4, costo: 35000, trim: 1, ef: { conv: 2, canal: 'maquina', modelo: 'suscripcion' }, seg: ['S3'], desc: 'Contrato mensual con empresas para sus empleados.' },
    { id: 'I38', nombre: 'Franquicia de kioscos saludables', tipo: 'Paradigma', nov: 5, riesgo: 8, costo: 150000, trim: 3, ef: { conv: 2, salud: 1, canal: 'kiosco' }, seg: ['S2'], desc: 'Red de kioscos operados por terceros con la marca.' },
    { id: 'I39', nombre: 'Bebidas personalizadas por app', tipo: 'Paradigma', nov: 5, riesgo: 8, costo: 140000, trim: 3, ef: { nut: 2, sab: 2, cu: 1.6, canal: 'app' }, seg: ['S4', 'S2'], desc: 'El cliente elige sabor y nutrientes; producción a pedido.' },
    { id: 'I40', nombre: 'Reciclaje de envases con puntos canjeables', tipo: 'Paradigma', nov: 3, riesgo: 5, costo: 40000, trim: 1, ef: { sost: 3 }, seg: ['S2', 'S4'], desc: 'Puntos por devolver envases.' },
    { id: 'I41', nombre: 'Plataforma de venta directa a tiendas de barrio', tipo: 'Paradigma', nov: 3, riesgo: 4, costo: 50000, trim: 2, ef: { cu: -0.2, conv: 1 }, seg: ['S1', 'S5'], desc: 'Pedidos digitales de los tenderos sin intermediarios.' },
    { id: 'I42', nombre: 'Venta a cafeterías universitarias como insumo', tipo: 'Paradigma', nov: 2, riesgo: 3, costo: 20000, trim: 1, ef: { canal: 'kiosco' }, seg: ['S2'], desc: 'Las cafeterías preparan bebidas con el producto.' },
    { id: 'I43', nombre: 'Regalar el producto durante un mes', tipo: 'Paradigma', nov: 1, riesgo: 9, costo: 80000, trim: 1, ef: {}, seg: ['S1'], desc: 'Promoción masiva sin estrategia de retención.' },
    { id: 'I44', nombre: 'Cambiar el color de la etiqueta', tipo: 'Posición', nov: 1, riesgo: 1, costo: 5000, trim: 1, ef: {}, seg: ['S1'], desc: 'Rediseño cosmético.' }
  ],

  // Noticias visibles en el trimestre t. tipo real: oportunidad, amenaza, ambas o ruido.
  // Menú general de acciones ante el entorno: el mismo para todas las noticias; el equipo elige cuál aplica.
  // Herramientas de la empresa frente al entorno: disponibles en cualquier trimestre, con costo y duración.
  // Se pagan con el presupuesto operativo (estado de resultados: "Herramientas del entorno").
  // Costos calibrados para que contratarlas "por si acaso" todo el tiempo no convenga: solo rinden a quien lee bien el entorno.
  herramientas: [
    { id: 'leche', grupo: 'cobertura', nombre: 'Proveedor de leche de respaldo', costo: 25000, dur: 4, seg: false, desc: 'Precio de la leche cruda pactado con un segundo acopiador. Si el precio de mercado sube, su costo de leche no sube mientras esté vigente.' },
    { id: 'envases', grupo: 'cobertura', nombre: 'Compra anticipada de envases importados', costo: 100000, dur: 4, seg: false, desc: 'Envases y tapas importados comprados por adelantado al precio actual (incluye financiamiento y almacenaje). Su costo de envase no sube mientras esté vigente.' },
    { id: 'rutas', grupo: 'cobertura', nombre: 'Rutas y distribución alternativas', costo: 45000, dur: 2, seg: false, desc: 'Transporte por rutas secundarias y depósitos de reserva. Si se cortan las carreteras, recupera cerca del 70 % de las entregas perdidas.' },
    { id: 'etiqueta', grupo: 'cobertura', nombre: 'Adecuación de etiqueta y comunicación nutricional', costo: 40000, dur: 0, seg: false, desc: 'Rediseño de etiquetas y mensajes nutricionales de todos sus productos actuales. Adecúa sus productos a una norma de etiquetado vigente o aprobada: reduce a la mitad la pérdida de atractivo que esa norma cause a los productos poco saludables. Permanente para los productos que tengan al contratarla. Solo se puede contratar cuando existe una norma vigente o aprobada.', requiere: 'norma' },
    { id: 'competidor', grupo: 'comercial', nombre: 'Plan comercial frente a un competidor', costo: 10000, dur: 2, seg: true, desc: 'Precios, promociones y presencia preparados para responder a un rival nuevo en el segmento elegido: mejora 5 % el atractivo de sus productos allí mientras ese rival compita.' },
    { id: 'campana', grupo: 'comercial', nombre: 'Campaña anticipada de marca', costo: 10000, dur: 1, seg: true, desc: 'Campaña en redes y puntos de venta en el segmento elegido: mejora 6 % el atractivo de sus productos allí durante el trimestre.' }
  ],

  noticias: [
    { id: 'N01', area: 'Económico', t: 1, tipo: 'amenaza', ambito: 'Clientes', llega: 0, texto: 'Las ventas de bebidas lácteas tradicionales cayeron por tercer año consecutivo en Santa Cruz.' },
    { id: 'N02', area: 'Demográfico', t: 1, tipo: 'oportunidad', ambito: 'Demográfico', llega: 0, texto: 'Crece la matrícula universitaria y se construyen nuevas residencias estudiantiles.' },
    { id: 'N03', area: 'Tecnológico', t: 2, tipo: 'oportunidad', ambito: 'Tecnológico', llega: 0, texto: 'Aumentan con fuerza los pedidos por aplicaciones de delivery en la ciudad.' },
    { id: 'N04', area: 'Cultural', t: 4, tipo: 'oportunidad', ambito: 'Clientes', llega: 0, texto: 'Estudio: los jóvenes buscan desayunos rápidos, saciantes y fáciles de llevar.' },
    { id: 'N05', area: 'Económico', t: 6, tipo: 'amenaza', ambito: 'Entrantes', llega: 4, texto: 'Una startup local de bebidas vegetales vendidas por app cierra una ronda de inversión.' },
    { id: 'N06', area: 'Legal', t: 7, tipo: 'ambas', ambito: 'Legal', llega: 2, texto: 'Se presenta un proyecto de ley de etiquetado frontal para alimentos altos en azúcar.' },
    { id: 'N07', area: 'Legal', t: 8, tipo: 'ambas', ambito: 'Legal', llega: 1, texto: 'Se aprueba la ley de etiquetado frontal: regirá desde el próximo trimestre.' },
    { id: 'N08', area: 'Económico', t: 9, tipo: 'amenaza', ambito: 'Entrantes', llega: 1, texto: 'La startup de bebidas vegetales anuncia su lanzamiento en universidades con precios bajos.' },
    { id: 'N09', area: 'Económico', t: 11, tipo: 'ambas', ambito: 'Proveedores', llega: 1, texto: 'Se amplía la brecha cambiaria y se retrasan las importaciones de envases y alimentos.' },
    { id: 'N10', area: 'Tecnológico', t: 13, tipo: 'amenaza', ambito: 'Entrantes', llega: 1, texto: 'La startup mejora su fórmula y prepara su llegada a supermercados y oficinas.' },
    { id: 'N11', area: 'Político', t: 15, tipo: 'oportunidad', ambito: 'Político', llega: 1, texto: 'La gobernación prepara una licitación de alimentación escolar y universitaria (requisito: producto saludable y nutritivo).' },
    { id: 'N12', area: 'Ecológico', t: 16, tipo: 'oportunidad', ambito: 'Ecológico', llega: 2, texto: 'Crece en redes el interés por bebidas vegetales y envases sostenibles.' },
    { id: 'N13', area: 'Cultural', t: 17, tipo: 'oportunidad', ambito: 'Clientes', llega: 1, texto: 'Estudio: los universitarios y deportistas prefieren marcas con compromiso ambiental.' }
  ],
  ruido: [
    'Rumor: una cadena extranjera de supermercados dejaría el país.',
    'Circula en redes que la leche en polvo importada bajará a la mitad de precio.',
    'Un influencer afirma que las bebidas lácteas pasarán de moda el próximo año.',
    'Se especula con una fusión entre dos competidores nacionales.',
    'Rumor: el gobierno prohibiría las botellas plásticas el próximo mes.',
    'Un blog anuncia que una gran marca extranjera llegará al mercado local.',
    'Se comenta que el precio del azúcar se triplicará.',
    'Circula una cadena que afirma que la leche saborizada es dañina para la salud.',
    'Rumor de importación masiva de leche de contrabando.',
    'Se especula que las universidades prohibirán la venta de bebidas en campus.',
    'Un portal dice que los supermercados cobrarán el doble por espacio en góndola.',
    'Rumor: una startup de robots repartidores llegará a la ciudad.',
    'Circula que habrá un feriado largo nacional cada mes.',
    'Se dice que los camiones refrigerados serán prohibidos en el centro.',
    'Rumor de que una cadena de cafeterías regalará desayunos todo el año.',
    'Un portal afirma que la demanda de lácteos se duplicará el próximo trimestre.',
    'Se especula con un nuevo impuesto a las bebidas lácteas.',
    'Rumor: la principal planta envasadora del país cerraría.',
    'Circula que los estudiantes dejarán de desayunar fuera de casa.',
    'Un blog asegura que el yogur será reemplazado por cápsulas.'
  ]
};

/** Lee los parámetros (DEF + sobrescrituras de la hoja "Parametros" si existe). */
function getParams_() {
  var P = JSON.parse(JSON.stringify(DEF));
  if (typeof SpreadsheetApp !== 'undefined') {
    try {
      var sh = ss_().getSheetByName('Parametros');
      if (sh && sh.getLastRow() > 1) {
        var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
        vals.forEach(function (r) {
          if (r[0] !== '' && P.general.hasOwnProperty(r[0]) && r[1] !== '') P.general[r[0]] = Number(r[1]);
        });
      }
    } catch (e) { /* usar valores por defecto */ }
  }
  P.cal = calibrate_(P);
  return P;
}

if (typeof module !== 'undefined') module.exports = { DEF: DEF, ATTRS: ATTRS, ATTR_NOMBRES: ATTR_NOMBRES };
