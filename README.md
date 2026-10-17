# MyHifz

Persönliche Koran-App: Rezitation mit Mitverfolgung und Fehlerhinweisen, Hifz-Plan zum Abhaken von Suren, Seiten und Versen, Koran-Wortschatz mit Lernkarten und Tests pro Sure. Text nach Hafs ʿan ʿĀṣim (Madina-Mushaf).

- **Mushaf-Seiten:** die 604 Seiten des Madina-Mushaf mit ihren 15 Zeilen, zum Umblättern nach links. Quer gehalten liegen zwei Seiten nebeneinander wie ein aufgeschlagenes Buch (in der Darstellung abschaltbar). Fließtext und Vers für Vers gibt es weiterhin.
- **Auswendig prüfen:** die Seite steht leer da, nur mit Surenkopf und den Versenden mit ihren Nummern; jedes Wort erscheint an seinem Platz, sobald es rezitiert ist. Der Text um die geprüfte Stelle bleibt blass lesbar.
- **Was die App bemängelt:** in der Grundeinstellung („Ganze Wörter“) nur ein ausgelassenes oder nicht gesagtes Wort. Erst auf Wunsch auch Wörter, die die Erkennung anders gehört hat (die Spracherkennung irrt sich dabei zu oft).

**Adresse:** https://moeruc.github.io/Hifz/

## Auf dem Handy installieren

- **Android:** Adresse in Chrome öffnen, Menü (⋮), „App installieren“.
- **iPhone:** Adresse in Safari öffnen, Teilen, „Zum Home-Bildschirm“.

Beim ersten Rezitieren fragt der Browser nach dem Mikrofon: erlauben.

## Updates

Neue Versionen werden in dieses Repository hochgeladen. GitHub Pages veröffentlicht sie nach etwa einer Minute, und die installierte App lädt sie beim nächsten Öffnen selbst. Nichts neu installieren.

## Daten und Datenschutz

Der Fortschritt (Hifz, Wortschatz, Einstellungen) bleibt nur auf dem Gerät, im Speicher des Browsers für diese Adresse. Es gibt kein Konto und keinen Server. Die Spracherkennung beim Rezitieren läuft über den Browser (Chrome: Google, Safari: Apple). Die Schrift der Mushaf-Seiten lädt die App beim ersten Anzeigen einer Seite von jsDelivr (cdn.jsdelivr.net) und behält sie; unter Darstellung lassen sich alle Seiten auf einmal für offline laden (etwa 36 MB). Umziehen auf ein anderes Gerät: Einstellungen, „Sicherung kopieren“ und dort „Sicherung einfügen“.

## Aufbau des Repositorys

- Hauptordner: die fertige App, so wie GitHub Pages sie ausliefert (`index.html`, `sw.js`, Daten als JSON).
- `dev/`: Quellcode, Build-Skript und Tests, siehe [dev/README.md](dev/README.md).

## Quellen

Korantext und Schrift: King Fahd Glorious Quran Printing Complex (KFGQPC), Hafs ʿan ʿĀṣim, über Quranpedia.net. Seiten- und Juz-Einteilung: Madina-Mushaf (604 Seiten). Mushaf-Seiten: Zeilenaufteilung aus [quran-qcf4](https://github.com/MohamadHajjRabee/quran-qcf4) (Mohamad Hajj Rabee, Daten unter MIT-Lizenz), Seitenschrift QCF4 des King Fahd Complex (Madina-Mushaf 1441 H, Kalligraphie ʿUṯmān Ṭāhā; Schriftfassung Ahmad ElGharib). Die Schriften sind nicht Teil dieses Repositorys, die App lädt sie zur Laufzeit aus dem quran-qcf4-Repository. Deutsche Übersetzung: Frank Bubenheim und Nadeem Elyas, QuranEnc.com Version 1.1.4. Wortanalyse: Quranic Arabic Corpus (Kais Dukes), überarbeitet von furqan.co. Tajweed-Regeln: cpfair/quran-tajweed (CC BY 4.0) auf Basis des Tanzil-Texts. Testtext: Tanzil Simple Clean (tanzil.net, CC BY 3.0). Deutsche Kurzbedeutungen: für MyHifz erstellt, an Bubenheim und Elyas orientiert, ohne Gewähr.
