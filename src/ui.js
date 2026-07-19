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
// onPanelToggle(open) viene chiamato quando il pannello opzioni si apre/chiude.
// onAdded() viene chiamato dopo un add-to-cart reale riuscito (non l'anteprima mock).
export function createUI(root, sandal, { currency = 'EUR', onPanelToggle, onAdded } = {}) {
  const state = {
    mode: DEFAULT_MODE,
    parts: deepClone(DEFAULT_PARTS), // { [partId]: { model, color } }
    activeSection: null, // 'tomaia' | 'suola' | null
    activePart: PART.UPPER_FRONT, // parte attiva dentro la sezione
    activeCategory: 'modello', // 'modello' | 'colore'
    addStatus: '',
    adding: false,
  };

  restoreFromHash(state);

  root.classList.add('sc-root');

  // ---- applica stato al 3D ----
  function applyAll() {
    sandal.setUpperMode(state.mode);
    for (const [partId, sel] of Object.entries(state.parts)) {
      sandal.setModel(partId, sel.model);
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

  function selection() {
    return { mode: state.mode, parts: state.parts };
  }

  function notifyPanel() {
    if (onPanelToggle) onPanelToggle(!!state.activeSection);
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
    notifyPanel();
    render();
  }

  function setMode(mode) {
    if (state.mode === mode) return;
    state.mode = mode;
    state.activePart = TOMAIA_PARTS_BY_MODE[mode][0];
    state.activeCategory = 'modello';
    applyAll();
    syncHash(state);
    render();
  }

  function selectModel(modelId) {
    const partId = currentPart();
    state.parts[partId].model = modelId;
    ensureValidColor(partId);
    applyAll();
    syncHash(state);
    render();
  }

  function selectColor(colorId) {
    const partId = currentPart();
    state.parts[partId].color = colorId;
    const c = colorById[colorId];
    if (c) sandal.setColor(partId, c.hex);
    syncHash(state);
    render();
  }

  async function doAdd() {
    if (state.adding) return;
    state.adding = true;
    state.addStatus = '';
    render();
    try {
      const res = await addToCart(selection());
      const isMock = res && res.mock;
      state.addStatus = isMock
        ? 'Aggiunto (anteprima) — payload nella console.'
        : 'Aggiunto al carrello!';
      if (!isMock && onAdded) onAdded();
    } catch (err) {
      state.addStatus = 'Errore: ' + err.message;
    }
    state.adding = false;
    render();
  }

  // ---- eventi (delegati; il pannello viene ri-renderizzato) ----
  root.addEventListener('click', (e) => {
    const t = e.target;
    const section = t.closest('[data-section]');
    const mode = t.closest('[data-mode]');
    const part = t.closest('[data-part]');
    const cat = t.closest('[data-cat]');
    const model = t.closest('[data-model]');
    const color = t.closest('[data-color]');

    if (section) return toggleSection(section.dataset.section);
    if (t.closest('[data-close]')) { state.activeSection = null; notifyPanel(); return render(); }
    if (mode) return setMode(mode.dataset.mode);
    if (part) { state.activePart = part.dataset.part; state.activeCategory = 'modello'; return render(); }
    if (cat) { state.activeCategory = cat.dataset.cat; return render(); }
    if (model) return selectModel(model.dataset.model);
    if (color) return selectColor(color.dataset.color);
    if (t.closest('[data-add]')) return doAdd();
  });

  // Escape chiude il pannello aperto.
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.activeSection) {
      e.stopPropagation(); // non lasciare che l'Escape chiuda anche la modale a schermo intero
      state.activeSection = null;
      notifyPanel();
      render();
      root.querySelector('[data-section]')?.focus();
    }
  });

  // ---- render (con ripristino del focus per la navigazione da tastiera) ----
  function render() {
    const fk = document.activeElement?.closest?.('[data-fk]')?.dataset.fk;
    root.innerHTML = panelHTML();
    if (fk) {
      const el = root.querySelector(`[data-fk="${cssEscape(fk)}"]`);
      if (el) el.focus();
    }
  }

  function panelHTML() {
    const price = computePrice(selection());
    return `
      ${state.activeSection ? popoverHTML() : ''}
      <div class="sc-bar">
        <div class="sc-sections">
          ${SECTIONS.map(
            (s) =>
              `<button class="sc-section${state.activeSection === s.id ? ' is-active' : ''}" data-section="${s.id}" data-fk="s:${s.id}" aria-expanded="${state.activeSection === s.id}">${s.label}</button>`
          ).join('')}
        </div>
        <div class="sc-checkout">
          <span class="sc-price">${formatMoney(price.total, currency)}</span>
          <button class="sc-add" data-add data-fk="add" ${state.adding ? 'disabled' : ''}>${state.adding ? 'Aggiunta…' : 'Aggiungi al carrello'}</button>
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
      <div class="sc-popover" role="dialog" aria-label="${title}">
        <div class="sc-pop-head">
          <strong>${title}</strong>
          <button class="sc-close" data-close data-fk="close" aria-label="Chiudi">&times;</button>
        </div>
        ${isTomaia ? modeToggleHTML() + partsHTML() : ''}
        ${catsHTML()}
        <div class="sc-options">${optionsHTML(partId)}</div>
        ${breakdownHTML()}
      </div>
    `;
  }

  function modeToggleHTML() {
    const btn = (m, label) =>
      `<button class="sc-toggle-btn${state.mode === m ? ' is-active' : ''}" data-mode="${m}" data-fk="m:${m}" aria-pressed="${state.mode === m}">${label}</button>`;
    return `<div class="sc-toggle" role="group" aria-label="Tipo di tomaia">${btn(UPPER_MODE.SPLIT, 'Separata')}${btn(UPPER_MODE.WHOLE, 'Intera')}</div>`;
  }

  function partsHTML() {
    const parts = TOMAIA_PARTS_BY_MODE[state.mode];
    if (parts.length < 2) return ''; // tomaia intera: parte unica, nessun selettore
    return `<div class="sc-parts">${parts
      .map(
        (pid) =>
          `<button class="sc-part${state.activePart === pid ? ' is-active' : ''}" data-part="${pid}" data-fk="p:${pid}" aria-pressed="${state.activePart === pid}">${PART_LABELS[pid]}</button>`
      )
      .join('')}</div>`;
  }

  function catsHTML() {
    return `<div class="sc-cats">${CATEGORIES.map(
      (c) =>
        `<button class="sc-cat${state.activeCategory === c.id ? ' is-active' : ''}" data-cat="${c.id}" data-fk="c:${c.id}" aria-pressed="${state.activeCategory === c.id}">${c.label}</button>`
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
          return `<button class="sc-model${active ? ' is-active' : ''}" data-model="${m.id}" data-fk="mo:${m.id}" aria-pressed="${active}">
              <span class="sc-model-thumb" style="--sc-color:${thumb ? thumb.hex : '#ccc'}"></span>
              <span class="sc-model-label">${m.label}${single ? ' · colore unico' : ''}</span>
              ${badge}
            </button>`;
        })
        .join('')}</div>`;
    }

    // categoria colore (filtrata dal modello selezionato)
    const colors = colorsForModel(partId, state.parts[partId].model);
    const current = state.parts[partId].color;
    const swatches = colors
      .map((c) => {
        const extra = c.priceDelta ? ` (+${formatMoney(c.priceDelta, currency)})` : '';
        return `<button class="sc-swatch${c.id === current ? ' is-active' : ''}" data-color="${c.id}" data-fk="co:${c.id}" aria-pressed="${c.id === current}" style="--sc-color:${c.hex}" title="${c.label}${extra}" aria-label="${c.label}"></button>`;
      })
      .join('');
    const note = colors.length === 1 ? `<span class="sc-fixed">Colore unico per questo modello</span>` : '';
    return `<div class="sc-swatches">${swatches}${note}</div>`;
  }

  function breakdownHTML() {
    const p = computePrice(selection());
    if (!p.breakdown.length) return '';
    return `<ul class="sc-pop-breakdown">
      <li>Base<span>${formatMoney(p.base, currency)}</span></li>
      ${p.breakdown.map((b) => `<li>${b.label}<span>+${formatMoney(b.amount, currency)}</span></li>`).join('')}
    </ul>`;
  }

  // init
  applyAll();
  render();

  return { state };
}

