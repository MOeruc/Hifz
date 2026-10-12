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

- Isti'adha, Basmala und „ṣadaqa llāhu l-ʿaẓīm“ sind neutrale Wendungen: Sie sagen, dass eine Rezitation oder Sure beginnt, aber nie, welche. Sie werden vor dem Abgleich herausgenommen (auch wenn die Erkennung ein oder zwei Wörter davon verschluckt). Ausnahme: Wo sie echter Text an der aktuellen Stelle sind (al-Fātiḥa 1:1, an-Naml 27:30, an-Naḥl 16:98), zählen sie als Wörter.
- Nach einer Basmala (und nach dem Ende einer Sure) wird ein Surenanfang erwartet: Alle 114 Anfänge werden mit den folgenden Wörtern verglichen und bekommen einen Vorsprung, aber nur, wenn das erste Wort passt (3:2 ist gleich 2:255).
- Suchmodus (Start über „Rezitieren“, Basmala mitten in einer Sure, oder Stelle verloren): Kandidaten sind die sichtbare Sure, die Surenanfänge und jede andere Stelle. Entschieden wird erst, wenn genau eine klar vorne liegt (mindestens drei, ohne Vorsprung vier passende Wörter, Abstand zur zweitbesten Stelle).
- Folgemodus: Wechsel ohne Basmala nur bei eindeutiger, anhaltender Evidenz; nach einem Sprung vorsichtiger, kein schnelles Zurückspringen. Passen Wörter nirgends in die Nähe, wird gesucht statt Fehler zu markieren.
- Der Leser folgt dem zuletzt gehörten Wort, auch rückwärts (an-Nās, dann al-Falaq). Nach an-Nās hört die App weiter zu.
- Hifz-Prüfung: `bounds` (Seite oder Bereich) bzw. `stay` (nur diese Sure); ein Abrutschen in einen ähnlichen Vers anderswo wird als Fehler markiert, nicht verfolgt.
- Auswendig mit verdecktem Text (`strict`): Der Text muss am Zeiger weitergehen. Ein Anlauf ab dem vorigen Vers ist erlaubt, bis zu fünf verschluckte Wörter am Versende auch, ein ausgelassener Vers nie. Ein falscher Vers ist ein Versuch (Weiterlesen im selben falschen Abschnitt zählt einmal, ein Neuanfang oder eine Pause zählt neu; den vorigen Vers wiederholt aufsagen zählt ab dem zweiten Mal). Nach `help.tries` Versuchen kommt zuerst die Diagnose (übersprungen, wiederholt, ähnlicher Vers aus Sure X), danach jeweils das nächste Wort. Gezeigte und dann gelesene Wörter bekommen den Status `HINT`.
- Verdeckter Text in der Oberfläche: Nicht gelesene Wörter, Versnummern, Übersetzungen und Seiten sind ganz ausgeblendet (keine Kästchen); ein Strich zeigt, wo es weitergeht.

## Tests

- `scenarios.test.js`: einzelne Fälle (Fehlerarten, Refrains, Sprünge, Hifz-Prüfung)
- `noise.test.js`: simulierte Erkennungsfehler über lange Abschnitte
- `sessions.test.js`: realistische Sitzungen mit Isti'adha, Basmala, Pausen und Surenwechseln
- `memorise.test.js`: Auswendig-Modus (übersprungene Verse, Versuche, Hinweise, keine Fehlalarme durch Erkennungsfehler)
- `fullquran.test.js`: der ganze Koran einmal fehlerfrei vorgelesen
- `bench_find.js`: für jede Sure, wie sicher und nach wie vielen Wörtern die App sie findet (Start, Wechsel, Mitte)
