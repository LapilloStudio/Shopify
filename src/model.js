import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PART, UPPER_MODE, TOMAIA_PARTS_BY_MODE } from './config.js';

// Costruisce il sandalo e gestisce parti / modelli (stili) / materiali.
//
// Registry unificato: ogni mesh è registrata come (parte, modelId|null).
// - modelId null  = mesh sempre presente per quella parte (indipendente dal modello)
// - modelId 'xyz' = mesh visibile solo quando il modello 'xyz' è selezionato
// La visibilità finale = parte visibile nella modalità corrente && modello selezionato.
//
// Model Contract per i .glb: mesh chiamate `Sole`, `UpperFront`, `UpperBack`,
// `UpperWhole`, opzionalmente con suffisso stile `__idModello`
// (es. `UpperFront__cross`, `UpperWhole__woven`). Vedi README.
export async function createSandal(scene, { modelUrl } = {}) {
  const group = new THREE.Group();
  scene.add(group);

  // part -> { meshes: [{mesh, modelId}], materials: [], models: Set, current: string|null }
  const parts = {};
  let mode = UPPER_MODE.SPLIT;

  function partEntry(partName) {
    if (!parts[partName]) {
      parts[partName] = { meshes: [], materials: [], models: new Set(), current: null };
    }
    return parts[partName];
  }

  function registerMesh(partName, modelId, mesh) {
    const entry = partEntry(partName);
    entry.meshes.push({ mesh, modelId });
    if (modelId) entry.models.add(modelId);
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    entry.materials.push(...mats);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }

  function partVisibleInMode(partName) {
    if (partName === PART.SOLE) return true;
    return TOMAIA_PARTS_BY_MODE[mode].includes(partName);
  }

  // Ricalcola la visibilità di tutte le mesh (modalità + modello selezionato).
  function refresh() {
    for (const [partName, entry] of Object.entries(parts)) {
      const partVisible = partVisibleInMode(partName);
      let current = entry.current;
      // Fallback: se il modello richiesto non ha mesh, usa il primo disponibile.
      if (entry.models.size > 0 && (!current || !entry.models.has(current))) {
        current = entry.models.values().next().value;
      }
      for (const { mesh, modelId } of entry.meshes) {
        mesh.visible = partVisible && (modelId === null || modelId === current);
      }
    }
  }

  // ---- caricamento GLB (se fornito) ----
  const NAME_RE = /^(Sole|UpperFront|UpperBack|UpperWhole)(?:__(.+))?$/;
  if (modelUrl) {
    try {
      const gltf = await new GLTFLoader().loadAsync(modelUrl);
      gltf.scene.traverse((obj) => {
        if (!obj.isMesh) return;
        const m = NAME_RE.exec(obj.name || '');
        if (!m) {
          obj.castShadow = true;
          obj.receiveShadow = true;
          return; // mesh decorativa fuori contract: resta com'è
        }
        // Material dedicata per mesh: il colore di una parte non tocca le altre.
        obj.material = Array.isArray(obj.material)
          ? obj.material.map((mm) => mm.clone())
          : obj.material.clone();
        registerMesh(m[1], m[2] || null, obj);
      });
      group.add(gltf.scene);
    } catch (e) {
      console.warn('[sandal] Caricamento GLB fallito, uso la geometria segnaposto:', e);
    }
  }

  // Se manca la suola (nessun modello o nomi non conformi) -> segnaposto completo.
  if (!parts[PART.SOLE]) buildPlaceholder(group, registerMesh);

  refresh();

  return {
    group,
    setUpperMode(newMode) {
      mode = newMode;
      refresh();
    },
    setModel(partName, modelId) {
      partEntry(partName).current = modelId;
      refresh();
    },
    setColor(partName, hex) {
      const entry = parts[partName];
      if (!entry) return;
      for (const mat of entry.materials) if (mat.color) mat.color.set(hex);
    },
    getParts: () => parts,
  };
}

// ===========================================================================
// Geometria segnaposto: silhouette di suola estrusa + fascette ad arco.
// Ogni "Modello" (config.MODELS_BY_PART) ha una geometria dedicata, così la
// categoria Modello è visibile in 3D anche prima dei .glb reali.
// Orientamento contract: punta verso +Z, suola appoggiata a y=0.
// ===========================================================================

