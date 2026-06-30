import {
  PART,
  UPPER_MODE,
  DEFAULT_MODE,
  DEFAULT_PARTS,
  COLORS,
  SECTIONS,
  CATEGORIES,
  PART_LABELS,
  TOMAIA_PARTS_BY_MODE,
  getModels,
  colorsForModel,
} from './config.js';
import { computePrice, formatMoney } from './pricing.js';
import { addToCart } from './cart.js';

const colorById = Object.fromEntries(COLORS.map((c) => [c.id, c]));

// Costruisce la barra in basso + il pannello drill-down, mantiene lo stato e lo applica al 3D.
export function createUI(root, sandal, { currency = 'EUR' } = {}) {
  const state = {
    mode: DEFAULT_MODE,
    parts: deepClone(DEFAULT_PARTS), // { [partId]: { model, color } }
    activeSection: null, // 'tomaia' | 'suola' | null
    activePart: PART.UPPER_FRONT, // parte attiva dentro la sezione
    activeCategory: 'modello', // 'modello' | 'colore'
    addStatus: '',
  };

  root.classList.add('sc-root');

  // ---- applica stato al 3D ----
  function applyAll() {
    sandal.setUpperMode(state.mode);
    for (const [partId, sel] of Object.entries(state.parts)) {
      const c = colorById[sel.color];
      if (c) sandal.setColor(partId, c.hex);
    }
  }

  function ensureValidColor(partId) {
    const allowed = colorsForModel(partId, state.parts[partId].model);
    if (!allowed.some((c) => c.id === state.parts[partId].color) && allowed[0]) {
      state.parts[partId].color = allowed[0].id;
    }
  }

  // Parte attualmente in modifica (tomaia: parte attiva; suola: la suola).
  function currentPart() {
    return state.activeSection === 'suola' ? PART.SOLE : state.activePart;
  }

  // ---- handlers ----
  function toggleSection(id) {
    if (state.activeSection === id) {
      state.activeSection = null;
    } else {
      state.activeSection = id;
      state.activeCategory = 'modello';
      if (id === 'tomaia') {
        const parts = TOMAIA_PARTS_BY_MODE[state.mode];
        if (!parts.includes(state.activePart)) state.activePart = parts[0];
      } else {
        state.activePart = PART.SOLE;
      }
    }
    state.addStatus = '';
    render();
  }

  function setMode(mode) {
    if (state.mode === mode) return;
    state.mode = mode;
    sandal.setUpperMode(mode);
    state.activePart = TOMAIA_PARTS_BY_MODE[mode][0];
    state.activeCategory = 'modello';
    applyAll();
    render();
  }

  function selectModel(modelId) {
    const partId = currentPart();
    state.parts[partId].model = modelId;
    ensureValidColor(partId);
    const c = colorById[state.parts[partId].color];
    if (c) sandal.setColor(partId, c.hex);
    render();
  }

  function selectColor(colorId) {
    const partId = currentPart();
    state.parts[partId].color = colorId;
    const c = colorById[colorId];
    if (c) sandal.setColor(partId, c.hex);
    render();
  }

  async function doAdd() {
    state.addStatus = '…';
    render();
    try {
      const res = await addToCart({ mode: state.mode, parts: state.parts });
      state.addStatus = res && res.mock
        ? 'Aggiunto (anteprima) — payload nella console.'
        : 'Aggiunto al carrello!';
    } catch (err) {
      state.addStatus = 'Errore: ' + err.message;
    }
    render();
  }

  // ---- eventi (delegati, il pannello viene ri-renderizzato) ----
  root.addEventListener('click', (e) => {
    const t = e.target;
    const section = t.closest('[data-section]');
    const mode = t.closest('[data-mode]');
    const part = t.closest('[data-part]');
    const cat = t.closest('[data-cat]');
    const model = t.closest('[data-model]');
    const color = t.closest('[data-color]');

    if (section) return toggleSection(section.dataset.section);
    if (t.closest('[data-close]')) { state.activeSection = null; return render(); }
    if (mode) return setMode(mode.dataset.mode);
    if (part) { state.activePart = part.dataset.part; state.activeCategory = 'modello'; return render(); }
    if (cat) { state.activeCategory = cat.dataset.cat; return render(); }
    if (model) return selectModel(model.dataset.model);
    if (color) return selectColor(color.dataset.color);
    if (t.closest('[data-add]')) return doAdd();
  });

  // ---- render ----
  function render() {
    root.innerHTML = panelHTML();
  }

  function panelHTML() {
    const price = computePrice({ mode: state.mode, parts: state.parts });
    return `
      ${state.activeSection ? popoverHTML() : ''}
      <div class="sc-bar">
        <div class="sc-sections">
          ${SECTIONS.map(
            (s) =>
              `<button class="sc-section${state.activeSection === s.id ? ' is-active' : ''}" data-section="${s.id}">${s.label}</button>`
          ).join('')}
        </div>
        <div class="sc-checkout">
          <span class="sc-price">${formatMoney(price.total, currency)}</span>
          <button class="sc-add" data-add>Aggiungi al carrello</button>
        </div>
      </div>
      ${state.addStatus ? `<p class="sc-status" aria-live="polite">${state.addStatus}</p>` : ''}
    `;
  }

  function popoverHTML() {
    const isTomaia = state.activeSection === 'tomaia';
    const partId = currentPart();
    const title = isTomaia ? 'Tomaia' : 'Suola';
    return `
      <div class="sc-popover">
        <div class="sc-pop-head">
          <strong>${title}</strong>
          <button class="sc-close" data-close aria-label="Chiudi">&times;</button>
        </div>
        ${isTomaia ? modeToggleHTML() + partsHTML() : ''}
        ${catsHTML()}
        <div class="sc-options">${optionsHTML(partId)}</div>
      </div>
    `;
  }

  function modeToggleHTML() {
    const btn = (m, label) =>
      `<button class="sc-toggle-btn${state.mode === m ? ' is-active' : ''}" data-mode="${m}">${label}</button>`;
    return `<div class="sc-toggle">${btn(UPPER_MODE.SPLIT, 'Separata')}${btn(UPPER_MODE.WHOLE, 'Intera')}</div>`;
  }

  function partsHTML() {
    const parts = TOMAIA_PARTS_BY_MODE[state.mode];
    if (parts.length < 2) return ''; // tomaia intera: parte unica, nessun selettore
    return `<div class="sc-parts">${parts
      .map(
        (pid) =>
          `<button class="sc-part${state.activePart === pid ? ' is-active' : ''}" data-part="${pid}">${PART_LABELS[pid]}</button>`
      )
      .join('')}</div>`;
  }

  function catsHTML() {
    return `<div class="sc-cats">${CATEGORIES.map(
      (c) =>
        `<button class="sc-cat${state.activeCategory === c.id ? ' is-active' : ''}" data-cat="${c.id}">${c.label}</button>`
    ).join('')}</div>`;
  }

  function optionsHTML(partId) {
    if (state.activeCategory === 'modello') {
      return `<div class="sc-models">${getModels(partId)
        .map((m) => {
          const active = state.parts[partId].model === m.id;
          const single = Array.isArray(m.colors) && m.colors.length === 1;
          const thumb = colorsForModel(partId, m.id)[0];
          const badge = m.priceDelta ? `<span class="sc-badge">+${formatMoney(m.priceDelta, currency)}</span>` : '';
          return `<button class="sc-model${active ? ' is-active' : ''}" data-model="${m.id}">
              <span class="sc-model-thumb" style="--sc-color:${thumb ? thumb.hex : '#ccc'}"></span>
              <span class="sc-model-label">${m.label}${single ? ' · colore unico' : ''}</span>
              ${badge}
            </button>`;
        })
        .join('')}</div>`;
    }

    // categoria colore
    const colors = colorsForModel(partId, state.parts[partId].model);
    const current = state.parts[partId].color;
    const swatches = colors
      .map((c) => {
        const extra = c.priceDelta ? ` (+${formatMoney(c.priceDelta, currency)})` : '';
        return `<button class="sc-swatch${c.id === current ? ' is-active' : ''}" data-color="${c.id}" style="--sc-color:${c.hex}" title="${c.label}${extra}" aria-label="${c.label}"></button>`;
      })
      .join('');
    const note = colors.length === 1 ? `<span class="sc-fixed">Colore unico per questo modello</span>` : '';
    return `<div class="sc-swatches">${swatches}${note}</div>`;
  }

  // init
  applyAll();
  render();

  return { state };
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
