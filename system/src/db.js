// Datenbank (SQLite) – Schema, Migration und Erstbefüllung mit den
// Inhalten der bisherigen Website.
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', 'data');
for (const dir of ['', 'uploads', 'rechnungen']) {
  fs.mkdirSync(path.join(DATA_DIR, dir), { recursive: true });
}

const db = new Database(path.join(DATA_DIR, 'muehle.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS einstellungen (
  schluessel TEXT PRIMARY KEY,
  wert TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  pass_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS seiten (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  titel TEXT NOT NULL,
  nav_titel TEXT NOT NULL,
  beschreibung TEXT NOT NULL DEFAULT '',
  sortierung INTEGER NOT NULL DEFAULT 0,
  in_navigation INTEGER NOT NULL DEFAULT 1,
  sichtbar INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS bloecke (
  id INTEGER PRIMARY KEY,
  seite_id INTEGER NOT NULL REFERENCES seiten(id) ON DELETE CASCADE,
  typ TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  daten TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS termine (
  id INTEGER PRIMARY KEY,
  titel TEXT NOT NULL,
  typ TEXT NOT NULL DEFAULT 'singleeltern',
  beginn TEXT NOT NULL,
  ende TEXT NOT NULL,
  plaetze INTEGER NOT NULL DEFAULT 35,
  preis_erwachsener INTEGER NOT NULL DEFAULT 0,
  preis_kind INTEGER NOT NULL DEFAULT 0,
  preis_pauschal INTEGER NOT NULL DEFAULT 0,
  beschreibung TEXT NOT NULL DEFAULT '',
  buchbar INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS buchungen (
  id INTEGER PRIMARY KEY,
  nummer TEXT UNIQUE NOT NULL,
  termin_id INTEGER REFERENCES termine(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'angefragt',
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  telefon TEXT NOT NULL DEFAULT '',
  strasse TEXT NOT NULL DEFAULT '',
  plz_ort TEXT NOT NULL DEFAULT '',
  erwachsene INTEGER NOT NULL DEFAULT 1,
  kinder INTEGER NOT NULL DEFAULT 0,
  wunsch_beginn TEXT NOT NULL DEFAULT '',
  wunsch_ende TEXT NOT NULL DEFAULT '',
  nachricht TEXT NOT NULL DEFAULT '',
  betrag INTEGER NOT NULL DEFAULT 0,
  zahlart TEXT NOT NULL DEFAULT 'ueberweisung',
  stripe_session TEXT NOT NULL DEFAULT '',
  angelegt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS posten (
  id INTEGER PRIMARY KEY,
  buchung_id INTEGER NOT NULL REFERENCES buchungen(id) ON DELETE CASCADE,
  bezeichnung TEXT NOT NULL,
  menge INTEGER NOT NULL DEFAULT 1,
  einzelpreis INTEGER NOT NULL DEFAULT 0,
  typ TEXT NOT NULL DEFAULT 'getraenk',
  angelegt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS getraenke (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  preis INTEGER NOT NULL DEFAULT 0,
  aktiv INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS rechnungen (
  id INTEGER PRIMARY KEY,
  nummer TEXT UNIQUE NOT NULL,
  buchung_id INTEGER NOT NULL REFERENCES buchungen(id) ON DELETE CASCADE,
  art TEXT NOT NULL DEFAULT 'rechnung',
  betrag INTEGER NOT NULL DEFAULT 0,
  pfad TEXT NOT NULL,
  angelegt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS emails (
  id INTEGER PRIMARY KEY,
  buchung_id INTEGER REFERENCES buchungen(id) ON DELETE SET NULL,
  an TEXT NOT NULL,
  betreff TEXT NOT NULL,
  text TEXT NOT NULL,
  anhang TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ausgang',
  angelegt TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

function einstellung(schluessel, standard = '') {
  const zeile = db.prepare('SELECT wert FROM einstellungen WHERE schluessel = ?').get(schluessel);
  return zeile ? zeile.wert : standard;
}

function setzeEinstellung(schluessel, wert) {
  db.prepare(
    'INSERT INTO einstellungen (schluessel, wert) VALUES (?, ?) ' +
    'ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert'
  ).run(schluessel, String(wert));
}

function naechsteNummer(art) {
  const jahr = new Date().getFullYear();
  const schluessel = `zaehler_${art}_${jahr}`;
  const stand = parseInt(einstellung(schluessel, '0'), 10) + 1;
  setzeEinstellung(schluessel, stand);
  const prefix = art === 'rechnung' ? 'RE' : 'BU';
  return `${prefix}-${jahr}-${String(stand).padStart(4, '0')}`;
}

// ---------------------------------------------------------------------------
// Erstbefüllung
// ---------------------------------------------------------------------------

function seedEinstellungen() {
  const standardwerte = {
    verein_name: 'Wertacher Mühle, Sonnenhof e.V.',
    verein_strasse: 'Vorderschneid 7',
    verein_ort: '87497 Wertach',
    verein_telefon: '08365 / 1628',
    verein_email: 'Wertachermuehle@web.de',
    bank_inhaber: 'Wertacher Mühle, Sonnenhof e.V.',
    bank_iban: 'DE00 0000 0000 0000 0000 00',
    bank_name: 'Bitte Bankname eintragen',
    rechnung_hinweis: 'Als gemeinnütziger Verein weisen wir keine Umsatzsteuer aus.',
    zahlungsziel_tage: '14'
  };
  for (const [schluessel, wert] of Object.entries(standardwerte)) {
    if (!db.prepare('SELECT 1 FROM einstellungen WHERE schluessel = ?').get(schluessel)) {
      setzeEinstellung(schluessel, wert);
    }
  }
}

function seedAdmin() {
  if (db.prepare('SELECT COUNT(*) AS n FROM admins').get().n === 0) {
    const hash = bcrypt.hashSync('muehle2026', 10);
    db.prepare('INSERT INTO admins (email, pass_hash) VALUES (?, ?)')
      .run('verwaltung@wertachermuehle.de', hash);
    console.log('[Setup] Dashboard-Zugang angelegt: verwaltung@wertachermuehle.de / muehle2026');
    console.log('[Setup] Bitte das Passwort nach dem ersten Anmelden ändern (Einstellungen).');
  }
}

function seedGetraenke() {
  if (db.prepare('SELECT COUNT(*) AS n FROM getraenke').get().n === 0) {
    const rein = db.prepare('INSERT INTO getraenke (name, preis) VALUES (?, ?)');
    rein.run('Apfelschorle 0,5 l', 180);
    rein.run('Wasser 0,5 l', 120);
    rein.run('Limo 0,5 l', 180);
    rein.run('Bier 0,5 l', 250);
    rein.run('Kaffee', 150);
  }
}

function seedTermine() {
  if (db.prepare('SELECT COUNT(*) AS n FROM termine').get().n === 0) {
    const rein = db.prepare(
      'INSERT INTO termine (titel, typ, beginn, ende, plaetze, preis_erwachsener, preis_kind, beschreibung) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    rein.run('Herbstferien für Singleeltern', 'singleeltern', '2026-11-02', '2026-11-07', 30, 32000, 19000,
      'Eine Woche Gemeinschaft in den Herbstferien – Vollverpflegung, Programm für die Kinder, Zeit zum Durchatmen.');
    rein.run('Weihnachtsferien für Singleeltern', 'singleeltern', '2026-12-27', '2027-01-02', 30, 36000, 21000,
      'Den Jahreswechsel gemeinsam feiern – mit Schnee, Holzofen und Silvester am Lagerfeuer.');
    rein.run('Faschingsferien für Singleeltern', 'singleeltern', '2027-02-15', '2027-02-20', 30, 32000, 19000,
      'Winterferien mit Schlittenfahren, Wintersport und gemütlichen Abenden in der Stube.');
  }
}

const SEED_SEITEN = [
  {
    slug: 'index', titel: 'Wertacher Mühle | Gruppenhaus im Oberallgäu', nav_titel: 'Die Mühle',
    beschreibung: 'Die Wertacher Mühle im Allgäu – Gruppenhaus auf fast 1000 m Höhe für Alleinerziehende, Schulklassen und Gruppen. Umgeben von Wiesen, Bergen und Tieren.',
    bloecke: [
      ['hero', {
        bild: '/images/hero-muehle-abend.jpg',
        alt: 'Die Wertacher Mühle am Abend, dahinter Wiesen und die Allgäuer Berge',
        ueberschrift: 'Die Wertacher Mühle im Allgäu'
      }],
      ['intro', {
        lead: 'Wir liegen auf fast 1000 Metern Höhe – umgeben von Wiesen, Bäumen und Bergpanorama. Alle Zimmer blicken ins Grüne. Und vor der Tür beginnt die Natur – einfach Natur erleben.',
        text: 'Auf der Rückseite fließt ein Bach, der früher das Mühlrad angetrieben hat. Man hört ihn im Haus – mal leise, mal deutlicher. Nach dem Brand von 2021 wurde die Mühle als ökologisches Vollholzhaus wieder aufgebaut – mit Erdwärme, Sonnenstrom vom Dach und Holzöfen in den Stuben.',
        knopf_text: 'Das Haus ansehen', knopf_ziel: '/hausbesichtigung',
        bild: '/images/muehle-vogelperspektive.jpg', bild_alt: 'Die Mühle von oben, mitten im Wald',
        bild_unterschrift: 'Alleinstehend zwischen Wald und Wiesen', bild_oben: true
      }],
      ['stats', {
        werte: [
          { zahl: '1424', text: 'Erste Erwähnung' },
          { zahl: '1000', einheit: ' m', text: 'Höhenlage' },
          { zahl: '35', text: 'Betten im Haus' },
          { zahl: '6000', einheit: ' m²', text: 'Garten & Wiese' }
        ]
      }],
      ['ueberschrift_text', {
        ueberschrift: 'Zum Alltag gehören auch die Tiere',
        text: 'Katzen im Haus, Pferde im Stall und Hasen im Garten. Und natürlich auch die Kühe auf den Weiden der Nachbarbauern. Sie sind einfach da und begleiten das Leben auf der Mühle.'
      }],
      ['fotoreihe', {
        fotos: [
          { bild: '/images/pferd-portrait.jpg', alt: 'Eines unserer Pferde in der Abendsonne', unterschrift: 'Pferde im Stall' },
          { bild: '/images/katze-stall.jpg', alt: 'Katze vor der Stalltür', unterschrift: 'Katzen im Haus' },
          { bild: '/images/hasen.jpg', alt: 'Hasen im Gras', unterschrift: 'Hasen im Garten' },
          { bild: '/images/esel.jpg', alt: 'Esel auf der Weide', unterschrift: 'Vierbeinige Nachbarn' },
          { bild: '/images/kuehe-morgennebel.jpg', alt: 'Kühe im Morgennebel', unterschrift: 'Kühe der Nachbarn' }
        ]
      }],
      ['zitat', { text: 'Ein ruhiger Ort mit viel Raum. Und einer, an dem sich manches von selbst ergibt.' }],
      ['text_bild', {
        ueberschrift: 'Ferien für Menschen, die Gemeinschaft suchen',
        text: 'Die Mühle wird vom gemeinnützigen Verein „Wertacher Mühle, Sonnenhof e.V.“ getragen. In den Schulferien gehört das Haus den Alleinerziehenden und ihren Kindern. Dazwischen kommen Schulklassen, Familienfreizeiten, Seminare und Gruppen aller Art.',
        liste: [
          'Urlaub für Singleeltern|/urlaub-fuer-singleeltern| — Ferien in Gemeinschaft, in allen Schulferien',
          'Gruppen|/gruppen| — Freizeiten, Seminare, Vereine und Chöre',
          'Schulklassen|/schulklassen| — Klassenfahrten mit Natur und Tieren'
        ],
        bild: '/images/fassade-schindeln.jpg', bild_alt: 'Die schindelverkleidete Fassade des neuen Hauses',
        bild_unterschrift: 'Die neue Fassade, verschindelt wie eh und je', bild_links: true
      }],
      ['chronik', {
        ueberschrift: 'Sechshundert Jahre Mühlengeschichte',
        eintraege: [
          '1424|Erste urkundliche Erwähnung als „Schleifmühle“. Über Jahrhunderte werden hier Roggen, Weizen und Hafer gemahlen.',
          '1960|Bis 1990 privates Kindererholungsheim „Sonnenhof“ für bis zu 80 Kinder.',
          '1992|Gründung des gemeinnützigen Vereins „Wertacher Mühle, Sonnenhof e.V.“ – seither Ferien für Alleinerziehende, Gruppen und Schulklassen.',
          '2021|Ein Brand zerstört das alte Mühlengebäude. Viele Freundinnen und Freunde der Mühle helfen beim Neuanfang.',
          'Heute|Die neue Mühle steht – aus massivem Holz, gebaut für die nächsten Generationen.'
        ],
        bild: '/images/muehle-luftbild.jpg', bild_alt: 'Die neue Mühle mit Photovoltaik-Dach vor Allgäuer Bergen',
        bild_unterschrift: 'Die neue Mühle, Sommer 2025'
      }],
      ['cta', {
        ueberschrift: 'Lust auf Mühle bekommen?',
        text: 'Schaut euch die freien Termine an oder meldet euch direkt – wir freuen uns auf euch.',
        knopf_text: 'Jetzt buchen', knopf_ziel: '/buchen'
      }]
    ]
  },
  {
    slug: 'hausbesichtigung', titel: 'Das Haus | Wertacher Mühle', nav_titel: 'Das Haus',
    beschreibung: 'Das Haus der Wertacher Mühle – ökologisches Vollholzhaus mit 35 Betten, Stuben mit Holzöfen, Gästeküche und großem Garten mit Bach.',
    bloecke: [
      ['seitenkopf', {
        ueberschrift: 'Hausbesichtigung',
        text: 'Neu aufgebaut als Vollholzhaus – mit viel Platz drinnen, einem großen Garten draußen und dem Bach direkt hinterm Haus.'
      }],
      ['grossfoto', {
        bild: '/images/muehle-luftbild.jpg',
        alt: 'Die neue Wertacher Mühle von oben, mit Photovoltaik auf dem Dach',
        unterschrift: 'Die neue Mühle mit Sonnenstrom vom eigenen Dach'
      }],
      ['text_bild', {
        ueberschrift: 'Drinnen',
        text: 'Das Haus bietet Platz für rund 35 Personen. Die Zimmer sind individuell und gemütlich eingerichtet – und alle blicken ins Grüne.',
        liste: [
          '35 Betten in gemütlichen Zimmern',
          'Zwei Ess- und Aufenthaltsräume mit Holzöfen',
          'Großer Seminar- und Gruppenraum',
          'Gästeküche mit Spülmaschine für Selbstversorger',
          'Lesezimmer, Spielzimmer, Tischtennis und Kicker',
          'Trockenraum und Waschmaschine für lange Aufenthalte'
        ],
        bild: '/images/fassade-schindeln.jpg', bild_alt: 'Die schindelverkleidete Fassade',
        bild_unterschrift: 'Holzschindeln, wie sie ins Allgäu gehören'
      }],
      ['text_bild', {
        ueberschrift: 'Draußen',
        text: 'Rund um das Haus liegt ein großes Gartengelände mit altem Baumbestand. Auf der Rückseite fließt der Bach, der früher das Mühlrad angetrieben hat – man hört ihn bis ins Haus.',
        liste: [
          'Rund 6000 m² Spiel- und Liegewiese',
          'Lagerfeuer- und Grillplatz',
          'Kinderspielplatz und Platz zum Toben',
          'Stall mit Pferden, Hasen im Garten, Katzen im Haus',
          'Wandern, Radfahren und Wintersport direkt ab Haus',
          'Parkplätze am Haus'
        ],
        bild: '/images/muehle-vogelperspektive.jpg', bild_alt: 'Die Mühle aus der Vogelperspektive, umgeben von Wald',
        bild_unterschrift: 'Der Bach hinterm Haus trieb früher das Mühlrad', bild_oben: true
      }],
      ['freitext', {
        ueberschrift: 'Neu gebaut, alt gedacht',
        text: 'Nach dem Brand im Jahr 2021 wurde die Mühle als ökologisches Vollholzhaus neu errichtet: massives Holz, eine verschindelte Fassade, geheizt mit Erdwärme und Holzöfen, den Strom liefert die Sonne über die Photovoltaik auf dem Dach. Ein neues Haus – gebaut, wie man hier schon immer gebaut hat.\n\nIhr möchtet das Haus sehen? Wir zeigen es euch gerne persönlich – ruft an unter 08365 / 1628 oder schreibt an Wertachermuehle@web.de.'
      }]
    ]
  },
  {
    slug: 'urlaub-fuer-singleeltern', titel: 'Urlaub für Singleeltern | Wertacher Mühle', nav_titel: 'Singleeltern',
    beschreibung: 'Urlaub für Alleinerziehende im Allgäu: In den Schulferien gehört die Wertacher Mühle Singleeltern und ihren Kindern – Gemeinschaft, Natur und Erholung.',
    bloecke: [
      ['seitenkopf', {
        ueberschrift: 'Urlaub für Singleeltern',
        text: 'In den Schulferien gehört die Mühle den Alleinerziehenden und ihren Kindern – Ferien in Gemeinschaft, mitten in der Natur.'
      }],
      ['text_bild', {
        ueberschrift: 'Gemeinsam statt allein',
        text: 'Alleinerziehende tragen viel – im Alltag und oft auch im Urlaub. In der Mühle muss niemand alles alleine stemmen: Die Kinder finden schnell Spielkameraden, die Großen finden Zeit zum Durchatmen und gute Gespräche am Abend.\n\nMorgens gemeinsames Frühstück in der Stube, danach zieht es die Kinder meist direkt zu den Pferden und Hasen. Tagsüber wandern, baden, in die Berge fahren – oder einfach den ganzen Tag auf der Spielwiese und am Bach bleiben. Abends Lagerfeuer, Spiele oder einfach Ruhe am Holzofen, während die Kinder längst Freunde geworden sind.',
        bild: '/images/allgaeu-landschaft.jpg', bild_alt: 'Blick über die Allgäuer Hügel mit kleiner Kapelle',
        bild_unterschrift: 'Vor der Tür: das Allgäu'
      }],
      ['termine', {
        ueberschrift: 'Termine und freie Plätze',
        text: 'Hier stehen die nächsten Ferienwochen – direkt online buchbar. Die Ferienzeiten sind schnell ausgebucht, fragt am besten frühzeitig an.',
        typ: 'singleeltern'
      }],
      ['fotoreihe', {
        ueberschrift: 'Die Tiere sind mit dabei',
        fotos: [
          { bild: '/images/pferde-weide.jpg', alt: 'Pferde grasen auf der Weide', unterschrift: 'Auf der Weide' },
          { bild: '/images/pferd-portrait.jpg', alt: 'Pferdeportrait in der Abendsonne', unterschrift: 'Unsere Pferde' },
          { bild: '/images/hasen.jpg', alt: 'Hasen im Garten', unterschrift: 'Hasen im Garten' },
          { bild: '/images/katze.jpg', alt: 'Neugierige Katze', unterschrift: 'Katzen im Haus' }
        ]
      }]
    ]
  },
  {
    slug: 'gruppen', titel: 'Gruppen | Wertacher Mühle', nav_titel: 'Gruppen',
    beschreibung: 'Gruppenhaus im Allgäu: Die Wertacher Mühle bietet Platz für Familienfreizeiten, Seminare, Vereins- und Sportgruppen – mit 35 Betten und großem Garten.',
    bloecke: [
      ['seitenkopf', {
        ueberschrift: 'Gruppen in der Mühle',
        text: 'Wer die Mühle bucht, hat sie für sich: das ganze Haus, den Garten, den Bach und die Ruhe drumherum.'
      }],
      ['text_bild', {
        ueberschrift: 'Ein ganzes Haus für eure Gruppe',
        text: 'Familienfreizeiten, Seminare, Chöre, Vereine und Sportgruppen: Die Mühle bietet Raum für alle, die etwas miteinander vorhaben. Abgelegen genug, dass niemand gestört wird – und dass sich eine Gruppe wirklich begegnet.\n\nAls gemeinnütziger Verein liegen uns Gruppen mit sozialen Anliegen besonders am Herzen.',
        liste: [
          'Bis zu 35 Betten',
          'Großer Seminar- und Gruppenraum für Programm und Proben',
          'Zwei Stuben mit Holzöfen für die Abende',
          'Gästeküche für Selbstversorger – Verpflegung nach Absprache',
          '6000 m² Garten mit Lagerfeuerplatz und Spielwiese',
          'Parkplätze direkt am Haus'
        ],
        bild: '/images/muehle-vogelperspektive.jpg', bild_alt: 'Die Wertacher Mühle von oben, mitten im Grünen',
        bild_unterschrift: 'Alleinstehend am Waldrand – niemand stört, niemand wird gestört', bild_oben: true
      }],
      ['grossfoto', {
        bild: '/images/hero-muehle-abend.jpg',
        alt: 'Abendstimmung an der Wertacher Mühle mit Bergblick',
        unterschrift: 'Abends wird es still – bis auf den Bach'
      }],
      ['freitext', {
        ueberschrift: 'Rund um die Mühle',
        text: 'Wandern und Radfahren beginnen an der Haustür, im Winter sind Skigebiete und Rodelhänge in der Nähe. Der Grüntensee, Bad Hindelang und Füssen mit Schloss Neuschwanstein sind lohnende Ausflugsziele – und wer bleiben mag, bleibt einfach am Lagerfeuer.'
      }],
      ['cta', {
        ueberschrift: 'Erzählt uns, was ihr vorhabt',
        text: 'Stellt eine unverbindliche Anfrage mit eurem Wunschzeitraum – wir melden uns und schauen gemeinsam, wann die Mühle frei ist.',
        knopf_text: 'Gruppenanfrage stellen', knopf_ziel: '/anfrage'
      }]
    ]
  },
  {
    slug: 'schulklassen', titel: 'Schulklassen | Wertacher Mühle', nav_titel: 'Schulklassen',
    beschreibung: 'Klassenfahrt ins Allgäu: Die Wertacher Mühle bietet Schulklassen Natur, Tiere, Berge und viel Platz – für bis zu 35 Personen.',
    bloecke: [
      ['seitenkopf', {
        ueberschrift: 'Schulklassen auf der Mühle',
        text: 'Idyllisch und ruhig auf fast 1000 m Höhe, mitten in Wald und Wiesen – ein guter Ort für eure Klassenfahrt.'
      }],
      ['text_bild', {
        ueberschrift: 'Natur statt Bildschirm',
        text: 'Die alleinstehende Lage, der Gruppenraum und das große Gelände geben Kindern und Jugendlichen Raum, kreativ zu werden, zu spielen und Natur zu entdecken – ganz ohne Ablenkung.\n\nDer Bach hinterm Haus hat früher das Mühlrad angetrieben – heute ist er das schönste Freiluft-Klassenzimmer. Dazu kommen die Tiere: Pferde striegeln, Hasen füttern, Verantwortung übernehmen. Und abends Stockbrot und Sternenhimmel am Lagerfeuerplatz.',
        liste: [
          'Platz für Klassen bis 35 Personen samt Begleitung',
          'Alleinstehende Lage – niemand stört, niemand wird gestört',
          'Gruppenraum für Programm, Spiele und Regentage',
          'Spielwiese, Tischtennis, Kicker und Lagerfeuerplatz',
          'Wanderungen direkt ab Haus'
        ],
        bild: '/images/kuehe-morgennebel.jpg', bild_alt: 'Morgennebel über den Weiden rund um die Mühle',
        bild_unterschrift: 'Morgens um sieben auf den Weiden nebenan'
      }],
      ['text_bild', {
        ueberschrift: 'Für Lehrkräfte',
        text: 'Verpflegung nach Absprache oder Selbstversorgung in der Gästeküche. Wertach liegt an der B310 und ist gut mit dem Bus zu erreichen; Parkplätze gibt es am Haus. Für Ausflüge bieten sich der Grüntensee, Bad Hindelang und Füssen mit Schloss Neuschwanstein an.\n\nTermine und Konditionen besprechen wir am liebsten persönlich – oder ihr stellt direkt eine Anfrage mit eurem Wunschzeitraum.',
        bild: '/images/pferde-weide.jpg', bild_alt: 'Pferde auf der Weide vor der Mühle',
        bild_unterschrift: 'Die Pferde gehören zum Programm', bild_links: true
      }],
      ['cta', {
        ueberschrift: 'Klassenfahrt anfragen',
        text: 'Sagt uns Klassengröße und Wunschzeitraum – wir melden uns mit Terminen und Preisen.',
        knopf_text: 'Anfrage stellen', knopf_ziel: '/anfrage'
      }]
    ]
  },
  {
    slug: 'ihr-bei-uns', titel: 'Ihr bei uns – Kontakt & Anfahrt | Wertacher Mühle', nav_titel: 'Ihr bei uns',
    beschreibung: 'Kontakt und Anfahrt zur Wertacher Mühle: Vorderschneid 7, 87497 Wertach im Allgäu. Telefon 08365/1628.',
    bloecke: [
      ['seitenkopf', {
        ueberschrift: 'Ihr bei uns',
        text: 'Fragen, Termine, Besichtigung? Meldet euch – wir freuen uns auf euch.'
      }],
      ['kontakt', {
        ueberschrift: 'So erreicht ihr uns',
        bild: '/images/allgaeu-landschaft.jpg', bild_alt: 'Blick über die Allgäuer Landschaft rund um Wertach',
        bild_unterschrift: 'Der Weg lohnt sich'
      }],
      ['freitext', {
        ueberschrift: 'Anfahrt',
        text: 'Mit dem Auto: Über die A7 bis zur Ausfahrt Oy-Mittelberg, weiter auf der B310 Richtung Wertach / Oberjoch. In Wertach der Beschilderung Richtung Vorderschneid folgen – die Mühle liegt alleinstehend am Ortsrand. Fürs Navi: Vorderschneid 7, 87497 Wertach. Parkplätze gibt es direkt am Haus.\n\nMit Bahn und Bus: Bahn bis Kempten oder Sonthofen, weiter mit dem Bus nach Wertach. Abholung von der Bushaltestelle nach Absprache.'
      }]
    ]
  },
  {
    slug: 'impressum', titel: 'Impressum | Wertacher Mühle', nav_titel: 'Impressum', in_navigation: 0,
    bloecke: [
      ['seitenkopf', { ueberschrift: 'Impressum', text: '' }],
      ['freitext', {
        ueberschrift: 'Angaben gemäß § 5 DDG',
        text: 'Wertacher Mühle, Sonnenhof e.V.\nVorderschneid 7\n87497 Wertach\nDeutschland\n\nTelefon: 08365 / 1628\nE-Mail: Wertachermuehle@web.de\n\nVertreten durch: Den Vorstand des Vereins „Wertacher Mühle, Sonnenhof e.V.“\n\nHinweis: Bitte hier die vertretungsberechtigten Vorstandsmitglieder mit Namen sowie das zuständige Registergericht und die Vereinsregisternummer eintragen. Ebenso die inhaltlich verantwortliche Person nach § 18 Abs. 2 MStV.\n\nHaftung für Inhalte: Die Inhalte unserer Seiten wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen.\n\nHaftung für Links: Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.\n\nUrheberrecht: Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht.'
      }]
    ]
  },
  {
    slug: 'datenschutz', titel: 'Datenschutz | Wertacher Mühle', nav_titel: 'Datenschutz', in_navigation: 0,
    bloecke: [
      ['seitenkopf', { ueberschrift: 'Datenschutzerklärung', text: '' }],
      ['freitext', {
        ueberschrift: 'Verantwortliche Stelle',
        text: 'Wertacher Mühle, Sonnenhof e.V.\nVorderschneid 7\n87497 Wertach\nTelefon: 08365 / 1628\nE-Mail: Wertachermuehle@web.de\n\nBuchungen: Für die Abwicklung von Buchungen speichern wir die im Buchungsformular angegebenen Daten (Name, Anschrift, Kontaktdaten, Teilnehmerzahl). Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO. Die Daten werden nach den gesetzlichen Aufbewahrungsfristen gelöscht.\n\nOnline-Zahlung: Bei Zahlung per Karte wird die Zahlung über den Dienstleister Stripe abgewickelt; dabei gelten dessen Datenschutzbestimmungen.\n\nServer-Logdateien: Beim Aufruf dieser Website erhebt der Hosting-Anbieter automatisch Informationen in Server-Logdateien (z. B. IP-Adresse, Datum und Uhrzeit der Anfrage, Browsertyp). Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Hinweis: Bitte den tatsächlichen Hosting-Anbieter ergänzen.\n\nIhre Rechte: Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20), Widerspruch (Art. 21) sowie Beschwerde bei einer Aufsichtsbehörde (Art. 77 DSGVO). Zuständig ist das Bayerische Landesamt für Datenschutzaufsicht (BayLDA), Promenade 18, 91522 Ansbach.'
      }]
    ]
  }
];

function seedSeiten() {
  if (db.prepare('SELECT COUNT(*) AS n FROM seiten').get().n > 0) return;
  const seiteRein = db.prepare(
    'INSERT INTO seiten (slug, titel, nav_titel, beschreibung, sortierung, in_navigation) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const blockRein = db.prepare(
    'INSERT INTO bloecke (seite_id, typ, position, daten) VALUES (?, ?, ?, ?)'
  );
  SEED_SEITEN.forEach((seite, i) => {
    const info = seiteRein.run(
      seite.slug, seite.titel, seite.nav_titel, seite.beschreibung || '',
      i, seite.in_navigation === 0 ? 0 : 1
    );
    seite.bloecke.forEach(([typ, daten], pos) => {
      blockRein.run(info.lastInsertRowid, typ, pos, JSON.stringify(daten));
    });
  });
  console.log('[Setup] Website-Inhalte übernommen (' + SEED_SEITEN.length + ' Seiten).');
}

seedEinstellungen();
seedAdmin();
seedGetraenke();
seedTermine();
seedSeiten();

module.exports = { db, einstellung, setzeEinstellung, naechsteNummer, DATA_DIR };