const SOLE_TOP = 0.16; // quota approssimativa del piano d'appoggio delle fascette

function makeMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.65,
    metalness: opts.metalness ?? 0.05,
    side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
  });
}

// Silhouette del piede nel piano XY della Shape (y = lunghezza, +y = punta).
function footShape(scale = 1) {
  const s = new THREE.Shape();
  s.moveTo(0, -1.18 * scale);
  s.bezierCurveTo(0.34 * scale, -1.18 * scale, 0.42 * scale, -1.02 * scale, 0.42 * scale, -0.8 * scale);
  s.bezierCurveTo(0.42 * scale, -0.5 * scale, 0.36 * scale, -0.3 * scale, 0.38 * scale, 0);
  s.bezierCurveTo(0.4 * scale, 0.35 * scale, 0.5 * scale, 0.5 * scale, 0.48 * scale, 0.8 * scale);
  s.bezierCurveTo(0.47 * scale, 1.05 * scale, 0.3 * scale, 1.2 * scale, 0, 1.2 * scale);
  s.bezierCurveTo(-0.3 * scale, 1.2 * scale, -0.47 * scale, 1.05 * scale, -0.48 * scale, 0.8 * scale);
  s.bezierCurveTo(-0.5 * scale, 0.5 * scale, -0.4 * scale, 0.35 * scale, -0.38 * scale, 0);
  s.bezierCurveTo(-0.36 * scale, -0.3 * scale, -0.42 * scale, -0.5 * scale, -0.42 * scale, -0.8 * scale);
  s.bezierCurveTo(-0.42 * scale, -1.02 * scale, -0.34 * scale, -1.18 * scale, 0, -1.18 * scale);
  return s;
}

// Estrusione della silhouette, ruotata piatta con punta verso +Z e base a y=0.
function soleGeometry({ depth = 0.13, scale = 1 } = {}) {
  const geo = new THREE.ExtrudeGeometry(footShape(scale), {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.03,
    bevelSegments: 3,
    curveSegments: 24,
  });
  geo.rotateX(-Math.PI / 2);
  geo.rotateY(Math.PI);
  geo.computeBoundingBox();
  geo.translate(0, -geo.boundingBox.min.y, 0);
  return geo;
}

