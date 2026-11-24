/* Menú único del panel de NC Studio — fase 1 (23-11-2026).
   Lo usan agendar.html y galeria-admin.html. En computadora va a la izquierda; en el celular, abajo con «Más».
   Cada página le dice qué hacer con los botones que son suyos (NCPanel.al); los de la otra página la abren por su enlace. */
(function () {
  var ITEMS = [
    { k: 'agendar', i: '📅', t: 'Agendar', p: 'agendar.html', g: 'Trabajo' },
    { k: 'compromisos', i: '🗓️', t: 'Compromisos', p: 'agendar.html' },
    { k: 'clientes', i: '👥', t: 'Clientes', p: 'agendar.html' },
    { k: 'galerias', i: '📸', t: 'Galerías', p: 'galeria-admin.html' },
    { k: 'pedidos', i: '🛒', t: 'Pedidos de carreras', p: 'galeria-admin.html' },
    { k: 'enviar', i: '✉️', t: 'Enviar', p: 'agendar.html', g: 'Comunicar' },
    { k: 'publicar', i: '📲', t: 'Por publicar', p: 'agendar.html' },
    { k: 'finanzas', i: '💰', t: 'Finanzas', p: 'agendar.html', g: 'Negocio' },
    { k: 'codigos', i: '🏷️', t: 'Códigos', p: 'agendar.html' },
    { k: 'papelera', i: '🗑️', t: 'Papelera', p: 'agendar.html' }
  ];
  var ABAJO = ['agendar', 'clientes', 'galerias', 'finanzas'];
  var aqui = (location.pathname.split('/').pop() || 'agendar.html').toLowerCase();
  var manejadores = {}, activo = '';

  function enlace(it) { return it.p + '#' + it.k; }
  function a(it, cls) {
    return '<a href="' + enlace(it) + '" data-k="' + it.k + '"' + (cls ? ' class="' + cls + '"' : '') + '><span class="i" aria-hidden="true">' + it.i + '</span>' + it.t + '</a>';
  }
  function lista() {
    return ITEMS.map(function (it) { return (it.g ? '<div class="nc-grupo">' + it.g + '</div>' : '') + a(it); }).join('');
  }
  function armar() {
    if (document.querySelector('.nc-lado')) return;
    var lado = document.createElement('aside');
    lado.className = 'nc-lado';
    lado.setAttribute('aria-label', 'Menú del panel');
    lado.innerHTML = '<a class="nc-marca" href="agendar.html#agendar"><img src="logo.png" alt="NC Studio"><span>Panel de<br>NC Studio</span></a>' +
      '<nav class="nc-nav">' + lista() + '</nav>' +
      '<div class="nc-pie"><a href="index.html" target="_blank" rel="noopener">Ver la página ↗</a><a href="#" data-salir>Salir</a></div>';
    var abajo = document.createElement('nav');
    abajo.className = 'nc-abajo';
    abajo.setAttribute('aria-label', 'Menú del panel');
    abajo.innerHTML = ABAJO.map(function (k) { return a(ITEMS.filter(function (x) { return x.k === k; })[0]); }).join('') +
      '<a href="#" data-mas><span class="i" aria-hidden="true">☰</span>Más</a>';
    var mas = document.createElement('div');
    mas.className = 'nc-mas';
    mas.innerHTML = '<div class="hoja" role="dialog" aria-label="Todo el panel"><div class="asa"></div><nav class="nc-nav">' + lista() +
      '<div class="nc-grupo">Cuenta</div><a href="index.html" target="_blank" rel="noopener"><span class="i">↗</span>Ver la página</a><a href="#" data-salir><span class="i">⎋</span>Salir</a></nav></div>';
    document.body.appendChild(lado);
    document.body.appendChild(abajo);
    document.body.appendChild(mas);
    document.body.addEventListener('click', clic);
    pintarActivo();
  }
  function clic(ev) {
    var x = ev.target.closest('a[data-k], a[data-mas], a[data-salir], .nc-mas');
    if (!x) return;
    if (x.classList.contains('nc-mas')) { if (ev.target === x) document.body.classList.remove('nc-mas-abierto'); return; }
    if (x.hasAttribute('data-mas')) { ev.preventDefault(); document.body.classList.toggle('nc-mas-abierto'); return; }
    if (x.hasAttribute('data-salir')) { ev.preventDefault(); document.body.classList.remove('nc-mas-abierto'); if (manejadores.salir) manejadores.salir(); return; }
    var k = x.getAttribute('data-k'), it = ITEMS.filter(function (y) { return y.k === k; })[0];
    document.body.classList.remove('nc-mas-abierto');
    if (it && it.p === aqui && manejadores[k]) {   // es de esta misma página: sin recargar
      ev.preventDefault();
      try { history.replaceState(null, '', '#' + k); } catch (e) {}
      marcar(k);
      manejadores[k]();
      window.scrollTo(0, 0);
    }
  }
  function marcar(k) { activo = k; pintarActivo(); }
  function pintarActivo() {
    [].forEach.call(document.querySelectorAll('.nc-lado a[data-k], .nc-abajo a[data-k], .nc-mas a[data-k]'), function (x) {
      x.classList.toggle('on', x.getAttribute('data-k') === activo);
    });
    var enAbajo = ABAJO.indexOf(activo) >= 0, mas = document.querySelector('.nc-abajo a[data-mas]');
    if (mas) mas.classList.toggle('on', !!activo && !enAbajo);
  }

  window.NCPanel = {
    // la página registra qué hacer con sus botones: NCPanel.al('clientes', function () { … })
    al: function (k, fn) { manejadores[k] = fn; },
    marcar: marcar,
    // mostrar u ocultar el menú (se oculta en la pantalla de entrar)
    mostrar: function (si) { armar(); document.body.classList.toggle('nc-con-menu', !!si); },
    // la sección que pidió el enlace (#clientes, #galerias…) o '' si no pidió ninguna
    pedido: function () { var h = (location.hash || '').slice(1); return ITEMS.some(function (x) { return x.k === h; }) ? h : ''; }
  };
  document.body.classList.add('nc-panel');
})();
