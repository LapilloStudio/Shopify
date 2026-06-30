import { PART, UPPER_MODE, COLORS, visibleParts, getModel } from './config.js';
import { computePrice, computeTier } from './pricing.js';

const colorById = Object.fromEntries(COLORS.map((c) => [c.id, c]));

// Etichette leggibili delle parti per le line item properties.
const PROP_LABEL = {
  [PART.UPPER_FRONT]: 'Tomaia davanti',
  [PART.UPPER_BACK]: 'Tomaia dietro',
  [PART.UPPER_WHOLE]: 'Tomaia intera',
  [PART.SOLE]: 'Suola',
};

// Dati iniettati dalla sezione Liquid (in Shopify). Nell'harness/dev è assente -> mock.
function getShopData() {
  return (typeof window !== 'undefined' && window.SANDAL_CONFIGURATOR_DATA) || null;
}

// Costruisce le line item properties leggibili: per ogni parte visibile "Modello / Colore".
export function buildProperties(selection) {
  const props = {};
  props['Tomaia'] = selection.mode === UPPER_MODE.WHOLE ? 'Intera' : 'Separata (davanti + dietro)';

  for (const partId of visibleParts(selection.mode)) {
    const sel = selection.parts[partId];
    if (!sel) continue;
    const model = getModel(partId, sel.model);
    const color = colorById[sel.color];
    props[PROP_LABEL[partId]] = `${model ? model.label : '—'}${color ? ' / ' + color.label : ''}`;
  }
  return props;
}

// Trova la variante corrispondente alla fascia di prezzo calcolata
// (match per option1 / titolo variante uguale alla label della fascia).
function findVariantForTier(data, tier) {
  if (!data || !Array.isArray(data.variants) || data.variants.length === 0) return null;
  const want = tier.label.toLowerCase();
  return (
    data.variants.find((v) => (v.option || v.title || '').toLowerCase() === want) ||
    data.variants[0]
  );
}

// Aggiunge al carrello. In Shopify usa /cart/add.js; altrimenti mock (console + payload).
export async function addToCart(selection) {
  const data = getShopData();
  const properties = buildProperties(selection);
  const tier = computeTier(selection);
  const price = computePrice(selection);

  if (!data) {
    const payload = { mock: true, tier: tier.id, properties, price };
    console.log('[sandal] add-to-cart (mock):', payload);
    return payload;
  }

  const variant = findVariantForTier(data, tier);
  if (!variant) throw new Error('Nessuna variante disponibile per questo prodotto.');

  const addUrl = (data.routes && data.routes.cart_add_url) || '/cart/add.js';
  const res = await fetch(addUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ items: [{ id: variant.id, quantity: 1, properties }] }),
  });
  if (!res.ok) throw new Error(`Carrello: HTTP ${res.status}`);
  const json = await res.json();

  document.dispatchEvent(new CustomEvent('sandal:added', { detail: json }));
  if (!hasCartDrawer()) {
    const cartUrl = (data.routes && data.routes.cart_url) || '/cart';
    window.location.href = cartUrl;
  }
  return json;
}

function hasCartDrawer() {
  return !!document.querySelector('cart-drawer, #CartDrawer, [data-cart-drawer]');
}
