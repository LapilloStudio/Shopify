import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PART, UPPER_MODE } from './config.js';

// Costruisce il sandalo: prova a caricare un .glb (se `modelUrl` è fornito), altrimenti
// genera geometria segnaposto con gli STESSI nomi mesh del Model Contract.
// Espone una API uniforme usata da UI/stato: setUpperMode, setColor, getParts.
export async function createSandal(scene, { modelUrl } = {}) {
  const group = new THREE.Group();
  scene.add(group);

  const parts = {}; // name -> Mesh (ognuna con la propria material)

  if (modelUrl) {
    try {
      const gltf = await new GLTFLoader().loadAsync(modelUrl);
      gltf.scene.traverse((obj) => {
        if (!obj.isMesh) return;
        obj.castShadow = true;
        obj.receiveShadow = true;
        // Material dedicata per parte, così il colore di una non tocca le altre.
        obj.material = obj.material.clone();
        if (obj.name) parts[obj.name] = obj;
      });
      group.add(gltf.scene);
    } catch (e) {
      console.warn('[sandal] Caricamento GLB fallito, uso la geometria segnaposto:', e);
    }
  }

  // Se manca la suola (nessun modello, o nomi non conformi al contract) -> segnaposto.
  if (!parts[PART.SOLE]) buildPlaceholder(group, parts);

  function setColor(partName, hex) {
    const mesh = parts[partName];
    if (mesh && mesh.material) mesh.material.color.set(hex);
  }

  function setUpperMode(mode) {
    const whole = mode === UPPER_MODE.WHOLE;
    if (parts[PART.UPPER_FRONT]) parts[PART.UPPER_FRONT].visible = !whole;
    if (parts[PART.UPPER_BACK]) parts[PART.UPPER_BACK].visible = !whole;
    if (parts[PART.UPPER_WHOLE]) parts[PART.UPPER_WHOLE].visible = whole;
  }

  return { group, parts, setColor, setUpperMode, getParts: () => parts };
}

function mat(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05 });
}

function addMesh(group, parts, name, geometry, material, pos) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (pos) mesh.position.set(pos[0], pos[1], pos[2]);
  group.add(mesh);
  parts[name] = mesh;
  return mesh;
}

// Geometria segnaposto: suola piatta (lunghezza lungo Z) + tre fasce (davanti/dietro/intera).
// Stessi nomi e una material per parte: la logica di swap/colore è identica ai modelli reali.
function buildPlaceholder(group, parts) {
  // Suola
  addMesh(
    group, parts, PART.SOLE,
    new RoundedBoxGeometry(0.95, 0.18, 2.4, 4, 0.08),
    mat('#a9743b'),
    [0, 0.09, 0]
  );

  // Tomaia davanti: fascia verso la punta (+Z)
  addMesh(
    group, parts, PART.UPPER_FRONT,
    new RoundedBoxGeometry(1.02, 0.12, 0.44, 4, 0.05),
    mat('#1f1f1f'),
    [0, 0.30, 0.62]
  );

  // Tomaia dietro: cinturino verso il tallone (-Z)
  addMesh(
    group, parts, PART.UPPER_BACK,
    new RoundedBoxGeometry(1.0, 0.12, 0.42, 4, 0.05),
    mat('#1f1f1f'),
    [0, 0.32, -0.62]
  );

  // Tomaia intera: banda unica al centro del collo del piede
  const whole = addMesh(
    group, parts, PART.UPPER_WHOLE,
    new RoundedBoxGeometry(1.06, 0.13, 1.4, 4, 0.06),
    mat('#d9b38c'),
    [0, 0.30, 0]
  );
  whole.visible = false; // default: modalità "split"
}
