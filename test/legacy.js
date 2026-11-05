// Atajos de prueba (se cargan solo en gasmock). Reproducen el acceso anterior para las pruebas de las etapas 1–4.
var LEG_PIN = {};
function apiLoginDocente() {
  AX_migrar_();
  var d = rows_('Docentes').filter(function (x) { return x.rol === 'superadmin'; })[0];
  return { token: AX_newSession_({ rol: 'docente', docenteId: d.docenteId, email: d.email, nombre: d.nombre, superadmin: true, tmp: false }) };
}
function apiActivar(codigo, registro, pin) {
  var s = simPorCodigo_(codigo); if (!s) throw new Error('No existe una simulación con ese código.');
  LEG_PIN[s.simId + '|' + registro] = String(pin);
  return { token: AX_tokenIntegrante_(s.simId, registro) };
}
function apiLogin(registro, pin, simId) {
  var cand = rows_('Integrantes').filter(function (i) {
    if (String(i.registro) !== String(registro) || (simId && String(i.simId) !== String(simId))) return false;
    var eq = equipoById_(i.equipoId), k = i.simId + '|' + registro;
    return LEG_PIN[k] ? LEG_PIN[k] === String(pin) : AX_coincide_(pin, eq.claveHash, eq.claveSal);
  });
  if (!cand.length) throw new Error('Registro o contraseña incorrectos.');
  if (cand.length > 1) return { elegir: cand.map(function (i) { var s = simById_(i.simId), e = equipoById_(i.equipoId); return { simId: i.simId, nombre: s.nombre, sigla: s.sigla, equipo: e.nombre }; }) };
  return { token: AX_tokenIntegrante_(cand[0].simId, registro) };
}
