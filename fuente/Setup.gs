/**
 * Simulador de Innovación — Instalación.
 * Ejecute instalar() UNA vez desde el editor de Apps Script (botón "Ejecutar").
 */
function instalar() {
  // Se abre el libro por su ID para no depender de la pestaña activa (evita el error "No se encontró la hoja 0").
  var ss = ss_();
  var primera = ss.getSheets()[0];
  if (primera) ss.setActiveSheet(primera);
  Object.keys(HOJAS).forEach(function (nombre) {
    var s = ss.getSheetByName(nombre) || ss.insertSheet(nombre, ss.getNumSheets());
    var head = HOJAS[nombre];
    s.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#1F3864').setFontColor('#FFFFFF');
    s.setFrozenRows(1);
  });
  ss.setActiveSheet(ss.getSheetByName('Config'));
  ['Hoja 1', 'Hoja1', 'Sheet1'].forEach(function (n) { var d = ss.getSheetByName(n); if (d && ss.getSheets().length > 1) ss.deleteSheet(d); });

  // v2.3: el acceso de docentes es por correo y contraseña. La migración crea el superadministrador
  // con una contraseña temporal (la antigua clave docente, si existía) y obliga a cambiarla.
  var mig = AX_migrar_();

  var par = sh_('Parametros');
  if (par.getLastRow() < 2) {
    var filas = Object.keys(DEF.general).map(function (k) { return [k, DEF.general[k], '']; });
    par.getRange(2, 1, filas.length, 3).setValues(filas);
  }
  log_('sistema', 'instalar', 'Hojas creadas');
  var txt = mig && mig.superadmin ? 'Superadministrador: ' + mig.superadmin.email + ' · contraseña temporal: ' + mig.superadmin.temporal + ' (cámbiela al ingresar)' : 'Hojas verificadas. Si olvidó la contraseña del superadministrador, use el menú Simulador → Restablecer contraseña del superadministrador.';
  try { ss_().toast(txt, 'Instalación completa', 30); } catch (e) { /* ejecución sin interfaz */ }
  Logger.log('Instalación completa. ' + txt);
  return mig;
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Simulador')
    .addItem('Instalar o reparar hojas', 'instalar')
    .addItem('Procesar trimestre de una simulación', 'menuProcesar')
    .addItem('Buscar actualización ahora', 'autoActualizar')
    .addItem('Restablecer contraseña del superadministrador', 'axRestablecerSuperadmin')
    .addToUi();
}
function menuProcesar() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Procesar trimestre', 'Escriba el código de la simulación:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var sim = simPorCodigo_(r.getResponseText());
  if (!sim) { ui.alert('No existe una simulación con ese código.'); return; }
  ui.alert(procesarTrimestre_(sim.simId).mensaje);
}
