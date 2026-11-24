// Visor de las galerías (24-11-2026, Nelson): pasar fotos deslizando con el dedo o arrastrando con el mouse,
// y compartir links (una foto, mis ♡, las fotos de una cara).
(function () {
  // marco: el área de la foto; cuadro: lo que se mueve; ir(+1 | -1): pasa a la siguiente / anterior
  function gestos(marco, cuadro, ir) {
    var x0 = null, y0 = 0, dx = 0, id = null;
    marco.addEventListener('pointerdown', function (ev) {
      if (ev.button > 0 || ev.target.closest('button,a,input')) return;
      x0 = ev.clientX; y0 = ev.clientY; dx = 0; id = ev.pointerId;
    });
    marco.addEventListener('pointermove', function (ev) {
      if (x0 === null || ev.pointerId !== id) return;
      dx = ev.clientX - x0;
      if (Math.abs(dx) < 8 && !marco.classList.contains('arrastrando')) return;
      if (!marco.classList.contains('arrastrando')) {
        if (Math.abs(ev.clientY - y0) > Math.abs(dx)) { x0 = null; return; }   // se mueve hacia arriba/abajo: no es pasar foto
        marco.classList.add('arrastrando'); try { marco.setPointerCapture(id); } catch (e) {}
      }
      cuadro.style.transform = 'translateX(' + dx + 'px)'; cuadro.style.opacity = String(1 - Math.min(.5, Math.abs(dx) / 600));
    });
    function soltar() {
      if (x0 === null) return;
      x0 = null; var arr = marco.classList.contains('arrastrando'); marco.classList.remove('arrastrando');
      if (!arr) return;
      var lado = dx < 0 ? 1 : -1;
      if (Math.abs(dx) > Math.min(90, marco.clientWidth * .18)) {
        cuadro.style.transform = 'translateX(' + (-lado * 60) + 'px)'; cuadro.style.opacity = '0';
        setTimeout(function () {
          ir(lado);
          cuadro.style.transition = 'none'; cuadro.style.transform = 'translateX(' + (lado * 60) + 'px)';
          void cuadro.offsetWidth; cuadro.style.transition = ''; cuadro.style.transform = ''; cuadro.style.opacity = '';
        }, 160);
      } else { cuadro.style.transform = ''; cuadro.style.opacity = ''; }
    }
    marco.addEventListener('pointerup', soltar);
    marco.addEventListener('pointercancel', soltar);
  }

  // compartir: el menú del celular; en la compu copia el link y lo avisa
  function compartir(url, titulo, texto) {
    url = new URL(url, location.href).href;
    if (navigator.share) return navigator.share({ title: titulo, text: texto, url: url }).catch(function () {});
    var listo = function () { aviso('✓ Link copiado: pégalo donde quieras'); };
    if (navigator.clipboard) return navigator.clipboard.writeText(url).then(listo, function () { prompt('Copia este link:', url); });
    prompt('Copia este link:', url);
  }
  function aviso(t) {
    var d = document.createElement('div'); d.className = 'aviso-copiado'; d.setAttribute('role', 'status'); d.textContent = t;
    document.body.appendChild(d); setTimeout(function () { d.remove(); }, 2200);
  }
  // cuadrícula tipo Pixieset: cada foto ocupa el ancho que le toca según su forma
  function forma(mini, img) {
    function pon() { if (img.naturalWidth) mini.style.setProperty('--r', (img.naturalWidth / img.naturalHeight).toFixed(3)); }
    if (img.complete) pon(); else img.addEventListener('load', pon, { once: true });
  }
  window.NCVisor = { gestos: gestos, compartir: compartir, aviso: aviso, forma: forma };
})();
