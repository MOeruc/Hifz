# MyHifz – Entwicklung

Die App hieß früher Rahle. Interne Namen bleiben deshalb gleich: der Speicher-Schlüssel `rahle.v1` (sonst wäre der Fortschritt weg), das Präfix `RAHLE1:` der Sicherungscodes und `RahleDebug` für Tests.

## Ordner

| Pfad | Inhalt |
| --- | --- |
| `app/core.js` | Erkennungs-Engine (Browser und Node): Normalisierung, Abgleich, Tracker mit Such- und Folgemodus |
| `app/src/index.html` | HTML-Gerüst und gesamtes CSS; Platzhalter für Schrift und Skripte |
| `app/src/app.js` | Oberfläche: Lesen, Rezitieren, Hifz (Prüfen mit verdecktem Text, Blindtest), Wörter, Test pro Sure, Einstellungen |
| `app/tests/` | Node-Tests der Engine |
| `tools/build_app.py` | baut die ausgelieferte App (Schrift und Skripte inline, Service Worker mit Inhalts-Hash) |
| `tools/build_quran.py`, `build_tajweed.py`, `run_tajweed.py`, `build_lexicon.py` | Datenaufbereitung aus den Originalquellen (nur nötig, um die JSON-Daten neu zu erzeugen) |
| `tools/build_mushaf.py` | `mushaf.json`, die Zeilen der 604 Mushaf-Seiten aus quran-qcf4 (siehe unten) |
| `tools/logo.js`, `tools/icons.js` | das Logo (das Herz als Mushaf-Seite) und die daraus gerenderten App-Icons in `app/` |
| `tools/ui_*.js` | Playwright-Prüfungen der Oberfläche mit einer gespielten Spracherkennung (Pfade zu Playwright und Chromium anpassen), z. B. `ui_blind.js` für den Blindtest |
| `fonts/` | KFGQPC HAFS Uthmanic Script v14 (wird in `index.html` eingebettet) |
| `testdata/simple-clean.json` | Tanzil-Text ohne Zeichen, simuliert die Spracherkennung in den Tests |

Die Daten-JSONs (`quran.json`, `de.json`, `tajweed.json`, `lex.json`, `words.json`, `mushaf.json`) liegen im Hauptordner und sind gleichzeitig Eingabe des Builds. Die deutschen Kurzbedeutungen stehen in `lex.json` (`lemmas[i][4]`) und werden dort direkt gepflegt.

## Bauen und veröffentlichen

```sh
sh dev/build.sh      # erzeugt index.html, sw.js und manifest im Hauptordner neu
sh dev/test.sh       # Engine-Tests
git add -A && git commit -m "…" && git push
```

GitHub Pages veröffentlicht den Branch `main` aus dem Hauptordner. Der Service Worker bekommt bei jeder Änderung einen neuen Cache-Namen; die installierte App lädt die neue Version beim Öffnen und startet einmal neu. Der Fortschritt liegt im `localStorage` dieser Adresse und bleibt dabei erhalten.

## Mushaf-Seiten

