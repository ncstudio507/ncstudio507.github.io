// "Servidor" SIMULADO del prototipo: guarda todo en este navegador (localStorage).
// En la versión real estas mismas funciones llaman al Apps Script (hojas "Pedidos galería", "Clientes", etc.).
// Decisiones de Nelson (22-11-2026): galeria-carreras\PREGUNTAS-UNA-POR-UNA.md
// La MISMA lógica corre en la página y dentro del Apps Script (copiada como tienda.gs): así el servidor
// calcula los precios él mismo y las reglas no se separan. Dónde se guarda lo decide NC_ALMACEN:
//   - prototipo: localStorage de este navegador
//   - Apps Script: hojas de cálculo (ver galeria.gs)
//   - página real: copia en memoria que manda el servidor (ver nc-api.js)
(function () {
  var raiz = typeof window !== 'undefined' ? window : globalThis;
  var DIA = 864e5;
  function leerK(k, def) {
    if (raiz.NC_ALMACEN) { var x = raiz.NC_ALMACEN.leer(k); return x === undefined || x === null ? def : x; }
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; }
  }
  function guardarK(k, v) { if (raiz.NC_ALMACEN) { raiz.NC_ALMACEN.guardar(k, v); return; } try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function leer() { return leerK('nc-galeria-pedidos', []); }
  function escribir(l) { guardarK('nc-galeria-pedidos', l); }
  function ahora() { return new Date(raiz.NC_RELOJ || Date.now()); }   // NC_RELOJ: para probar vencimientos
  function iso() { return ahora().toISOString(); }
  function normal(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 2; }); }
  function mismoNombre(a, b) {
    var x = normal(a), y = normal(b); if (!x.length || !y.length) return false;
    var comunes = x.filter(function (w) { return y.indexOf(w) >= 0; }).length;
    return comunes >= Math.min(2, x.length, y.length);
  }
  function soloDigitos(t) { return String(t || '').replace(/\D/g, '').replace(/^507(?=\d{8}$)/, ''); }
  function base(n) { return String(n).trim().replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[-_ ](editar|edit|edited|editada|final|\d)$/i, '').toUpperCase(); }
  function dinero(x) { return '$' + Number(x || 0).toFixed(2); }
  function primero(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }
  var ACTIVOS = { pagado: 1, edicion: 1 };

  // dirección de la página (en el servidor la pone galeria.gs con CFG.SITE)
  function sitio() { return raiz.NC_SITIO || 'https://ncstudio507.github.io/'; }
  // Zona VIP (solo en el servidor): código para crear el usuario y regalo de bienvenida. En el prototipo no existe.
  function vip() { return raiz.NC_VIP || null; }

  var T = raiz.NC_TIENDA = {
    DIA: DIA, dinero: dinero,
    REGALO: { fotos: 3, descuento: 15 },   // regalo por crear su usuario: 3 fotos gratis en una carrera O 15 % en una sesión
    // ================================================================ precios por carrera (editables en el panel)
    PRECIOS_BASE: { tabla: [3.5, 5, 8, 10], captura: [2.5, 5], patrocinio: { gratis: 3, extra: 5 } },
    precios: function (eventoId) {
      var p = leerK('nc-galeria-precios', {})[eventoId] || {}, b = this.PRECIOS_BASE;
      return { tabla: p.tabla || b.tabla, captura: p.captura || b.captura, patrocinio: p.patrocinio || b.patrocinio, propio: !!leerK('nc-galeria-precios', {})[eventoId] };
    },
    guardarPrecios: function (eventoId, p) { var m = leerK('nc-galeria-precios', {}); if (p) m[eventoId] = p; else delete m[eventoId]; guardarK('nc-galeria-precios', m); },
    // precio de n fotos pagables en esa carrera (sigue = subió la captura; lib = liberada por patrocinio; yaGratis = gratis de patrocinio ya usadas)
    calcular: function (eventoId, n, sigue, lib, yaGratis) {
      if (!n) return 0;
      var P = this.precios(eventoId);
      if (lib) return Math.max(0, n - Math.max(0, P.patrocinio.gratis - (yaGratis || 0))) * P.patrocinio.extra;
      if (sigue) return n === 1 ? P.captura[0] : P.captura[1];
      return P.tabla[Math.min(n, 4) - 1];
    },

    // ================================================================ pedidos
    pedidos: leer,
    pedido: function (ticket) { return leer().filter(function (p) { return p.ticket === ticket; })[0] || null; },
    crear: function (p) {
      var l = leer();
      p.ticket = 'C-' + String(l.length + 1).padStart(4, '0');
      p.creado = iso();
      p.tel = soloDigitos(p.tel);
      p.estado = Number(p.monto) ? 'esperando' : 'pagado';    // sin Yappy no avanza nada
      if (p.captura) p.capturaEstado = 'revisar';               // la PC la lee; si no dice "ncstudio507" + "Siguiendo", la ve Nelson
      l.push(p); escribir(l);
      if (p.estado === 'pagado') this._entrarAFila(p.ticket, null);
      return this.pedido(p.ticket);
    },
    pagado: function (p) { return p.estado !== 'esperando' && p.estado !== 'vencido' && p.estado !== 'pausado'; },
    actualizar: function (ticket, cambios) {
      var l = leer();
      l.forEach(function (p) { if (p.ticket === ticket) Object.keys(cambios).forEach(function (k) { p[k] = cambios[k]; }); });
      escribir(l);
    },
    porTelefono: function (tel) { var t = soloDigitos(tel); return leer().filter(function (p) { return p.tel === t && !p.borrado; }); },

    // ================================================================ fila por carrera (las sesiones nunca tienen fila)
    // turno fijo, como en la panadería: se da al confirmarse el pago y no cambia
    _entrarAFila: function (ticket, y) {
      var p = this.pedido(ticket); if (!p) return;
      var max = 0; leer().forEach(function (q) { if (q.evento === p.evento && q.turno > max) max = q.turno; });
      this.actualizar(ticket, { estado: p.estado === 'pausado' ? 'pagado' : (p.estado === 'esperando' ? 'pagado' : p.estado), pagado: p.pagado || iso(), turno: p.turno || max + 1, yappy: y ? y.ref : (p.yappy || (Number(p.monto) ? 'a mano' : '')) });
      this._avisarPedido(this.pedido(ticket));
    },
    cola: function (eventoId) {
      return leer().filter(function (p) { return ACTIVOS[p.estado] && p.turno && !p.borrado && (!eventoId || p.evento === eventoId); })
        .sort(function (a, b) { return a.evento === b.evento ? a.turno - b.turno : (a.pagado < b.pagado ? -1 : 1); });
    },
    // "NC va por el X": el turno más bajo que todavía no se entrega en esa carrera
    vaPor: function (eventoId) {
      var c = this.cola(eventoId); if (c.length) return c[0].turno;
      var m = 0; leer().forEach(function (p) { if (p.evento === eventoId && p.estado === 'entregado' && p.turno > m) m = p.turno; });
      return m;
    },
    posicion: function (ticket) { var p = this.pedido(ticket); return p && p.turno ? p.turno : 0; },

    // ================================================================ Yappy
    yappys: function () { return leerK('nc-galeria-yappys', []); },
    registrarYappy: function (y) {
      var ys = this.yappys(); y.ref = y.ref || 'Y' + Date.now() + '-' + Math.random().toString(36).slice(2, 7); y.tel = soloDigitos(y.tel); y.monto = Number(y.monto); y.fecha = y.fecha || iso();
      if (ys.some(function (x) { return x.ref === y.ref; })) return { repetido: true };
      var esperan = leer().filter(function (p) { return p.estado === 'esperando' && Math.abs(Number(p.monto) - y.monto) < 0.01; });
      var c = esperan.filter(function (p) { return y.tel && p.tel.slice(-8) === y.tel.slice(-8); });
      if (!c.length) c = esperan.filter(function (p) { return mismoNombre(p.nombre, y.nombre); });
      y.ticket = c.length === 1 ? c[0].ticket : null;
      y.dudas = c.length > 1 ? c.map(function (p) { return p.ticket; }) : !c.length ? esperan.map(function (p) { return p.ticket; }) : [];
      ys.push(y); guardarK('nc-galeria-yappys', ys);
      if (y.ticket) this.confirmarPago(y.ticket, y);
      return y;
    },
    confirmarPago: function (ticket, y) {
      var p = this.pedido(ticket); if (!p || p.estado !== 'esperando') return null;
      if (y) { var ys = this.yappys(); ys.forEach(function (x) { if (x.ref === y.ref) { x.ticket = ticket; x.dudas = []; } }); guardarK('nc-galeria-yappys', ys); }
      if (p.tipo === 'diferencia') {           // pagó lo que faltaba por una captura falsa: el pedido original sigue en la fila
        this.actualizar(ticket, { estado: 'entregado', pagado: iso() });
        this.actualizar(p.de, { estado: 'pagado', capturaEstado: 'pagada-diferencia' });
        this._aviso({ tipo: 'pago', tel: p.tel, texto: '💰 ' + p.nombre + ' pagó la diferencia de ' + dinero(p.monto) + ' (captura) · el ' + p.de + ' sigue en la fila' });
        return p;
      }
      if (p.tipo === 'impresion') { this.actualizar(ticket, { estado: 'pagado', pagado: iso() }); this._avisarImpresion(this.pedido(ticket)); return p; }
      if (p.tipo === 'preventa') { this.actualizar(ticket, { estado: 'pagado', pagado: iso() }); this._avisarPreventa(this.pedido(ticket)); return p; }
      if (p.tipo === 'extras-sesion') { this.actualizar(ticket, { estado: 'pagado', pagado: iso() }); this._aviso({ tipo: 'pago', tel: p.tel, texto: '💰 ' + p.nombre + ' pagó ' + dinero(p.monto) + ' de fotos extra (' + p.eventoNombre + '). Ya puedes editarlas.' }); return p; }
      this._entrarAFila(ticket, y);
      return this.pedido(ticket);
    },

    // ================================================================ captura de "sigo a NC"
    // la PC la lee (RapidOCR): con "ncstudio507" y "Siguiendo" se aprueba sola; si no, la revisa Nelson
    revisarCaptura: function (ticket, ok) {
      var p = this.pedido(ticket); if (!p) return;
      if (ok) { this.actualizar(ticket, { capturaEstado: 'ok' }); return; }
      // falsa: se cobra la diferencia y el pedido se pausa (no avanza en la fila) hasta que pague
      var lleno = this.calcular(p.evento, p.fotos.length - (p.gratis || []).length - (p.regaloFotos || []).length, false, false), dif = Math.max(0, lleno - Number(p.monto));
      this.actualizar(ticket, { capturaEstado: 'falsa', estado: dif ? 'pausado' : p.estado });
      if (dif) {
        var d = this.crear({ tipo: 'diferencia', de: ticket, evento: p.evento, eventoNombre: p.eventoNombre, nombre: p.nombre, tel: p.tel, correo: p.correo, fotos: [], gratis: [], monto: dif });
        this._mensajeCliente(p, 'Hola ' + primero(p.nombre) + ', revisamos tu captura y no se ve que sigas a @ncstudio507. Para seguir con tu pedido ' + ticket + ' te falta pagar ' + dinero(dif) + ' por Yappy. ¡Gracias por confiar en nosotros!');
        return d;
      }
    },

    // ================================================================ vencimientos (los corre la tarea de Necty; aquí se simulan)
    // pedido sin pagar: recordatorio al día 6, se cancela al día 7 (el contacto queda)
    // fotos editadas: disponibles 90 días; recordatorio 7 días antes (al cliente y a Nelson)
    revisarVencimientos: function () {
      var yo = this, t = ahora().getTime(), cambios = 0;
      leer().forEach(function (p) {
        var c = new Date(p.creado).getTime();
        if (p.estado === 'esperando') {
          if (t - c >= 7 * DIA) {
            yo.actualizar(p.ticket, { estado: 'vencido', vencido: iso() }); cambios++;
            if ((p.regaloFotos || []).length && vip()) try { vip().devolverRegalo(p.tel, p.ticket); } catch (e) {}   // su regalo vuelve a estar disponible
            yo._aviso({ tipo: 'vencido', tel: p.tel, texto: '⌛ Se venció el pedido ' + p.ticket + ' de ' + p.nombre + ' (no pagó en 7 días). El contacto queda guardado.' });
          }
          else if (t - c >= 6 * DIA && !p.recordado) { yo.actualizar(p.ticket, { recordado: iso() }); cambios++; yo._mensajeCliente(p, 'Hola ' + primero(p.nombre) + ' 👋 tu pedido ' + p.ticket + ' de ' + p.eventoNombre + ' vence mañana. Si lo quieres, paga ' + dinero(p.monto) + ' por Yappy y entra a la fila de edición. ¡Gracias por confiar en nosotros!'); }
        }
        if (p.estado === 'entregado' && p.entregado && p.tipo !== 'diferencia') {
          var e = new Date(p.entregado).getTime();
          if (t - e >= 90 * DIA && !p.expirado) { yo.actualizar(p.ticket, { expirado: iso() }); cambios++; yo._aviso({ tipo: 'vencido', tel: p.tel, texto: '🗂 Se vencieron las fotos de ' + p.nombre + ' (' + p.ticket + ', ' + p.eventoNombre + '): ya no se ven en Mis fotos. Siguen en tu Drive.' }); }
          else if (t - e >= 83 * DIA && !p.avisado90) {
            yo.actualizar(p.ticket, { avisado90: iso() }); cambios++;
            yo._mensajeCliente(p, 'Hola ' + primero(p.nombre) + ' 📸 tus fotos de ' + p.eventoNombre + ' se vencen en 7 días. Descárgalas en tu Zona VIP: ' + sitio() + 'vip.html');
            yo._aviso({ tipo: 'vence', tel: p.tel, texto: '⏳ A ' + p.nombre + ' se le vencen las fotos en 7 días (' + p.ticket + ', ' + p.eventoNombre + ').', wa: 'https://wa.me/507' + p.tel });
          }
        }
      });
      return cambios;
    },
    disponibleHasta: function (p) { return p.entregado ? new Date(new Date(p.entregado).getTime() + 90 * DIA) : null; },

    // ================================================================ avisos de Necty a Nelson (uno por persona)
    // cada aviso lleva un link que pasa por ir.html: anota que Nelson abrió el chat y abre WhatsApp con el saludo escrito
    avisos: function () { return leerK('nc-galeria-avisos', []); },
    _aviso: function (a) {
      var l = this.avisos(); a.id = 'A' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); a.fecha = iso();
      l.push(a); guardarK('nc-galeria-avisos', l);
      if (raiz.NC_NOVEDAD) try { raiz.NC_NOVEDAD(a); } catch (e) {}   // en el Apps Script: va a la hoja «Novedades» que lee Necty
      return a;
    },
    marcarAbierto: function (id) { var l = this.avisos(); l.forEach(function (a) { if (a.id === id) a.abierto = iso(); }); guardarK('nc-galeria-avisos', l); },
    sinAbrir: function () {
      var yo = this;
      return this.avisos().filter(function (a) { return a.saludo && !a.abierto && !a.borrado; })
        .map(function (a) { return { a: a, p: yo.pedido(a.ticket) }; })
        .sort(function (x, y) { return ((x.p && x.p.turno) || 999) - ((y.p && y.p.turno) || 999); });
    },
    // saludo que el corredor recibe: SIEMPRE con el nombre que puso en la página (nunca el del contacto)
    // inv: la invitación a la Zona VIP (con el código para crear su usuario) que se agrega al final
    saludo: function (p, inv) {
      var n = p.fotos.length, g = this.grupoDe(p.tel), frase = g ? this.fraseGrupo(g) : '';
      return '¡Hola ' + primero(p.nombre) + '! 👋 Soy Nelson de NC Studio 📸 Ya me llegó tu pedido de ' + n + (n === 1 ? ' foto' : ' fotos') + ' de la ' + p.eventoNombre +
        ' (ticket ' + p.ticket + '). ' + (this.vaPor(p.evento) >= p.turno ? '¡Ya voy con tu pedido!' : 'Tu turno es el ' + p.turno + ' y voy por el ' + this.vaPor(p.evento) + '; te aviso apenas estén listas.') + ' ' + (frase ? frase + ' ' : '') + '¡Gracias por confiar en nosotros! 🧡' +
        (inv && inv.codigo ? '\n\n🔐 Crea tu usuario en la Zona VIP de NC Studio: ahí ves tu turno y descargas tus fotos editadas.\n👉 ' + inv.link + (p.cortesia ? '&r=0' : '') + '\nTu código: ' + inv.codigo + ' (vale ' + inv.dias + ' días)' +
          (p.cortesia ? '' : '\n🎁 Al crearlo te ganas un regalo de bienvenida para la próxima vez.')   // con código de cortesía no hay regalo (Nelson 23-11)
          : inv && inv.cuenta ? '\n\nTus fotos te llegan a tu Zona VIP 👑 ' + inv.link + ' (entras con tu número y tu contraseña).' : '');
    },
    // si no tiene usuario en la Zona VIP, el servidor crea un código y va en el WhatsApp del pedido
    invitarVip: function (p, forzar) {
      if (!vip() || !p.tel) return null;
      try { return vip().invitar(p.tel, p.nombre, p.correo, !!forzar); } catch (e) { return null; }
    },
    _avisarPedido: function (p) {
      var k = this.contactoDe(p.tel), n = p.fotos.length;
      var quien = k ? k.nombre + (k.nombre.toLowerCase() !== p.nombre.toLowerCase() ? ' (en la página puso «' + p.nombre + '»)' : '') : p.nombre + ' (' + p.tel + ')';
      var g = this.grupoDe(p.tel), inv = this.invitarVip(p);
      return this._aviso({ tipo: 'pedido', ticket: p.ticket, tel: p.tel, contacto: !!k, saludo: this.saludo(p, inv),
        texto: (Number(p.monto) ? '💰 ' : p.cortesia ? '🎟 ' : '🎁 ') + quien + (g ? ' · ' + g : '') + ' escogió ' + n + (n === 1 ? ' foto' : ' fotos') + ' de ' + p.eventoNombre +
          (Number(p.monto) ? ' y pagó ' + dinero(p.monto) + ' por Yappy' : p.cortesia ? ' · 🎟 GRATIS con tu código ' + p.cortesia : p.patrocinio ? ' (gratis por patrocinio' + (p.patrocinio !== 'sí' ? ' de ' + p.patrocinio : '') + ')' : ' (gratis)') +
          ((p.regaloFotos || []).length ? ' · 🎁 usó su regalo (' + p.regaloFotos.length + ' gratis)' : '') +
          (p.captura ? ' · 📸 con captura' : '') + '\n🎟 Turno ' + p.turno + ' · vas por el ' + this.vaPor(p.evento) + (k ? '' : '\n🆕 No lo tienes en tus contactos') +
          (inv && inv.codigo ? '\n🔐 El mensaje lleva su código para crear su usuario' : '') });
    },
    // panel de Nelson: código nuevo para alguien que lo perdió o se le venció (te devuelve el mensaje listo para WhatsApp)
    codigoVip: function (tel, nombre) {
      var t = soloDigitos(tel); if (t.length < 7) return { ok: false, title: 'Ese número no está completo' };
      var inv = this.invitarVip({ tel: t, nombre: nombre || '' }, true);
      if (!inv || !inv.codigo) return { ok: false, title: 'La Zona VIP solo funciona en la página real' };
      var texto = '¡Hola ' + primero(nombre) + '! 👋 Este es tu código para ' + (inv.cuenta ? 'crear una contraseña nueva' : 'crear tu usuario') + ' en la Zona VIP de NC Studio:\n👉 ' + inv.link + '\nTu código: ' + inv.codigo + ' (vale ' + inv.dias + ' días)' + (inv.cuenta ? '' : '\n🎁 Al crearlo te ganas un regalo de bienvenida.');
      return { ok: true, codigo: inv.codigo, texto: texto, wa: 'https://wa.me/507' + t + '?text=' + encodeURIComponent(texto) };
    },
    // link para WhatsApp con el saludo ya escrito (lo usa ir.html)
    linkWa: function (a) { return 'https://wa.me/507' + a.tel + (a.saludo ? '?text=' + encodeURIComponent(a.saludo) : ''); },
    // mensajes que Necty le manda al CLIENTE (recordatorios). En el prototipo se guardan para verlos en el panel.
    mensajesCliente: function () { return leerK('nc-galeria-msj-clientes', []); },
    // Necty le escribe a NELSON (no a los clientes): cada mensaje para un cliente le llega a Nelson como aviso
    // con el texto ya escrito; Nelson toca «Escríbele» y lo manda desde su WhatsApp.
    _mensajeCliente: function (p, texto) {
      var l = this.mensajesCliente(); l.push({ fecha: iso(), tel: p.tel, nombre: p.nombre, ticket: p.ticket, texto: texto }); guardarK('nc-galeria-msj-clientes', l);
      if (p.tel) this._aviso({ tipo: 'cliente', ticket: p.ticket, tel: p.tel, saludo: texto, texto: '📨 Para ' + p.nombre + ' (' + p.tel + '): ' + texto.slice(0, 90) + (texto.length > 90 ? '…' : '') });
    },

    // ================================================================ grupos de clientes (Leones, Runners Chitré…)
    // Claude escribe la frase base con el contexto que da Nelson; Necty la varía (en el prototipo se usa la base)
    grupos: function () { return leerK('nc-galeria-grupos', {}); },
    guardarGrupo: function (nombre, datos) { var m = this.grupos(); if (datos === null) delete m[nombre]; else m[nombre] = datos; guardarK('nc-galeria-grupos', m); },
    grupoDe: function (tel) { return leerK('nc-galeria-grupo-de', {})[soloDigitos(tel)] || ''; },
    ponerGrupo: function (tel, grupo) { var m = leerK('nc-galeria-grupo-de', {}); if (grupo) m[soloDigitos(tel)] = grupo; else delete m[soloDigitos(tel)]; guardarK('nc-galeria-grupo-de', m); },
    fraseGrupo: function (g) { var d = this.grupos()[g]; return d && d.frase ? d.frase : '¡Qué buena carrera hicieron! 🔥'; },

    // ================================================================ entrega
    base: base,
    cruzar: function (eventoId, nombres, link) {
      var hay = {}; nombres.forEach(function (n) { if (n.trim()) hay[base(n)] = n.trim(); });
      return leer().filter(function (p) { return p.evento === eventoId && ACTIVOS[p.estado] && p.turno && !p.borrado; }).map(function (p) {
        var faltan = p.fotos.filter(function (f) { return !hay[base(f)]; });
        var archivos = p.fotos.filter(function (f) { return hay[base(f)]; }).map(function (f) { return { original: f, editada: hay[base(f)] }; });
        return { pedido: p, faltan: faltan, completo: faltan.length === 0 && p.fotos.length > 0, link: link, archivos: archivos };
      });
    },
    entregar: function (ticket, link, archivos) {
      this.actualizar(ticket, { estado: 'entregado', entrega: link, editadas: archivos, entregado: iso() });
      var p = this.pedido(ticket);
      this._mensajeCliente(p, '¡Hola ' + primero(p.nombre) + '! 📸 Tus fotos editadas de ' + p.eventoNombre + ' ya están listas (ticket ' + p.ticket + '). Velas y descárgalas en buena calidad en tu Zona VIP: ' + sitio() + 'vip.html (Mis fotos de carreras). Quedan disponibles 90 días. ¡Gracias por confiar en nosotros! 🧡');
    },

    // ================================================================ grupales y álbumes de grupo
    esGrupal: function (eventoId, nombre, defecto) {
      if (this.albumDe(eventoId, nombre)) return true;
      var m = this.marcasGrupales()[eventoId] || {};
      return nombre in m ? m[nombre] : defecto;
    },
    marcasGrupales: function () { return leerK('nc-galeria-grupales', {}); },
    marcarGrupal: function (eventoId, nombre, valor) { var m = this.marcasGrupales(); m[eventoId] = m[eventoId] || {}; m[eventoId][nombre] = valor; guardarK('nc-galeria-grupales', m); },
    albumes: function (eventoId) { return (leerK('nc-galeria-albumes', {})[eventoId]) || []; },
    _guardarAlbumes: function (eventoId, l) { var m = leerK('nc-galeria-albumes', {}); m[eventoId] = l; guardarK('nc-galeria-albumes', m); },
    crearAlbum: function (eventoId, nombre) {
      var l = this.albumes(eventoId), id = String(nombre).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'grupo';
      var b = id, i = 2; while (l.some(function (a) { return a.id === id; })) id = b + '-' + i++;
      l.push({ id: id, nombre: String(nombre).trim(), fotos: [], privado: false }); this._guardarAlbumes(eventoId, l);
      return id;
    },
    cambiarAlbum: function (eventoId, id, cambios) { var l = this.albumes(eventoId); l.forEach(function (a) { if (a.id === id) Object.keys(cambios).forEach(function (k) { a[k] = cambios[k]; }); }); this._guardarAlbumes(eventoId, l); },
    borrarAlbum: function (eventoId, id) { var a = this.albumes(eventoId).filter(function (x) { return x.id === id; })[0]; if (a) this._papelera('album', a.nombre, { eventoId: eventoId, album: a }); this._guardarAlbumes(eventoId, this.albumes(eventoId).filter(function (x) { return x.id !== id; })); },
    albumDe: function (eventoId, foto) { return this.albumes(eventoId).filter(function (a) { return a.fotos.indexOf(foto) >= 0; })[0] || null; },
    ponerEnAlbum: function (eventoId, foto, albumId) {
      var l = this.albumes(eventoId);
      l.forEach(function (a) { a.fotos = a.fotos.filter(function (n) { return n !== foto; }); if (a.id === albumId) a.fotos.push(foto); });
      this._guardarAlbumes(eventoId, l);
    },

    // ================================================================ clientes (base de datos) y posibles clientes
    clientes: function () {
      var por = {}, yo = this;
      leer().forEach(function (p) {
        if (p.borrado || !p.tel || p.tipo === 'diferencia') return;
        var c = por[p.tel] = por[p.tel] || { tel: p.tel, nombre: p.nombre, correo: p.correo, caras: [], dorsales: [], eventos: [], pedidos: 0, gastado: 0, fotos: 0, ultimo: p.creado };
        c.nombre = p.nombre; c.correo = p.correo || c.correo; c.pedidos++; if (yo.pagado(p)) c.gastado += Number(p.monto); c.fotos += (p.fotos || []).length;
        if (p.creado > c.ultimo) c.ultimo = p.creado;
        if (p.cara && c.caras.indexOf(p.cara) < 0) c.caras.push(p.cara);
        if (p.dorsal && c.dorsales.indexOf(p.dorsal) < 0) c.dorsales.push(p.dorsal);
        if (p.eventoNombre && c.eventos.indexOf(p.eventoNombre) < 0) c.eventos.push(p.eventoNombre);
      });
      return Object.keys(por).map(function (k) { var c = por[k]; c.grupo = yo.grupoDe(c.tel); return c; }).sort(function (a, b) { return a.ultimo < b.ultimo ? 1 : -1; });
    },
    posibles: function () { return leerK('nc-galeria-posibles', []).filter(function (x) { return !x.borrado; }); },
    registrarPosible: function (nombre, tel, origen) {
      var l = leerK('nc-galeria-posibles', []), t = soloDigitos(tel), x = l.filter(function (y) { return y.tel === t; })[0];
      if (x) { if (x.origenes.indexOf(origen) < 0) x.origenes.push(origen); x.nombre = nombre || x.nombre; x.ultimo = iso(); }
      else l.push({ tel: t, nombre: nombre, origenes: [origen], primero: iso(), ultimo: iso() });
      guardarK('nc-galeria-posibles', l);
    },
    contactos: function () { return leerK('nc-galeria-contactos', []); },
    guardarContactos: function (l) { guardarK('nc-galeria-contactos', l); },
    contactoDe: function (tel) {
      var t = soloDigitos(tel).slice(-8); if (t.length < 7) return null;
      return this.contactos().filter(function (c) { return c.tels.some(function (x) { return x.slice(-8) === t; }); })[0] || null;
    },
    soloDigitos: soloDigitos,

    // ================================================================ patrocinio (Nelson lo prende a mano)
    liberado: function (eventoId) { return leerK('nc-galeria-liberados', {})[eventoId] || null; },
    liberar: function (eventoId, patrocinador) {
      var m = leerK('nc-galeria-liberados', {});
      if (patrocinador === false) delete m[eventoId]; else m[eventoId] = { patrocinador: patrocinador || '', desde: iso() };
      guardarK('nc-galeria-liberados', m);
    },
    // gratis de patrocinio ya usadas por ese celular en esa carrera
    gratisUsadas: function (eventoId, tel) { var t = soloDigitos(tel), n = 0; leer().forEach(function (q) { if (q.evento === eventoId && q.tel === t && q.patrocinio && q.estado !== 'vencido') n += q.gratisPatrocinio || 0; }); return n; },

    // ================================================================ preventas con paquetes por carrera
    preventas: function () { return leerK('nc-galeria-preventas', []).filter(function (x) { return !x.borrado; }); },
    preventa: function (id) { return this.preventas().filter(function (x) { return x.id === id; })[0] || null; },
    guardarPreventa: function (pv) {
      var l = leerK('nc-galeria-preventas', []);
      if (!pv.id) { pv.id = 'pv-' + String(pv.nombre).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 6); pv.creada = iso(); pv.abierta = true; l.push(pv); }
      else l = l.map(function (x) { return x.id === pv.id ? pv : x; });
      guardarK('nc-galeria-preventas', l); return pv;
    },
    preventaAbierta: function (pv) { return pv && pv.abierta && (!pv.hasta || ahora() <= new Date(pv.hasta + 'T23:59:59')); },
    comprarPreventa: function (pvId, paqueteIdx, datos) {
      var pv = this.preventa(pvId), q = pv.paquetes[paqueteIdx];
      return this.crear({ tipo: 'preventa', preventa: pvId, paquete: q, evento: pv.evento || '', eventoNombre: pv.nombre, nombre: datos.nombre, tel: datos.tel, correo: datos.correo || '', dorsal: datos.dorsal, fotos: [], gratis: [], monto: q.precio });
    },
    _avisarPreventa: function (p) {
      this._aviso({ tipo: 'preventa', ticket: p.ticket, tel: p.tel, saludo: '¡Hola ' + primero(p.nombre) + '! 👋 Soy Nelson de NC Studio 📸 Ya quedó tu preventa de ' + p.eventoNombre + ' (' + p.paquete.nombre + ', dorsal ' + p.dorsal + '). Cuando salgan las fotos te las asigno y te aviso. ¡Gracias por confiar en nosotros! 🧡',
        texto: '🎟 Preventa: ' + p.nombre + ' (' + p.tel + ') pagó ' + dinero(p.monto) + ' · ' + p.paquete.nombre + ' · dorsal ' + p.dorsal + ' · ' + p.eventoNombre });
    },
    // al procesar el álbum: cada preventa pagada recibe sus fotos por dorsal (o rostro) y entra a la fila
    // paquete "todas" = todas las de UNA persona; paquete de N = queda "por elegir" N fotos
    asignarPreventas: function (E) {
      var yo = this, hechas = [];
      leer().filter(function (p) { return p.tipo === 'preventa' && p.estado === 'pagado' && !p.asignada && p.evento === E.id; }).forEach(function (p) {
        var c = E.corredores.filter(function (x) { return x.dorsal && +x.dorsal === +p.dorsal; })[0];
        var suyas = c ? E.fotos.filter(function (f) { return (f.corredores || []).indexOf(c.id) >= 0; }).map(function (f) { return f.nombre; }) : [];
        var todas = !p.paquete.fotos;
        yo.actualizar(p.ticket, { asignada: iso(), corredor: c ? c.id : null, cara: c ? c.cara : null, fotos: todas ? suyas : [], porElegir: todas ? 0 : p.paquete.fotos, estado: todas ? 'pagado' : 'elegir' });
        if (todas && suyas.length) yo._entrarAFila(p.ticket, null);
        hechas.push({ ticket: p.ticket, nombre: p.nombre, dorsal: p.dorsal, fotos: suyas.length, encontrado: !!c, todas: todas });
      });
      return hechas;
    },
    // el de paquete de N fotos elige las suyas (cualquiera del álbum)
    elegirPreventa: function (ticket, fotos) { this.actualizar(ticket, { fotos: fotos, porElegir: 0, estado: 'pagado' }); this._entrarAFila(ticket, null); },
    // "Esta también es mía": queda pendiente y le llega a Nelson por WhatsApp para revisar
    reclamos: function () { return leerK('nc-galeria-reclamos', []); },
    reclamar: function (ticket, foto) {
      var p = this.pedido(ticket), l = this.reclamos();
      if (l.some(function (r) { return r.ticket === ticket && r.foto === foto; })) return;
      l.push({ id: 'R' + Date.now().toString(36), ticket: ticket, foto: foto, estado: 'pendiente', fecha: iso() }); guardarK('nc-galeria-reclamos', l);
      this._aviso({ tipo: 'reclamo', ticket: ticket, tel: p.tel, texto: '🙋 ' + p.nombre + ' (turno ' + (p.turno || '—') + ', paquete «todas») reclama la foto ' + foto + ' como suya. Revísala en el panel → Reclamos.' });
    },
    resolverReclamo: function (id, aprobado) {
      var l = this.reclamos(), r = l.filter(function (x) { return x.id === id; })[0]; if (!r) return;
      r.estado = aprobado ? 'aprobado' : 'rechazado'; guardarK('nc-galeria-reclamos', l);
      var p = this.pedido(r.ticket);
      if (aprobado) this.actualizar(r.ticket, { fotos: p.fotos.concat([r.foto]) });
      this._mensajeCliente(p, aprobado ? '¡Listo ' + primero(p.nombre) + '! La foto ' + r.foto + ' ya está en tu pedido 📸' : 'Hola ' + primero(p.nombre) + ', revisamos la foto ' + r.foto + ' y no eres tú 🙈 Si la quieres, la puedes agregar como foto extra.');
    },

    // ================================================================ impresiones (catálogo de la página; en carreras, solo después de entregar)
    CATALOGO: [{ id: '4x6', nombre: 'Foto impresa 4×6', precio: 3.5 }, { id: '5x7', nombre: 'Foto impresa 5×7', precio: 5 }, { id: '8x10', nombre: 'Foto impresa 8×10', precio: 8 },
      { id: '11x17', nombre: 'Foto impresa 11×17', precio: 12 }, { id: 'cartera', nombre: 'Juego de 6 fotos tamaño cartera', precio: 5 }, { id: 'marco', nombre: 'Fotografía enmarcada 16×20', precio: 70 },
      { id: 'album', nombre: 'Álbum fotográfico (20 páginas)', precio: 90, porPedido: true }, { id: 'usb', nombre: 'USB con fotografías', precio: 25, porPedido: true }],
    pedirImpresion: function (datos) {
      var total = 0, yo = this; datos.items.forEach(function (it) { var c = yo.CATALOGO.filter(function (x) { return x.id === it.producto; })[0]; it.nombre = c.nombre; it.precio = c.precio; total += c.precio * it.cant; });
      return this.crear({ tipo: 'impresion', de: datos.de || '', sesion: datos.sesion || '', evento: datos.evento || '', eventoNombre: datos.eventoNombre, nombre: datos.nombre, tel: datos.tel, correo: datos.correo || '', fotos: [], items: datos.items, gratis: [], monto: total });
    },
    _avisarImpresion: function (p) {
      this._aviso({ tipo: 'impresion', ticket: p.ticket, tel: p.tel, saludo: '¡Hola ' + primero(p.nombre) + '! 👋 Soy Nelson de NC Studio 🖼️ Ya me llegó tu pedido de impresiones (' + p.ticket + '). Te escribo para coordinar la entrega. ¡Gracias por confiar en nosotros! 🧡',
        texto: '🖼️ ' + p.nombre + ' (' + p.tel + ') pidió impresiones de ' + p.eventoNombre + ' y pagó ' + dinero(p.monto) + ':\n' + p.items.map(function (it) { return '• ' + it.cant + ' × ' + it.nombre + ' — ' + it.foto; }).join('\n') });
    },

    // ================================================================ papelera (solo Nelson, con PIN; 30 días para deshacer)
    papelera: function () { var t = ahora().getTime(); return leerK('nc-galeria-papelera', []).filter(function (x) { return t - new Date(x.fecha).getTime() < 30 * DIA; }); },
    _papelera: function (tipo, titulo, datos) { var l = leerK('nc-galeria-papelera', []); l.push({ id: 'P' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), tipo: tipo, titulo: titulo, datos: datos, fecha: iso() }); guardarK('nc-galeria-papelera', l); },
    borrar: function (tipo, id) {
      if (tipo === 'pedido') { var p = this.pedido(id); if (!p) return; this._papelera('pedido', p.ticket + ' · ' + p.nombre, p); this.actualizar(id, { borrado: iso() }); }
      if (tipo === 'cliente') {   // borra sus datos personales en todos sus pedidos (Ley 81); las ventas quedan sin nombre
        var t = soloDigitos(id), suyos = leer().filter(function (q) { return q.tel === t; }); if (!suyos.length) return;
        this._papelera('cliente', suyos[0].nombre + ' · ' + t, suyos.map(function (q) { return { ticket: q.ticket, nombre: q.nombre, tel: q.tel, correo: q.correo, cara: q.cara, dorsal: q.dorsal }; }));
        var yo = this; suyos.forEach(function (q) { yo.actualizar(q.ticket, { nombre: 'Cliente borrado', tel: '', correo: '', cara: null, dorsal: '', borradoCliente: iso() }); });
        this.ponerGrupo(t, '');
      }
      if (tipo === 'yappy') { var ys = this.yappys(), y = ys.filter(function (x) { return x.ref === id; })[0]; if (y) { this._papelera('yappy', dinero(y.monto) + ' · ' + (y.nombre || ''), y); guardarK('nc-galeria-yappys', ys.filter(function (x) { return x.ref !== id; })); } }
      if (tipo === 'aviso') { var av = this.avisos(); av.forEach(function (a) { if (a.id === id) a.borrado = iso(); }); guardarK('nc-galeria-avisos', av); }
      if (tipo === 'posible') { var ps = leerK('nc-galeria-posibles', []), x = ps.filter(function (z) { return z.tel === id; })[0]; if (x) { this._papelera('posible', x.nombre + ' · ' + x.tel, x); guardarK('nc-galeria-posibles', ps.filter(function (z) { return z.tel !== id; })); } }
      if (tipo === 'preventa') { var pvs = leerK('nc-galeria-preventas', []); pvs.forEach(function (z) { if (z.id === id) z.borrado = iso(); }); guardarK('nc-galeria-preventas', pvs); this._papelera('preventa', id, { id: id }); }
      if (tipo === 'evento') { var oc = leerK('nc-galeria-eventos-ocultos', []); if (oc.indexOf(id) < 0) oc.push(id); guardarK('nc-galeria-eventos-ocultos', oc); this._papelera('evento', id, { id: id }); }
    },
    eventoOculto: function (id) { return leerK('nc-galeria-eventos-ocultos', []).indexOf(id) >= 0; },
    restaurar: function (pid) {
      var l = leerK('nc-galeria-papelera', []), x = l.filter(function (z) { return z.id === pid; })[0]; if (!x) return;
      var yo = this;
      if (x.tipo === 'pedido') this.actualizar(x.datos.ticket, { borrado: null });
      if (x.tipo === 'cliente') x.datos.forEach(function (d) { yo.actualizar(d.ticket, { nombre: d.nombre, tel: d.tel, correo: d.correo, cara: d.cara, dorsal: d.dorsal, borradoCliente: null }); });
      if (x.tipo === 'yappy') { var ys = this.yappys(); ys.push(x.datos); guardarK('nc-galeria-yappys', ys); }
      if (x.tipo === 'posible') { var ps = leerK('nc-galeria-posibles', []); ps.push(x.datos); guardarK('nc-galeria-posibles', ps); }
      if (x.tipo === 'album') { var al = this.albumes(x.datos.eventoId); al.push(x.datos.album); this._guardarAlbumes(x.datos.eventoId, al); }
      if (x.tipo === 'preventa') { var pvs = leerK('nc-galeria-preventas', []); pvs.forEach(function (z) { if (z.id === x.datos.id) z.borrado = null; }); guardarK('nc-galeria-preventas', pvs); }
      if (x.tipo === 'evento') guardarK('nc-galeria-eventos-ocultos', leerK('nc-galeria-eventos-ocultos', []).filter(function (z) { return z !== x.datos.id; }));
      guardarK('nc-galeria-papelera', l.filter(function (z) { return z.id !== pid; }));
    },

    // ================================================================ sesiones (Zona VIP, privadas, sin fila)
    // una lista de ♡ por celular; la de la dueña (su celular está en la reserva) es la oficial
    listasSesion: function (id) { return leerK('nc-sesion-listas', {})[id] || {}; },
    listaSesion: function (id, tel) { return this.listasSesion(id)[soloDigitos(tel)] || { nombre: '', fotos: [], notas: {}, enviada: null }; },
    guardarListaSesion: function (id, tel, lista) { var m = leerK('nc-sesion-listas', {}); m[id] = m[id] || {}; m[id][soloDigitos(tel)] = lista; guardarK('nc-sesion-listas', m); },
    // compatibilidad: la selección oficial (la de la dueña)
    selSesion: function (id) {
      var S = (raiz.NC_SESIONES || []).filter(function (x) { return x.id === id; })[0];
      return S && S.tel ? this.listaSesion(id, S.tel) : { fotos: [], notas: {}, enviada: null };
    },
    plazoSesion: function (S) {
      var ext = leerK('nc-sesion-extension', {})[S.id] || 0, desde = new Date((S.pruebasDesde || S.fecha) + 'T12:00:00');
      return new Date(desde.getTime() + (3 + ext) * DIA);
    },
    extenderSesion: function (id, dias) { var m = leerK('nc-sesion-extension', {}); m[id] = (m[id] || 0) + dias; guardarK('nc-sesion-extension', m); },
    enviarSelSesion: function (S, tel) {
      var L = this.listaSesion(S.id, tel); L.enviada = iso(); this.guardarListaSesion(S.id, tel, L);
      var inc = S.incluidas || 0, n = L.fotos.length, extra = inc ? Math.max(0, n - inc) : 0, notas = Object.keys(L.notas || {}).filter(function (k) { return L.notas[k]; }).length;
      if (extra) this.crear({ tipo: 'extras-sesion', sesion: S.id, eventoNombre: S.sesion, nombre: S.cliente, tel: S.tel, fotos: [], gratis: [], monto: extra * 10 });
      this._aviso({ tipo: 'sesion', sesion: S.id, tel: S.tel || '', saludo: '¡Hola ' + primero(S.cliente) + '! 👋 Ya me llegó tu selección (' + n + ' fotos). Empiezo a editarlas. ¡Gracias por confiar en nosotros! 🧡',
        texto: '❤ ' + S.cliente + ' eligió ' + n + (n === 1 ? ' foto' : ' fotos') + ' de prueba de ' + S.sesion + (inc ? ' (' + inc + ' incluidas' + (extra ? ' + ' + extra + ' extra = $' + (extra * 10) + ', cobro por Yappy enviado' : '') + ')' : '') + (notas ? ' · ' + notas + ' con nota' : '') });
      return L;
    },
    revisarPlazosSesiones: function () {
      var yo = this, t = ahora().getTime(), m = leerK('nc-sesion-recordatorios', {});
      (raiz.NC_SESIONES || []).forEach(function (S) {
        if (!S.pruebas || !S.tel || yo.selSesion(S.id).enviada) return;
        var fin = yo.plazoSesion(S).getTime(), r = m[S.id] = m[S.id] || {};
        if (t >= fin && !r.vencio) { r.vencio = iso(); yo._aviso({ tipo: 'sesion', sesion: S.id, tel: S.tel, texto: '⌛ ' + S.cliente + ' no eligió sus fotos de prueba (' + S.sesion + '). Dale más tiempo desde el panel → Sesiones.' }); }
        else if (t >= fin - DIA && !r.ultimo) { r.ultimo = iso(); yo._mensajeCliente({ tel: S.tel, nombre: S.cliente, ticket: S.id }, 'Hola ' + primero(S.cliente) + ' 💛 hoy es el último día para elegir tus fotos de prueba. Entra a tu Zona VIP y toca «Enviar a Nelson».'); }
        else if (t >= fin - 2 * DIA && !r.dia2) { r.dia2 = iso(); yo._mensajeCliente({ tel: S.tel, nombre: S.cliente, ticket: S.id }, 'Hola ' + primero(S.cliente) + ' 📸 ¿ya viste tus fotos de prueba? Te queda hasta mañana para elegirlas en tu Zona VIP.'); }
      });
      guardarK('nc-sesion-recordatorios', m);
    },

    // ================================================================ funciones PÚBLICAS (las únicas que la página pública puede pedirle al servidor)
    // El servidor recalcula todo (precio, gratis, corredor): lo que mande el teléfono no se cree a ciegas.
    eventos: function () { return raiz.NC_EVENTOS || leerK('nc-eventos', []); },
    evento: function (id) { return this.eventos().filter(function (e) { return e.id === id; })[0] || null; },
    pedidoCarrera: function (eventoId, d) {
      var E = this.evento(eventoId); if (!E) return { ok: false, title: 'No encontramos ese álbum' };
      var yo = this, porNombre = {}; E.fotos.forEach(function (f) { porNombre[f.nombre] = f; });
      var fotos = (d.fotos || []).filter(function (n, i, a) { return porNombre[n] && a.indexOf(n) === i; });
      if (!fotos.length) return { ok: false, title: 'Elige al menos una foto' };
      var tel = soloDigitos(d.tel); if (tel.length < 7 || !String(d.nombre || '').trim()) return { ok: false, title: 'Faltan tu nombre o tu celular' };
      var gratis = fotos.filter(function (n) { return yo.esGrupal(E.id, n, !!porNombre[n].grupal); }), pag = fotos.filter(function (n) { return gratis.indexOf(n) < 0; });
      var lib = this.liberado(E.id), P = this.precios(E.id), yaUso = lib ? this.gratisUsadas(E.id, tel) : 0;
      var cap = lib ? null : (d.captura || null);
      // regalo de bienvenida de la Zona VIP: las primeras 3 fotos pagables salen gratis (no aplica con patrocinio).
      // Solo en carreras DESPUÉS del día en que creó su usuario: no en la carrera de la que pidió fotos al crearlo.
      // código de cortesía (Nelson, 23-11-2026): con un código «Fotos gratis» activo, TODAS las fotos salen gratis.
      // Igual entran a la fila de edición y se descargan editadas (nada sin editar se descarga). No gasta el regalo VIP.
      var cort = null;
      if (String(d.codigo || '').trim()) { cort = this.codigoFotos(d.codigo); if (!cort.ok) return { ok: false, title: cort.title }; cap = null; }
      var regalo = [];
      if (d.regalo && !cort && !lib && pag.length && vip()) { var est = ''; try { est = vip().regalo(tel, E.fecha); } catch (e) {} if (est === 'disponible') regalo = pag.slice(0, this.REGALO.fotos); }
      var monto = cort ? 0 : this.calcular(E.id, pag.length - regalo.length, !!cap, !!lib, yaUso);
      // a qué corredor pertenece: el dorsal que escribió, o la cara que más sale en sus fotos
      var c = null, dor = String(d.dorsal || '').replace(/\D/g, '');
      if (dor) c = E.corredores.filter(function (x) { return x.dorsal && +x.dorsal === +dor; })[0] || null;
      if (!c) { var cu = {}; pag.forEach(function (n) { (porNombre[n].corredores || []).forEach(function (x) { cu[x] = (cu[x] || 0) + 1; }); }); var m = Object.keys(cu).sort(function (a, b) { return cu[b] - cu[a]; })[0]; c = E.corredores.filter(function (x) { return x.id === m; })[0] || null; }
      // el regalo se marca usado ANTES de crear el pedido (si el pedido entra gratis, el aviso ya sale con él)
      var ticketNuevo = 'C-' + String(leer().length + 1).padStart(4, '0');
      if (regalo.length) { var okR = false; try { okR = vip().usarRegalo(tel, ticketNuevo); } catch (e) {} if (!okR) { regalo = []; monto = this.calcular(E.id, pag.length, !!cap, !!lib, yaUso); } }
      // el uso del código se cuenta al pedir (el aviso a Nelson sale al crearlo, porque entra gratis a la fila)
      if (cort) this.usarCodigoFotos(cort.codigo);
      var p = this.crear({ evento: E.id, eventoNombre: E.nombre, nombre: String(d.nombre).trim().slice(0, 80), tel: tel, correo: String(d.correo || '').trim().slice(0, 120),
        dorsal: dor || (c && c.dorsal) || '', fotos: fotos, gratis: gratis, regaloFotos: regalo, monto: monto, captura: cap, capturaArchivo: d.capturaArchivo || null,
        finisher: fotos.indexOf(d.finisher) >= 0 ? d.finisher : null, patrocinio: lib && !cort ? (lib.patrocinador || 'sí') : null, cortesia: cort ? cort.codigo : null,
        gratisPatrocinio: lib && !cort ? Math.min(pag.length, Math.max(0, P.patrocinio.gratis - yaUso)) : 0, yaUsoGratis: cort ? 0 : yaUso, corredor: c ? c.id : null, cara: c ? c.cara : null });
      return { ok: true, pedido: p, vaPor: this.vaPor(E.id) };
    },
    // el álbum para la página pública: las copias LIMPIAS (sin logo) solo salen si Nelson lo liberó por patrocinio
    // 24-11-2026 (Nelson): lo que llega de las carpetas «NC Publicar» queda POR PUBLICAR hasta que él lo revisa
    // y toca «Publicar» en su panel. Un álbum por publicar no sale en News ni se abre por su link.
    porPublicar: function () { return leerK('nc-por-publicar', []); },
    esPorPublicar: function (tipo, id) { return this.porPublicar().some(function (x) { return x.tipo === tipo && x.id === id; }); },
    eventoPublico: function (id) {
      var E = this.evento(id); if (!E || leerK('nc-galeria-eventos-ocultos', []).indexOf(id) >= 0 || this.esPorPublicar('evento', id)) return null;
      var lib = !!this.liberado(id), x = {};
      Object.keys(E).forEach(function (k) { if (k !== 'limpiasClave' && k !== 'revision') x[k] = E[k]; });
      if (lib) x.limpiasClave = E.limpiasClave;
      x.fotos = E.fotos.map(function (f) { var g = {}; Object.keys(f).forEach(function (k) { if (k !== 'limpia' || lib) g[k] = f[k]; }); return g; });
      return x;
    },
    // tarjetas de News: sin la lista de fotos (pesa) y sin los álbumes borrados
    listaEventos: function () {
      var yo = this, oc = leerK('nc-galeria-eventos-ocultos', []);
      return this.eventos().filter(function (e) { return oc.indexOf(e.id) < 0 && !yo.esPorPublicar('evento', e.id); }).map(function (e) {
        return { id: e.id, tipo: e.tipo, nombre: e.nombre, fecha: e.fecha, lugar: e.lugar, portada: e.portada, nfotos: (e.fotos || []).length, liberado: yo.liberado(e.id) };
      });
    },
    // lo que la página pública de un álbum necesita (sin datos de nadie)
    publico: function (eventoId) {
      var yo = this, pv = this.preventas().filter(function (x) { return !eventoId || x.evento === eventoId || !x.evento; }).map(function (x) { return { id: x.id, nombre: x.nombre, fecha: x.fecha, lugar: x.lugar, hasta: x.hasta, paquetes: x.paquetes, abierta: yo.preventaAbierta(x), evento: x.evento }; });
      var m = {}; if (eventoId) { m[eventoId] = this.marcasGrupales()[eventoId] || {}; }
      var vp = {}; this.eventos().forEach(function (e) { vp[e.id] = yo.vaPor(e.id); });
      return { ok: true, precios: eventoId ? this.precios(eventoId) : null, liberado: eventoId ? this.liberado(eventoId) : null, albumes: eventoId ? this.albumes(eventoId) : [],
        grupales: m, vaPor: vp, preventas: pv, ocultos: leerK('nc-galeria-eventos-ocultos', []) };
    },
    // ================================================================ código de cortesía «Fotos gratis»
    // En la página real los códigos viven en la hoja «Códigos» del panel (tipo F; se crean, activan y desactivan en
    // agendar.html → Códigos de descuento). En el prototipo se guardan en este navegador: nc-codigos-fotos.
    codigoFotos: function (code) {
      if (raiz.NC_CODIGOS_FOTOS) { try { return raiz.NC_CODIGOS_FOTOS.ver(code); } catch (e) { return { ok: false, title: 'No pudimos revisar el código. Inténtalo otra vez.' }; } }
      var k = String(code || '').toUpperCase().replace(/\s+/g, '');
      if (!k) return { ok: false, title: 'Escribe tu código.' };
      var o = leerK('nc-codigos-fotos', []).filter(function (x) { return x.codigo === k; })[0];
      return o && o.activo ? { ok: true, codigo: o.codigo } : { ok: false, title: 'Ese código no es válido o ya no está activo.' };
    },
    usarCodigoFotos: function (code) {
      if (raiz.NC_CODIGOS_FOTOS) { try { raiz.NC_CODIGOS_FOTOS.usar(code); } catch (e) {} return; }
      var l = leerK('nc-codigos-fotos', []); l.forEach(function (x) { if (x.codigo === code) x.usos = (x.usos || 0) + 1; }); guardarK('nc-codigos-fotos', l);
    },
    // prototipo: lo que en la página real hace el panel (crear / activar / desactivar)
    guardarCodigoFotos: function (code, activo) {
      var k = String(code || '').toUpperCase().replace(/\s+/g, ''), l = leerK('nc-codigos-fotos', []), o = l.filter(function (x) { return x.codigo === k; })[0];
      if (!/^[A-Z0-9ÁÉÍÓÚÑ_-]{3,20}$/.test(k)) return { ok: false, title: 'El código debe tener de 3 a 20 letras o números, sin espacios.' };
      if (o) o.activo = !!activo; else l.push({ codigo: k, activo: activo !== false, usos: 0, creado: iso() });
      guardarK('nc-codigos-fotos', l); return { ok: true, list: l };
    },
    // la página pública solo pregunta si el código sirve (no cuenta el uso: eso pasa al pedir)
    codigoFotosPublico: function (code) { var v = this.codigoFotos(code); return v.ok ? { ok: true, codigo: v.codigo } : { ok: false, title: v.title }; },

    // ¿ese celular puede usar su regalo de bienvenida en ESTA carrera? (solo dice sí o no; nada más de la persona)
    regaloPublico: function (tel, eventoId) {
      var t = soloDigitos(tel), est = '', E = eventoId ? this.evento(eventoId) : null;
      if (t.length >= 7 && vip()) try { est = vip().regalo(t, E ? E.fecha : ''); } catch (e) {}
      return { regalo: est === 'disponible', fotos: this.REGALO.fotos };
    },
    // «Ya pagué: revisar» en el álbum: solo ESE pedido, y solo si el celular coincide
    estadoPedido: function (ticket, tel) {
      var p = this.pedido(ticket); if (!p || p.tel !== soloDigitos(tel)) return null;
      return { pedido: p, vaPor: this.vaPor(p.evento) };
    },
    // Mis fotos de carreras: solo los pedidos de ESE celular. En la página real se ve dentro de la Zona VIP (con contraseña).
    misPedidos: function (tel) {
      var t = soloDigitos(tel); if (t.length < 7) return { ok: false, title: 'Escribe tu número completo' };
      this.revisarVencimientos();
      var l = this.porTelefono(t), yo = this, vp = {}; l.forEach(function (p) { if (p.evento) vp[p.evento] = yo.vaPor(p.evento); });
      var R = this.reclamos().filter(function (r) { return l.some(function (p) { return p.ticket === r.ticket; }); });
      return { ok: true, pedidos: l, vaPor: vp, reclamos: R };
    },
    elegirPreventaPublico: function (ticket, tel, fotos, finisher) {
      var p = this.pedido(ticket); if (!p || p.tel !== soloDigitos(tel) || p.estado !== 'elegir') return { ok: false, title: 'No encontramos ese pedido' };
      var E = this.evento(p.evento), nombres = E ? E.fotos.map(function (f) { return f.nombre; }) : [];
      fotos = (fotos || []).filter(function (n, i, a) { return nombres.indexOf(n) >= 0 && a.indexOf(n) === i; });
      if (fotos.length !== p.porElegir) return { ok: false, title: 'Elige exactamente ' + p.porElegir + ' fotos' };
      this.elegirPreventa(ticket, fotos); if (finisher && fotos.indexOf(finisher) >= 0) this.actualizar(ticket, { finisher: finisher });
      return { ok: true, pedido: this.pedido(ticket), vaPor: this.vaPor(p.evento) };
    },
    reclamarPublico: function (ticket, tel, foto) {
      var p = this.pedido(ticket); if (!p || p.tel !== soloDigitos(tel) || p.tipo !== 'preventa') return { ok: false, title: 'No encontramos ese pedido' };
      this.reclamar(ticket, foto); return { ok: true };
    },
    pedirImpresionPublico: function (d) {
      var de = d.de ? this.pedido(d.de) : null, tel = soloDigitos(d.tel);
      if (d.de && (!de || de.tel !== tel || de.estado !== 'entregado')) return { ok: false, title: 'Las impresiones se piden cuando ya tienes tus fotos editadas' };
      var items = (d.items || []).filter(function (it) { return it && it.producto && it.cant > 0; }).map(function (it) { return { foto: String(it.foto), producto: String(it.producto), cant: Math.min(50, Math.round(+it.cant)) }; });
      var yo = this; if (!items.length || items.some(function (it) { return !yo.CATALOGO.some(function (c) { return c.id === it.producto; }); })) return { ok: false, title: 'Elige al menos un producto' };
      return { ok: true, pedido: this.pedirImpresion({ de: d.de || '', sesion: d.sesion || '', evento: de ? de.evento : '', eventoNombre: de ? de.eventoNombre : String(d.eventoNombre || ''), nombre: de ? de.nombre : String(d.nombre || ''), tel: tel, correo: de ? de.correo : '', items: items }) };
    },
    comprarPreventaPublico: function (pvId, idx, d) {
      var pv = this.preventa(pvId); if (!pv || !this.preventaAbierta(pv) || !pv.paquetes[idx]) return { ok: false, title: 'Esta preventa ya cerró' };
      if (soloDigitos(d.tel).length < 7 || !String(d.nombre || '').trim()) return { ok: false, title: 'Faltan tu nombre o tu celular' };
      return { ok: true, pedido: this.comprarPreventa(pvId, idx, { nombre: String(d.nombre).trim().slice(0, 80), tel: soloDigitos(d.tel), correo: String(d.correo || '').slice(0, 120), dorsal: String(d.dorsal || '').replace(/\D/g, '') }) };
    },
    // sesión: los ♡ de los demás se ven por NOMBRE, nunca su celular; solo la dueña puede enviar
    sesionPublica: function (id, tel) {
      var S = (raiz.NC_SESIONES || []).filter(function (x) { return x.id === id; })[0]; if (!S) return { ok: false, title: 'Galería no encontrada' };
      var t = soloDigitos(tel), duena = !!S.tel && t.slice(-8) === String(S.tel).slice(-8), L = this.listasSesion(id);
      var otros = duena ? Object.keys(L).filter(function (k) { return k.slice(-8) !== t.slice(-8) && L[k].fotos.length; }).map(function (k) { return { nombre: L[k].nombre || 'Alguien', fotos: L[k].fotos }; }) : [];
      var pub = {}; Object.keys(S).forEach(function (k) { if (k !== 'tel') pub[k] = S[k]; });
      this.porPublicar().forEach(function (x) { if (x.tipo === 'sesion' && x.id === id && x.clase) delete pub[x.clase]; });   // aún sin publicar
      return { ok: true, sesion: pub, duena: duena, mia: this.listaSesion(id, t), otros: otros, plazo: this.plazoSesion(S).toISOString() };
    },
    guardarMiLista: function (id, tel, nombre, fotos, notas) {
      var S = (raiz.NC_SESIONES || []).filter(function (x) { return x.id === id; })[0]; if (!S || soloDigitos(tel).length < 7) return { ok: false };
      var L = this.listaSesion(id, tel), validas = (S.pruebas || []).map(function (f) { return f.nombre; });
      L.nombre = String(nombre || L.nombre || '').slice(0, 60); L.fotos = (fotos || []).filter(function (n) { return validas.indexOf(n) >= 0; });
      L.notas = {}; Object.keys(notas || {}).forEach(function (k) { if (validas.indexOf(k) >= 0 && notas[k]) L.notas[k] = String(notas[k]).slice(0, 300); });
      this.guardarListaSesion(id, tel, L); return { ok: true };
    },
    enviarMiSeleccion: function (id, tel) {
      var S = (raiz.NC_SESIONES || []).filter(function (x) { return x.id === id; })[0];
      if (!S || !S.tel || soloDigitos(tel).slice(-8) !== String(S.tel).slice(-8)) return { ok: false, title: 'Solo la dueña de la sesión puede enviar la selección' };
      return { ok: true, lista: this.enviarSelSesion(S, S.tel) };
    },

    borrarTodo: function () { escribir([]); }
  };
})();
