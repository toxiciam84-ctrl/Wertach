# Wertacher Mühle – Website

Moderne, statische Website für die **Wertacher Mühle, Sonnenhof e.V.** in
87497 Wertach im Oberallgäu – Neugestaltung der bisherigen Website
[wertachermuehle.de](https://www.wertachermuehle.de/).

## Seiten

| Datei | Inhalt |
| --- | --- |
| `index.html` | Startseite „Die Mühle“ mit Hero, Tieren, Angeboten und Chronik |
| `hausbesichtigung.html` | Das Haus: Ausstattung, Garten, ökologischer Neubau |
| `urlaub-fuer-singleeltern.html` | Ferien für Alleinerziehende |
| `gruppen.html` | Familienfreizeiten, Seminare, Vereine |
| `schulklassen.html` | Klassenfahrten |
| `ihr-bei-uns.html` | Kontakt & Anfahrt |
| `impressum.html` / `datenschutz.html` | Rechtstexte (Platzhalter bitte prüfen und vervollständigen) |
| `wertacher-muehle.html` | **Die komplette Website als eine einzige Datei** – alle Inhalte, Bilder und Schriften eingebettet, releasefähig und offline nutzbar |

## Technik

- Reines HTML/CSS/JS, kein Build-Schritt und keine externen Abhängigkeiten –
  einfach den Ordner auf einen beliebigen Webspace hochladen.
- DSGVO-freundlich: keine Cookies, kein Tracking, keine externen Font-Server –
  die Schriften Fraunces und Inter (Open-Source, SIL OFL) liegen lokal
  in `fonts/`.
- Responsiv mit mobiler Navigation, sanften Scroll-Animationen
  (respektiert `prefers-reduced-motion`).
- Bilder stammen von der bisherigen Website (`images/`).

## Einzeldatei-Version

`wertacher-muehle.html` enthält die gesamte Website (inklusive Impressum und
Datenschutz als aufklappbare Abschnitte) in einer einzigen Datei: Bilder sind
verkleinert und als Data-URIs eingebettet, die Schriften ebenfalls. Die Datei
kann direkt im Browser geöffnet oder einzeln auf einen Webspace gelegt werden.

Neu erzeugen (nach Änderungen an Inhalten oder Bildern):

```sh
pip install Pillow
python3 tools/build-einzeldatei.py
```

Vorlage: `tools/einzeldatei-vorlage.html`.

## Lokal ansehen

`index.html` im Browser öffnen – oder für einen lokalen Server:

```sh
python3 -m http.server 8000
```

## Vor Veröffentlichung prüfen

- Impressum: Vorstand, Registergericht und Vereinsregisternummer eintragen
  (im Text als Hinweiskästen markiert).
- Datenschutz: Hosting-Anbieter ergänzen.
- Facebook-/Instagram-Links und Telefonnummer gegenprüfen.
