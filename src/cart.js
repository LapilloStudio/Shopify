import { PART, UPPER_MODE, COLORS } from './config.js';
import { computePrice, computeTier } from './pricing.js';

const colorById = Object.fromEntries(COLORS.map((c) => [c.id, c]));

// Dati iniettati dalla sezione Liquid (in Shopify). Nell'harness/dev è assente -> mock.
function getShopData() {
  return (typeof window !== 'undefined' && window.SANDAL_CONFIGURATOR_DATA) || null;
}

function partColorLabel(partId) {
  switch (partId) {
    case PART.UPPER_FRONT: return 'Colore tomaia davanti';
    case PART.UPPER_BACK: return 'Colore tomaia dietro';
    case PART.UPPER_WHOLE: return 'Colore tomaia';
    case PART.SOLE: return 'Colore suola';
    default: return partId;
  }
}

// Costruisce le line item properties leggibili a partire dalla selezione.
export function buildProperties(selection) {
  const props = {};
  props['Tomaia'] = selection.mode === UPPER_MODE.WHOLE ? 'Intera' : 'Davanti + dietro';

  const visible = selection.mode === UPPER_MODE.WHOLE
    ? [PART.UPPER_WHOLE, PART.SOLE]
    : [PART.UPPER_FRONT, PART.UPPER_BACK, PART.SOLE];

  for (const partId of visible) {
    const c = colorById[selection.colors[partId]];
    if (c) props[partColorLabel(partId)] = c.label;
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
    // Modalità anteprima/harness: nessun vero carrello.
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

  // Notifica il tema (eventuale cart drawer) o, in assenza, vai al carrello.
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
