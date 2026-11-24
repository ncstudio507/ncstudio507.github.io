// Pantalla de carga de NC Studio para TODA la página (Nelson, 24-11-2026: «que sirva para todo, donde las consultas demoran, y que diga que está cargando»).
// - Sola: si una consulta al servidor (Apps Script) tarda más de medio segundo, sale la camarita EOS M6 con «Cargando…» y se quita al llegar la respuesta.
// - A mano: NC_CARGA.mostrar('Guardando…') / NC_CARGA.ocultar().  Para una consulta silenciosa: NC_CARGA.silencio(function () { return fetch(...); }).
// Va en el <head> de cada página, antes de cualquier otro script que consulte al servidor.
(function () {
  if (window.NC_CARGA) return;
  var ESPERA = 500, pendientes = 0, temporizador = null, caja = null, msjT = null, callado = 0, manual = false;
  var MSJS = ['Un momentito…', 'Estamos trayendo tu información.', 'Ya casi…', 'Gracias por esperar 🧡'];

  var CSS = '' +
    '#ncCarga{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:rgba(20,18,18,.55);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);opacity:0;transition:opacity .2s;pointer-events:none}' +
    '#ncCarga.si{opacity:1;pointer-events:auto}' +
    '#ncCarga .tarjeta{display:flex;flex-direction:column;align-items:center;gap:10px;padding:22px 28px 20px;border-radius:22px;background:#222020;border:1px solid #3D3B3E;box-shadow:0 18px 50px rgba(0,0,0,.45);min-width:230px;max-width:86vw;text-align:center;font-family:Montserrat,"Segoe UI",Arial,sans-serif}' +
    '#ncCarga svg{width:120px;height:102px;overflow:visible}' +
    '#ncCarga b{font-size:22px;font-weight:700;color:#FEFEFE;letter-spacing:.02em}' +
    '#ncCarga small{font-size:14px;color:#bdb3a6;min-height:1.3em}' +
    '#ncCarga .clicc{font-weight:700;font-size:11px;letter-spacing:.3em;color:#F99824;opacity:0;animation:ncc-clic 1.6s infinite;margin-top:-8px}' +
    '#ncCarga .llenar{width:190px;max-width:70vw;height:8px;border-radius:99px;background:#3D3B3E;overflow:hidden}' +
    '#ncCarga .llenar i{display:block;height:100%;width:4%;border-radius:99px;background:#F99824;transition:width 7s cubic-bezier(.15,.7,.3,1)}' +
    '#ncCarga.va .llenar i{width:92%}' +
    '#ncCarga .cam{transform-origin:66px 100px;animation:ncc-salto 1.6s cubic-bezier(.3,.7,.4,1) infinite}' +
    '#ncCarga .boton{transform-origin:26px 15px;animation:ncc-boton 1.6s infinite}' +
    '#ncCarga .iris{transform-origin:76px 66px;animation:ncc-iris 1.6s infinite}' +
    '#ncCarga .flash{transform-origin:80px 18px;opacity:0;animation:ncc-flash 1.6s infinite}' +
    '#ncCarga .sombra{transform-origin:66px 106px;animation:ncc-sombra 1.6s cubic-bezier(.3,.7,.4,1) infinite}' +
    '@keyframes ncc-salto{0%,100%{transform:translateY(0) scale(1.06,.94)}12%{transform:translateY(0) scale(1)}40%{transform:translateY(-26px) rotate(-6deg)}55%{transform:translateY(-26px) rotate(5deg)}80%{transform:translateY(0) scale(1)}90%{transform:translateY(0) scale(1.08,.92)}}' +
    '@keyframes ncc-sombra{0%,100%,85%{transform:scale(1);opacity:.45}40%,55%{transform:scale(.6);opacity:.2}}' +
    '@keyframes ncc-boton{0%,44%,56%,100%{transform:translateY(0)}48%,52%{transform:translateY(5px)}}' +
    '@keyframes ncc-iris{0%,44%{transform:rotate(0) scale(1)}50%{transform:rotate(60deg) scale(.55)}62%,100%{transform:rotate(120deg) scale(1)}}' +
    '@keyframes ncc-flash{0%,47%{opacity:0;transform:scale(.3)}50%{opacity:.95;transform:scale(1.4)}66%,100%{opacity:0;transform:scale(2.4)}}' +
    '@keyframes ncc-clic{0%,46%{opacity:0;transform:translateY(4px)}50%,64%{opacity:1;transform:none}80%,100%{opacity:0}}' +
    '@media (prefers-reduced-motion:reduce){#ncCarga *{animation:none!important}#ncCarga .clicc{opacity:1}}';

  // la camarita estilo Canon EOS M6 (la misma de News y el álbum; ids propios para no chocar)
  var SVG = '<svg viewBox="0 0 132 112" aria-hidden="true"><defs>' +
    '<linearGradient id="nccPlata" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6f6f4"/><stop offset=".5" stop-color="#c4c4c1"/><stop offset="1" stop-color="#e4e4e1"/></linearGradient>' +
    '<pattern id="nccCuero" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#1c1c1e"/><circle cx="1" cy="1" r=".8" fill="#2b2b2e"/><circle cx="3" cy="3" r=".7" fill="#121214"/></pattern>' +
    '<pattern id="nccEstria" width="3" height="10" patternUnits="userSpaceOnUse"><rect width="3" height="10" fill="#b9b9b6"/><rect width="1.4" height="10" fill="#7d7d7a"/></pattern>' +
    '<radialGradient id="nccVidrio" cx=".35" cy=".3"><stop offset="0" stop-color="#7d6aa8"/><stop offset=".35" stop-color="#2b3550"/><stop offset=".75" stop-color="#10141d"/><stop offset="1" stop-color="#07080b"/></radialGradient>' +
    '<radialGradient id="nccFlash"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#fff8e6" stop-opacity=".95"/><stop offset="1" stop-color="#F99824" stop-opacity="0"/></radialGradient></defs>' +
    '<ellipse class="sombra" cx="66" cy="106" rx="42" ry="5" fill="#000"/><g class="cam">' +
    '<rect x="16" y="17" width="20" height="10" rx="3" fill="url(#nccEstria)" stroke="#6f6f6c" stroke-width=".8"/>' +
    '<rect class="boton" x="20" y="12" width="12" height="6" rx="3" fill="url(#nccPlata)" stroke="#7d7d7a" stroke-width=".8"/>' +
    '<rect x="40" y="20" width="18" height="8" rx="3" fill="url(#nccEstria)" stroke="#6f6f6c" stroke-width=".8"/>' +
    '<path d="M70 28 V22 H90 V28" fill="url(#nccPlata)" stroke="#7d7d7a" stroke-width=".8"/><rect x="72" y="20" width="16" height="3" fill="#9a9a97"/>' +
    '<path d="M8 46 Q8 34 16 28 H116 Q124 28 124 36 V48 H8 Z" fill="url(#nccPlata)" stroke="#9a9a97" stroke-width="1"/><circle cx="113" cy="38" r="3.4" fill="#F99824"/>' +
    '<path d="M8 48 H124 V88 H8 Z" fill="url(#nccCuero)" stroke="#000" stroke-width="1"/><path d="M8 48 H30 Q36 68 30 88 H8 Z" fill="#141416" stroke="#000" stroke-width="1"/>' +
    '<path d="M10 50 H28 Q33 68 28 86 H10 Z" fill="url(#nccCuero)" opacity=".9"/><circle cx="38" cy="56" r="2.6" fill="#2b2b2e" stroke="#555" stroke-width=".8"/>' +
    '<path d="M8 88 H124 V91 Q124 96 118 96 H14 Q8 96 8 91 Z" fill="url(#nccPlata)" stroke="#9a9a97" stroke-width="1"/><rect x="123" y="40" width="4" height="10" rx="2" fill="url(#nccPlata)"/>' +
    '<circle cx="76" cy="66" r="31" fill="#121214" stroke="#2a2a2d" stroke-width="2"/><circle cx="76" cy="66" r="27" fill="none" stroke="#3a3a3e" stroke-width="5" stroke-dasharray="1.4 1.6"/>' +
    '<circle cx="76" cy="66" r="22" fill="#0d0d0f" stroke="#4a4a4f" stroke-width="1.2"/><circle cx="76" cy="66" r="16.5" fill="url(#nccVidrio)" stroke="#2a2a2d" stroke-width="1.4"/>' +
    '<g class="iris"><path d="M76 52 L81 63 M89 59 L80 68 M87 75 L74 71 M71 80 L71 67 M62 72 L72 64 M65 57 L76 62" stroke="#07080b" stroke-width="2.4" stroke-linecap="round"/><circle cx="76" cy="66" r="4.6" fill="#040506"/></g>' +
    '<ellipse cx="69" cy="58" rx="5" ry="3" fill="#fff" opacity=".5" transform="rotate(-30 69 58)"/><circle cx="84" cy="74" r="2" fill="#c9b8ff" opacity=".55"/>' +
    '<circle class="flash" cx="80" cy="18" r="30" fill="url(#nccFlash)"/>' +
    '<path class="flash" d="M80 -10v12M80 32v6M52 18h12M96 18h12M60 -2l8 8M92 30l8 8M100 -2l-8 8M68 30l-8 8" stroke="#fff" stroke-width="3" stroke-linecap="round"/></g></svg>';

  function armar() {
    if (caja) return caja;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    caja = document.createElement('div'); caja.id = 'ncCarga'; caja.setAttribute('role', 'status'); caja.setAttribute('aria-live', 'polite');
    caja.innerHTML = '<div class="tarjeta">' + SVG + '<div class="clicc">¡CLIC!</div><b>Cargando…</b><div class="llenar"><i></i></div><small></small></div>';
    document.body.appendChild(caja);
    return caja;
  }
  // si la página ya muestra su propia pantalla de carga (News, el álbum), no se encima otra
  function hayPropia() { var p = document.getElementById('carga'); return p && !p.hidden; }

  function mostrar(texto) {
    if (!document.body) return;
    var c = armar(); c.querySelector('b').textContent = texto || 'Cargando…';
    var s = c.querySelector('small'), n = 0; s.textContent = MSJS[0];
    clearInterval(msjT); msjT = setInterval(function () { n = (n + 1) % MSJS.length; s.textContent = MSJS[n]; }, 2800);
    c.classList.remove('va'); c.classList.add('si');
    requestAnimationFrame(function () { requestAnimationFrame(function () { c.classList.add('va'); }); });
  }
  function ocultar() {
    clearInterval(msjT); clearTimeout(temporizador); temporizador = null;
    if (caja) caja.classList.remove('si', 'va');
  }

  function esServidor(u) { u = String(u && u.url || u || ''); return /script\.google(usercontent)?\.com/.test(u); }
  var fetchOriginal = window.fetch;
  if (fetchOriginal) window.fetch = function (recurso) {
    var p = fetchOriginal.apply(this, arguments);
    if (callado || !esServidor(recurso)) return p;
    pendientes++;
    if (!temporizador && !manual) temporizador = setTimeout(function () { temporizador = null; if (pendientes > 0 && !hayPropia()) mostrar(); }, ESPERA);
    var fin = function () { pendientes = Math.max(0, pendientes - 1); if (!pendientes && !manual) ocultar(); };
    p.then(function (r) { (r && r.clone ? r.clone().text() : Promise.resolve()).then(fin, fin); }, fin);
    return p;
  };

  window.NC_CARGA = {
    mostrar: function (t) { manual = true; mostrar(t); },
    ocultar: function () { manual = false; if (!pendientes) ocultar(); },
    // para consultas que corren solas por detrás (no deben tapar la pantalla)
    silencio: function (f) { callado++; try { var r = f(); return r; } finally { callado--; } }
  };
})();
