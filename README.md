# Configuratore 3D Sandalo — Shopify

Configuratore 3D di un sandalo personalizzabile, realizzato come **sezione di tema**
Shopify (Online Store 2.0). Nessuna app, nessun backend. Rendering con **Three.js**.

Il cliente può:

1. Cambiare i **colori**
2. Personalizzare la **tomaia davanti**
3. Personalizzare la **tomaia dietro**
4. Sostituire entrambe con una **tomaia intera** (pezzo unico)

**Interfaccia**: prodotto al centro (ruotabile a 360°), barra flottante in basso con le
sezioni **Tomaia** e **Suola**. Dentro ogni sezione si naviga in profondità:
`Tomaia → Separata / Intera → Davanti·Dietro (o Intera) → Modello → Colore`.
La modalità **Intera** esclude le tomaie separate (interruttore). I **colori dipendono dal
modello** scelto: alcuni modelli speciali hanno un colore unico, gli altri (e la suola)
mantengono la palette completa. Definizioni in `src/config.js` (`MODELS_BY_PART`, `COLOR_SETS`).

Il prezzo si aggiorna in tempo reale; i sovrapprezzi (modello + colore premium + tomaia
intera) sono gestiti tramite **varianti a fasce di prezzo** + **line item properties**
(l'unica via robusta senza backend).

> ⚠️ I modelli 3D non ci sono ancora: il configuratore usa **geometria segnaposto** con
> una convenzione di nomi (Model Contract). Quando arriveranno i `.glb`, si innestano
> senza modifiche al codice. Il segnaposto è già "parlante": suola a silhouette di piede,
> fascette ad arco e **una geometria diversa per ogni Modello** (incrociata, zeppa,
> tallone chiuso, intrecciata…), così l'esperienza è valutabile da subito.

**Altre caratteristiche:**
- Rotazione **360°** con auto-rotazione iniziale (si ferma alla prima interazione)
- Illuminazione ambiente procedurale (nessun asset esterno) + ombra morbida
- **Configurazione condivisibile**: lo stato vive nell'URL (`#sc=...`), sopravvive al
  reload e può essere inviato come link
- Con il pannello opzioni aperto il prodotto viene **reinquadrato in alto** e resta visibile
- Rendering in pausa quando il canvas è fuori viewport; cleanup automatico nell'editor tema
- Accessibilità: navigazione da tastiera con focus preservato, `aria-pressed`, Escape per chiudere
- Ordine con proprietà nascosta `_configurazione` (JSON macchina-leggibile per il merchant)

---

## Sviluppo

```bash
npm install
npm run dev      # apri http://localhost:5173/dev/  (segnaposto, add-to-cart simulato in console)
npm run build    # genera shopify/assets/sandal-configurator.js e .css
npm test         # test della logica (prezzi, config, properties carrello) — richiede Node 20+
```

## Struttura

```
src/                       # sorgenti (bundle con Vite)
  config.js                # palette colori, parti, modalità, regole prezzo  ← personalizza qui
  scene.js                 # scena Three.js (camera, luci, controlli, ombra)
  model.js                 # GLTFLoader + geometria segnaposto (Model Contract)
  pricing.js               # calcolo prezzo + fascia/variante
  cart.js                  # add-to-cart (/cart/add.js) + line item properties
  ui.js                    # pannello opzioni
  main.js                  # entry: monta su .sandal-configurator
  styles.css
dev/index.html             # anteprima standalone (senza Shopify)
shopify/                   # file da copiare nel tema
  sections/sandal-configurator.liquid
  snippets/sandal-configurator-data.liquid
  assets/                  # output build (.js/.css) + qui andranno i .glb
```

---

## Installazione nel tema

1. `npm run build` (genera `shopify/assets/sandal-configurator.js` e `.css`).
2. Copia nel tuo tema (es. via Shopify CLI o admin → Modifica codice):
   - `shopify/sections/sandal-configurator.liquid` → `sections/`
   - `shopify/snippets/sandal-configurator-data.liquid` → `snippets/`
   - `shopify/assets/sandal-configurator.js` e `.css` → `assets/`
3. Nel **theme editor**, aggiungi la sezione **"Configuratore Sandalo 3D"** alla pagina.
4. Imposta il **Prodotto configuratore** e (opzionale) il nome file `.glb`.

Sviluppo in locale sul tema: `shopify theme dev` (Shopify CLI).

---

## Prezzo: varianti a fasce

Senza backend, i sovrapprezzi si gestiscono con varianti che rappresentano fasce di prezzo:

1. Sul prodotto crea un'opzione (es. **"Configurazione"**) con valori = fasce:
   `Standard`, `Plus`, `Premium`, ciascuna con il proprio prezzo.
2. Il configuratore calcola il sovrapprezzo dalle selezioni, sceglie automaticamente la
   variante della fascia giusta e salva i dettagli (colori, tipo tomaia) come **line item
   properties** dell'ordine.
3. Modifica soglie, prezzi e palette in **`src/config.js`** (`PRICING`, `COLORS`), poi `npm run build`.

I nomi delle fasce in `PRICING.tiers[].label` devono combaciare con i valori dell'opzione
variante (`option1`) sul prodotto Shopify.

> Vuoi una meccanica diversa (es. prodotti add-on separati)? La logica è isolata in
> `src/pricing.js` e `src/cart.js`.

---

## Model Contract (per i `.glb` futuri)

Esporta il modello 3D rispettando questa convenzione, così sostituisce il segnaposto senza
toccare il codice:

- **Mesh nominate esattamente**: `Sole` (suola), `UpperFront` (tomaia davanti),
  `UpperBack` (tomaia dietro), `UpperWhole` (tomaia intera).
- **Una material dedicata per ogni parte** ricolorabile (i materiali condivisi vengono
  comunque clonati al caricamento).
- **Modelli/stili** (categoria "Modello"): convenzione `Nome__idModello`, es.
  `UpperFront__classic`, `UpperFront__cross`, `UpperWhole__woven`. Gli `idModello` sono
  quelli in `MODELS_BY_PART` (`src/config.js`). Quando ci saranno i `.glb`, `setModel`
  mostrerà la mesh corrispondente (ora il "Modello" incide solo su colori ammessi e prezzo).
- **Orientamento**: lunghezza del piede lungo **Z** (punta verso +Z), suola appoggiata a
  y ≈ 0, scala coerente (~2–2.5 unità lungo Z, come il segnaposto).
- Carica `sandal.glb` in `assets/` del tema e indica il **nome file** nelle impostazioni
  della sezione.

Se le mesh mancano o i nomi non combaciano, il configuratore ricade automaticamente sulla
geometria segnaposto.

---

## Cambiare tema in futuro

La sezione vive nel tema attuale. Per migrare a un nuovo tema (OS 2.0): ricopia
`sections/`, `snippets/`, `assets/` nel nuovo tema e ri-aggiungi la sezione dall'editor.
La logica 3D/carrello resta invariata; potrebbe servire un piccolo ritocco al
comportamento del *cart drawer* o al CSS per adattarsi allo stile del nuovo tema.

---

## Personalizzazione rapida

| Cosa | Dove |
| --- | --- |
| Colori e set di colori | `src/config.js` (`COLORS`, `COLOR_SETS`) |
| Modelli per parte (e loro colori/prezzo) | `src/config.js` (`MODELS_BY_PART`) |
| Prezzi base e fasce/varianti | `src/config.js` (`PRICING`) |
| Geometria segnaposto | `src/model.js` (`buildPlaceholder`) |
| Navigazione/pannello (barra, drill-down) | `src/ui.js` |
| Stile del pannello/UI | `src/styles.css` |
| Inquadratura/luci 3D | `src/scene.js` |
| Testo/impostazioni sezione | `shopify/sections/sandal-configurator.liquid` |