- `mushaf.json` (etwa 410 KB) entsteht mit `python3 -I dev/tools/build_mushaf.py QCF4_REPO quran.json mushaf.json` aus einem Klon von [quran-qcf4](https://github.com/MohamadHajjRabee/quran-qcf4) (Daten MIT). Pro Seite: Nummer der Seitenschrift (`f`), erstes Wort (`g`, Index in die Wortliste der App) und die Zeilen: `["h", sure]` Surenkopf, `["b", code]` Basmala, sonst `[Zeichen, Arten, (1 = zentriert)]` mit einem Zeichen pro Glyphe (`w` Wort, `x` zweite Glyphe desselben Worts, `s` Sajda-Zeichen, `e` Versende, `q` Viertel-Hizb). Das Skript prüft, dass alle 77 430 Wörter der App in Reihenfolge genau einmal vorkommen; kurze Zeilen (Surenenden, Seiten 1 und 2) erkennt es an der Breite der Glyphen.
- Die Seitenschriften QCF4 (47 Schriften plus `QCF4_QBSML` für Surenköpfe und Juz-Namen) liegen nicht im Repository: `QCF` in `app.js` lädt sie per `FontFace` von jsDelivr, festgelegt auf einen Commit von quran-qcf4; der Service Worker behält sie (Cache `qcf4-fonts-1`). Ohne Schrift (offline beim ersten Mal, oder mit Tajweed-Farben) stehen dieselben Zeilen in der HAFS-Schrift der App.
- `Mushaf` in `app.js`: ein waagrechter Seitenwechsler von rechts nach links (`scroll-snap`, `scrollLeft` negativ), 604 Folien oder 302 Doppelseiten (quer, ab 600 px Breite, abschaltbar). Gezeichnet werden nur die Folie im Blick und ihre Nachbarn. `measure()` macht die Seite so groß, dass sie ganz zu sehen ist (die Zeilen bei Platz etwas weiter auseinander, wie gedruckt); wäre sie dafür zu klein (Handy quer), ist sie so breit wie möglich und wird nach unten gelesen. Der Rezitieren-Knopf wandert in die Kopfzeile, wenn er unter der Seite keinen Platz hat.
- Auswendig auf den Seiten: nicht gelesene Wörter sind durchsichtig, Surenkopf, Basmala und Versenden bleiben, die Seite füllt sich an Ort und Stelle. Bei einem Test eines Abschnitts bleibt der Text davor und danach blass lesbar (`ctx`).

## Logo und Startbildschirm

- Logo: das Herz als Mushaf-Seite. 15 Zeilen wie eine Seite des Madina-Mushaf füllen das Herz; gelernte Zeilen sind hell, der Rest blass; ein kleines türkises Licht schreibt von rechts nach links, Versenden sind golden, das letzte bildet die Spitze des Herzens. Die Wörter liegen als feste Liste in `tools/logo.js` (512er-Raster). Die Icons zeigen die Seite zu zwei Dritteln geschrieben; neu rendern mit `node dev/tools/icons.js dev/app`. Die Icons fließen in den Cache-Namen des Service Workers ein, installierte Apps übernehmen sie also mit dem nächsten Update.
- Startbildschirm: Markup und CSS stehen in `app/src/index.html`, dazu ein kleines Skript direkt dahinter (mit derselben Wortliste), das die Seite aufbaut, bevor Engine und Oberfläche geladen sind: Jedes Wort wird per `clip-path` von rechts nach links geschrieben, wenn das Licht (per `offset-path`) es erreicht; ist die Seite voll, schlägt das Herz einmal. Das Skript setzt auch gleich das gewählte Erscheinungsbild, damit ein dunkler Start nicht hell aufblitzt. `Splash.hide()` in `app.js` schließt den Bildschirm nach dem ersten Rendern, frühestens nach 2,5 s; Tippen schließt sofort. Ohne Animation (die ganze Seite steht sofort, Schließen sobald bereit): Einstellung „Startanimation“ aus, `prefers-reduced-motion` und automatisierte Browser (`navigator.webdriver`), damit die UI-Prüfungen nicht warten. `tools/ui_splash.js` prüft das.

## Wichtige Verhaltensregeln der Engine

- Isti'adha, Basmala und „ṣadaqa llāhu l-ʿaẓīm“ sind neutrale Wendungen: Sie sagen, dass eine Rezitation oder Sure beginnt, aber nie, welche. Sie werden vor dem Abgleich herausgenommen (auch wenn die Erkennung ein oder zwei Wörter davon verschluckt). Ausnahme: Wo sie echter Text an der aktuellen Stelle sind (al-Fātiḥa 1:1, an-Naml 27:30, an-Naḥl 16:98), zählen sie als Wörter.
  - Auch die langen Formen der Isti'adha (as-Samīʿ al-ʿAlīm, al-ʿAẓīm, astaʿīdhu, mit „min hamzihī wa-nafkhihī wa-nafthih“) sind neutral.
  - Endet ein Ergebnis der Erkennung mit den ersten Wörtern einer Wendung (bis zu sechs, z. B. „أعوذ بالله من“), warten sie auf das nächste Ergebnis, damit die Wendung als Ganzes erkannt wird. Formen ohne erstes Wort („بالله من …“, „الله الرحمن …“) nur, solange noch kein Text gelesen wurde.
  - Hat die Erkennung das letzte Wort einer Wendung verloren und das erste Wort des Textes nimmt seinen Platz ein („بسم الله الرحمن | الرحمن“ vor ar-Raḥmān, „أعوذ بالله من الشيطان | الم“), wird die Wendung ohne dieses Wort genommen, wenn sie so klar besser passt und das Wort nicht nur ihr eigenes letztes Wort ist (الرجيم als الرحيم gehört).
  - Beim Prüfen ist ein Stück einer Wendung (z. B. „الشيطان الرجيم“ allein) nie ein Fehlversuch, und Reste davon vor dem Text werden übergangen. `tests/neutral.test.js` prüft über 6000 Kombinationen (Formen, Stellen, Arten der Erkennung).
- Nach einer Basmala (und nach dem Ende einer Sure) wird ein Surenanfang erwartet: Alle 114 Anfänge werden mit den folgenden Wörtern verglichen und bekommen einen Vorsprung, aber nur, wenn das erste Wort passt (3:2 ist gleich 2:255).
- Suchmodus (Start über „Rezitieren“, Basmala mitten in einer Sure, oder Stelle verloren): Kandidaten sind die sichtbare Sure, die Surenanfänge und jede andere Stelle. Entschieden wird erst, wenn genau eine klar vorne liegt (mindestens drei, ohne Vorsprung vier passende Wörter, Abstand zur zweitbesten Stelle).
- Folgemodus: Wechsel ohne Basmala nur bei eindeutiger, anhaltender Evidenz; nach einem Sprung vorsichtiger, kein schnelles Zurückspringen. Passen Wörter nirgends in die Nähe, wird gesucht statt Fehler zu markieren.
- Der Leser folgt dem zuletzt gehörten Wort, auch rückwärts (an-Nās, dann al-Falaq). Nach an-Nās hört die App weiter zu.
- Hifz-Prüfung: `bounds` (Seite oder Bereich) bzw. `stay` (nur diese Sure); ein Abrutschen in einen ähnlichen Vers anderswo wird als Fehler markiert, nicht verfolgt.
- Auswendig mit verdecktem Text und Blindtest (`strict`): Der Text muss am Zeiger weitergehen. Ein Anlauf ab dem vorigen Vers ist erlaubt, ein ausgelassener Vers nie. Ein falscher Vers ist ein Versuch (Weiterlesen im selben falschen Abschnitt zählt einmal, ein Neuanfang oder eine Pause zählt neu; den vorigen Vers wiederholt aufsagen zählt ab dem zweiten Mal; nächster Vers, dieser, dann übernächster heißt `order`, vertauscht). Jeder Versuch wird sofort gemeldet (`attempt` mit Diagnose), auch ohne Hilfen.
- Strenge (`strictness`, Einstellung „Wie genau soll ich prüfen?“): 0 „Ganze Wörter“ (Standard): nur ein fehlendes Wort zählt; 1 „Genauer“: auch ein Wort, das als anderes Wort gehört wurde; 2 „Streng“: auch ein Wort, das anders klang, Buchstaben und Dehnungen. Die Oberfläche zeigt und zählt nur, was zur Stufe gehört (`isIssue()`).
- Das Tor (`gate`, beim Prüfen immer an): Der Zeiger geht nie an einem Wort vorbei, das fehlt (ab „Genauer“ auch nicht an einem Wort, das als anderes Wort gehört wurde, bei „Streng“ auch nicht an einem, das anders klang, an Buchstaben und Dehnungen). Erstes Mal: `say` `unheard`/`misheard` („nicht ganz gehört, lies ab X nochmal“, kein Fehlversuch, vielleicht war es die Erkennung); dieselbe Stelle wieder: `missing`/`wrong`, das Wort wird gezeigt („Du sagst X, richtig ist Y“); ein drittes Mal: `accept`, durchgelassen und als nicht gehört markiert (manche Wörter hört die Erkennung nie). Liest man nach der Stelle weiter, werden die Wörter als gehört behalten und der Zeiger wartet (`open` erinnert einmal im nächsten Vers); ist die Stelle gefüllt, springt der Zeiger dorthin, wo man war. Nach einer Pause mitten im Vers: `where` (wo man war; auch wenn die Erkennung das letzte Wort verlor).
- Hilfen (`help.tries` Versuche je Stufe): zuerst `runup` (die letzten Wörter vor der Stelle zum Neuansetzen, mit der Diagnose, z. B. „Du verwechselst das mit Sure X, Vers Y“), danach jeweils das nächste Wort (`word`). Die Glühbirne zeigt sofort das nächste Wort, `skipVerse()` gibt den ganzen Vers (Status `HINT`). Jeder fertige Vers meldet `verseDone` mit dem, was nicht ganz stimmte.
- Ein Wort, das die Erkennung im Zwischenergebnis deutlich hatte und im Endergebnis verlor, gilt als gesagt (`seen`). Endet eine Sitzung der Erkennung, bevor ihr letztes Zwischenergebnis endgültig wurde (Chrome auf Android nach einer Pause), oder beendet man selbst bzw. pausiert, zählen diese Wörter (`Speech.flush()`).
- Erkennung: Jedes Endergebnis kommt mit bis zu vier Alternativen; `pick()` nimmt die, die am besten an die erwartete Stelle passt (die erste gewinnt bei Gleichstand; wurde ein Teil schon aus dem Zwischenergebnis übernommen, nur Alternativen, die genauso beginnen). Wo der Browser kontextuelles Biasing kann, bekommt die Erkennung die nächsten Wörter als `phrases` (`phrasesAt()`, `plainText()` macht daraus heutige Schreibweise); Chrome lehnt das bei der Cloud-Erkennung mit `phrases-not-supported` ab, dann ohne.
- Ein Test läuft nie in die nächste Sure: ohne Ende geht er bis zum Ende dieser Sure; „Weiter mit …“ in der Zusammenfassung startet die nächste Sure oder Seite.
- Verdeckter Text in der Oberfläche: Nicht gelesene Wörter sind durchsichtig, behalten aber ihren Platz; Versnummern bleiben stehen, so sieht man, wie weit die Seite gefüllt ist (Übersetzungen erst, wenn der Vers fertig ist). Ein Strich zeigt, wo es weitergeht. Blindtest (`Blind` in `app.js`): gar kein Text, nur die Versnummer im Stern, ein Band mit einem Stück pro Vers und die Karte, auf der die App spricht.

## Tests

- `scenarios.test.js`: einzelne Fälle (Fehlerarten, Refrains, Sprünge, Hifz-Prüfung)
- `noise.test.js`: simulierte Erkennungsfehler über lange Abschnitte
- `sessions.test.js`: realistische Sitzungen mit Isti'adha, Basmala, Pausen und Surenwechseln
- `memorise.test.js`: Auswendig-Modus (übersprungene Verse, Versuche, Hinweise, das Tor, vertauschte Verse, Verse fertig, n-best, Pausen; ein Rezitator, der auf die App hört, mit verrauschter Erkennung: fast keine falschen Versuche)
- `neutral.test.js`: Isti'adha und Basmala vor einem Test sind nie ein Fehler (Formen, Stellen, Arten der Erkennung)
- `fullquran.test.js`: der ganze Koran einmal fehlerfrei vorgelesen
- `bench_find.js`: für jede Sure, wie sicher und nach wie vielen Wörtern die App sie findet (Start, Wechsel, Mitte)
