(function () {
  "use strict";

  /* =========================================================
     CONFIGURACIÓN: edita aquí los datos del estudio
     ========================================================= */
  var CONFIG = {
    whatsapp: "50200000000",   // número con código de país, sin + ni espacios
    formEndpoint: "",          // opcional: URL de Formspree (https://formspree.io/f/xxxx)
    daysAhead: 14,

    classes: [
      { id: "esencial", name: "Balletfit esencial", level: "Todos los niveles", mins: 55, intensity: 2,
        text: "La clase base: barra, centro y tonificación con música. Ideal para empezar." },
      { id: "sculpt", name: "Barre sculpt", level: "Intermedio", mins: 55, intensity: 3,
        text: "Más repeticiones y pulsos para esculpir piernas, glúteos y abdomen." },
      { id: "stretch", name: "Stretch & flow", level: "Todos los niveles", mins: 45, intensity: 1,
        text: "Estiramiento profundo y movilidad para soltar tensión y ganar amplitud." }
    ],

    // Horario semanal (1 = lunes ... 6 = sábado). Cada clase: [hora, id de clase]
    week: {
      1: [["06:30", "esencial"], ["18:00", "esencial"], ["19:15", "sculpt"]],
      2: [["07:00", "stretch"], ["18:00", "sculpt"]],
      3: [["06:30", "esencial"], ["18:00", "esencial"], ["19:15", "stretch"]],
      4: [["07:00", "sculpt"], ["18:00", "esencial"]],
      5: [["06:30", "esencial"], ["17:30", "stretch"]],
      6: [["08:00", "esencial"], ["09:15", "sculpt"]]
    },

    plans: [
      { name: "Inicio", desc: "Para conocer el método", price: 280, sessions: 4, days: 30,
        perks: ["4 clases al mes", "Vigencia de 30 días", "Panel con tus sesiones"] },
      { name: "Constancia", desc: "El favorito del estudio", price: 480, sessions: 8, days: 30, featured: true,
        perks: ["8 clases al mes", "Vigencia de 30 días", "Reserva prioritaria", "Panel con tus sesiones"] },
      { name: "Ilimitado", desc: "Para entrenar sin límites", price: 650, sessions: 0, days: 30,
        perks: ["Clases ilimitadas", "Vigencia de 30 días", "Reserva prioritaria", "1 clase para una amiga"] }
    ]
  };

  var DAY = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  var DAY_LONG = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  var MONTH = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var classById = {};
  CONFIG.classes.forEach(function (c) { classById[c.id] = c; });
  function wa(msg) { return "https://wa.me/" + CONFIG.whatsapp + (msg ? "?text=" + encodeURIComponent(msg) : ""); }

  /* ---------- Intro del logo ---------- */
  var io = null; // observador del revelado (se declara antes de usarse en la intro)
  var intro = $("#intro");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var seen = false;
  try { seen = sessionStorage.getItem("bf_intro") === "1"; } catch (e) {}
  if (/[?&]sinintro\b/.test(location.search)) seen = true; // enlace directo sin animación
  var introDone = false;
  function endIntro(fast) {
    if (introDone) return;
    introDone = true;
    try { sessionStorage.setItem("bf_intro", "1"); } catch (e) {}
    document.body.classList.remove("is-intro");
    // setTimeout 0: espera a que se pinten clases y planes antes de observarlos
    if (fast) { if (intro) intro.classList.add("is-gone"); setTimeout(kickReveal, 0); return; }
    intro.classList.add("is-leaving");
    setTimeout(function () { intro.classList.add("is-gone"); }, 1000);
    setTimeout(kickReveal, 350);
  }
  if (!intro || seen || reduce) { endIntro(true); }
  else {
    setTimeout(function () { endIntro(false); }, 3600);
    $("#introSkip").addEventListener("click", function () { endIntro(false); });
    intro.addEventListener("click", function (e) { if (e.target.id !== "introSkip") endIntro(false); });
  }

  /* ---------- Revelado al hacer scroll ---------- */
  function kickReveal() {
    var items = $$(".reveal");
    if (!("IntersectionObserver" in window)) { items.forEach(function (el) { el.classList.add("is-in"); }); return; }
    if (io) return;
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("is-in");
        var ring = en.target.querySelector(".ring");
        if (ring) setTimeout(function () { ring.classList.add("is-on"); }, 250);
        io.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    items.forEach(function (el, i) {
      el.style.transitionDelay = (el.parentElement && el.parentElement.children.length > 1 ? (i % 4) * 70 : 0) + "ms";
      io.observe(el);
    });
  }

  /* ---------- Header y menú ---------- */
  var top = $("#top"), nav = $("#nav"), menuBtn = $("#menuBtn");
  window.addEventListener("scroll", function () { top.classList.toggle("is-scrolled", window.scrollY > 10); }, { passive: true });
  menuBtn.addEventListener("click", function () {
    var open = nav.classList.toggle("is-open");
    menuBtn.setAttribute("aria-expanded", String(open));
  });
  $$("#nav a").forEach(function (a) {
    a.addEventListener("click", function () { nav.classList.remove("is-open"); menuBtn.setAttribute("aria-expanded", "false"); });
  });
  if ("IntersectionObserver" in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        $$("#nav a").forEach(function (a) { a.classList.toggle("is-active", a.getAttribute("href") === "#" + en.target.id); });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    $$("main section[id]").forEach(function (s) { spy.observe(s); });
  }

  /* ---------- Clases ---------- */
  $("#classGrid").innerHTML = CONFIG.classes.map(function (c) {
    var bars = "";
    for (var i = 1; i <= 3; i++) bars += '<i class="' + (i <= c.intensity ? "on" : "") + '"></i>';
    return '<article class="class-card reveal">' +
      '<div class="class-card__top"><span class="class-card__lvl">' + c.level + '</span><span class="class-card__time">' + c.mins + ' min</span></div>' +
      '<h3>' + c.name + '</h3><p>' + c.text + '</p>' +
      '<div class="meter" aria-label="Intensidad ' + c.intensity + ' de 3">' + bars + '<span>Intensidad</span></div>' +
      '</article>';
  }).join("");

  /* ---------- Horario semanal ---------- */
  var weekHtml = "";
  for (var d = 1; d <= 6; d++) {
    var list = CONFIG.week[d] || [];
    weekHtml += '<div class="day" role="row"><h3 role="columnheader">' + DAY_LONG[d] + '</h3>' +
      list.map(function (s) {
        var c = classById[s[1]];
        return '<div class="slot" role="cell"><strong>' + s[0] + '</strong><span>' + c.name + '</span></div>';
      }).join("") + '</div>';
  }
  $("#week").innerHTML = weekHtml;

  /* ---------- Planes ---------- */
  $("#planGrid").innerHTML = CONFIG.plans.map(function (p, i) {
    var per = p.sessions ? "Q" + Math.round(p.price / p.sessions) + " por clase" : "Entrena todos los días";
    return '<article class="plan reveal' + (p.featured ? " plan--featured" : "") + '">' +
      (p.featured ? '<span class="plan__badge">Más elegido</span>' : "") +
      '<h3>' + p.name + '</h3><p class="plan__desc">' + p.desc + '</p>' +
      '<p class="plan__price">Q' + p.price + ' <small>/ mes</small></p>' +
      '<p class="plan__per">' + per + '</p>' +
      '<ul class="plan__list">' + p.perks.map(function (k) { return "<li>" + k + "</li>"; }).join("") + '</ul>' +
      '<a class="btn btn--block ' + (p.featured ? "btn--light" : "") + '" href="' +
      wa("Hola, me interesa el plan " + p.name + " (Q" + p.price + ") de balletfit.") +
      '" target="_blank" rel="noopener" data-plan="' + i + '">Quiero este plan</a>' +
      '</article>';
  }).join("");

  /* ---------- Panel de ejemplo ---------- */
  var due = new Date(); due.setDate(due.getDate() + 12);
  $("#demoDue").textContent = due.getDate() + " " + MONTH[due.getMonth()] + " · en 12 días";
  $$(".chk").forEach(function (b) {
    b.addEventListener("click", function () {
      var on = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", String(on));
      b.textContent = on ? "Asistió" : "Marcar";
    });
  });

  /* ---------- WhatsApp ---------- */
  $$("[data-wa]").forEach(function (a) {
    a.href = wa("Hola, quiero información sobre las clases de balletfit.");
    a.target = "_blank"; a.rel = "noopener";
  });
  $("#year").textContent = new Date().getFullYear();

  /* ---------- Clase de prueba (lógica de la base) ---------- */
  var daysEl = $("#days"), timesEl = $("#times"), form = $("#form"), statusEl = $("#status");
  var picked = { date: null, label: "", time: null };
  var levelSel = $("#levelSelect");
  CONFIG.classes.forEach(function (c) {
    var o = document.createElement("option"); o.textContent = c.name; levelSel.appendChild(o);
  });

  function iso(dt) { return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0"); }
  function chip(html, onClick) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.innerHTML = html;
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", function () { onClick(b); });
    return b;
  }
  function select(container, btn) {
    container.querySelectorAll(".chip").forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
    btn.setAttribute("aria-pressed", "true");
  }
  function showTimes(slots) {
    timesEl.innerHTML = ""; picked.time = null;
    slots.forEach(function (s) {
      var label = s[0] + "<small>" + classById[s[1]].name + "</small>";
      timesEl.appendChild(chip(label, function (b) {
        picked.time = s[0]; select(timesEl, b);
        levelSel.value = classById[s[1]].name;
      }));
    });
  }
  var today = new Date();
  for (var k = 0; k < CONFIG.daysAhead; k++) {
    (function (dt) {
      var slots = CONFIG.week[dt.getDay()];
      if (!slots || !slots.length) return;
      var label = DAY[dt.getDay()] + " " + dt.getDate() + " " + MONTH[dt.getMonth()];
      daysEl.appendChild(chip(DAY[dt.getDay()] + "<small>" + dt.getDate() + " " + MONTH[dt.getMonth()] + "</small>", function (b) {
        picked.date = iso(dt); picked.label = label; select(daysEl, b); showTimes(slots);
      }));
    })(new Date(today.getFullYear(), today.getMonth(), today.getDate() + k));
  }
  function say(el, html) { el.innerHTML = html; }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!picked.date || !picked.time) { say(statusEl, "Elige un día y una hora antes de enviar."); return; }
    if (!form.checkValidity()) { form.reportValidity(); return; }
    var f = new FormData(form);
    var data = { nombre: f.get("student"), edad: f.get("age"), clase: f.get("level"), telefono: f.get("phone"), fecha: picked.label, hora: picked.time };
    var msg = "Hola, quiero agendar una clase de prueba de balletfit.\n" +
      "Nombre: " + data.nombre + " (" + data.edad + " años)\n" +
      "Clase: " + data.clase + "\n" +
      "Día y hora: " + data.fecha + ", " + data.hora + "\n" +
      "Teléfono: " + data.telefono;
    var link = wa(msg);
    if (CONFIG.formEndpoint) {
      say(statusEl, "Enviando solicitud...");
      fetch(CONFIG.formEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(data)
      }).then(function (r) {
        if (!r.ok) throw new Error("fail");
        say(statusEl, "Solicitud enviada para " + data.fecha + ", " + data.hora + ". Te confirmaremos pronto.");
        form.reset();
      }).catch(function () {
        say(statusEl, 'No se pudo enviar. <a href="' + link + '" target="_blank" rel="noopener">Envíala por WhatsApp</a>.');
      });
    } else {
      window.open(link, "_blank", "noopener");
      say(statusEl, "Se abrió WhatsApp con tu solicitud. Envía el mensaje para terminar.");
    }
  });

  /* ---------- Ingresar / crear cuenta (demostración) ---------- */
  var dlg = $("#login"), lf = $("#loginForm"), lStatus = $("#loginStatus"), lSubmit = $("#loginSubmit");
  $$('[data-open="login"]').forEach(function (b) {
    b.addEventListener("click", function (e) {
      e.preventDefault();
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
    });
  });
  $$(".tabs button").forEach(function (t) {
    t.addEventListener("click", function () {
      var up = t.dataset.tab === "up";
      $$(".tabs button").forEach(function (o) { o.setAttribute("aria-selected", String(o === t)); });
      $(".only-up", lf).hidden = !up;
      lSubmit.textContent = up ? "Crear cuenta" : "Ingresar";
      say(lStatus, "");
    });
  });
  lf.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!lf.checkValidity()) { lf.reportValidity(); return; }
    say(lStatus, "Versión de demostración: así se verá tu panel.");
    setTimeout(function () {
      dlg.close();
      document.getElementById("como-funciona").scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    }, 900);
  });
})();
