// Definizioni "di dominio" del configuratore: parti, modalità, modelli, colori, prezzo.
// Tutto ciò che è personalizzabile sta qui, separato dalla logica 3D / UI / carrello.

// ---------------------------------------------------------------------------
// Model Contract — nomi delle mesh attesi nel modello 3D.
// I file .glb reali DEVONO usare questi nomi per innestarsi senza modifiche.
// Per gli stili (vedi MODELS_BY_PART) la convenzione è `Nome__idModello`,
// es. `UpperFront__classic`, `UpperFront__cross` (vedi README).
// ---------------------------------------------------------------------------
export const PART = {
  SOLE: 'Sole', // suola
  UPPER_FRONT: 'UpperFront', // tomaia davanti
  UPPER_BACK: 'UpperBack', // tomaia dietro
  UPPER_WHOLE: 'UpperWhole', // tomaia intera (pezzo unico)
};

export const PART_LABELS = {
  [PART.UPPER_FRONT]: 'Davanti',
  [PART.UPPER_BACK]: 'Dietro',
  [PART.UPPER_WHOLE]: 'Intera',
  [PART.SOLE]: 'Suola',
};

// Modalità della tomaia (mutuamente esclusive).
export const UPPER_MODE = {
  SPLIT: 'split', // tomaia davanti + dietro indipendenti
  WHOLE: 'whole', // tomaia intera (pezzo unico)
};

export const DEFAULT_MODE = UPPER_MODE.SPLIT;

// Parti della tomaia visibili per modalità.
export const TOMAIA_PARTS_BY_MODE = {
  [UPPER_MODE.SPLIT]: [PART.UPPER_FRONT, PART.UPPER_BACK],
  [UPPER_MODE.WHOLE]: [PART.UPPER_WHOLE],
};

// Tutte le parti visibili (tomaia in base alla modalità + suola).
export function visibleParts(mode) {
  return [...TOMAIA_PARTS_BY_MODE[mode], PART.SOLE];
}

// Sezioni di primo livello (barra in basso).
export const SECTIONS = [
  { id: 'tomaia', label: 'Tomaia' },
  { id: 'suola', label: 'Suola' },
];

// Categorie dentro ogni parte (drill-down): prima il Modello, poi il Colore.
export const CATEGORIES = [
  { id: 'modello', label: 'Modello' },
  { id: 'colore', label: 'Colore' },
];

// ---------------------------------------------------------------------------
// Colori. `priceDelta` in centesimi (sovrapprezzo per i colori "premium").
// ---------------------------------------------------------------------------
export const COLORS = [
  { id: 'natural', label: 'Naturale', hex: '#d9b38c', priceDelta: 0 },
  { id: 'black', label: 'Nero', hex: '#1f1f1f', priceDelta: 0 },
  { id: 'white', label: 'Bianco', hex: '#f2efe9', priceDelta: 0 },
  { id: 'tan', label: 'Cuoio', hex: '#a9743b', priceDelta: 0 },
  { id: 'red', label: 'Rosso', hex: '#b5322f', priceDelta: 500 },
  { id: 'cobalt', label: 'Cobalto', hex: '#2f5bb5', priceDelta: 500 },
  { id: 'gold', label: 'Oro', hex: '#c9a227', priceDelta: 800 },
];

// Set di colori riutilizzabili (riferiti per nome in MODELS_BY_PART.colors).
export const COLOR_SETS = {
  standard: ['natural', 'black', 'white', 'tan'], // i "4 colori" base
  full: ['natural', 'black', 'white', 'tan', 'red', 'cobalt', 'gold'],
};

// ---------------------------------------------------------------------------
// Modelli disponibili per ciascuna parte.
// `colors` = nome di un COLOR_SET oppure lista di id colore.
// Una lista con un solo id ⇒ colore unico (fisso, non modificabile).
// `priceDelta` in centesimi.
// ---------------------------------------------------------------------------
export const MODELS_BY_PART = {
  [PART.UPPER_FRONT]: [
    { id: 'classic', label: 'Classica', priceDelta: 0, colors: 'standard' },
    { id: 'cross', label: 'Incrociata', priceDelta: 500, colors: 'full' },
    { id: 'gold', label: 'Gold Edition', priceDelta: 1500, colors: ['gold'] },
  ],
  [PART.UPPER_BACK]: [
    { id: 'strap', label: 'Cinturino', priceDelta: 0, colors: 'standard' },
    { id: 'closed', label: 'Chiusa', priceDelta: 500, colors: 'full' },
  ],
  [PART.UPPER_WHOLE]: [
    { id: 'band', label: 'Fascia unica', priceDelta: 0, colors: 'standard' },
    { id: 'woven', label: 'Intrecciata', priceDelta: 800, colors: 'full' },
    { id: 'platinum', label: 'Platinum', priceDelta: 2000, colors: ['white'] },
  ],
  [PART.SOLE]: [
    { id: 'flat', label: 'Bassa', priceDelta: 0, colors: 'standard' },
    { id: 'wedge', label: 'Zeppa', priceDelta: 1000, colors: 'standard' },
  ],
};

const COLOR_BY_ID = Object.fromEntries(COLORS.map((c) => [c.id, c]));

export function getModels(partId) {
  return MODELS_BY_PART[partId] || [];
}

export function getModel(partId, modelId) {
  const models = getModels(partId);
  return models.find((m) => m.id === modelId) || models[0];
}

// Colori ammessi dal modello selezionato (oggetti colore completi).
export function colorsForModel(partId, modelId) {
  const model = getModel(partId, modelId);
  if (!model) return [];
  const ids = Array.isArray(model.colors) ? model.colors : COLOR_SETS[model.colors] || [];
  return ids.map((id) => COLOR_BY_ID[id]).filter(Boolean);
}

// Stato iniziale per parte (modello + colore di default, coerente coi colori ammessi).
export const DEFAULT_PARTS = {
  [PART.UPPER_FRONT]: { model: 'classic', color: 'black' },
  [PART.UPPER_BACK]: { model: 'strap', color: 'black' },
  [PART.UPPER_WHOLE]: { model: 'band', color: 'natural' },
  [PART.SOLE]: { model: 'flat', color: 'tan' },
};

// Regole di prezzo (valori segnaposto in centesimi — sostituire con i prezzi reali).
export const PRICING = {
  basePrice: 7900, // prezzo base del sandalo
  wholeUpperSurcharge: 1500, // sovrapprezzo per la modalità tomaia intera

  // Mappatura su "fasce" = varianti Shopify, in base al sovrapprezzo totale.
  // La prima fascia il cui `maxSurcharge` >= sovrapprezzo vince.
  tiers: [
    { id: 'standard', label: 'Standard', maxSurcharge: 0 },
    { id: 'plus', label: 'Plus', maxSurcharge: 1500 },
    { id: 'premium', label: 'Premium', maxSurcharge: Infinity },
  ],
};
