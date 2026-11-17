/**
 * Simulador de Innovación "vida real" — Datos del Año 0 (todos con fuente).
 * Origen: documento del proyecto "claude/banco-datos-simulador.md" (aprobado por el docente, 11 y 12-nov-2026)
 * y "claude/decisiones-simulador-vida-real.md". Cada valor indica su sección del banco de datos.
 * Las reglas marcadas "regla del motor" fueron aprobadas por el docente el 12-nov-2026 (siguiendo la sugerencia de Claude).
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
  // Escala del logit 0,02 (decisión del docente, 12-nov-2026, a sugerencia de Claude; sin fuente publicada) y constantes de marca
  // de los competidores, calibradas para reproducir las participaciones aprobadas del Año 0: 33,6 % / 56,4 % / 10,0 % (banco §9).
  escalaLogit: 0.02,
  constanteMarca: { chiquitano: 1, cupesi: 1.4289039213003782, motacu: 0.16923600967638028 },
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
        { valor: 3.25, id: 'entera', u: { natural: 17.6, calorias: -66.3, promedio: 33.7 } } // entera EE. UU. 3,25 % (regla del motor)
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
    // Mensaje frontal de la etiqueta (Brodock et al., 2021, tabla 3; no difiere entre segmentos). Aprobado 17-nov-2026.
    // "ninguno" = 0: un producto sin mensaje se toma igual al promedio de los mensajes medidos (las utilidades están centradas en cero).
    mensaje: {
      ninguno: { nombre: 'Sin mensaje frontal', u: { natural: 0, calorias: 0, promedio: 0 } },
      recuperacion: { nombre: 'Bebida de recuperación deportiva', u: { natural: -30.1, calorias: -27.3, promedio: -33.5 } },
      proteina: { nombre: 'Buena fuente de proteína', u: { natural: 6.0, calorias: 6.3, promedio: 4.8 } },
      indulgente: { nombre: 'Chocolatada oscura indulgente', u: { natural: 19.2, calorias: 18.2, promedio: 17.3 } },
      premium: { nombre: 'Bebida de chocolate oscuro premium', u: { natural: 20.9, calorias: 20.1, promedio: 26.1 } },
      polifenoles: { nombre: 'Contiene polifenoles de cacao', u: { natural: -27.5, calorias: -27.4, promedio: -31.4 } },
      cacao_real: { nombre: 'Contiene cacao real', u: { natural: 11.5, calorias: 10.1, promedio: 16.8 } }
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
  // sin la desvalorización de existencias (el simulador calcula el vencimiento aparte). Regla del motor.
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
  // Capacidad de planta: el Año 0 usa el 68,5 % de la capacidad (Pil 2015: acopio promedio 685.000 L/día frente a una capacidad
  // de más de 1.000.000 L/día; Ministerio de Desarrollo Productivo, SIIP, Boletín especial 05-2015). Regla aprobada 12-nov-2026.
  utilizacionCapacidadAnio0: 0.685,
  tasaInteresAnual: 0.08,                     // banco §11 (DS 5403)
  tasaImpuesto: 0.25,                         // IUE, Ley 843 (regla del motor; impuesto a las utilidades de las empresas, 25 %)

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
  // Auditoría, punto 2 (aprobado 17-nov-2026): error de pronóstico de productos nuevos.
  // Kahn, K. B. (2002). An exploratory investigation of new product forecasting practices. Journal of Product
  // Innovation Management, 19(2), 133-143: precisión autodeclarada un año después del lanzamiento: mejora del producto 65 %,
  // extensión de línea 63 %, nueva categoría para la empresa 47 %. Error medio absoluto = 1 − precisión (supuesto declarado).
  errorPronostico: { mejora: 0.35, incremental: 0.37, radical: 0.53 },
  // Auditoría, punto 5 (aprobado 17-nov-2026): reacción de la competencia a un aumento de publicidad.
  // Steenkamp, Nijs, Hanssens y Dekimpe (2005), Marketing Science 24(1), 35-54, tabla 4A: ante un ataque publicitario,
  // los competidores que anuncian regularmente responden con más publicidad en el 37,03 % de los casos (corto plazo);
  // a largo plazo casi nunca hay reacción. Cupesí (diferenciador) reacciona; Motacú (líder en costos) no.
  reaccionCompetidor: { competidor: 'cupesi', probabilidad: 0.3703 },
  // Auditoría, punto 5: calendario de eventos con fuente. La Razón (15-oct-2026): tras el retiro de la subvención al
  // diésel, el precio base de la leche cruda en Cochabamba sube de Bs 5,15 a Bs 5,75 (+11,65 %). Se aplica a mitad de la partida.
  precioLecheBase: 5.50,
  eventos: [
    { trimestre: 7, tipo: 'leche', variacion: 0.60 / 5.15, titulo: 'Sube el precio de la leche cruda',
      texto: 'Tras el retiro de la subvención al diésel, productores e industria acordaron subir el precio base de la leche cruda en 11,7 % (en Cochabamba, de Bs 5,15 a Bs 5,75 por litro). El aumento se aplica a todas las empresas desde este trimestre.',
      fuente: 'La Razón (15-oct-2026). Productores elevan en Bs 0,60 el precio base por litro de leche cruda.' }
  ],
  caidaSinPublicidad: [{ trimestres: 0, caida: 0 }, { trimestres: 4, caida: 0.16 }, { trimestres: 8, caida: 0.25 }, { trimestres: 12, caida: 0.36 }]
};
