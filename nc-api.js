// Puente entre las páginas de la galería y el servidor.
// - Prototipo (NC_CONFIG.url vacío): corre la tienda aquí mismo, con localStorage.
// - Página real: le pide todo al Apps Script; la página guarda en memoria solo lo que el servidor le manda.
(function () {
  var cfg = window.NC_CONFIG || {}, URLS = cfg.url || '', real = !!URLS;
  var T = window.NC_TIENDA;
  var memoria = {};
  if (real) window.NC_ALMACEN = { leer: function (k) { return memoria[k]; }, guardar: function (k, v) { memoria[k] = v; } };
  var canal = URLS === 'sim' ? new BroadcastChannel('nc-sim') : null, esperando = {}, nMsj = 0;
  if (canal) canal.onmessage = function (ev) { var f = esperando[ev.data.id]; if (f) { delete esperando[ev.data.id]; f(ev.data.r); } };
  function post(body) {
    if (canal) return new Promise(function (ok, mal) { var id = 'm' + (++nMsj) + Math.random(); esperando[id] = ok; canal.postMessage({ id: id, body: JSON.parse(JSON.stringify(body)) }); setTimeout(function () { if (esperando[id]) { delete esperando[id]; mal({ title: 'El simulador no responde (¿está abierta la pestaña sim/servidor.html?)' }); } }, 8000); });
    return fetch(URLS, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); });
  }
  function pin() { try { return localStorage.getItem('ncPin') || ''; } catch (e) { return ''; } }
  var vaPorSrv = {};

  var A = window.NC_API = {
    real: real,
    // función pública de la tienda (el servidor recalcula precios y revisa el celular)
    gal: function (fn, args) {
      if (!real) { try { return Promise.resolve(T[fn].apply(T, args || [])); } catch (e) { return Promise.reject({ title: String(e.message || e) }); } }
      return post({ action: 'gal', fn: fn, args: args || [] }).then(function (r) { if (!r.ok) throw r; return r.r; });
    },
    // carga lo público de un álbum (fotos, precios, patrocinio, álbumes de grupo, turno de la fila)
    cargarEvento: function (id) {
      if (!real) return Promise.resolve();
      return Promise.all([A.gal('eventoPublico', [id]), A.gal('publico', [id])]).then(function (r) {
        if (r[0]) window.NC_EVENTOS = [r[0]];
        var p = r[1], m = {};
        m['nc-galeria-precios'] = {}; if (p.precios && p.precios.propio) m['nc-galeria-precios'][id] = p.precios;
        m['nc-galeria-liberados'] = {}; if (p.liberado) m['nc-galeria-liberados'][id] = p.liberado;
        m['nc-galeria-albumes'] = {}; m['nc-galeria-albumes'][id] = p.albumes || [];
        m['nc-galeria-grupales'] = p.grupales || {};
        m['nc-galeria-preventas'] = p.preventas || [];
        m['nc-galeria-eventos-ocultos'] = p.ocultos || [];
        Object.keys(m).forEach(function (k) { memoria[k] = m[k]; });
        vaPorSrv = p.vaPor || {}; T.vaPor = function (e) { return vaPorSrv[e] || 0; };
      });
    },
    // selfie o captura: se achica en el teléfono (máx. 1280 px) antes de subir
    subirFoto: function (tipo, archivo, extra) {
      return achicar(archivo).then(function (dataUrl) {
        if (!real) {
          if (tipo === 'selfie') { var l = []; try { l = JSON.parse(localStorage.getItem('nc-galeria-selfies') || '[]'); } catch (e) {} l.push({ evento: extra.evento, nombre: extra.nombre, tel: extra.tel, archivo: archivo.name, fecha: new Date().toISOString(), estado: 'pendiente' }); try { localStorage.setItem('nc-galeria-selfies', JSON.stringify(l)); } catch (e) {} T.registrarPosible(extra.nombre, extra.tel, 'selfie · ' + extra.evento); }
          return { ok: true, archivo: archivo.name };
        }
        var b = { action: 'gal_foto', tipo: tipo, imagen: dataUrl }; Object.keys(extra || {}).forEach(function (k) { b[k] = extra[k]; });
        return post(b).then(function (r) { if (!r.ok) throw r; return r; });
      });
    },
    // panel de Nelson (con su PIN, el mismo de agendar.html)
    cargarAdmin: function () {
      if (!real) return Promise.resolve();
      return post({ action: 'gal_admin', pin: pin() }).then(function (r) { if (!r.ok) throw r; memoria = r.estado || {}; window.NC_SESIONES = memoria['nc-sesiones'] || []; window.NC_EVENTOS = memoria['nc-eventos'] || []; });
    },
    // en la página real, cada cambio del panel se hace aquí al momento y se confirma en el servidor;
    // cuando el servidor responde, la página toma su versión (así los números y fechas son los del servidor)
    envolverAdmin: function (repintar) {
      if (!real) return;
      ['crear', 'actualizar', 'registrarYappy', 'confirmarPago', 'revisarCaptura', 'entregar', 'marcarGrupal', 'crearAlbum', 'cambiarAlbum', 'borrarAlbum', 'ponerEnAlbum',
        'guardarPrecios', 'liberar', 'guardarPreventa', 'asignarPreventas', 'resolverReclamo', 'borrar', 'restaurar', 'guardarGrupo', 'ponerGrupo', 'guardarContactos',
        'extenderSesion', 'revisarVencimientos', 'revisarPlazosSesiones', 'marcarAbierto'].forEach(function (fn) {
        var orig = T[fn];
        T[fn] = function () {
          var args = [].slice.call(arguments), r = orig.apply(T, args);
          post({ action: 'gal_admin', pin: pin(), fn: fn, args: args }).then(function (x) {
            if (!x.ok) { alert('No se guardó: ' + (x.title || 'error')); return; }
            memoria = x.estado || memoria; window.NC_SESIONES = memoria['nc-sesiones'] || []; if (repintar) repintar();
          }).catch(function () { alert('Sin conexión: no se guardó el último cambio.'); });
          return r;
        };
      });
    },
    // «Pagar con Yappy»: el botón oficial (Botón de Pago V2) cobra el monto exacto de ESE pedido y Yappy le avisa al servidor.
    // Debajo queda el link de cobro del negocio por si el botón no carga (ahí el cliente escribe el monto).
    botonYappy: function (p) {
      var c = window.NC_CONFIG || {}; if (typeof p !== 'object') p = { monto: p };
      var m = '$' + Number(p.monto || 0).toFixed(2), h = '';
      if (p.ticket && p.tel) {
        cargarYappy();
        h += '<div style="display:flex;justify-content:center;margin:8px 0"><btn-yappy theme="orange" rounded="true" data-ticket="' + p.ticket + '" data-tel="' + String(p.tel).replace(/\D/g, '') + '"></btn-yappy></div>' +
          '<p class="nota nc-yappy-msj" style="margin-top:0;text-align:center">Toca el botón, aprueba en tu app de Yappy y listo: se confirma solo.</p>';
      }
      return h;   // solo el botón (si alguien no sabe usarlo, Nelson le da el link o su número de boca)
    },
    // link «Escríbele» de los avisos
    ir: function (id) {
      if (!real) { var a = T.avisos().filter(function (x) { return x.id === id; })[0]; if (!a) return Promise.resolve(null); T.marcarAbierto(id); return Promise.resolve(T.linkWa(a)); }
      return post({ action: 'gal_ir', id: id }).then(function (r) { return r.ok ? r.url : null; });
    }
  };

  // carga una sola vez el botón de Yappy y le engancha los eventos a cada <btn-yappy> que aparezca en la página
  var yappyCargado = false;
  function cargarYappy() {
    if (yappyCargado) return; yappyCargado = true;
    var s = document.createElement('script'); s.type = 'module';
    s.src = (window.NC_CONFIG || {}).yappyCdn || 'https://bt-cdn.yappy.cloud/v1/cdn/web-component-btn-yappy.js';
    document.head.appendChild(s);
    function enganchar(b) {
      if (b._nc) return; b._nc = true;
      var msj = function (t) { var n = b.parentNode && b.parentNode.nextElementSibling; if (n && n.classList.contains('nc-yappy-msj')) n.innerHTML = t; };
      b.addEventListener('eventClick', function () {
        msj('Preparando tu pago…');
        post({ action: 'gal_yappy', ticket: b.getAttribute('data-ticket'), tel: b.getAttribute('data-tel') }).then(function (r) {
          if (!r.ok) { msj(r.title || 'No se pudo iniciar el pago.'); return; }
          b.eventPayment({ transactionId: r.transactionId, documentName: r.documentName, token: r.token });
          msj('Aprueba el pago en tu app de Yappy.');
        }).catch(function () { msj('Sin conexión. Inténtalo otra vez.'); });
      });
      b.addEventListener('eventSuccess', function () { msj('✅ ¡Pago recibido! Lo estamos confirmando…'); setTimeout(function () { location.reload(); }, 6000); });
      b.addEventListener('eventError', function () { msj('El pago no se completó. Puedes intentarlo otra vez.'); });
    }
    new MutationObserver(function () { [].forEach.call(document.querySelectorAll('btn-yappy'), enganchar); }).observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { [].forEach.call(document.querySelectorAll('btn-yappy'), enganchar); }, 0);
  }

  function achicar(archivo) {
    return new Promise(function (ok, mal) {
      var fr = new FileReader();
      fr.onload = function () {
        var im = new Image();
        im.onload = function () {
          var s = Math.min(1, 1280 / Math.max(im.width, im.height)), c = document.createElement('canvas');
          c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          ok(c.toDataURL('image/jpeg', 0.85));
        };
        im.onerror = function () { mal({ title: 'Esa imagen no se pudo abrir' }); };
        im.src = fr.result;
      };
      fr.onerror = function () { mal({ title: 'No se pudo leer el archivo' }); };
      fr.readAsDataURL(archivo);
    });
  }
})();
