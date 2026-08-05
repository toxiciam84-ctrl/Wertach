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

## Technik

- Statisches HTML/CSS/JS – einfach den Ordner auf einen beliebigen Webspace
  hochladen (der Ordner `animationen/` wird auf dem Server nicht benötigt).
- DSGVO-freundlich: keine Cookies, kein Tracking, keine externen Server –
  die Schriften Fraunces und Inter (Open-Source, SIL OFL) liegen lokal in
  `fonts/`, das Animations-Bundle lokal in `js/`.
- Responsiv mit mobiler Navigation.
- Bilder stammen von der bisherigen Website (`images/`).

## Animationen (ReactBits)

Die Animationen nutzen Komponenten von [ReactBits](https://reactbits.dev)
(MIT-Lizenz): **SplitText** für die großen Überschriften, **CountUp** für das
Zahlenband auf der Startseite und **FadeContent** für das weiche Einblenden
der Bilder. Sie sind als ein lokales Bundle (`js/reactbits-animationen.js`)
eingebunden – ohne CDN. Ohne JavaScript oder bei aktiviertem
`prefers-reduced-motion` bleibt die Seite komplett statisch und lesbar.

Bundle neu bauen (nach Änderungen in `animationen/src/`):

```sh
cd animationen
npm install
npm run build
```

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
