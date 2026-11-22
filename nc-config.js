// Dirección del Apps Script de NC Studio. Vacía = prototipo (todo se guarda en este navegador).
// En la página real va la misma dirección que usa agendar.html (…/macros/s/…/exec).
// Para pruebas: si la pestaña sim/servidor.html está abierta, las páginas le hablan a ese simulador.
// Los DOS Yappy conviven (decisión de Nelson, 22-11-2026):
//   yappy / yappyLink → el del NEGOCIO (Yappy Comercial, punto de cobro «ncstudio»): lo confirma la API cada 5 minutos
//   yappyPersonal     → el número de Nelson: lo confirma el correo de Yappy, como siempre
window.NC_CONFIG = {
  url: 'https://script.google.com/macros/s/AKfycbzaT3OjIAFX5CET8Opyjnehye_XOfdI_kwA0DxEDusXzCzesOtffZUwsvE2-IbEp4yvIQ/exec',
  yappy: 'ncstudio',
  yappyLink: 'https://link.yappy.com.pa/stc/ew%2BQrL87BOqjMc5YuN80XRSk16Vdr9BZvaim7nGhYrA%3D',
  yappyPersonal: '6631-3762'
};
