import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PART,
  UPPER_MODE,
  DEFAULT_MODE,
  DEFAULT_PARTS,
  MODELS_BY_PART,
  PRICING,
  getModel,
  colorsForModel,
} from '../src/config.js';
import { computePrice, computeTier } from '../src/pricing.js';
import { buildProperties } from '../src/cart.js';

function defaultSelection() {
  return { mode: DEFAULT_MODE, parts: structuredClone(DEFAULT_PARTS) };
}

test('la configurazione di default costa il prezzo base (fascia Standard)', () => {
  const sel = defaultSelection();
  const p = computePrice(sel);
  assert.equal(p.surcharge, 0);
  assert.equal(p.total, PRICING.basePrice);
  assert.equal(computeTier(sel).id, 'standard');
});

test('modello e colore premium si sommano e portano in fascia Premium', () => {
  const sel = defaultSelection();
  sel.parts[PART.UPPER_FRONT] = { model: 'gold', color: 'gold' }; // +1500 modello, +800 colore
  const p = computePrice(sel);
  assert.equal(p.surcharge, 2300);
  assert.equal(computeTier(sel).id, 'premium');
});

test('in modalità Intera le tomaie separate sono escluse dal prezzo', () => {
  const sel = defaultSelection();
  sel.parts[PART.UPPER_FRONT] = { model: 'gold', color: 'gold' }; // non deve contare
  sel.mode = UPPER_MODE.WHOLE;
  const p = computePrice(sel);
  assert.equal(p.surcharge, PRICING.wholeUpperSurcharge);
  assert.equal(computeTier(sel).id, 'plus'); // 1500 = limite fascia Plus
});

test('i modelli a colore unico espongono esattamente un colore', () => {
  const gold = colorsForModel(PART.UPPER_FRONT, 'gold');
  assert.equal(gold.length, 1);
  assert.equal(gold[0].id, 'gold');
});

test('integrità config: default validi e fasce ben formate', () => {
  for (const [partId, sel] of Object.entries(DEFAULT_PARTS)) {
    assert.ok(getModel(partId, sel.model), `modello default mancante per ${partId}`);
    const allowed = colorsForModel(partId, sel.model);
    assert.ok(allowed.length > 0, `nessun colore per ${partId}/${sel.model}`);
    assert.ok(
      allowed.some((c) => c.id === sel.color),
      `colore default non ammesso per ${partId}`
    );
  }
  for (const models of Object.values(MODELS_BY_PART)) {
    assert.ok(models.length > 0);
  }
  const tiers = PRICING.tiers;
  assert.equal(tiers[tiers.length - 1].maxSurcharge, Infinity, 'ultima fascia deve coprire tutto');
  for (let i = 1; i < tiers.length; i++) {
    assert.ok(tiers[i].maxSurcharge > tiers[i - 1].maxSurcharge, 'fasce non crescenti');
  }
});

test('le properties del carrello riflettono modalità, modello e colore', () => {
  const sel = defaultSelection();
  const propsSplit = buildProperties(sel);
  assert.equal(propsSplit['Tomaia'], 'Separata (davanti + dietro)');
  assert.ok(propsSplit['Tomaia davanti'].includes('Classica'));
  assert.ok(propsSplit['Tomaia davanti'].includes('Nero'));
  assert.ok(!('Tomaia intera' in propsSplit));

  sel.mode = UPPER_MODE.WHOLE;
  const propsWhole = buildProperties(sel);
  assert.equal(propsWhole['Tomaia'], 'Intera');
  assert.ok('Tomaia intera' in propsWhole);
  assert.ok(!('Tomaia davanti' in propsWhole));
});
