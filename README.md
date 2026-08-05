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

## Komplettsystem: Buchung, Dashboard & Baukasten (`system/`)

Im Ordner `system/` liegt das Node.js-Komplettsystem:

- **Online-Buchung** auf der Website: Ferienwochen mit Platzverwaltung und
  Bezahlung (Stripe; ohne Stripe-Schlüssel automatisch per Überweisung),
  dazu Gruppen-/Schulklassen-Anfragen mit Wunschzeitraum.
- **Dashboard** unter `/verwaltung`: Buchungen mit Status-Verwaltung,
  E-Mail-Versand, automatische Rechnungs-PDFs mit fortlaufender Nummer,
  Getränke-/Extras-Abrechnung pro Aufenthalt (Ein-Klick-Strichliste).
- **Website-Baukasten**: alle Seiten und Blöcke bearbeiten, hinzufügen,
  verschieben, entfernen; Bilder hochladen; neue Seiten anlegen. Die
  öffentliche Website wird daraus im bekannten Design gerendert.

Starten:

```sh
cd system
npm install
npm start          # http://localhost:3000  ·  Dashboard: /verwaltung
```

Erster Zugang: `verwaltung@wertachermuehle.de` / `muehle2026` –
**Passwort nach dem ersten Anmelden ändern** (Einstellungen).
E-Mail-Versand (SMTP) und Online-Zahlung (Stripe) werden in `system/.env`
eingetragen (Vorlage: `system/.env.beispiel`); ohne diese Zugänge landen
E-Mails im Postausgang des Dashboards und Buchungen laufen per Überweisung.
Vor dem Echtbetrieb außerdem: IBAN in den Einstellungen hinterlegen.

Die statischen HTML-Seiten im Projektstamm bleiben als einfache Variante
ohne Buchungssystem erhalten.

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
