import { COLORS, PARTS_BY_MODE, UPPER_MODE, DEFAULT_COLORS, DEFAULT_MODE } from './config.js';
import { computePrice, formatMoney } from './pricing.js';
import { addToCart } from './cart.js';

// Costruisce il pannello opzioni, mantiene lo stato e lo applica al modello 3D.
export function createUI(root, sandal, { currency = 'EUR' } = {}) {
  const state = {
    mode: DEFAULT_MODE,
    colors: { ...DEFAULT_COLORS },
    selectedPart: PARTS_BY_MODE[DEFAULT_MODE][0].id,
  };

  root.classList.add('sc-panel');
  root.innerHTML = template();

  const el = {
    modeBtns: root.querySelectorAll('[data-mode]'),
    parts: root.querySelector('[data-parts]'),
    swatches: root.querySelector('[data-swatches]'),
    price: root.querySelector('[data-price]'),
    breakdown: root.querySelector('[data-breakdown]'),
    addBtn: root.querySelector('[data-add]'),
    status: root.querySelector('[data-status]'),
  };

  // ---- render ----
  function renderModeButtons() {
    el.modeBtns.forEach((b) => b.classList.toggle('is-active', b.dataset.mode === state.mode));
  }

  function renderParts() {
    el.parts.innerHTML = PARTS_BY_MODE[state.mode]
      .map(
        (p) =>
          `<button class="sc-tab${p.id === state.selectedPart ? ' is-active' : ''}" data-part="${p.id}">${p.label}</button>`
      )
      .join('');
  }

  function renderSwatches() {
    const current = state.colors[state.selectedPart];
    el.swatches.innerHTML = COLORS.map((c) => {
      const extra = c.priceDelta ? ` (+${formatMoney(c.priceDelta, currency)})` : '';
      return `<button class="sc-swatch${c.id === current ? ' is-active' : ''}" data-color="${c.id}" title="${c.label}${extra}" style="--sc-color:${c.hex}" aria-label="${c.label}"></button>`;
    }).join('');
  }

  function renderPrice() {
    const p = computePrice(state);
    el.price.textContent = formatMoney(p.total, currency);
    el.breakdown.innerHTML = p.breakdown.length
      ? p.breakdown
          .map((b) => `<li>${b.label}<span>+${formatMoney(b.amount, currency)}</span></li>`)
          .join('')
      : '';
  }

  function renderAll() {
    renderModeButtons();
    renderParts();
    renderSwatches();
    renderPrice();
  }

  // ---- applica stato al 3D ----
  function applyMode() {
    sandal.setUpperMode(state.mode);
  }
  function applyColors() {
    for (const [part, colorId] of Object.entries(state.colors)) {
      const c = COLORS.find((x) => x.id === colorId);
      if (c) sandal.setColor(part, c.hex);
    }
  }

  // ---- eventi ----
  el.modeBtns.forEach((btn) =>
    btn.addEventListener('click', () => {
      state.mode = btn.dataset.mode;
      const parts = PARTS_BY_MODE[state.mode];
      if (!parts.some((p) => p.id === state.selectedPart)) state.selectedPart = parts[0].id;
      applyMode();
      renderAll();
    })
  );

  el.parts.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-part]');
    if (!btn) return;
    state.selectedPart = btn.dataset.part;
    renderParts();
    renderSwatches();
  });

  el.swatches.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-color]');
    if (!btn) return;
    state.colors[state.selectedPart] = btn.dataset.color;
    applyColors();
    renderSwatches();
    renderPrice();
  });

  el.addBtn.addEventListener('click', async () => {
    el.addBtn.disabled = true;
    el.status.textContent = '';
    try {
      const res = await addToCart(state);
      el.status.textContent = res && res.mock
        ? 'Aggiunto (anteprima) — payload nella console.'
        : 'Aggiunto al carrello!';
    } catch (err) {
      el.status.textContent = 'Errore: ' + err.message;
    } finally {
      el.addBtn.disabled = false;
    }
  });

  // init
  applyMode();
  applyColors();
  renderAll();

  return { state };
}

function template() {
  return `
    <div class="sc-group">
      <h3 class="sc-title">Tomaia</h3>
      <div class="sc-modes">
        <button class="sc-mode" data-mode="${UPPER_MODE.SPLIT}">Davanti + dietro</button>
        <button class="sc-mode" data-mode="${UPPER_MODE.WHOLE}">Tomaia intera</button>
      </div>
    </div>
    <div class="sc-group">
      <h3 class="sc-title">Parte da colorare</h3>
      <div class="sc-tabs" data-parts></div>
    </div>
    <div class="sc-group">
      <h3 class="sc-title">Colore</h3>
      <div class="sc-swatches" data-swatches></div>
    </div>
    <div class="sc-summary">
      <ul class="sc-breakdown" data-breakdown></ul>
      <div class="sc-price-row"><span>Totale</span><strong class="sc-price" data-price></strong></div>
      <button class="sc-add" data-add>Aggiungi al carrello</button>
      <p class="sc-status" data-status aria-live="polite"></p>
    </div>
  `;
}
