import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Crea e gestisce la scena Three.js: renderer, camera, luci + environment,
// controlli con auto-rotazione iniziale, ombra, resize e pausa fuori viewport.
// Ritorna { scene, camera, renderer, controls, resize, dispose }.
export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();

  // Environment procedurale (nessun asset esterno): riflessi/ambiente realistici sui PBR.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(2.7, 1.55, 3.0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 2.2;
  controls.maxDistance = 8;
  controls.maxPolarAngle = Math.PI * 0.52; // evita di andare sotto il piano
  controls.target.set(0, 0.05, 0);

  // Con il pannello opzioni aperto il target scende: il prodotto sale nella metà
  // alta dello stage e resta visibile mentre si cambiano le opzioni.
  let targetY = 0.05;

  // Rotazione automatica: attiva all'avvio, si ferma mentre l'utente trascina e
  // riparte piano dopo che rilascia (breve pausa + velocità che sale gradualmente).
  const AUTOROTATE_SPEED = 1.0; // velocità a regime
  const RESUME_DELAY = 1200; // ms di inattività prima di ricominciare
  const RESUME_RAMP = AUTOROTATE_SPEED / 90; // ~1.5s per tornare a regime (60fps)
  let resumeAt = null; // timestamp a cui ripartire, o null

  controls.autoRotate = true;
  controls.autoRotateSpeed = AUTOROTATE_SPEED;
  controls.addEventListener('start', () => {
    controls.autoRotate = false;
    resumeAt = null; // l'utente ha ripreso in mano: annulla la ripresa in attesa
  });
  controls.addEventListener('end', () => {
    resumeAt = performance.now() + RESUME_DELAY; // programma la ripresa graduale
  });

  function updateAutoRotate() {
    if (resumeAt === null || performance.now() < resumeAt) return;
    if (!controls.autoRotate) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0; // riparte da fermo e accelera piano
    }
    if (controls.autoRotateSpeed < AUTOROTATE_SPEED) {
      controls.autoRotateSpeed = Math.min(AUTOROTATE_SPEED, controls.autoRotateSpeed + RESUME_RAMP);
    } else {
      resumeAt = null; // ripresa completata
    }
  }

  // Luci: l'environment dà l'ambiente; key light direzionale per l'ombra.
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 0.35));

  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(4, 6, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 20;
  key.shadow.camera.left = -4;
  key.shadow.camera.right = 4;
  key.shadow.camera.top = 4;
  key.shadow.camera.bottom = -4;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffffff, 0.35);
  fill.position.set(-4, 2, -2);
  scene.add(fill);

  // Piano che riceve solo l'ombra (trasparente).
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.ShadowMaterial({ opacity: 0.18 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  function resize() {
    const parent = canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth || 1;
    const h = parent.clientHeight || Math.round(w * 0.75);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // ResizeObserver sul contenitore: reagisce anche ai cambi di layout del tema
  // (editor Shopify, sidebar, ecc.), non solo al resize della finestra.
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (ro && canvas.parentElement) ro.observe(canvas.parentElement);
  window.addEventListener('resize', resize);
  resize();

  // Pausa il rendering quando il canvas esce dal viewport (pagine lunghe del negozio).
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
    updateAutoRotate();
    controls.target.y += (targetY - controls.target.y) * 0.08; // reframe morbido
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
    setPanelOpen(open) {
      targetY = open ? -0.5 : 0.05;
    },
    dispose() {
      running = false;
      window.removeEventListener('resize', resize);
      if (ro) ro.disconnect();
      if (io) io.disconnect();
      controls.dispose();
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
