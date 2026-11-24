/* Menú único de la Zona VIP (24-11-2026, pedido de Nelson).
   Mismo diseño que el panel (panel.css): a la izquierda en computadora, abajo en el celular.
   Cada clienta ve SOLO lo suyo: si compró sesión, lo de sesión; si compró fotos de carreras, lo de carreras; si las dos, todo.
   vip.html guarda lo que tiene la clienta (ncVipMenu) para que sus otras páginas (su galería, Mis fotos) pinten el mismo menú. */
(function () {
  var CLAVE = 'ncVipMenu';
  function leer() { try { return JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch (e) { return null; } }
  function tieneSesion() { try { return !!localStorage.getItem('ncVipTok'); } catch (e) { return false; } }
  function items(d) {
    var L = [{ k: 'inicio', i: '🏠', t: 'Mi VIP', h: 'vip.html?s=inicio' }];
    if (d.sesion) L.push({ k: 'galerias', i: '📸', t: 'Mis galerías', h: 'vip.html?s=galerias' });
    if (d.carreras) L.push({ k: 'carreras', i: '🏃', t: 'Mis carreras', h: 'mis-fotos.html' });
    L.push({ k: 'avisos', i: '🔔', t: 'Avisos', h: 'vip.html?s=avisos', n: d.avisos || 0 });
    if (d.consejos) L.push({ k: 'consejos', i: '✨', t: 'Consejos', h: 'vip.html?s=consejos' });
    L.push({ k: 'perfil', i: '👤', t: 'Mi perfil', h: 'vip.html?s=perfil' });
    return L;
  }
  var manejadores = {}, activo = '', datos = null;
  function a(it) {
    return '<a href="' + it.h + '" data-k="' + it.k + '"><span class="i" aria-hidden="true">' + it.i + '</span>' + it.t +
      (it.n ? '<span class="nc-dot">' + it.n + '</span>' : '') + '</a>';
  }
  function pintar() {
    var d = datos || {}, L = items(d);
    var lado = document.querySelector('.nc-lado'), abajo = document.querySelector('.nc-abajo');
    if (!lado) {
      lado = document.createElement('aside'); lado.className = 'nc-lado'; lado.setAttribute('aria-label', 'Tu Zona VIP');
      abajo = document.createElement('nav'); abajo.className = 'nc-abajo'; abajo.setAttribute('aria-label', 'Tu Zona VIP');
      document.body.appendChild(lado); document.body.appendChild(abajo);
      document.body.addEventListener('click', clic);
    }
    lado.innerHTML = '<a class="nc-marca" href="vip.html?s=inicio"><img src="logo.png" alt="NC Studio"><span>Zona VIP' + (d.nombre ? '<br><b style="color:#F99824">' + String(d.nombre).replace(/[<>&"]/g, '') + '</b>' : '') + '</span></a>' +
      (d.saldo ? '<div class="nc-saldo' + (d.pagado ? ' pag' : '') + '">' + String(d.saldo).replace(/[<>&"]/g, '') + '</div>' : '') +
      '<nav class="nc-nav">' + L.map(a).join('') + '</nav>' +
      '<div class="nc-pie"><a href="index.html">🏠 Página de NC Studio</a><a href="news.html">📰 News</a></div>';
    // abajo caben 5: si hay más, Perfil se queda solo en el menú lateral y se llega desde Mi VIP
    var B = L.length > 5 ? L.filter(function (x) { return x.k !== 'perfil'; }).slice(0, 5) : L;
    abajo.style.gridTemplateColumns = 'repeat(' + B.length + ',1fr)';
    abajo.innerHTML = B.map(a).join('');
    marcar(activo);
  }
  function clic(ev) {
    var x = ev.target.closest('.nc-lado a[data-k], .nc-abajo a[data-k]');
    if (!x) return;
    var k = x.getAttribute('data-k');
    if (manejadores[k]) { ev.preventDefault(); marcar(k); manejadores[k](); window.scrollTo(0, 0); }
  }
  function marcar(k) {
    activo = k;
    [].forEach.call(document.querySelectorAll('.nc-lado a[data-k], .nc-abajo a[data-k]'), function (x) { x.classList.toggle('on', x.getAttribute('data-k') === k); });
  }
  window.NCVip = {
    // vip.html: guarda qué tiene la clienta y pinta el menú → NCVip.guardar({ sesion, carreras, consejos, avisos, nombre, saldo, pagado })
    guardar: function (d) { datos = d; try { localStorage.setItem(CLAVE, JSON.stringify(d)); } catch (e) {} document.body.classList.add('nc-con-menu'); pintar(); },
    // al cerrar sesión: se borra y desaparece el menú
    olvidar: function () { datos = null; try { localStorage.removeItem(CLAVE); } catch (e) {} document.body.classList.remove('nc-con-menu'); },
    al: function (k, fn) { manejadores[k] = fn; },
    marcar: marcar,
    // otras páginas (su galería, Mis fotos): menú solo si en este celular hay una clienta con sesión abierta
    usar: function (k) { var d = leer(); if (!d || !tieneSesion()) return false; datos = d; activo = k; document.body.classList.add('nc-con-menu'); pintar(); return true; }
  };
  document.body.classList.add('nc-panel', 'nc-vip');
})();
