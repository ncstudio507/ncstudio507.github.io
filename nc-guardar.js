/* NC Studio · «Guardar en mi galería» (25-11-2026, Nelson)
   Las fotos finales (sesiones y carreras) se guardan SIN ZIP y en calidad completa:
   - iPhone/iPad: se abre la hoja de compartir con las fotos → «Guardar N imágenes» → quedan en Fotos.
     (iPhone no guarda en Fotos con una descarga normal: por eso a algunas no les salían en la galería.)
   - Android y computadora: cada foto se descarga suelta (Android la muestra en la galería, carpeta Descargas).
   - Calidad completa: de Drive se pide el archivo original (=d), no la vista achicada.
   - Al terminar sale «✓ Listo» y se llama a listo(n) para avisarle a Nelson.
   Uso: NCGuardar.fotos([{ nombre, url }], { titulo, listo: function (n) {} })                         */
(function () {
  var ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var LOTE = 10;   // solo si el iPhone no aguanta todas juntas: entonces de 10 en 10

  // de cualquier link de Drive al archivo ORIGINAL
  function original(u) {
    u = String(u || '');
    var m = u.match(/lh3\.googleusercontent\.com\/d\/([\w-]+)/) || u.match(/drive\.google\.com\/.*[?&]id=([\w-]+)/) || u.match(/drive\.usercontent\.google\.com\/.*[?&]id=([\w-]+)/);
    return m ? 'https://lh3.googleusercontent.com/d/' + m[1] + '=d' : u;
  }
  function tipoDe(nombre, tipo) {
    var e = (String(nombre).match(/\.(\w+)$/) || [])[1]; e = e ? e.toLowerCase() : '';
    if (e === 'png') return 'image/png'; if (e === 'heic') return 'image/heic'; if (e === 'webp') return 'image/webp';
    return tipo && /^image\//.test(tipo) ? tipo : 'image/jpeg';
  }
  function conExt(nombre, tipo) { return /\.\w{3,4}$/.test(nombre) ? nombre : nombre + (tipo === 'image/png' ? '.png' : '.jpg'); }
  function bajarUna(x) {
    return fetch(original(x.url)).then(function (r) { if (!r.ok) throw new Error('foto'); return r.blob(); }).then(function (b) {
      var t = tipoDe(x.nombre, b.type), n = conExt(String(x.nombre || 'foto').replace(/[\\/:*?"<>|]+/g, '-'), t);
      return new File([b], n, { type: t });
    });
  }
  // de 3 en 3 para no ahogar el celular
  function bajarTodas(lista, paso) {
    var out = new Array(lista.length), i = 0, hechas = 0;
    function sig() {
      if (i >= lista.length) return Promise.resolve();
      var k = i++;
      return bajarUna(lista[k]).then(function (f) { out[k] = f; paso(++hechas); return sig(); });
    }
    return Promise.all([sig(), sig(), sig()]).then(function () { return out; });
  }

  // ---------- ventanita propia (igual en sesiones y carreras) ----------
  var css = document.createElement('style');
  css.textContent = '.ncg-fondo{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:16px}' +
    '.ncg-caja{background:#1b1b1b;color:#fff;border-radius:18px;max-width:380px;width:100%;padding:22px 20px;text-align:center;font:15px/1.45 system-ui,-apple-system,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.5)}' +
    '.ncg-caja h3{margin:0 0 6px;font-size:19px}.ncg-caja p{margin:6px 0;color:#d9d9d9}.ncg-ico{font-size:40px;line-height:1;margin-bottom:8px}' +
    '.ncg-barra{height:8px;border-radius:8px;background:#333;overflow:hidden;margin:14px 0 6px}.ncg-barra i{display:block;height:100%;width:0;background:#F99824;transition:width .2s}' +
    '.ncg-btn{display:block;width:100%;margin-top:12px;padding:14px;border:0;border-radius:12px;background:#F99824;color:#111;font-weight:700;font-size:16px;cursor:pointer}' +
    '.ncg-btn.sec{background:transparent;color:#ccc;border:1px solid #444;font-weight:500}.ncg-btn:disabled{opacity:.55}';
  document.head.appendChild(css);
  var fondo = null;
  function caja(html) {
    if (!fondo) { fondo = document.createElement('div'); fondo.className = 'ncg-fondo'; document.body.appendChild(fondo); }
    fondo.innerHTML = '<div class="ncg-caja">' + html + '</div>';
    return fondo.firstChild;
  }
  function cerrar() { if (fondo) { fondo.remove(); fondo = null; } }

  function listo(n, total, op) {
    var c = caja('<div class="ncg-ico">✅</div><h3>¡Listo!</h3><p>' + (n === 1 ? 'Tu foto ya está' : 'Tus <b>' + n + ' fotos</b> ya están') + (ios ? ' en tu app <b>Fotos</b>.' : ' en tu celular (galería, carpeta <b>Descargas</b>).') + '</p>' +
      '<p style="font-size:13px">Guárdalas también en otro lugar (Drive, iCloud o la compu) para no perderlas.</p><button class="ncg-btn">Listo</button>');
    c.querySelector('button').onclick = cerrar;
    if (op.listo) try { op.listo(n, total); } catch (e) {}
  }

  // iPhone: hoja de compartir con TODAS de una vez (Nelson, 25-11-2026: «si son muchas no puede ser todas juntas» → sí, todas juntas).
  // Solo si el iPhone no aguanta tantas (falla por memoria) se parten en grupos de 10, sin que la persona tenga que hacer nada distinto.
  function compartir(files, op) {
    var hechas = 0, tam = files.length;
    function pintar(msg) {
      var lote = files.slice(hechas, hechas + tam), parte = lote.length < files.length;
      var de = parte ? ' (' + (hechas + 1) + ' a ' + (hechas + lote.length) + ' de ' + files.length + ')' : '';
      var c = caja('<div class="ncg-ico">📲</div><h3>' + (hechas ? '¡Van ' + hechas + '! Sigue' : 'Tus fotos están listas') + '</h3>' +
        '<p>Toca el botón y luego <b>«Guardar ' + (lote.length === 1 ? 'imagen' : lote.length + ' imágenes') + '»</b>.</p>' + (msg ? '<p style="color:#ffb4a8">' + msg + '</p>' : '') +
        '<button class="ncg-btn" id="ncgOk">' + (parte ? 'Guardar en mi galería' + de : lote.length === 1 ? 'Guardar en mi galería' : 'Guardar las ' + lote.length + ' en mi galería') + '</button><button class="ncg-btn sec" id="ncgX">Cancelar</button>');
      c.querySelector('#ncgX').onclick = cerrar;
      c.querySelector('#ncgOk').onclick = function () {
        var b = this; b.disabled = true;
        navigator.share({ files: lote, title: op.titulo || 'Fotos NC Studio' }).then(function () {
          hechas += lote.length; if (hechas >= files.length) listo(files.length, files.length, op); else pintar();
        }, function (e) {
          b.disabled = false; if (e && e.name === 'AbortError') return;
          if (tam > LOTE) { tam = LOTE; pintar('Eran muchas para tu celular de una vez: van en grupos de ' + LOTE + '.'); }
          else pintar('No se pudo abrir. Inténtalo otra vez.');
        });
      };
    }
    pintar();
  }
  // Android y computadora: una descarga suelta por foto
  function descargar(files, op) {
    var i = 0;
    (function sig() {
      if (i >= files.length) { setTimeout(function () { listo(files.length, files.length, op); }, 400); return; }
      var f = files[i++], u = URL.createObjectURL(f), a = document.createElement('a');
      a.href = u; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
      setTimeout(sig, 450);
    })();
  }

  function fotos(lista, op) {
    op = op || {}; lista = (lista || []).filter(function (x) { return x && x.url; });
    if (!lista.length) return;
    var c = caja('<div class="ncg-ico">⬇</div><h3>Preparando ' + (lista.length === 1 ? 'tu foto' : 'tus ' + lista.length + ' fotos') + '</h3><p>En calidad completa. No cierres esta página.</p>' +
      '<div class="ncg-barra"><i></i></div><p id="ncgN" style="font-size:13px">0 de ' + lista.length + '</p>');
    var barra = c.querySelector('i'), num = c.querySelector('#ncgN');
    bajarTodas(lista, function (n) { barra.style.width = Math.round(100 * n / lista.length) + '%'; num.textContent = n + ' de ' + lista.length; })
      .then(function (files) {
        var puede = ios && navigator.canShare && navigator.canShare({ files: files.slice(0, 1) });
        if (puede) compartir(files, op); else descargar(files, op);
      })
      .catch(function () {
        var c2 = caja('<div class="ncg-ico">⚠️</div><h3>No se pudo</h3><p>Revisa tu internet e inténtalo otra vez. Si sigue fallando, escríbenos por WhatsApp.</p><button class="ncg-btn">Cerrar</button>');
        c2.querySelector('button').onclick = cerrar;
      });
  }

  // lleva la cuenta de qué fotos ya guardó (una por una también cuenta): al completarlas todas, avisa una vez
  function marcar(clave, nombres, total) {
    var k = 'ncGuardadas:' + clave, s = {};
    try { s = JSON.parse(localStorage.getItem(k) || '{}'); } catch (e) {}
    nombres.forEach(function (n) { s[n] = 1; });
    try { localStorage.setItem(k, JSON.stringify(s)); } catch (e) {}
    return Object.keys(s).length >= total;
  }

  window.NCGuardar = { fotos: fotos, original: original, marcar: marcar, ios: ios };
})();
