# MyHifz

Persönliche Koran-App: Rezitation mit Mitverfolgung und Fehlerhinweisen, Hifz-Plan zum Abhaken von Suren, Seiten und Versen, Koran-Wortschatz mit Lernkarten und Tests pro Sure. Text nach Hafs ʿan ʿĀṣim (Madina-Mushaf).

- **Mushaf-Seiten:** die 604 Seiten des Madina-Mushaf mit ihren 15 Zeilen, zum Umblättern nach links, gestaltet wie der Druck: elfenbeinfarbenes Papier, vergoldeter Rahmen, Surenköpfe als Kartuschen, die Seitenzahl im Stern. Ein Tippen auf den Seitenrand blendet die Leisten aus, dann bleibt nur die Seite (wie eine PDF). Quer gehalten liegen zwei Seiten aufgeschlagen auf dem grünen Einband (in der Darstellung abschaltbar). Dreht sich die App beim Querlegen nicht mit (Drehung gesperrt, oder die installierte App hat noch die Einstellung „nur hochkant“ der ersten Version), bietet sie die Doppelseite selbst an; unter Darstellung gibt es dafür auch „Doppelseite jetzt öffnen“ (Android). Fließtext und Vers für Vers gibt es weiterhin.
- **Gestaltung:** wie ein gebundener Mushaf. Papier und Tinte, Alegreya als Schrift, Grün (der Einband) für Aktionen, Gold für Verzierung und Gelerntes, Lapisblau für Hilfen, Rot für ein fehlendes Wort. Nachts dunkles Papier mit goldenen Rahmen.
- **Auswendig prüfen:** die Seite steht leer da, nur mit Surenkopf und den Versenden mit ihren Nummern; jedes Wort erscheint an seinem Platz, sobald es rezitiert ist. Der Text um die geprüfte Stelle bleibt blass lesbar.
- **Was die App bemängelt:** in der Grundeinstellung („Ganze Wörter“) nur ein ausgelassenes oder nicht gesagtes Wort. Erst auf Wunsch auch Wörter, die die Erkennung anders gehört hat (die Spracherkennung irrt sich dabei zu oft).
- **Pausen zwischen den Versen:** Auf Android beginnt die Spracherkennung nach jeder Pause neu und hört das erste Wort des nächsten Verses oft nicht. Die App weiß das und meldet dieses Wort nicht als fehlend; hat die Erkennung schon vorher zugehört, zählt ein fehlendes Wort wie sonst.
- **Isti'adha und Basmala:** werden erkannt und in der Leiste genannt; die App sucht deswegen keine Sure und blättert nicht.
- **Eigene Aufnahmen:** unter Einstellungen, Rezitation, „Aufnahmen“: die eigene Rezitation aufnehmen (ab dem Vers, der zu sehen ist), angeben, was gelesen wurde und wie (normal, langsam, zügig, mit Fehlern), anhören und alle als eine ZIP-Datei herunterladen. Sie sind der Testsatz für eine Erkennung, die direkt auf dem Handy laufen soll, und später ihr Training mit der eigenen Stimme.

**Adresse:** https://moeruc.github.io/Hifz/

## Auf dem Handy installieren

- **Android:** Adresse in Chrome öffnen, Menü (⋮), „App installieren“.
- **iPhone:** Adresse in Safari öffnen, Teilen, „Zum Home-Bildschirm“.

Beim ersten Rezitieren fragt der Browser nach dem Mikrofon: erlauben.

## Updates

Neue Versionen werden in dieses Repository hochgeladen. GitHub Pages veröffentlicht sie nach etwa einer Minute, und die installierte App lädt sie beim nächsten Öffnen selbst. Nichts neu installieren.

## Daten und Datenschutz

Der Fortschritt (Hifz, Wortschatz, Einstellungen) bleibt nur auf dem Gerät, im Speicher des Browsers für diese Adresse. Es gibt kein Konto und keinen Server. Die Spracherkennung beim Rezitieren läuft über den Browser (Chrome: Google, Safari: Apple). Die Schrift der Mushaf-Seiten lädt die App beim ersten Anzeigen einer Seite von jsDelivr (cdn.jsdelivr.net) und behält sie; unter Darstellung lassen sich alle Seiten auf einmal für offline laden (etwa 36 MB). Umziehen auf ein anderes Gerät: Einstellungen, „Sicherung kopieren“ und dort „Sicherung einfügen“. Für Fehlermeldungen merkt sich die App, was die Spracherkennung bei der letzten Rezitation gehört hat (nur auf dem Gerät); unter Einstellungen, „Protokoll kopieren“ lässt es sich weitergeben. Eigene Aufnahmen liegen im Speicher des Browsers auf dem Gerät, bis man sie selbst herunterlädt oder löscht.

## Aufbau des Repositorys

- Hauptordner: die fertige App, so wie GitHub Pages sie ausliefert (`index.html`, `sw.js`, Daten als JSON).
- `dev/`: Quellcode, Build-Skript und Tests, siehe [dev/README.md](dev/README.md).

## Quellen

Korantext und Schrift: King Fahd Glorious Quran Printing Complex (KFGQPC), Hafs ʿan ʿĀṣim, über Quranpedia.net. Seiten- und Juz-Einteilung: Madina-Mushaf (604 Seiten). Mushaf-Seiten: Zeilenaufteilung aus [quran-qcf4](https://github.com/MohamadHajjRabee/quran-qcf4) (Mohamad Hajj Rabee, Daten unter MIT-Lizenz), Seitenschrift QCF4 des King Fahd Complex (Madina-Mushaf 1441 H, Kalligraphie ʿUṯmān Ṭāhā; Schriftfassung Ahmad ElGharib). Die Schriften sind nicht Teil dieses Repositorys, die App lädt sie zur Laufzeit aus dem quran-qcf4-Repository. Deutsche Übersetzung: Frank Bubenheim und Nadeem Elyas, QuranEnc.com Version 1.1.4. Wortanalyse: Quranic Arabic Corpus (Kais Dukes), überarbeitet von furqan.co. Tajweed-Regeln: cpfair/quran-tajweed (CC BY 4.0) auf Basis des Tanzil-Texts. Testtext: Tanzil Simple Clean (tanzil.net, CC BY 3.0). Deutsche Kurzbedeutungen: für MyHifz erstellt, an Bubenheim und Elyas orientiert, ohne Gewähr.
