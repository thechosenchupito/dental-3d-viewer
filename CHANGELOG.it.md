# Changelog

Versione inglese: [CHANGELOG.md](./CHANGELOG.md)

## Aggiunto
- Modelli dentali di test (31 file STL) in `test/testfiles/dental/`.
- Asset della griglia di riferimento: `grid_reference.svg`, `.stl`, `.obj`, `.mtl`.
- Engine: `DetectCusps` (rilevamento delle cuspidi tramite persistenza topologica dei massimi locali lungo la direzione occlusale), `SegmentTeeth` (separazione dei denti dai solchi concavi) e `GetWeldedMesh` (saldatura dei vertici e grafo dei vertici), con relativi test.
- Website: nuovo pulsante nella toolbar che, in un unico passaggio:
  - divide il modello in due mesh selezionabili separatamente, "Lower arch" e "Upper arch" (una volta per modello caricato);
  - rileva le cuspidi di ogni dente e le mostra come piccoli punti rossi;
  - allinea una griglia di riferimento nera a ciascuna arcata, usando il vettore "up" corrente come direzione occlusale.
- Punti e griglie sono visibili solo quando è selezionata l'arcata corrispondente.
- Pulsante toggle "Show/hide cusps": visibile solo con la griglia attiva e attivo di default ogni volta che si abilita la griglia. Nasconde solo i punti, la griglia resta.
- Viewer: `RemoveExtraObject` / `ViewerModel.RemoveObject` per rimuovere un singolo oggetto extra.
- Commenti esplicativi sulle nuove funzioni e sulle modifiche.

## Modificato
- Il rilevamento delle cuspidi non è più un pulsante separato: fa parte del caricamento della griglia.
- I punti delle cuspidi sono più piccoli (raggio pari allo 0,4% della diagonale del modello).
- La scala della griglia considera anche la profondità dell'arcata, così le arcate profonde ci stanno dentro.

## Corretto
- Misura e griglia non interferiscono più: ogni strumento rimuove solo i propri oggetti extra invece di cancellarli tutti.
- Rotazione dei marker e precisione delle cuspidi (l'arcata superiore non mostra più cuspidi sulle radici).
