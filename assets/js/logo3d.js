/* balletfit — logo 3D (three.js)
 * Geometría tomada del diseño "Ese Logo 3D" (Claude Design): cuerpo carbón,
 * brazo y cabeza malva, extruidos con bisel. Se usa en tres lugares:
 *   [data-logo3d="intro"]  gira una vuelta al final de la intro
 *   [data-logo3d="hero"]   pieza central del inicio (se puede arrastrar)
 *   [data-logo3d="coach"]  marcador en "El método" mientras llega la foto
 * Si WebGL o three.js no cargan, se queda el logo SVG de siempre.
 */
import * as THREE from "three";

const INK = 0x2d2d2e;
const MAUVE = 0xaf909f;
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Modelo (del diseño) ---------- */
function buildLogo() {
  // Trazado en píxeles de la imagen fuente, pasado a metros (~0.34 m de alto)
  const S = 0.0004, CX = 630, BY = 1100;
  const p = (x, y) => [(x - CX) * S, (BY - y) * S];

  function crescent(pts) {
    const sh = new THREE.Shape();
    sh.moveTo(...p(...pts[0]));
    for (const seg of pts.slice(1)) {
      if (seg.length === 4) sh.quadraticCurveTo(...p(seg[0], seg[1]), ...p(seg[2], seg[3]));
      else sh.bezierCurveTo(...p(seg[0], seg[1]), ...p(seg[2], seg[3]), ...p(seg[4], seg[5]));
    }
    return sh;
  }

  const mauve = new THREE.MeshPhysicalMaterial({ color: MAUVE, roughness: 0.42, metalness: 0.05, clearcoat: 0.35, clearcoatRoughness: 0.4 });
  const ink = new THREE.MeshPhysicalMaterial({ color: INK, roughness: 0.32, metalness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.25 });

  const bevel = { bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 6, curveSegments: 64 };
  function extrude(shape, depth, mat, z) {
    const g = new THREE.ExtrudeGeometry(shape, { depth, ...bevel });
    g.translate(0, 0, -depth / 2);
    const m = new THREE.Mesh(g, mat);
    m.position.z = z;
    return m;
  }

  const body = crescent([
    [760, 258],
    [440, 440, 440, 840, 705, 1088],
    [735, 1102, 742, 1058],
    [620, 800, 600, 440, 800, 290],
    [815, 252, 760, 258],
  ]);
  const arm = crescent([
    [378, 495],
    [470, 680, 700, 780, 915, 752],
    [948, 760, 928, 775],
    [700, 830, 360, 720, 330, 505],
    [345, 462, 378, 495],
  ]);

  const model = new THREE.Group();
  model.add(extrude(body, 0.03, ink, 0));
  model.add(extrude(arm, 0.03, mauve, 0.016));

  const headR = 68 * S;
  const [hx, hy] = p(517, 340);
  const headGeo = new THREE.CylinderGeometry(headR, headR, 0.03, 64);
  headGeo.rotateX(Math.PI / 2);
  const head = new THREE.Mesh(headGeo, mauve);
  head.position.set(hx, hy, 0);
  head.scale.z = 38 / 30;
  model.add(head);
  const rimGeo = new THREE.TorusGeometry(headR - 0.001, 0.004, 12, 64);
  const capGeo = new THREE.CircleGeometry(headR - 0.001, 64);
  [0.015, -0.015].forEach((z) => {
    const r = new THREE.Mesh(rimGeo, mauve);
    r.position.set(hx, hy, z);
    model.add(r);
  });
  [0.019, -0.019].forEach((z, i) => {
    const c = new THREE.Mesh(capGeo, mauve);
    c.position.set(hx, hy, z);
    if (i) c.rotation.y = Math.PI;
    model.add(c);
  });

  // Centrado en el origen para que gire sobre sí mismo
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);
  const pivot = new THREE.Group();
  pivot.add(model);
  pivot.userData.height = box.max.y - box.min.y;
  return pivot;
}

/* ---------- Escena por contenedor ---------- */
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const TAU = Math.PI * 2;

class Logo3D {
  constructor(host) {
    this.host = host;
    this.mode = host.dataset.logo3d;
    this.fill = parseFloat(host.dataset.fill || "0.6"); // alto del logo / alto visible

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    this.renderer = renderer;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xead9e1, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 2.3);
    key.position.set(2.5, 3.5, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffe9f2, 1.4);
    rim.position.set(-3, 1.5, -2.5);
    scene.add(rim);
    const front = new THREE.DirectionalLight(0xffffff, 0.35);
    front.position.set(0, 0, 5);
    scene.add(front);
    this.scene = scene;

    this.logo = buildLogo();
    scene.add(this.logo);

    this.camera = new THREE.PerspectiveCamera(24, 1, 0.01, 50);

    // Estado de movimiento
    this.t0 = performance.now();
    this.spin = 0;        // giro acumulado por arrastre
    this.vel = 0;         // velocidad del arrastre (rad/frame)
    this.tilt = { x: 0, y: 0, tx: 0, ty: 0 };
    this.intro = null;    // { start, dur } cuando gira en la intro
    this.visible = true;

    this._fit = this._fit.bind(this);
    this._loop = this._loop.bind(this);
    this._fit();
    this.ro = new ResizeObserver(this._fit);
    this.ro.observe(host);

    if (this.mode === "hero") this._bindDrag();
    if (this.mode === "hero" && !reduced) this._bindTilt();

    // Solo dibuja cuando se ve
    this.io = new IntersectionObserver((es) => {
      this.visible = es[0].isIntersecting;
      this._run();
    });
    this.io.observe(host);
    document.addEventListener("visibilitychange", () => this._run());

