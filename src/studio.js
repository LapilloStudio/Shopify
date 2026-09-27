import * as THREE from 'three';
import { HorizontalBlurShader } from 'three/addons/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/addons/shaders/VerticalBlurShader.js';

// ---------------------------------------------------------------------------
// Ambiente "studio fotografico" generato in codice (nessun file HDRI da
// scaricare): una stanza con gradiente pavimento/soffitto e softbox emissivi
// (key, fill, rim, overhead). Convertito in env map PMREM, dà ai materiali PBR
// riflessi e luce diffusa da set fotografico.
// ---------------------------------------------------------------------------
export function createStudioEnvironment(renderer) {
  const env = new THREE.Scene();

  // Stanza sferica con gradiente verticale (pavimento scuro -> soffitto chiaro).
  const roomGeo = new THREE.SphereGeometry(20, 48, 24);
  const pos = roomGeo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const floor = new THREE.Color(0x2a2826);
  const horizon = new THREE.Color(0x8c8883);
  const ceiling = new THREE.Color(0xcfcbc5);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / 20; // -1 .. 1
    if (t < 0) c.copy(horizon).lerp(floor, Math.min(1, -t * 1.6));
    else c.copy(horizon).lerp(ceiling, Math.min(1, t * 1.4));
    c.toArray(colors, i * 3);
  }
  roomGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  env.add(new THREE.Mesh(roomGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));

  // Softbox: pannelli emissivi (colore > 1 = luce HDR) rivolti verso il centro.
  const softbox = (w, h, intensity, position) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(intensity), side: THREE.DoubleSide })
    );
    m.position.set(...position);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  softbox(6, 4, 7, [7, 7, 6]); // key: alto a destra, frontale
  softbox(5, 5, 2.5, [-9, 3, 3]); // fill: sinistra, morbido
  softbox(8, 2, 5, [-2, 6, -9]); // rim: dietro, stacca il profilo
  softbox(8, 8, 3, [0, 12, 0]); // overhead: dall'alto

  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(env, 0.03).texture;
  pmrem.dispose();
  env.traverse((o) => {
    if (o.isMesh) {
      o.geometry.dispose();
      o.material.dispose();
    }
  });
  return texture;
}

// ---------------------------------------------------------------------------
// Ombra di contatto morbida (tecnica "contact shadow" da product viewer): si
// renderizza la profondità del modello vista da sotto, la si sfoca e la si
// proietta su un piano alla base del modello. Niente shadow map della luce,
// e viene ricalcolata solo quando il modello cambia (non a ogni frame).
// ---------------------------------------------------------------------------
export function createContactShadow(renderer, { resolution = 512, darkness = 1.1, opacity = 0.75, blur = 3.2 } = {}) {
  const group = new THREE.Group();

  const renderTarget = new THREE.WebGLRenderTarget(resolution, resolution);
  renderTarget.texture.generateMipmaps = false;
  const renderTargetBlur = new THREE.WebGLRenderTarget(resolution, resolution);
  renderTargetBlur.texture.generateMipmaps = false;

  const planeGeo = new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2);
  const plane = new THREE.Mesh(
    planeGeo,
    new THREE.MeshBasicMaterial({
      map: renderTarget.texture,
      opacity,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    })
  );
  plane.renderOrder = 1;
  plane.scale.y = -1; // la texture è vista da sotto: la ribaltiamo
  group.add(plane);

  const blurPlane = new THREE.Mesh(planeGeo);
  blurPlane.visible = false;
  group.add(blurPlane);

  const camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);
  camera.rotation.x = Math.PI / 2; // guarda verso l'alto
  group.add(camera);

  const depthMaterial = new THREE.MeshDepthMaterial();
  depthMaterial.userData.darkness = { value: darkness };
  depthMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.darkness = depthMaterial.userData.darkness;
    shader.fragmentShader = `uniform float darkness;\n${shader.fragmentShader.replace(
      'gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );',
      'gl_FragColor = vec4( vec3( 0.0 ), ( 1.0 - fragCoordZ ) * darkness );'
    )}`;
  };
  depthMaterial.depthTest = false;
  depthMaterial.depthWrite = false;

  const hBlur = new THREE.ShaderMaterial(HorizontalBlurShader);
  hBlur.depthTest = false;
  const vBlur = new THREE.ShaderMaterial(VerticalBlurShader);
  vBlur.depthTest = false;

  function blurPass(amount) {
    blurPlane.visible = true;
    blurPlane.material = hBlur;
    hBlur.uniforms.tDiffuse.value = renderTarget.texture;
    hBlur.uniforms.h.value = amount / 256;
    renderer.setRenderTarget(renderTargetBlur);
    renderer.render(blurPlane, camera);

    blurPlane.material = vBlur;
    vBlur.uniforms.tDiffuse.value = renderTargetBlur.texture;
    vBlur.uniforms.v.value = amount / 256;
    renderer.setRenderTarget(renderTarget);
    renderer.render(blurPlane, camera);
    blurPlane.visible = false;
  }

  // Adatta piano e camera d'ombra alle dimensioni/base del modello.
  function fit(box) {
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const w = size.x * 1.5 + 0.2;
    const d = size.z * 1.5 + 0.2;
    group.position.set(center.x, box.min.y + 0.001, center.z);
    plane.scale.set(w, -1, d);
    blurPlane.scale.set(w, 1, d);
    camera.left = -w / 2;
    camera.right = w / 2;
    camera.top = d / 2;
    camera.bottom = -d / 2;
    camera.far = Math.max(size.y, 0.2); // oltre questa altezza il modello non fa ombra
    camera.updateProjectionMatrix();
  }

  function update(scene) {
    const prevBackground = scene.background;
    const prevClearAlpha = renderer.getClearAlpha();
    const prevTarget = renderer.getRenderTarget();
    scene.background = null;
    plane.visible = false;
    scene.overrideMaterial = depthMaterial;
    renderer.setClearAlpha(0);
    renderer.setRenderTarget(renderTarget);
    renderer.clear();
    renderer.render(scene, camera);
    scene.overrideMaterial = null;
    blurPass(blur);
    blurPass(blur * 0.4); // secondo passaggio: elimina gli artefatti del primo
    renderer.setRenderTarget(prevTarget);
    renderer.setClearAlpha(prevClearAlpha);
    scene.background = prevBackground;
    plane.visible = true;
  }

  function dispose() {
    renderTarget.dispose();
    renderTargetBlur.dispose();
    planeGeo.dispose();
    plane.material.dispose();
    depthMaterial.dispose();
    hBlur.dispose();
    vBlur.dispose();
  }

  return { group, fit, update, dispose };
}