// Suola a zeppa: stessa silhouette, estrusione alta "rampata" (alta al tallone).
function wedgeGeometry() {
  const geo = soleGeometry({ depth: 0.4, scale: 0.99 });
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    const f = 0.3 + 0.7 * ((1.2 - z) / 2.4); // 1 al tallone (-z), 0.3 alla punta (+z)
    pos.setY(i, pos.getY(i) * f);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// Fascetta ad arco sopra il piede: estrusione di un rettangolo lungo una semi-ellisse.
// span = semiampiezza in x, height = altezza dell'arco, width = larghezza fascia (lungo z).
function archStrapGeometry({ span = 0.5, height = 0.3, width = 0.3, thickness = 0.055, baseY = SOLE_TOP - 0.06 } = {}) {
  const pts = [];
  const N = 10;
  for (let i = 0; i <= N; i++) {
    const a = Math.PI - (i / N) * Math.PI;
    pts.push(new THREE.Vector3(Math.cos(a) * span, baseY + Math.sin(a) * height, 0));
  }
  const path = new THREE.CatmullRomCurve3(pts);
  const rect = new THREE.Shape();
  rect.moveTo(-thickness / 2, -width / 2);
  rect.lineTo(thickness / 2, -width / 2);
  rect.lineTo(thickness / 2, width / 2);
  rect.lineTo(-thickness / 2, width / 2);
  rect.closePath();
  return new THREE.ExtrudeGeometry(rect, { steps: 32, extrudePath: path });
}

// Fascia orizzontale che avvolge il tallone (arco in pianta, nel piano XZ).
function heelWrapGeometry({ radius = 0.41, centerZ = -0.78, y = 0.24, width = 0.18, thickness = 0.05, arc = 1.9 } = {}) {
  const pts = [];
  const N = 12;
  for (let i = 0; i <= N; i++) {
    const a = -arc + (i / N) * arc * 2; // angolo attorno a -Z
    pts.push(new THREE.Vector3(Math.sin(a) * radius, y, centerZ - Math.cos(a) * radius));
  }
  const path = new THREE.CatmullRomCurve3(pts);
  const rect = new THREE.Shape();
  rect.moveTo(-thickness / 2, -width / 2);
  rect.lineTo(thickness / 2, -width / 2);
  rect.lineTo(thickness / 2, width / 2);
  rect.lineTo(-thickness / 2, width / 2);
  rect.closePath();
  return new THREE.ExtrudeGeometry(rect, { steps: 36, extrudePath: path });
}

function buildPlaceholder(group, registerMesh) {
  const add = (partName, modelId, geometry, material, { z = 0, rotY = 0 } = {}) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = modelId ? `${partName}__${modelId}` : partName;
    mesh.position.z = z;
    mesh.rotation.y = rotY;
    group.add(mesh);
    registerMesh(partName, modelId, mesh);
    return mesh;
  };

  // --- Suola: Bassa / Zeppa ---
  add(PART.SOLE, 'flat', soleGeometry(), makeMat('#a9743b'));
  add(PART.SOLE, 'wedge', wedgeGeometry(), makeMat('#a9743b'));

  // --- Tomaia davanti: Classica / Incrociata / Gold Edition ---
  add(PART.UPPER_FRONT, 'classic', archStrapGeometry({ width: 0.4, height: 0.28 }), makeMat('#1f1f1f'), { z: 0.55 });

  const crossMat = makeMat('#1f1f1f');
  add(PART.UPPER_FRONT, 'cross', archStrapGeometry({ width: 0.18, height: 0.3 }), crossMat, { z: 0.5, rotY: 0.45 });
  add(PART.UPPER_FRONT, 'cross', archStrapGeometry({ width: 0.18, height: 0.3 }), crossMat, { z: 0.5, rotY: -0.45 });

  const goldMat = makeMat('#c9a227', { metalness: 0.65, roughness: 0.3 });
  add(PART.UPPER_FRONT, 'gold', archStrapGeometry({ width: 0.42, height: 0.28 }), goldMat, { z: 0.62 });
  add(PART.UPPER_FRONT, 'gold', archStrapGeometry({ width: 0.12, height: 0.33 }), goldMat, { z: 0.28 });

  // --- Tomaia dietro: Cinturino / Chiusa ---
  add(PART.UPPER_BACK, 'strap', heelWrapGeometry(), makeMat('#1f1f1f'));

  const heelCup = new THREE.CylinderGeometry(0.46, 0.52, 0.42, 28, 1, true, 0, Math.PI);
  heelCup.rotateY(Math.PI / 2); // apertura verso la punta
  const cupMesh = add(PART.UPPER_BACK, 'closed', heelCup, makeMat('#1f1f1f', { doubleSide: true }));
  cupMesh.position.set(0, 0.3, -0.74);

  // --- Tomaia intera: Fascia unica / Intrecciata / Platinum ---
  add(PART.UPPER_WHOLE, 'band', archStrapGeometry({ width: 0.85, height: 0.3 }), makeMat('#d9b38c'), { z: 0.1 });

  const wovenMat = makeMat('#d9b38c');
  add(PART.UPPER_WHOLE, 'woven', archStrapGeometry({ width: 0.15, height: 0.28 }), wovenMat, { z: -0.15 });
  add(PART.UPPER_WHOLE, 'woven', archStrapGeometry({ width: 0.15, height: 0.31 }), wovenMat, { z: 0.2 });
  add(PART.UPPER_WHOLE, 'woven', archStrapGeometry({ width: 0.15, height: 0.28 }), wovenMat, { z: 0.55 });
  add(PART.UPPER_WHOLE, 'woven', archStrapGeometry({ width: 0.13, height: 0.34 }), wovenMat, { z: 0.2, rotY: 0.5 });
  add(PART.UPPER_WHOLE, 'woven', archStrapGeometry({ width: 0.13, height: 0.34 }), wovenMat, { z: 0.2, rotY: -0.5 });

  const platMat = makeMat('#f2efe9', { metalness: 0.45, roughness: 0.25 });
  add(PART.UPPER_WHOLE, 'platinum', archStrapGeometry({ width: 0.5, height: 0.3 }), platMat, { z: 0.45 });
  add(PART.UPPER_WHOLE, 'platinum', archStrapGeometry({ width: 0.5, height: 0.32 }), platMat, { z: -0.05 });
}