// ---------------------------------------------------------------------------
// Configurazione condivisibile via hash URL: #sc=<mode>~<part>:<model>.<color>~...
// La configurazione sopravvive al reload e il link è condivisibile.
// ---------------------------------------------------------------------------
function syncHash(state) {
  if (typeof window === 'undefined') return;
  if (window.Shopify && window.Shopify.designMode) return; // non sporcare l'editor tema
  const parts = Object.entries(state.parts)
    .map(([pid, sel]) => `${pid}:${sel.model}.${sel.color}`)
    .join('~');
  try {
    history.replaceState(null, '', `#sc=${state.mode}~${parts}`);
  } catch {
    /* contesti sandbox: ignora */
  }
}

function restoreFromHash(state) {
  if (typeof window === 'undefined') return;
  const m = /(?:^|[#&])sc=([^&]+)/.exec(window.location.hash || '');
  if (!m) return;
  const [mode, ...pairs] = decodeURIComponent(m[1]).split('~');
  if (Object.values(UPPER_MODE).includes(mode)) state.mode = mode;
  for (const pair of pairs) {
    const pm = /^([A-Za-z]+):([\w-]+)\.([\w-]+)$/.exec(pair);
    if (!pm) continue;
    const [, partId, modelId, colorId] = pm;
    if (!state.parts[partId]) continue;
    const model = getModels(partId).find((x) => x.id === modelId);
    if (!model) continue;
    state.parts[partId].model = modelId;
    const allowed = colorsForModel(partId, modelId);
    state.parts[partId].color = allowed.some((c) => c.id === colorId)
      ? colorId
      : (allowed[0] ? allowed[0].id : state.parts[partId].color);
  }
  // riallinea la parte attiva alla modalità ripristinata
  state.activePart = TOMAIA_PARTS_BY_MODE[state.mode][0];
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function cssEscape(s) {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(s) : s.replace(/["\\]/g, '\\$&');
}
