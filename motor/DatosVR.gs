/**
 * Simulador de Innovación "vida real" — Datos del Año 0 (todos con fuente).
 * Origen: documento del proyecto "claude/banco-datos-simulador.md" (aprobado por el docente, 11 y 12-nov-2026)
 * y "claude/decisiones-simulador-vida-real.md". Cada valor indica su sección del banco de datos.
 * Los valores marcados "IMPLEMENTACIÓN" son reglas de programación pendientes de visto bueno del docente.
 */
var VR_DATOS = {
  version: 'vr-0.1',

  // ---------- tiempo (decisión 26) ----------
  semanasPorTrimestre: 13,
  trimestresPorAnio: 4,
  horizonteTrimestres: 12,

  // ---------- mercado (banco §9) ----------
  mercadoLitrosAnio: 10684618,          // leche saborizada, Santa Cruz
  segmentos: [                          // Brodock et al. (2021), estudio 1 (banco §9; decisión 31)
    { id: 'natural', nombre: 'Consumidores de lo natural', peso: 0.36 },
    { id: 'calorias', nombre: 'Conscientes de las calorías', peso: 0.38 },
    { id: 'promedio', nombre: 'Consumidores promedio', peso: 0.26 }
  ],
  elasticidadPrecio: -2.05,             // Hu et al. (2016), decisión 30
  elasticidadPublicidad: 0.12,          // Sethuraman et al. (2011), decisión 33
  escalaLogit: 0.11517838795090132,     // calibrada: no Pil 10 % / Pil 90 % (AEMP 2010), banco §9
  porcionMl: 240,                       // porción estándar de leche (FDA), banco §9

  // Utilidades por segmento, Brodock et al. (2021), tabla 3 (clúster 1 = natural, 2 = calorías, 3 = promedio).
  // A cada producto se le asigna el nivel más cercano (banco §9).
  utilidades: {
    endulzante: {
      estevia: { natural: 0.4, calorias: 27.9, promedio: -43.1 },
      jarabe_maiz: { natural: -86.9, calorias: -36.8, promedio: 11.8 },
      azucar_cana: { natural: 57.5, calorias: 15.6, promedio: 85.6 },
      fruta_monje: { natural: 14.4, calorias: -17.1, promedio: -40.7 },
      agave: { natural: 38.3, calorias: 27.1, promedio: 1.9 },
      azucar_remolacha: { natural: 36.4, calorias: 3.2, promedio: 19.4 },
      sucralosa: { natural: -60.2, calorias: -19.9, promedio: -34.9 }
    },
    grasa: { // % de grasa → nivel
      niveles: [
        { valor: 0, id: 'descremada', u: { natural: -26.8, calorias: 15.6, promedio: -38.4 } },
        { valor: 1, id: '1%', u: { natural: 9.2, calorias: 22.3, promedio: 5.3 } },
        { valor: 2, id: '2%', u: { natural: 21.8, calorias: 9.9, promedio: 28.7 } },
        { valor: 3.25, id: 'entera', u: { natural: 17.6, calorias: -66.3, promedio: 33.7 } } // entera EE. UU. 3,25 % (IMPLEMENTACIÓN)
      ]
    },
    azucar: { // g de azúcar añadida por porción de 240 ml → nivel
      niveles: [
        { valor: 0, u: { natural: 47.0, calorias: 69.5, promedio: 7.1 } },
        { valor: 4, u: { natural: 45.4, calorias: 19.2, promedio: 23.5 } },
        { valor: 6, u: { natural: 10.5, calorias: 0.3, promedio: 7.8 } },
        { valor: 8, u: { natural: -3.1, calorias: -8.1, promedio: 2.1 } },
        { valor: 12, u: { natural: -42.6, calorias: -35.6, promedio: -20.5 } },
        { valor: 16, u: { natural: -57.2, calorias: -45.3, promedio: -19.9 } }
      ]
    },
    proteina: { // g por porción → nivel
      niveles: [
        { valor: 8, u: { natural: -6.7, calorias: -3.9, promedio: 1.0 } },
        { valor: 10, u: { natural: -3.4, calorias: 4.4, promedio: 5.0 } },
        { valor: 13, u: { natural: 0.9, calorias: -6.3, promedio: -3.6 } },
        { valor: 16, u: { natural: 9.2, calorias: 5.8, promedio: -2.4 } }
      ]
    },
    tamano: { // onzas líquidas → nivel
      niveles: [
        { valor: 8, u: { natural: -7.5, calorias: -1.1, promedio: -4.4 } },
        { valor: 11, u: { natural: -6.8, calorias: 1.8, promedio: -6.4 } },
        { valor: 14, u: { natural: -4.8, calorias: 1.6, promedio: -4.4 } },
        { valor: 32, u: { natural: 19.1, calorias: -2.3, promedio: 15.2 } }
      ]
    }
  },

  // ---------- productos del Año 0 (banco §1, §2) ----------
  // Atributos por 100 ml de los equivalentes Colun; precio al consumidor de Santa Cruz (Hipermaxi, 11-nov-2026).
  productosAnio0: {
    chiquitano: { nombre: 'Lácteos Chiquitano chocolatada 1 L', endulzante: ['azucar_cana'], azucarAnadida100ml: 7.0, grasa100ml: 1.6, proteina100ml: 3.1, tamanoMl: 1000, precioConsumidor: 17.00 },
    cupesi: { nombre: 'Cupesí chocolatada sin lactosa', endulzante: ['estevia', 'sucralosa'], azucarAnadida100ml: 0.4, grasa100ml: 1.3, proteina100ml: 3.2, tamanoMl: 1000, precioConsumidor: 16.88 },
    motacu: { nombre: 'Motacú leche saborizada', endulzante: ['azucar_cana'], azucarAnadida100ml: 7.2, grasa100ml: 1.1, proteina100ml: 3.0, tamanoMl: 950, precioConsumidor: 11.05 }
  },
  precioReferencia: (17.00 + 16.88 + 11.05) / 3, // promedio de los tres al consumidor (calibración, banco §9)

  // ---------- canales (banco §5) ----------
  canales: {
    supermercado: { margen: 0.185, diasCobro: 30 },
    tienda: { margen: 0.15, diasCobro: 0 },
    mercado: { margen: 0.15, diasCobro: 0 }
  },
  costoDistribucionPctVentas: 228817 / 4252767, // comisiones Gloria 2024 (≈ 5,4 %)

  // ---------- estructura de costos (banco §6, §7, §10) ----------
  costoVentasPct: 0.7782,      // Moody's 2025
  gastosVentaAdmPct: 0.1317,   // Moody's 2025
  publicidadPctVentas: 110191 / 4252767, // Gloria 2024 (≈ 2,59 %)
  // Parte variable del costo de ventas: materias primas e insumos sobre los componentes de la nota 21 de Gloria 2024,
  // sin la desvalorización de existencias (el simulador calcula el vencimiento aparte). IMPLEMENTACIÓN.
  costoVentasVariablePct: 2323365 / (2323365 + 44388 + 85458 + 568238 + 285 + 57416),
  vidaUtilSemanas: { uht: 16, pasteurizado: 1 }, // banco §3

  // ---------- balance inicial (banco §11) ----------
  balance: {
    cajaPctVentas: 156490 / 4252767,
    diasCxC: 276955 / 4252767 * 365,
    diasInventarioPT: 164612 / 3330009 * 365,
    activoFijoPctVentas: 1116714 / 4252767,
    depreciacionAnualPct: 101494 / 1116714,
    depreciacionFabricacionPct: 80495 / 101494, // nota 11(d): parte de la depreciación que va al costo de ventas
    diasCxP: 465063 / 3330009 * 365,
    deudaSobreFinanciamiento: 1267500 / (1267500 + 1623368)
  },
  saldoMinimoCajaPctVentas: 119009 / 4097504, // banco §11
  tasaInteresAnual: 0.08,                     // banco §11 (DS 5403)
  tasaImpuesto: 0.25,                         // IUE, Ley 843 (IMPLEMENTACIÓN: fuente a registrar en el banco)

  // ---------- innovación (banco §8, §12, §13, §14) ----------
  presupuestoExploracionPctVentas: 0.008,
  sueldos: { jefe: 20185, profesional: 7850 },
  registroSanitario: { semanas: 9, costo: 1256 },
  estudios: {
    semanas: 5,
    mercado: 59200, consumidor: 59200,
    prueba: { 400: 59200, 1600: 177600 }
  },

  // ---------- reglas de implementación pendientes de visto bueno ----------
  // Caída de ventas cuando una marca deja de anunciar (Ehrenberg-Bass Institute, 2018: 70 marcas de consumo masivo de Australia,
  // 57 casos sin publicidad en medios masivos por un año o más): −16 % al año, −25 % a los 2 años, −36 % a los 3 años.
  // Regla: el efecto de la publicidad nunca es peor que dejar de anunciar durante los mismos trimestres seguidos con publicidad
  // por debajo de la referencia; entre los puntos se interpola por trimestre y después del año 3 se mantiene (aprobado, 12-nov-2026).
  caidaSinPublicidad: [{ trimestres: 0, caida: 0 }, { trimestres: 4, caida: 0.16 }, { trimestres: 8, caida: 0.25 }, { trimestres: 12, caida: 0.36 }]
};
