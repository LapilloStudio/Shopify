import './styles.css';
import { createScene } from './scene.js';
import { createSandal } from './model.js';
import { createUI } from './ui.js';

// Monta un'istanza del configuratore su un elemento `.sandal-configurator`.
async function mount(rootEl) {
  if (rootEl.dataset.scMounted) return;
  rootEl.dataset.scMounted = '1';

  const data = (typeof window !== 'undefined' && window.SANDAL_CONFIGURATOR_DATA) || {};

  const canvasWrap = rootEl.querySelector('[data-sc-canvas]') || rootEl;
  let canvas = canvasWrap.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvasWrap.appendChild(canvas);
  }
  const panelEl = rootEl.querySelector('[data-sc-panel]');

  const modelUrl = rootEl.dataset.modelUrl || data.modelUrl || null;
  const currency = data.currency || 'EUR';

  const sceneApi = createScene(canvas);
  const sandal = await createSandal(sceneApi.scene, { modelUrl });
  sceneApi.resize();

  if (panelEl) createUI(panelEl, sandal, { currency });
}

function init() {
  document.querySelectorAll('.sandal-configurator').forEach((el) => mount(el));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Re-init quando la sezione viene (ri)caricata nell'editor del tema Shopify.
document.addEventListener('shopify:section:load', init);