    this._update(performance.now());
    renderer.render(scene, this.camera);
    host.classList.add("is-ready");
    host.parentElement.classList.add("has-3d");
    this._run();
  }

  _run() {
    const on = this.visible && !document.hidden;
    this.renderer.setAnimationLoop(on ? this._loop : null);
  }

  _fit() {
    const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    const cam = this.camera;
    cam.aspect = w / h;
    // Distancia para que el logo ocupe "fill" del alto (o del ancho si es angosto)
    const H = this.logo.userData.height;
    let viewH = H / this.fill;
    const logoW = H * 0.75;
    if (logoW / this.fill > viewH * cam.aspect) viewH = logoW / this.fill / cam.aspect;
    cam.position.set(0, 0, viewH / 2 / Math.tan((cam.fov * Math.PI) / 360));
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
    if (this.renderer) this.renderer.render(this.scene, cam);
  }

  _bindDrag() {
    const el = this.renderer.domElement;
    let down = false, lastX = 0;
    el.addEventListener("pointerdown", (e) => {
      if (down) return; // ignora un segundo dedo a mitad del giro
      down = true; lastX = e.clientX; this.vel = 0;
      el.setPointerCapture(e.pointerId);
      this.host.classList.add("is-grabbing");
    });
    el.addEventListener("pointermove", (e) => {
      if (!down) return;
      const dx = e.clientX - lastX; lastX = e.clientX;
      const d = dx * 0.012;
      this.spin += d; this.vel = d;
    });
    const up = () => { down = false; this.host.classList.remove("is-grabbing"); };
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    this._isDown = () => down;
  }

  _bindTilt() {
    const zone = this.host.closest("section") || this.host;
    zone.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const r = this.host.getBoundingClientRect();
      this.tilt.ty = ((e.clientX - (r.left + r.width / 2)) / window.innerWidth) * 0.9;
      this.tilt.tx = ((e.clientY - (r.top + r.height / 2)) / window.innerHeight) * 0.5;
    });
    zone.addEventListener("pointerleave", () => { this.tilt.tx = 0; this.tilt.ty = 0; });
  }

  /** Una vuelta completa (intro). */
  playTurn(dur = 1400) {
    this.intro = { start: performance.now(), dur };
  }

  _update(now) {
    const t = (now - this.t0) / 1000;
    const L = this.logo;
    if (this.mode === "intro") {
      let k = 0;
      if (this.intro) k = Math.min(1, (now - this.intro.start) / this.intro.dur);
      const e = ease(k);
      L.rotation.y = e * TAU;
      L.rotation.x = Math.sin(e * Math.PI) * 0.12;
      L.scale.setScalar(1 + Math.sin(e * Math.PI) * 0.06);
      return;
    }
    if (this.mode === "hero") {
      // Inercia del arrastre y regreso suave a una vuelta completa
      if (!(this._isDown && this._isDown())) {
        this.spin += this.vel;
        this.vel *= 0.94;
        if (Math.abs(this.vel) < 0.002) {
          this.vel = 0;
          const target = Math.round(this.spin / TAU) * TAU;
          this.spin += (target - this.spin) * 0.04;
        }
      }
      const tl = this.tilt;
      tl.x += (tl.tx - tl.x) * 0.06;
      tl.y += (tl.ty - tl.y) * 0.06;
      const idle = reduced ? -0.42 : Math.sin(t * 0.45) * 0.55;
      L.rotation.y = idle + this.spin + tl.y;
      L.rotation.x = tl.x + (reduced ? 0.05 : Math.sin(t * 0.6) * 0.05);
      L.position.y = reduced ? 0 : Math.sin(t * 0.9) * 0.008;
      return;
    }
    // coach: balanceo lento
    L.rotation.y = reduced ? -0.5 : Math.sin(t * 0.35) * 0.75;
    L.position.y = reduced ? 0 : Math.sin(t * 0.8) * 0.006;
  }

  _loop(now) {
    this._update(now);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.ro.disconnect();
    this.io.disconnect();
    this.scene.traverse((o) => {
      if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); }
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}

/* ---------- Arranque ---------- */
function webglOK() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGL2RenderingContext && c.getContext("webgl2"));
  } catch (e) { return false; }
}

if (webglOK()) {
  // Hero y "El método"
  document.querySelectorAll('[data-logo3d="hero"], [data-logo3d="coach"]').forEach((host) => {
    try { new Logo3D(host); } catch (e) { console.warn("logo3d:", e); }
  });

  // Intro: el logo dibujado se vuelve 3D y da una vuelta antes de abrir la página
  const intro = document.getElementById("intro");
  const host = intro && intro.querySelector('[data-logo3d="intro"]');
  const elapsed = performance.now();
  if (host && !reduced && !intro.classList.contains("is-gone") && elapsed < 2500) {
    try {
      const l = new Logo3D(host);
      const go = () => {
        if (intro.classList.contains("is-leaving") || intro.classList.contains("is-gone")) return;
        intro.classList.add("is-3d");
        l.playTurn(1400);
      };
      // El trazo 2D del símbolo termina ~1.95 s después de cargar
      setTimeout(go, Math.max(0, 2000 - elapsed));
      const done = new MutationObserver(() => {
        if (intro.classList.contains("is-gone")) { done.disconnect(); l.dispose(); }
      });
      done.observe(intro, { attributes: true, attributeFilter: ["class"] });
    } catch (e) { console.warn("logo3d intro:", e); }
  }
}
