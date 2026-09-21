# Modelli 3D per il test locale

Metti qui il file combinato `sandal.glb` per vederlo nell'harness di sviluppo
(`npm run dev` → http://localhost:5173/dev/).

`dev/index.html` è già configurato per caricare `/models/sandal.glb` — se il
file non c'è, il configuratore ricade automaticamente sulla geometria
segnaposto (nessun errore).

## Hai 3 file separati (2 tomaie + 1 suola)?

Il configuratore si aspetta **un solo file `.glb`** che contiene tutte le mesh
(così può gestire lo scambio suola/tomaie). Uniscili in Blender in 5 click,
zero modellazione:

1. Apri Blender, scena vuota (elimina il cubo di default se c'è: click su di
   esso, tasto `X` → Delete)
2. **File → Import → glTF 2.0 (.glb/.gltf)** → seleziona il file della suola
3. Ripeti **File → Import → glTF 2.0** per la tomaia davanti, poi di nuovo per
   la tomaia dietro (ora hai 3 oggetti nella scena, visibili nel pannello
   "Outliner" in alto a destra)
4. Rinomina ciascun oggetto secondo la convenzione (doppio click sul nome
   nell'Outliner):
   - la suola → `Sole`
   - una tomaia → `UpperFront`
   - l'altra tomaia → `UpperBack`
   (Se muovi/ruoti un pezzo per allinearlo agli altri: selezionalo, tasto `G`
   per spostare o `R` per ruotare, click per confermare.)
5. **File → Export → glTF 2.0 (.glb)** → salva come `sandal.glb` **in questa
   cartella** (`public/models/`)

Poi (ri)avvia `npm run dev` e apri http://localhost:5173/dev/ — dovresti
vedere i tuoi modelli reali al posto del segnaposto.

## Nota sui "Modelli" (stili) nel pannello

Con un solo file così, tutte e 3 le mesh sono sempre visibili quando la loro
parte è visibile, indipendentemente da quale "Modello" scegli nel pannello
(Classica/Incrociata/ecc.) — è normale, serve solo a vedere le forme vere al
posto del segnaposto. Per collegare le mesh ai singoli "Modelli" del menu
(così cambiano anche la geometria, non solo colore/prezzo), i nomi vanno
`Parte__idModello` (es. `UpperFront__classic`) — vedi il README principale,
sezione "Model Contract".
