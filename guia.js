/* Guía para brillar · NC Studio. La usan guia.html, guia-exteriores.html, guia-quince.html y la Zona VIP (vip.html).
   Tres versiones: estudio (guia/, 7 partes), exteriores (guia-ext/, 8) y Sueños de 15 (guia-15/, 9). */
(function () {
  var G = window.NC_GUIA = [
    { f: "1-confianza", n: "01", t: "Confianza", h: "¿Te da nervios la cámara? A casi todas nos pasa", p: "Nadie te pide llegar segura. Aquí te contamos de dónde salen esos miedos y cómo soltarlos antes de la sesión, sin cambiar nada de ti.", min: 4 },
    { f: "2-tu-idea", n: "02", t: "Tu idea", h: "Tu idea no tiene que ser perfecta, solo tuya", p: "Una sola pregunta guía toda tu sesión. Descubre cuál es y cómo contarnos lo que imaginas, aunque solo tengas una foto de Pinterest o una emoción.", min: 2 },
    { f: "3-vestuario", n: "03", t: "Vestuario", h: "Lo que llevas puesto también cuenta tu historia", p: "Qué prendas le van a tu tipo de cuerpo, el truco para probarte la ropa antes del día y qué llevar (y qué no) para verte tú, no disfrazada.", min: 5 },
    { f: "4-el-color", n: "04", t: "El color", h: "Lo primero que el ojo ve no es tu pose: es el color", p: "Las combinaciones que te iluminan la cara (y las que te apagan), con ejemplos de sesiones reales y la regla de oro de los 3 colores.", min: 4 },
    { f: "5-accesorios-y-manos", n: "05", t: "Accesorios y manos", h: "¿Qué hago con las manos? El detalle que más se nota", p: "Casi nadie lo prepara y cambia todo. Ideas fáciles con sombreros, flores y objetos con historia para que tu cuerpo se relaje solo.", min: 5 },
    { f: "6-tu-sesion-con-nosotros", n: "06", t: "Tu sesión con nosotros", h: "«Se me nota la barriga», «no sé posar»… te entendemos", p: "Lo que muchas nos dicen antes de su sesión y cómo te acompañamos en cada paso, para que vivas una experiencia que vas a querer repetir.", min: 5 },
    { f: "7-el-gran-dia", n: "07", t: "El gran día", h: "No tienes que saber posar: llegó el día de disfrutar", p: "Así se vive la sesión entre música y risas, lo práctico del pago y el checklist final, y qué hacer con tus fotos cuando lleguen.", min: 4 }
  ];
  window.NC_GUIA_EXT = [
    { f: "1-confianza", n: "01", t: "Confianza", h: "Antes de hablar de fotos, hablemos de ti", p: "¡Ya reservaste tu sesión en exteriores! De dónde salen los nervios frente a la cámara y cómo soltarlos: tu comodidad siempre va primero.", min: 4 },
    { f: "2-tu-idea", n: "02", t: "Tu idea", h: "Todo empieza con una idea (y no tiene que ser perfecta)", p: "La pregunta que guía toda tu sesión y cómo contarnos lo que imaginas, aunque solo tengas una foto de Pinterest o una emoción.", min: 2 },
    { f: "3-tu-locacion", n: "03", t: "Tu locación", h: "El lugar también cuenta tu historia", p: "Playa, río, campo o pueblo: qué transmite cada escenario, por qué la luz de las 4:30 p. m. lo cambia todo y cómo prepararte para el sol, el viento o la lluvia.", min: 4 },
    { f: "4-vestuario", n: "04", t: "Vestuario", h: "Lo que llevas también cuenta tu historia", p: "Prendas según tu tipo de cuerpo, telas que se mueven con el viento, el calzado según el terreno y qué traer (y qué no).", min: 5 },
    { f: "5-el-color", n: "05", t: "El color", h: "Afuera, tu ropa conversa con el paisaje", p: "Las combinaciones que te iluminan, cómo destacar sobre el verde, la arena o el cielo, y la regla de oro de los 3 colores.", min: 4 },
    { f: "6-accesorios-y-manos", n: "06", t: "Accesorios y manos", h: "¿Qué hago con las manos? El detalle que más se nota", p: "Ideas fáciles con sombreros, flores, globos y objetos con historia para que tu cuerpo se relaje solo.", min: 5 },
    { f: "7-tu-sesion-con-nosotros", n: "07", t: "Tu sesión con nosotros", h: "«Se me nota la barriga», «no sé posar»… te entendemos", p: "Así se vive una sesión al aire libre con NC Studio: cómo te acompañamos paso a paso y cómo prepararte.", min: 5 },
    { f: "8-el-gran-dia", n: "08", t: "El gran día", h: "No tienes que saber posar: llegó el día de disfrutar", p: "Música, risas y dirección sobre la marcha; lo práctico del día y qué hacer con tus fotos cuando lleguen.", min: 4 }
  ];
  window.NC_GUIA_15 = [
    { f: "1-tu-sueno-empieza-aqui", n: "01", t: "Tu sueño empieza aquí", h: "¡Felices 15! Una guía para ti y para mamá", p: "Para ti, que vas a vivir tu sueño, y para mamá, que lo soñó desde que naciste: los nervios, la magia y cómo se vive tu sesión.", min: 3 },
    { f: "2-princesa-a-tu-manera", n: "02", t: "¿Princesa? Tú decides cómo", h: "Tu sueño, a tu manera", p: "Corona y tenis, vestido y tu balón: hay tantas formas de ser princesa como quinceañeras. Y ese momento especial en que mamá te corona.", min: 3 },
    { f: "3-a-los-50-visitaras-tus-15", n: "03", t: "A los 50 visitarás tus 15", h: "Un segundo look siendo tú misma", p: "El vestido cuenta tu sueño; tu segundo look, quién eres. Ideas con tus hobbies para recordar dentro de muchos años cómo eras a los 15.", min: 4 },
    { f: "4-el-vestido-y-tus-colores", n: "04", t: "El vestido y tus colores", h: "El vestido de tus sueños y todo lo que lo hace lucir", p: "Qué probarte antes del día, cómo cuidamos la cola en cada foto, el calzado y los colores que mejor lucen con tu vestido.", min: 5 },
    { f: "5-manos-y-detalles", n: "05", t: "Tus manos y los detalles", h: "¿Qué hago con mis manos? La pregunta más común", p: "Ideas fáciles para tus manos y los detalles que hacen fotos mágicas: corona, globos, flores y sombrilla.", min: 4 },
    { f: "6-tu-locacion", n: "06", t: "Tu locación", h: "El escenario de tu sueño", p: "Playa, bosque, cascada o la plaza de tu pueblo: qué transmite cada lugar y por qué la luz de las 4:30 p. m. lo cambia todo.", min: 3 },
    { f: "7-para-ti-mama", n: "07", t: "Para ti, mamá", h: "Mamá, este sueño también es tuyo", p: "Quince años soñándolo y hoy se cumple. Cómo acompañarla sin presionarla, darle seguridad y salir tú también en las fotos.", min: 4 },
    { f: "8-tu-sesion-con-nosotros", n: "08", t: "Tu sesión con nosotros", h: "Así vivimos tu sueño contigo", p: "El camino paso a paso, cómo te preparas en los días previos y cómo se ve tu sesión detrás de cámaras, entre música y risas.", min: 4 },
    { f: "9-tus-recuerdos", n: "09", t: "Tus recuerdos", h: "Lo que queda para siempre", p: "Cuándo te llegan tus fotos, cómo elegirlas juntas mamá e hija, y recuerdos que se pueden tocar: álbum, cuadro e impresiones.", min: 4 }
  ];
  function esc(s) { return String(s).replace(/[&<>"]/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]; }); }
  function leidas() { try { return JSON.parse(localStorage.getItem("ncGuia") || "{}"); } catch (e) { return {}; } }
  // pinta las guías en `lista`; `alLeer(n, total)` se llama al abrir una
  // `version`: "exteriores", "quince" (Sueños de 15) o, cualquier otra cosa, la de estudio
  window.ncGuia = function (lista, alLeer, base, version) {
    base = base || "";
    var V = { exteriores: [window.NC_GUIA_EXT, "guia-ext/", "ext:"], quince: [window.NC_GUIA_15, "guia-15/", "q15:"] }[version] || [window.NC_GUIA, "guia/", ""];
    var G = V[0], dir = V[1], pre = V[2];
    var L = leidas(), cuenta = function () { var n = G.filter(function (g) { return L[pre + g.f]; }).length; if (alLeer) alLeer(n, G.length); };
    lista.innerHTML = "";
    G.forEach(function (g) {
      var el = document.createElement("article"); el.className = "g" + (L[pre + g.f] ? " leido" : "");
      el.innerHTML = '<img src="' + base + dir + g.f + '.jpg" alt="Portada de la guía ' + esc(g.t) + '" loading="lazy"><div><small>' + g.n + ' · ' + esc(g.t) + ' · ' + g.min + ' min</small><h2>' + esc(g.h) + '</h2><p>' + esc(g.p) + '</p><div class="btns"><a class="btn" href="' + base + dir + g.f + '.pdf" target="_blank" rel="noopener">Leer ahora</a><span class="ok">✓ Ya la leíste</span></div></div>';
      el.querySelector("a").addEventListener("click", function () { L[pre + g.f] = 1; try { localStorage.setItem("ncGuia", JSON.stringify(L)); } catch (e) {} el.classList.add("leido"); cuenta(); });
      lista.appendChild(el);
    });
    cuenta();
  };
})();
