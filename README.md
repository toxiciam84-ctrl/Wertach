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

- Reines HTML/CSS/JS, kein Build-Schritt und keine externen Abhängigkeiten –
  einfach den Ordner auf einen beliebigen Webspace hochladen.
- DSGVO-freundlich: keine Cookies, kein Tracking, keine externen Fonts
  (System-Schriftstapel).
- Responsiv mit mobiler Navigation, sanften Scroll-Animationen
  (respektiert `prefers-reduced-motion`).
- Bilder stammen von der bisherigen Website (`images/`).

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
