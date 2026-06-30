import { COLORS, PRICING, UPPER_MODE, PARTS_BY_MODE } from './config.js';

const colorById = Object.fromEntries(COLORS.map((c) => [c.id, c]));

// selection: { mode, colors: { [partName]: colorId }, ... }
// Ritorna { base, surcharge, total, breakdown[] } in centesimi.
export function computePrice(selection) {
  const base = PRICING.basePrice;
  const breakdown = [];
  let surcharge = 0;

  // Sovrapprezzo dei colori "premium", solo sulle parti visibili nella modalità corrente.
  const visibleParts = PARTS_BY_MODE[selection.mode].map((p) => p.id);
  for (const partId of visibleParts) {
    const color = colorById[selection.colors[partId]];
    if (color && color.priceDelta > 0) {
      surcharge += color.priceDelta;
      breakdown.push({ label: `Colore ${color.label}`, amount: color.priceDelta });
    }
  }

  // Sovrapprezzo tomaia intera.
  if (selection.mode === UPPER_MODE.WHOLE && PRICING.wholeUpperSurcharge > 0) {
    surcharge += PRICING.wholeUpperSurcharge;
    breakdown.push({ label: 'Tomaia intera', amount: PRICING.wholeUpperSurcharge });
  }

  return { base, surcharge, total: base + surcharge, breakdown };
}

// Determina la "fascia" (variante Shopify) dal sovrapprezzo totale.
export function computeTier(selection) {
  const { surcharge } = computePrice(selection);
  for (const tier of PRICING.tiers) {
    if (surcharge <= tier.maxSurcharge) return tier;
  }
  return PRICING.tiers[PRICING.tiers.length - 1];
}

// Formatta centesimi in valuta.
export function formatMoney(cents, currency = 'EUR', locale = 'it-IT') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}
