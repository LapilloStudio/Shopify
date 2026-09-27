import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createStudioEnvironment, createContactShadow } from './studio.js';

// Crea e gestisce la scena Three.js: renderer, camera, ambiente "studio",
// ombra di contatto, controlli con auto-rotazione, resize e pausa fuori viewport.
export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();

  // Luce principale: l'ambiente studio (riflessi + luce diffusa da softbox).
  const envTex = createStudioEnvironment(renderer);
  scene.environment = envTex;

  // Una key light leggera (senza shadow map) per dare definizione ai volumi.
  const key = new THREE.DirectionalLight(0xffffff, 0.8);
  key.position.set(4, 6, 4);
  scene.add(key);

  // Ombra di contatto morbida alla base del modello (ricalcolata solo se cambia).
  const shadow = createContactShadow(renderer);
  scene.add(shadow.group);
  let shadowDirty = true;
  let subject = null;

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(2.7, 1.55, 3.0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 2.2;
  controls.maxDistance = 8;
  controls.maxPolarAngle = Math.PI * 0.49; // mai sotto il pavimento
  controls.target.set(0, 0.05, 0);

  // Ultime dimensioni note del canvas (servono per l'offset di inquadratura).
  let lastW = 1;
  let lastH = 1;
  // Larghezza (px CSS) occupata a destra dal pannello laterale: spostiamo
  // l'inquadratura a sinistra così il prodotto resta centrato nello spazio libero.
  let sidePanelPx = 0;

  function applyViewOffset() {
    if (sidePanelPx > 0 && lastW > 0 && lastH > 0) {
      const shift = sidePanelPx / 2;
      camera.setViewOffset(lastW + shift, lastH, shift, 0, lastW, lastH);
    } else {
      camera.clearViewOffset();
    }
    camera.updateProjectionMatrix();
  }

  // Inquadra automaticamente l'oggetto (qualunque scala/posizione abbia nel
  // file), mantenendo la direzione di vista corrente, e aggancia l'ombra alla
  // sua base reale. Il box include anche le varianti nascoste: inquadratura
  // stabile quando si cambia modello/modalità.
  function frame(object) {
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const radius = box.getSize(new THREE.Vector3()).length() / 2;

    const visibleW = Math.max(1, lastW - sidePanelPx);
    const aspect = visibleW / Math.max(1, lastH);
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const dist = (radius / Math.sin(Math.min(vFov, hFov) / 2)) * 0.95;

    const dir = camera.position.clone().sub(controls.target).normalize();
    controls.target.copy(center);
    camera.position.copy(center).addScaledVector(dir, dist);
    controls.minDistance = dist * 0.45;
    controls.maxDistance = dist * 2.5;
    camera.near = dist / 100;
    camera.far = dist * 20;
    applyViewOffset();
    controls.update();

    shadow.fit(box);
    shadowDirty = true;
  }

  // Rotazione automatica: si ferma mentre l'utente trascina e riparte piano
  // dopo che rilascia (breve pausa + velocità che sale gradualmente).
  const AUTOROTATE_SPEED = 1.0;
  const RESUME_DELAY = 1200;
  const RESUME_RAMP = AUTOROTATE_SPEED / 90;
  let resumeAt = null;

  controls.autoRotate = true;
  controls.autoRotateSpeed = AUTOROTATE_SPEED;
  controls.addEventListener('start', () => {
    controls.autoRotate = false;
    resumeAt = null;
  });
  controls.addEventListener('end', () => {
    resumeAt = performance.now() + RESUME_DELAY;
  });

  function updateAutoRotate() {
    if (resumeAt === null || performance.now() < resumeAt) return;
    if (!controls.autoRotate) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0;
    }
    if (controls.autoRotateSpeed < AUTOROTATE_SPEED) {
      controls.autoRotateSpeed = Math.min(AUTOROTATE_SPEED, controls.autoRotateSpeed + RESUME_RAMP);
    } else {
      resumeAt = null;
    }
  }

  function resize() {
    const parent = canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth || 1;
    const h = parent.clientHeight || Math.round(w * 0.75);
    lastW = w;
    lastH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    applyViewOffset();
  }

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (ro && canvas.parentElement) ro.observe(canvas.parentElement);
  window.addEventListener('resize', resize);
  resize();

  // Pausa il rendering quando il canvas esce dal viewport.
  let inView = true;
  const io = typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver((entries) => {
        inView = entries[0]?.isIntersecting !== false;
      })
    : null;
  if (io) io.observe(canvas);

  let running = true;
  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);
    if (!inView) return;
    if (shadowDirty && subject) {
      shadow.update(scene);
      shadowDirty = false;
    }
    updateAutoRotate();
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  return {
    scene,
    camera,
    renderer,
    controls,
    resize,
    // Oggetto principale da inquadrare e su cui calcolare l'ombra.
    setSubject(object) {
      subject = object;
      frame(object);
    },
    // Da chiamare quando cambia la geometria visibile (modello/modalità).
    invalidateShadow() {
      shadowDirty = true;
    },
    setSidePanelWidth(px) {
      const changed = Math.abs(px - sidePanelPx) > 1;
      sidePanelPx = px;
      applyViewOffset();
      // Prima misura del pannello: reinquadra sullo spazio effettivamente libero.
      if (changed && subject) frame(subject);
    },
    dispose() {
      running = false;
      window.removeEventListener('resize', resize);
      if (ro) ro.disconnect();
      if (io) io.disconnect();
      controls.dispose();
      shadow.dispose();
      envTex.dispose();
      renderer.dispose();
    },
  };
}
