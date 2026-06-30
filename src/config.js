// Definizioni "di dominio" del configuratore: parti, modalità, palette colori, regole prezzo.
// Tutto ciò che è personalizzabile sta qui, separato dalla logica 3D / UI / carrello.

// ---------------------------------------------------------------------------
// Model Contract — nomi delle mesh attesi nel modello 3D.
// I file .glb reali DEVONO usare esattamente questi nomi per innestarsi
// senza modifiche al codice (vedi README).
// ---------------------------------------------------------------------------
export const PART = {
  SOLE: 'Sole', // suola
  UPPER_FRONT: 'UpperFront', // tomaia davanti
  UPPER_BACK: 'UpperBack', // tomaia dietro
  UPPER_WHOLE: 'UpperWhole', // tomaia intera (pezzo unico)
};

// Modalità della tomaia.
export const UPPER_MODE = {
  SPLIT: 'split', // tomaia davanti + dietro indipendenti
  WHOLE: 'whole', // tomaia intera (pezzo unico)
};

export const DEFAULT_MODE = UPPER_MODE.SPLIT;

// Parti ricolorabili visibili per ciascuna modalità (ordine = ordine nella UI).
export const PARTS_BY_MODE = {
  [UPPER_MODE.SPLIT]: [
    { id: PART.UPPER_FRONT, label: 'Tomaia davanti' },
    { id: PART.UPPER_BACK, label: 'Tomaia dietro' },
    { id: PART.SOLE, label: 'Suola' },
  ],
  [UPPER_MODE.WHOLE]: [
    { id: PART.UPPER_WHOLE, label: 'Tomaia intera' },
    { id: PART.SOLE, label: 'Suola' },
  ],
};

// Palette colori. `priceDelta` in centesimi: sovrapprezzo per i colori "premium".
export const COLORS = [
  { id: 'natural', label: 'Naturale', hex: '#d9b38c', priceDelta: 0 },
  { id: 'black', label: 'Nero', hex: '#1f1f1f', priceDelta: 0 },
  { id: 'white', label: 'Bianco', hex: '#f2efe9', priceDelta: 0 },
  { id: 'tan', label: 'Cuoio', hex: '#a9743b', priceDelta: 0 },
  { id: 'red', label: 'Rosso', hex: '#b5322f', priceDelta: 500 },
  { id: 'cobalt', label: 'Cobalto', hex: '#2f5bb5', priceDelta: 500 },
  { id: 'gold', label: 'Oro', hex: '#c9a227', priceDelta: 800 },
];

// Colore di default per parte (deve essere un id presente in COLORS).
export const DEFAULT_COLORS = {
  [PART.SOLE]: 'tan',
  [PART.UPPER_FRONT]: 'black',
  [PART.UPPER_BACK]: 'black',
  [PART.UPPER_WHOLE]: 'natural',
};

// Regole di prezzo (valori segnaposto in centesimi — sostituire con i prezzi reali).
export const PRICING = {
  basePrice: 7900, // prezzo base del sandalo
  wholeUpperSurcharge: 1500, // sovrapprezzo per la tomaia intera

  // Mappatura su "fasce" = varianti Shopify, in base al sovrapprezzo totale.
  // totale = somma priceDelta dei colori (parti visibili) + eventuale tomaia intera.
  // La prima fascia il cui `maxSurcharge` >= sovrapprezzo vince.
  tiers: [
    { id: 'standard', label: 'Standard', maxSurcharge: 0 },
    { id: 'plus', label: 'Plus', maxSurcharge: 1500 },
    { id: 'premium', label: 'Premium', maxSurcharge: Infinity },
  ],
};
