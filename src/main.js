import './styles.css';
import { createScene } from './scene.js';
import { createSandal } from './model.js';
import { createUI } from './ui.js';

// stage (.sandal-configurator) -> { sceneApi } — per resize on-open e cleanup nell'editor tema.
const instances = new Map();

// Monta il 3D + il pannello sullo stage al primo utilizzo (idempotente).
async function mountConfigurator(stage, embed) {
  if (instances.has(stage)) return instances.get(stage);

  const data = (typeof window !== 'undefined' && window.SANDAL_CONFIGURATOR_DATA) || {};

  const canvasWrap = stage.querySelector('[data-sc-canvas]') || stage;
  let canvas = canvasWrap.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvasWrap.appendChild(canvas);
  }
  const panelEl = stage.querySelector('[data-sc-panel]');

  const modelUrl = stage.dataset.modelUrl || data.modelUrl || null;
  const currency = data.currency || 'EUR';

  const sceneApi = createScene(canvas);
  const sandal = await createSandal(sceneApi.scene, { modelUrl });
  sceneApi.resize();

  if (panelEl) {
    createUI(panelEl, sandal, {
      currency,
      onPanelToggle: (open) => sceneApi.setPanelOpen(open),
      // Su un vero add-to-cart (non l'anteprima mock) chiudiamo la modale:
      // l'utente torna alla pagina/carrello invece di restare nell'overlay.
      onAdded: () => closeModal(embed),
    });
  }

  const inst = { sceneApi };
  instances.set(stage, inst);
  return inst;
}

function openModal(embed) {
  const modal = embed.querySelector('[data-sc-modal]');
  const stage = embed.querySelector('.sandal-configurator');
  if (!modal || !stage) return;

  modal.hidden = false;
  document.documentElement.classList.add('sc-modal-open');

  mountConfigurator(stage, embed).then((inst) => {
    // Il canvas era display:none finché la modale era chiusa: va ridimensionato ora.
    inst.sceneApi.resize();
  });

  modal.querySelector('[data-sc-close]')?.focus();
}

function closeModal(embed) {
  const modal = embed.querySelector('[data-sc-modal]');
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  document.documentElement.classList.remove('sc-modal-open');
  embed.querySelector('[data-sc-open]')?.focus();
}

function wire(embed) {
  if (embed.dataset.scWired) return;
  embed.dataset.scWired = '1';

  embed.querySelector('[data-sc-open]')?.addEventListener('click', () => openModal(embed));
  embed.querySelector('[data-sc-close]')?.addEventListener('click', () => closeModal(embed));

  // Escape chiude la modale, ma solo se non è già stato gestito da un popover
  // interno del pannello opzioni (che ferma la propagazione — vedi ui.js).
  embed.querySelector('[data-sc-modal]')?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal(embed);
  });
}

function init() {
  document.querySelectorAll('.sandal-configurator-embed').forEach(wire);

  // Link condiviso (#sc=...): apre automaticamente il configuratore con la
  // configurazione salvata, altrimenti il link condiviso non mostrerebbe nulla.
  if (window.location.hash.startsWith('#sc=')) {
    const embed = document.querySelector('.sandal-configurator-embed');
    if (embed) openModal(embed);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Editor tema Shopify: ri-collega al (ri)caricamento della sezione, cleanup alla rimozione.
document.addEventListener('shopify:section:load', init);
document.addEventListener('shopify:section:unload', (e) => {
  for (const [stage, inst] of instances) {
    if (!document.contains(stage) || (e.target && e.target.contains(stage))) {
      inst.sceneApi.dispose();
      instances.delete(stage);
    }
  }
});
