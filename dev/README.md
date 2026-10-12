# Rahle – Entwicklung

## Ordner

| Pfad | Inhalt |
| --- | --- |
| `app/core.js` | Erkennungs-Engine (Browser und Node): Normalisierung, Abgleich, Tracker mit Such- und Folgemodus |
| `app/src/index.html` | HTML-Gerüst und gesamtes CSS; Platzhalter für Schrift und Skripte |
| `app/src/app.js` | Oberfläche: Lesen, Rezitieren, Hifz, Wörter, Test pro Sure, Einstellungen |
| `app/tests/` | Node-Tests der Engine |
| `tools/build_app.py` | baut die ausgelieferte App (Schrift und Skripte inline, Service Worker mit Inhalts-Hash) |
| `tools/build_quran.py`, `build_tajweed.py`, `run_tajweed.py`, `build_lexicon.py` | Datenaufbereitung aus den Originalquellen (nur nötig, um die JSON-Daten neu zu erzeugen) |
| `tools/ui_*.js` | Playwright-Prüfungen der Oberfläche (Pfade zu Playwright und Chromium anpassen) |
| `fonts/` | KFGQPC HAFS Uthmanic Script v14 (wird in `index.html` eingebettet) |
| `testdata/simple-clean.json` | Tanzil-Text ohne Zeichen, simuliert die Spracherkennung in den Tests |

Die Daten-JSONs (`quran.json`, `de.json`, `tajweed.json`, `lex.json`, `words.json`) liegen im Hauptordner und sind gleichzeitig Eingabe des Builds. Die deutschen Kurzbedeutungen stehen in `lex.json` (`lemmas[i][4]`) und werden dort direkt gepflegt.

## Bauen und veröffentlichen

```sh
sh dev/build.sh      # erzeugt index.html, sw.js und manifest im Hauptordner neu
sh dev/test.sh       # Engine-Tests
git add -A && git commit -m "…" && git push
```

GitHub Pages veröffentlicht den Branch `main` aus dem Hauptordner. Der Service Worker bekommt bei jeder Änderung einen neuen Cache-Namen; die installierte App lädt die neue Version beim Öffnen und startet einmal neu. Der Fortschritt liegt im `localStorage` dieser Adresse und bleibt dabei erhalten.

## Wichtige Verhaltensregeln der Engine

- Suchmodus (Start über „Rezitieren“): zuerst die sichtbare Stelle prüfen, sonst erst springen, wenn genau eine Stelle im Koran klar passt (Refrains wie in Ar-Rahman reichen nicht).
- Folgemodus: Wechsel nur bei eindeutiger, anhaltender Evidenz; nach einem Sprung vorsichtiger, kein schnelles Zurückspringen.
- Hifz-Prüfung: `bounds` (Seite oder Bereich) bzw. `stay` (nur diese Sure); ein Abrutschen in einen ähnlichen Vers anderswo wird als Fehler markiert, nicht verfolgt.
