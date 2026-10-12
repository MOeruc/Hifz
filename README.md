# Rahle

Persönliche Koran-App: Rezitation mit Mitverfolgung und Fehlerhinweisen, Hifz-Plan zum Abhaken von Suren, Seiten und Versen, Koran-Wortschatz mit Lernkarten und Tests pro Sure. Text nach Hafs ʿan ʿĀṣim (Madina-Mushaf).

**Adresse:** https://moeruc.github.io/Hifz/

## Auf dem Handy installieren

- **Android:** Adresse in Chrome öffnen, Menü (⋮), „App installieren“.
- **iPhone:** Adresse in Safari öffnen, Teilen, „Zum Home-Bildschirm“.

Beim ersten Rezitieren fragt der Browser nach dem Mikrofon: erlauben.

## Updates

Neue Versionen werden in dieses Repository hochgeladen. GitHub Pages veröffentlicht sie nach etwa einer Minute, und die installierte App lädt sie beim nächsten Öffnen selbst. Nichts neu installieren.

## Daten und Datenschutz

Der Fortschritt (Hifz, Wortschatz, Einstellungen) bleibt nur auf dem Gerät, im Speicher des Browsers für diese Adresse. Es gibt kein Konto und keinen Server. Die Spracherkennung beim Rezitieren läuft über den Browser (Chrome: Google, Safari: Apple). Umziehen auf ein anderes Gerät: Einstellungen, „Sicherung kopieren“ und dort „Sicherung einfügen“.

## Aufbau des Repositorys

- Hauptordner: die fertige App, so wie GitHub Pages sie ausliefert (`index.html`, `sw.js`, Daten als JSON).
- `dev/`: Quellcode, Build-Skript und Tests, siehe [dev/README.md](dev/README.md).

## Quellen

Korantext und Schrift: King Fahd Glorious Quran Printing Complex (KFGQPC), Hafs ʿan ʿĀṣim, über Quranpedia.net. Seiten- und Juz-Einteilung: Madina-Mushaf (604 Seiten). Deutsche Übersetzung: Frank Bubenheim und Nadeem Elyas, QuranEnc.com Version 1.1.4. Wortanalyse: Quranic Arabic Corpus (Kais Dukes), überarbeitet von furqan.co. Tajweed-Regeln: cpfair/quran-tajweed (CC BY 4.0) auf Basis des Tanzil-Texts. Testtext: Tanzil Simple Clean (tanzil.net, CC BY 3.0). Deutsche Kurzbedeutungen: für Rahle erstellt, an Bubenheim und Elyas orientiert, ohne Gewähr.
