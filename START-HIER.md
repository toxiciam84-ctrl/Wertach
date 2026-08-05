# Wertacher Mühle – was ist in diesem Paket?

Es gibt **zwei Varianten** der Website. Ihr braucht nur eine davon.

---

## Variante A: Nur die Website (einfach)

Die fertigen Seiten im Hauptordner – ohne Buchungssystem.

**So veröffentlichen:** Diese Dateien und Ordner auf euren Webspace laden:

```
index.html   hausbesichtigung.html   urlaub-fuer-singleeltern.html
gruppen.html   schulklassen.html   ihr-bei-uns.html
impressum.html   datenschutz.html   favicon.svg
css/   js/   images/   fonts/
```

Fertig – läuft auf jedem einfachen Webspace, ohne Datenbank und ohne
Server-Technik. Startseite ist `index.html`.

**Zum Anschauen:** `index.html` doppelklicken.

---

## Variante B: Das Komplettsystem (Buchung + Dashboard + Baukasten)

Alles aus Variante A, zusätzlich:

- **Online-Buchung** für Ferienwochen mit Platzverwaltung und Bezahlung
- **Gruppen- und Klassenanfragen** mit Wunschzeitraum
- **Dashboard** für Buchungen, E-Mails, Rechnungen (PDF) und die
  Getränke-Abrechnung
- **Website-Baukasten**: Texte ändern, Blöcke und Seiten hinzufügen oder
  entfernen – ohne Programmierkenntnisse

Das liegt im Ordner `system/` und braucht **Node.js-Hosting**
(z. B. ein kleiner Server bei Hetzner, Netcup o. ä.).

### Starten (auch zum Ausprobieren auf dem eigenen Rechner)

[Node.js](https://nodejs.org) installieren, dann im Terminal:

```sh
cd system
npm install
npm start
```

Danach im Browser öffnen:

- Website: <http://localhost:3000>
- Dashboard: <http://localhost:3000/verwaltung>

**Erster Zugang:** `verwaltung@wertachermuehle.de` / `muehle2026`
→ Passwort bitte sofort unter „Einstellungen" ändern.

### Vor dem Echtbetrieb ausfüllen

1. **Bankverbindung**: Dashboard → Einstellungen → IBAN und Bank eintragen.
2. **E-Mail-Versand**: Datei `system/.env.beispiel` nach `system/.env`
   kopieren und die SMTP-Zugangsdaten eures Hosters eintragen.
   Ohne das sammelt das Dashboard alle E-Mails im Postausgang, verschickt
   sie aber nicht.
3. **Kartenzahlung** (optional): Stripe-Schlüssel in dieselbe `.env`
   eintragen. Ohne Stripe laufen Buchungen automatisch per Überweisung.
4. **Impressum und Datenschutz**: Vorstand, Registergericht,
   Vereinsregisternummer und Hosting-Anbieter ergänzen (im Baukasten unter
   den jeweiligen Seiten).

---

## Animationen selbst anpassen (optional)

Die Animationen stammen von [ReactBits](https://reactbits.dev). Der
Quellcode liegt in `animationen/`. Nach Änderungen neu bauen:

```sh
cd animationen
npm install
npm run build
```

Für den normalen Betrieb ist das nicht nötig – die fertige Datei
`js/reactbits-animationen.js` ist bereits enthalten.

---

Mehr Details stehen in `README.md`.
