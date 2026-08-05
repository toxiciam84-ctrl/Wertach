// Dashboard unter /verwaltung: Buchungen, Abrechnung, E-Mails, Rechnungen,
// Termine, Website-Baukasten und Einstellungen.
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { db, einstellung, setzeEinstellung, DATA_DIR } = require('../db');
const { esc, BLOCK_TYPEN } = require('../render');
const { sende } = require('../mail');
const { rechnungFuerBuchung, euro, datumSchoen } = require('../buchungsHilfe');

const router = express.Router();
router.use(express.urlencoded({ extended: false }));

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(DATA_DIR, 'uploads'),
    filename: (req, file, cb) => {
      const sauber = file.originalname.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
      cb(null, Date.now() + '-' + sauber);
    }
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /image\/(jpeg|png|webp|svg\+xml)/.test(file.mimetype))
});

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

const NAV = [
  ['/verwaltung', 'Übersicht'],
  ['/verwaltung/buchungen', 'Buchungen'],
  ['/verwaltung/termine', 'Termine'],
  ['/verwaltung/getraenke', 'Getränke & Preise'],
  ['/verwaltung/website', 'Website-Baukasten'],
  ['/verwaltung/emails', 'E-Mails'],
  ['/verwaltung/einstellungen', 'Einstellungen']
];

function seite(req, titel, inhalt) {
  const meldung = req.session.meldung || '';
  req.session.meldung = null;
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(titel)} | Verwaltung Wertacher Mühle</title>
  <link rel="stylesheet" href="/css/verwaltung.css">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
</head>
<body>
  <header class="kopf">
    <span class="marke">Wertacher Mühle · Verwaltung</span>
    <nav>${NAV.map(([ziel, name]) =>
      `<a href="${ziel}"${req.path === ziel.replace('/verwaltung', '') || ('/verwaltung' + req.path) === ziel ? ' class="aktiv"' : ''}>${name}</a>`).join('')}
      <a href="/" target="_blank">Website ansehen ↗</a>
      <a href="/verwaltung/abmelden">Abmelden</a>
    </nav>
  </header>
  <main>
    ${meldung ? `<div class="meldung">${esc(meldung)}</div>` : ''}
    <h1>${esc(titel)}</h1>
    ${inhalt}
  </main>
</body>
</html>`;
}

function statusChip(status) {
  return `<span class="chip chip-${esc(status)}">${esc(status)}</span>`;
}

// ---------------------------------------------------------------------------
// Anmeldung
// ---------------------------------------------------------------------------

router.get('/anmelden', (req, res) => {
  res.send(`<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Anmelden | Wertacher Mühle</title>
    <link rel="stylesheet" href="/css/verwaltung.css"></head>
    <body class="anmeldung"><form method="post" action="/verwaltung/anmelden" class="anmelde-karte">
      <h1>Wertacher Mühle</h1>
      <p class="hinweis">Verwaltung – bitte anmelden</p>
      ${req.query.fehler ? '<p class="fehler">E-Mail oder Passwort falsch.</p>' : ''}
      <label>E-Mail<input type="email" name="email" required autofocus></label>
      <label>Passwort<input type="password" name="passwort" required></label>
      <button type="submit">Anmelden</button>
    </form></body></html>`);
});

router.post('/anmelden', (req, res) => {
  const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(String(req.body.email || '').trim());
  if (admin && bcrypt.compareSync(String(req.body.passwort || ''), admin.pass_hash)) {
    req.session.adminId = admin.id;
    return res.redirect('/verwaltung');
  }
  res.redirect('/verwaltung/anmelden?fehler=1');
});

router.get('/abmelden', (req, res) => {
  req.session = null;
  res.redirect('/verwaltung/anmelden');
});

router.use((req, res, next) => {
  if (!req.session.adminId) return res.redirect('/verwaltung/anmelden');
  next();
});

// ---------------------------------------------------------------------------
// Übersicht
// ---------------------------------------------------------------------------

router.get('/', (req, res) => {
  const offen = db.prepare("SELECT COUNT(*) AS n FROM buchungen WHERE status = 'angefragt'").get().n;
  const bestaetigt = db.prepare("SELECT COUNT(*) AS n FROM buchungen WHERE status IN ('bestaetigt','bezahlt')").get().n;
  const umsatz = db.prepare("SELECT COALESCE(SUM(betrag), 0) AS s FROM rechnungen WHERE strftime('%Y', angelegt) = strftime('%Y', 'now')").get().s;
  const postausgang = db.prepare("SELECT COUNT(*) AS n FROM emails WHERE status = 'ausgang'").get().n;
  const neueste = db.prepare(
    `SELECT b.*, t.titel AS termin_titel FROM buchungen b LEFT JOIN termine t ON t.id = b.termin_id
     ORDER BY b.angelegt DESC LIMIT 8`
  ).all();
  const zeilen = neueste.map(b => `<tr>
    <td><a href="/verwaltung/buchungen/${b.id}">${esc(b.nummer)}</a></td>
    <td>${esc(b.name)}</td>
    <td>${esc(b.termin_titel || (`Wunsch: ${datumSchoen(b.wunsch_beginn)} – ${datumSchoen(b.wunsch_ende)}`))}</td>
    <td>${b.erwachsene + b.kinder} Pers.</td>
    <td>${b.betrag ? euro(b.betrag) : '–'}</td>
    <td>${statusChip(b.status)}</td>
  </tr>`).join('');
  res.send(seite(req, 'Übersicht', `
    <div class="kacheln">
      <div class="kachel"><div class="zahl">${offen}</div><div class="label">Offene Anfragen</div></div>
      <div class="kachel"><div class="zahl">${bestaetigt}</div><div class="label">Bestätigte Buchungen</div></div>
      <div class="kachel"><div class="zahl">${euro(umsatz)}</div><div class="label">Rechnungen ${new Date().getFullYear()}</div></div>
      <div class="kachel"><div class="zahl">${postausgang}</div><div class="label">E-Mails im Postausgang</div></div>
    </div>
    <h2>Neueste Buchungen</h2>
    <table><thead><tr><th>Nummer</th><th>Name</th><th>Termin</th><th>Personen</th><th>Betrag</th><th>Status</th></tr></thead>
    <tbody>${zeilen || '<tr><td colspan="6">Noch keine Buchungen.</td></tr>'}</tbody></table>`));
});

// ---------------------------------------------------------------------------
// Buchungen
// ---------------------------------------------------------------------------

router.get('/buchungen', (req, res) => {
  const filter = req.query.status && req.query.status !== 'alle' ? 'WHERE b.status = ?' : '';
  const buchungen = db.prepare(
    `SELECT b.*, t.titel AS termin_titel FROM buchungen b LEFT JOIN termine t ON t.id = b.termin_id
     ${filter} ORDER BY b.angelegt DESC`
  ).all(...(filter ? [req.query.status] : []));
  const status = ['alle', 'angefragt', 'bestaetigt', 'bezahlt', 'abgeschlossen', 'storniert'];
  const tabs = status.map(s =>
    `<a class="tab${(req.query.status || 'alle') === s ? ' aktiv' : ''}" href="/verwaltung/buchungen?status=${s}">${s}</a>`).join('');
  const zeilen = buchungen.map(b => `<tr>
    <td><a href="/verwaltung/buchungen/${b.id}">${esc(b.nummer)}</a></td>
    <td>${esc(b.name)}<br><span class="klein">${esc(b.email)}</span></td>
    <td>${esc(b.termin_titel || (`Wunsch: ${datumSchoen(b.wunsch_beginn)} – ${datumSchoen(b.wunsch_ende)}`))}</td>
    <td>${b.erwachsene} Erw. / ${b.kinder} Ki.</td>
    <td>${b.betrag ? euro(b.betrag) : '–'}</td>
    <td>${statusChip(b.status)}</td>
    <td class="klein">${esc(b.angelegt.slice(0, 10))}</td>
  </tr>`).join('');
  res.send(seite(req, 'Buchungen', `
    <div class="tabs">${tabs}</div>
    <table><thead><tr><th>Nummer</th><th>Gast</th><th>Termin</th><th>Personen</th><th>Betrag</th><th>Status</th><th>Eingang</th></tr></thead>
    <tbody>${zeilen || '<tr><td colspan="7">Keine Buchungen mit diesem Status.</td></tr>'}</tbody></table>`));
});

router.get('/buchungen/:id', (req, res) => {
  const b = db.prepare('SELECT * FROM buchungen WHERE id = ?').get(req.params.id);
  if (!b) return res.redirect('/verwaltung/buchungen');
  const termin = b.termin_id ? db.prepare('SELECT * FROM termine WHERE id = ?').get(b.termin_id) : null;
  const posten = db.prepare('SELECT * FROM posten WHERE buchung_id = ? ORDER BY id').all(b.id);
  const getraenke = db.prepare('SELECT * FROM getraenke WHERE aktiv = 1 ORDER BY name').all();
  const rechnungen = db.prepare('SELECT * FROM rechnungen WHERE buchung_id = ? ORDER BY id DESC').all(b.id);
  const mails = db.prepare('SELECT * FROM emails WHERE buchung_id = ? ORDER BY id DESC').all(b.id);
  const postenSumme = posten.reduce((s, p) => s + p.menge * p.einzelpreis, 0);

  const getraenkeKnoepfe = getraenke.map(g =>
    `<form method="post" action="/verwaltung/buchungen/${b.id}/posten" class="inline">
      <input type="hidden" name="getraenk_id" value="${g.id}">
      <button type="submit" class="knopf klein-knopf">+1 ${esc(g.name)} (${euro(g.preis)})</button>
    </form>`).join(' ');

  const postenZeilen = posten.map(p => `<tr>
    <td>${esc(p.bezeichnung)}</td><td>${p.menge}</td><td>${euro(p.einzelpreis)}</td>
    <td>${euro(p.menge * p.einzelpreis)}</td>
    <td><form method="post" action="/verwaltung/buchungen/${b.id}/posten/${p.id}/loeschen" class="inline"><button class="knopf klein-knopf rot">Entfernen</button></form></td>
  </tr>`).join('');

  const statusKnoepfe = ['bestaetigt', 'bezahlt', 'abgeschlossen', 'storniert']
    .filter(s => s !== b.status)
    .map(s => `<form method="post" action="/verwaltung/buchungen/${b.id}/status" class="inline">
      <input type="hidden" name="status" value="${s}">
      <button class="knopf">${s === 'bestaetigt' ? 'Bestätigen' : s === 'bezahlt' ? 'Als bezahlt markieren' : s === 'abgeschlossen' ? 'Abschließen' : 'Stornieren'}</button>
    </form>`).join(' ');

  res.send(seite(req, `Buchung ${b.nummer}`, `
    <p><a href="/verwaltung/buchungen">← Alle Buchungen</a></p>
    <div class="spalten">
      <section class="karte">
        <h2>Gast ${statusChip(b.status)}</h2>
        <p><strong>${esc(b.name)}</strong><br>
        ${esc(b.strasse)}${b.strasse ? '<br>' : ''}${esc(b.plz_ort)}${b.plz_ort ? '<br>' : ''}
        <a href="mailto:${esc(b.email)}">${esc(b.email)}</a>${b.telefon ? '<br>' + esc(b.telefon) : ''}</p>
        <p>${termin
          ? `<strong>${esc(termin.titel)}</strong><br>${datumSchoen(termin.beginn)} – ${datumSchoen(termin.ende)}`
          : `<strong>Wunschzeitraum:</strong> ${datumSchoen(b.wunsch_beginn)} – ${datumSchoen(b.wunsch_ende)}`}
        <br>${b.erwachsene} Erwachsene, ${b.kinder} Kinder · Zahlart: ${esc(b.zahlart)}</p>
        ${b.nachricht ? `<p class="klein"><strong>Nachricht:</strong> ${esc(b.nachricht)}</p>` : ''}
        <div class="knopfleiste">${statusKnoepfe}</div>
        <h3>Unterkunft</h3>
        <form method="post" action="/verwaltung/buchungen/${b.id}/betrag" class="formzeile">
          <label>Betrag Unterkunft (€)
            <input type="number" step="0.01" name="betrag" value="${(b.betrag / 100).toFixed(2)}">
          </label>
          <button class="knopf">Speichern</button>
        </form>
      </section>

      <section class="karte">
        <h2>Abrechnung (Getränke & Extras)</h2>
        <p class="klein">Schnell eintragen – ein Klick pro Getränk:</p>
        <div class="knopfleiste">${getraenkeKnoepfe || '<span class="klein">Keine Getränke angelegt – unter „Getränke &amp; Preise“ anlegen.</span>'}</div>
        <form method="post" action="/verwaltung/buchungen/${b.id}/posten" class="formzeile">
          <label>Eigener Posten<input type="text" name="bezeichnung" placeholder="z. B. Brennholz"></label>
          <label>Menge<input type="number" name="menge" value="1" min="1"></label>
          <label>Einzelpreis (€)<input type="number" step="0.01" name="einzelpreis" value="0"></label>
          <button class="knopf">Hinzufügen</button>
        </form>
        <table><thead><tr><th>Posten</th><th>Menge</th><th>Einzeln</th><th>Gesamt</th><th></th></tr></thead>
        <tbody>${postenZeilen || '<tr><td colspan="5">Noch keine Posten.</td></tr>'}</tbody></table>
        <p><strong>Summe Extras: ${euro(postenSumme)}</strong> · Gesamt mit Unterkunft: <strong>${euro(postenSumme + b.betrag)}</strong></p>
      </section>

      <section class="karte">
        <h2>Rechnungen</h2>
        <div class="knopfleiste">
          <form method="post" action="/verwaltung/buchungen/${b.id}/rechnung" class="inline">
            <input type="hidden" name="art" value="rechnung">
            <button class="knopf">Rechnung Unterkunft erstellen + senden</button>
          </form>
          <form method="post" action="/verwaltung/buchungen/${b.id}/rechnung" class="inline">
            <input type="hidden" name="art" value="endabrechnung">
            <button class="knopf">Endabrechnung erstellen + senden</button>
          </form>
        </div>
        <ul class="liste">${rechnungen.map(r =>
          `<li><a href="/verwaltung/rechnungen/${r.id}/pdf">${esc(r.nummer)}</a> (${esc(r.art)}, ${euro(r.betrag)}, ${esc(r.angelegt.slice(0, 10))})</li>`).join('') || '<li>Noch keine Rechnung erstellt.</li>'}</ul>
      </section>

      <section class="karte">
        <h2>E-Mail an den Gast</h2>
        <form method="post" action="/verwaltung/buchungen/${b.id}/email">
          <label>Betreff<input type="text" name="betreff" value="Eure Buchung ${esc(b.nummer)} – Wertacher Mühle" required></label>
          <label>Text<textarea name="text" rows="7" required>Liebe/r ${esc(b.name)},\n\n\n\nHerzliche Grüße aus Wertach\n${esc(einstellung('verein_name'))}</textarea></label>
          <button class="knopf">Senden</button>
        </form>
        <h3>Bisherige E-Mails</h3>
        <ul class="liste">${mails.map(m =>
          `<li>${esc(m.angelegt.slice(0, 16).replace('T', ' '))} · ${esc(m.betreff)} <span class="klein">(${esc(m.status)})</span></li>`).join('') || '<li>Noch keine E-Mails.</li>'}</ul>
      </section>
    </div>`));
});

router.post('/buchungen/:id/status', (req, res) => {
  const erlaubt = ['angefragt', 'bestaetigt', 'bezahlt', 'abgeschlossen', 'storniert'];
  if (erlaubt.includes(req.body.status)) {
    db.prepare('UPDATE buchungen SET status = ? WHERE id = ?').run(req.body.status, req.params.id);
    req.session.meldung = 'Status geändert.';
  }
  res.redirect(`/verwaltung/buchungen/${req.params.id}`);
});

router.post('/buchungen/:id/betrag', (req, res) => {
  const betrag = Math.round(parseFloat(String(req.body.betrag).replace(',', '.')) * 100) || 0;
  db.prepare('UPDATE buchungen SET betrag = ? WHERE id = ?').run(betrag, req.params.id);
  req.session.meldung = 'Betrag gespeichert.';
  res.redirect(`/verwaltung/buchungen/${req.params.id}`);
});

router.post('/buchungen/:id/posten', (req, res) => {
  if (req.body.getraenk_id) {
    const g = db.prepare('SELECT * FROM getraenke WHERE id = ?').get(req.body.getraenk_id);
    if (g) {
      const vorhanden = db.prepare(
        'SELECT * FROM posten WHERE buchung_id = ? AND bezeichnung = ? AND einzelpreis = ?'
      ).get(req.params.id, g.name, g.preis);
      if (vorhanden) {
        db.prepare('UPDATE posten SET menge = menge + 1 WHERE id = ?').run(vorhanden.id);
      } else {
        db.prepare('INSERT INTO posten (buchung_id, bezeichnung, menge, einzelpreis, typ) VALUES (?, ?, 1, ?, ?)')
          .run(req.params.id, g.name, g.preis, 'getraenk');
      }
    }
  } else if (req.body.bezeichnung) {
    const einzel = Math.round(parseFloat(String(req.body.einzelpreis).replace(',', '.')) * 100) || 0;
    db.prepare('INSERT INTO posten (buchung_id, bezeichnung, menge, einzelpreis, typ) VALUES (?, ?, ?, ?, ?)')
      .run(req.params.id, String(req.body.bezeichnung), Math.max(1, parseInt(req.body.menge, 10) || 1), einzel, 'extra');
  }
  res.redirect(`/verwaltung/buchungen/${req.params.id}`);
});

router.post('/buchungen/:id/posten/:postenId/loeschen', (req, res) => {
  db.prepare('DELETE FROM posten WHERE id = ? AND buchung_id = ?').run(req.params.postenId, req.params.id);
  res.redirect(`/verwaltung/buchungen/${req.params.id}`);
});

router.post('/buchungen/:id/rechnung', async (req, res) => {
  try {
    const art = req.body.art === 'endabrechnung' ? 'endabrechnung' : 'rechnung';
    const rechnung = await rechnungFuerBuchung(parseInt(req.params.id, 10), art);
    req.session.meldung = `${rechnung.nummer} erstellt und per E-Mail verschickt (bzw. in den Postausgang gelegt).`;
  } catch (e) {
    req.session.meldung = 'Fehler: ' + e.message;
  }
  res.redirect(`/verwaltung/buchungen/${req.params.id}`);
});

router.post('/buchungen/:id/email', async (req, res) => {
  const b = db.prepare('SELECT * FROM buchungen WHERE id = ?').get(req.params.id);
  if (b) {
    const ergebnis = await sende({
      an: b.email, betreff: String(req.body.betreff || ''), text: String(req.body.text || ''), buchungId: b.id
    });
    req.session.meldung = ergebnis.gesendet ? 'E-Mail gesendet.' : ergebnis.hinweis;
  }
  res.redirect(`/verwaltung/buchungen/${req.params.id}`);
});

router.get('/rechnungen/:id/pdf', (req, res) => {
  const r = db.prepare('SELECT * FROM rechnungen WHERE id = ?').get(req.params.id);
  if (!r) return res.redirect('/verwaltung');
  res.download(r.pfad, r.nummer + '.pdf');
});

// ---------------------------------------------------------------------------
// Termine
// ---------------------------------------------------------------------------

function terminFormular(t = {}) {
  return `<form method="post" action="/verwaltung/termine/${t.id ? t.id : 'neu'}" class="karte formular-karte">
    <h2>${t.id ? 'Termin bearbeiten' : 'Neuer Termin'}</h2>
    <label>Titel<input type="text" name="titel" value="${esc(t.titel || '')}" required></label>
    <div class="formzeile">
      <label>Art<select name="typ">
        ${['singleeltern', 'gruppe', 'schulklasse', 'sonstiges'].map(x =>
          `<option value="${x}"${t.typ === x ? ' selected' : ''}>${x}</option>`).join('')}
      </select></label>
      <label>Beginn<input type="date" name="beginn" value="${esc(t.beginn || '')}" required></label>
      <label>Ende<input type="date" name="ende" value="${esc(t.ende || '')}" required></label>
      <label>Plätze<input type="number" name="plaetze" value="${t.plaetze != null ? t.plaetze : 30}" min="1"></label>
    </div>
    <div class="formzeile">
      <label>Preis Erwachsener (€)<input type="number" step="0.01" name="preis_erwachsener" value="${((t.preis_erwachsener || 0) / 100).toFixed(2)}"></label>
      <label>Preis Kind (€)<input type="number" step="0.01" name="preis_kind" value="${((t.preis_kind || 0) / 100).toFixed(2)}"></label>
      <label>Pauschalpreis (€, 0 = pro Person)<input type="number" step="0.01" name="preis_pauschal" value="${((t.preis_pauschal || 0) / 100).toFixed(2)}"></label>
    </div>
    <label>Beschreibung<textarea name="beschreibung" rows="2">${esc(t.beschreibung || '')}</textarea></label>
    <label class="zeile"><input type="checkbox" name="buchbar" ${t.buchbar !== 0 ? 'checked' : ''}> Online buchbar</label>
    <button class="knopf">Speichern</button>
  </form>`;
}

router.get('/termine', (req, res) => {
  const termine = db.prepare('SELECT * FROM termine ORDER BY beginn DESC').all();
  const zeilen = termine.map(t => `<tr>
    <td><a href="/verwaltung/termine/${t.id}">${esc(t.titel)}</a></td>
    <td>${esc(t.typ)}</td><td>${datumSchoen(t.beginn)} – ${datumSchoen(t.ende)}</td>
    <td>${t.plaetze}</td>
    <td>${t.preis_pauschal ? euro(t.preis_pauschal) + ' pauschal' : euro(t.preis_erwachsener) + ' / ' + euro(t.preis_kind)}</td>
    <td>${t.buchbar ? 'ja' : 'nein'}</td>
    <td><form method="post" action="/verwaltung/termine/${t.id}/loeschen" class="inline"><button class="knopf klein-knopf rot">Löschen</button></form></td>
  </tr>`).join('');
  res.send(seite(req, 'Termine', `
    <table><thead><tr><th>Titel</th><th>Art</th><th>Zeitraum</th><th>Plätze</th><th>Preis</th><th>Buchbar</th><th></th></tr></thead>
    <tbody>${zeilen || '<tr><td colspan="7">Noch keine Termine.</td></tr>'}</tbody></table>
    ${terminFormular()}`));
});

router.get('/termine/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM termine WHERE id = ?').get(req.params.id);
  if (!t) return res.redirect('/verwaltung/termine');
  res.send(seite(req, 'Termin bearbeiten', `<p><a href="/verwaltung/termine">← Alle Termine</a></p>` + terminFormular(t)));
});

router.post('/termine/:id', (req, res) => {
  const cent = f => Math.round(parseFloat(String(f || '0').replace(',', '.')) * 100) || 0;
  const werte = [
    String(req.body.titel || ''), String(req.body.typ || 'sonstiges'),
    String(req.body.beginn || ''), String(req.body.ende || ''),
    Math.max(1, parseInt(req.body.plaetze, 10) || 30),
    cent(req.body.preis_erwachsener), cent(req.body.preis_kind), cent(req.body.preis_pauschal),
    String(req.body.beschreibung || ''), req.body.buchbar ? 1 : 0
  ];
  if (req.params.id === 'neu') {
    db.prepare(
      'INSERT INTO termine (titel, typ, beginn, ende, plaetze, preis_erwachsener, preis_kind, preis_pauschal, beschreibung, buchbar) VALUES (?,?,?,?,?,?,?,?,?,?)'
    ).run(...werte);
  } else {
    db.prepare(
      'UPDATE termine SET titel=?, typ=?, beginn=?, ende=?, plaetze=?, preis_erwachsener=?, preis_kind=?, preis_pauschal=?, beschreibung=?, buchbar=? WHERE id=?'
    ).run(...werte, req.params.id);
  }
  req.session.meldung = 'Termin gespeichert.';
  res.redirect('/verwaltung/termine');
});

router.post('/termine/:id/loeschen', (req, res) => {
  db.prepare('DELETE FROM termine WHERE id = ?').run(req.params.id);
  req.session.meldung = 'Termin gelöscht.';
  res.redirect('/verwaltung/termine');
});

// ---------------------------------------------------------------------------
// Getränke & Preise
// ---------------------------------------------------------------------------

router.get('/getraenke', (req, res) => {
  const getraenke = db.prepare('SELECT * FROM getraenke ORDER BY aktiv DESC, name').all();
  const zeilen = getraenke.map(g => `<tr>
    <td>${esc(g.name)}</td><td>${euro(g.preis)}</td><td>${g.aktiv ? 'aktiv' : 'inaktiv'}</td>
    <td class="knopfleiste">
      <form method="post" action="/verwaltung/getraenke/${g.id}/umschalten" class="inline"><button class="knopf klein-knopf">${g.aktiv ? 'Deaktivieren' : 'Aktivieren'}</button></form>
      <form method="post" action="/verwaltung/getraenke/${g.id}/loeschen" class="inline"><button class="knopf klein-knopf rot">Löschen</button></form>
    </td>
  </tr>`).join('');
  res.send(seite(req, 'Getränke & Preise', `
    <p class="klein">Diese Liste erscheint als Schnell-Knöpfe in der Abrechnung jeder Buchung.</p>
    <table><thead><tr><th>Getränk</th><th>Preis</th><th>Status</th><th></th></tr></thead><tbody>${zeilen}</tbody></table>
    <form method="post" action="/verwaltung/getraenke" class="karte formular-karte">
      <h2>Neues Getränk / Extra</h2>
      <div class="formzeile">
        <label>Name<input type="text" name="name" required></label>
        <label>Preis (€)<input type="number" step="0.01" name="preis" required></label>
      </div>
      <button class="knopf">Anlegen</button>
    </form>`));
});

router.post('/getraenke', (req, res) => {
  const preis = Math.round(parseFloat(String(req.body.preis).replace(',', '.')) * 100) || 0;
  db.prepare('INSERT INTO getraenke (name, preis) VALUES (?, ?)').run(String(req.body.name || ''), preis);
  res.redirect('/verwaltung/getraenke');
});

router.post('/getraenke/:id/umschalten', (req, res) => {
  db.prepare('UPDATE getraenke SET aktiv = 1 - aktiv WHERE id = ?').run(req.params.id);
  res.redirect('/verwaltung/getraenke');
});

router.post('/getraenke/:id/loeschen', (req, res) => {
  db.prepare('DELETE FROM getraenke WHERE id = ?').run(req.params.id);
  res.redirect('/verwaltung/getraenke');
});

// ---------------------------------------------------------------------------
// E-Mails (Postausgang / Verlauf)
// ---------------------------------------------------------------------------

router.get('/emails', (req, res) => {
  const mails = db.prepare('SELECT * FROM emails ORDER BY id DESC LIMIT 100').all();
  const zeilen = mails.map(m => `<tr>
    <td class="klein">${esc(m.angelegt.slice(0, 16).replace('T', ' '))}</td>
    <td>${esc(m.an)}</td><td>${esc(m.betreff)}</td>
    <td>${esc(m.status)}</td>
  </tr>`).join('');
  const smtpDa = !!process.env.SMTP_HOST;
  res.send(seite(req, 'E-Mails', `
    ${smtpDa ? '' : '<div class="meldung">Kein SMTP konfiguriert – E-Mails werden hier gesammelt, aber nicht verschickt. SMTP-Zugang in der Datei .env eintragen (siehe .env.beispiel).</div>'}
    <table><thead><tr><th>Zeit</th><th>An</th><th>Betreff</th><th>Status</th></tr></thead>
    <tbody>${zeilen || '<tr><td colspan="4">Noch keine E-Mails.</td></tr>'}</tbody></table>`));
});

// ---------------------------------------------------------------------------
// Website-Baukasten
// ---------------------------------------------------------------------------

const BLOCK_NAMEN = {
  hero: 'Vollbild-Hero (Startseite)',
  seitenkopf: 'Seitenkopf (dunkles Band)',
  intro: 'Einleitung mit Bild und Knopf',
  stats: 'Zahlenband',
  ueberschrift_text: 'Überschrift + Text (zweispaltig)',
  fotoreihe: 'Fotoreihe',
  zitat: 'Zitat-Band',
  text_bild: 'Text + Bild (mit Liste)',
  chronik: 'Chronik',
  grossfoto: 'Großes Foto',
  freitext: 'Freitext',
  cta: 'Aufruf-Band (Buchen/Kontakt)',
  kontakt: 'Kontaktliste',
  termine: 'Terminliste (buchbar)'
};

router.get('/website', (req, res) => {
  const seiten = db.prepare('SELECT * FROM seiten ORDER BY sortierung').all();
  const zeilen = seiten.map(s => `<tr>
    <td><a href="/verwaltung/website/${s.id}">${esc(s.nav_titel)}</a> <span class="klein">/${s.slug === 'index' ? '' : esc(s.slug)}</span></td>
    <td>${s.in_navigation ? 'ja' : 'nein'}</td>
    <td>${s.sichtbar ? 'ja' : 'nein'}</td>
    <td class="knopfleiste">
      <form method="post" action="/verwaltung/website/${s.id}/verschieben" class="inline"><input type="hidden" name="richtung" value="-1"><button class="knopf klein-knopf">↑</button></form>
      <form method="post" action="/verwaltung/website/${s.id}/verschieben" class="inline"><input type="hidden" name="richtung" value="1"><button class="knopf klein-knopf">↓</button></form>
      ${s.slug !== 'index' ? `<form method="post" action="/verwaltung/website/${s.id}/loeschen" class="inline" onsubmit="return confirm('Seite wirklich löschen?')"><button class="knopf klein-knopf rot">Löschen</button></form>` : ''}
    </td>
  </tr>`).join('');
  res.send(seite(req, 'Website-Baukasten', `
    <p class="klein">Änderungen sind sofort auf der Website sichtbar. <a href="/" target="_blank">Website ansehen ↗</a></p>
    <table><thead><tr><th>Seite</th><th>Im Menü</th><th>Sichtbar</th><th>Reihenfolge</th></tr></thead><tbody>${zeilen}</tbody></table>
    <form method="post" action="/verwaltung/website" class="karte formular-karte">
      <h2>Neue Seite</h2>
      <div class="formzeile">
        <label>Menü-Titel<input type="text" name="nav_titel" required></label>
        <label>Adresse (z. B. "ferienprogramm")<input type="text" name="slug" pattern="[a-z0-9-]+" required></label>
      </div>
      <button class="knopf">Seite anlegen</button>
    </form>`));
});

router.post('/website', (req, res) => {
  const slug = String(req.body.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  const nav = String(req.body.nav_titel || '').trim();
  if (slug && nav && !db.prepare('SELECT 1 FROM seiten WHERE slug = ?').get(slug)) {
    const max = db.prepare('SELECT COALESCE(MAX(sortierung), 0) AS m FROM seiten').get().m;
    const info = db.prepare(
      'INSERT INTO seiten (slug, titel, nav_titel, sortierung) VALUES (?, ?, ?, ?)'
    ).run(slug, `${nav} | Wertacher Mühle`, nav, max + 1);
    db.prepare('INSERT INTO bloecke (seite_id, typ, position, daten) VALUES (?, ?, 0, ?)')
      .run(info.lastInsertRowid, 'seitenkopf', JSON.stringify({ ueberschrift: nav, text: '' }));
    return res.redirect(`/verwaltung/website/${info.lastInsertRowid}`);
  }
  req.session.meldung = 'Seite konnte nicht angelegt werden (Adresse schon vergeben?).';
  res.redirect('/verwaltung/website');
});

router.post('/website/:id/verschieben', (req, res) => {
  const s = db.prepare('SELECT * FROM seiten WHERE id = ?').get(req.params.id);
  if (s) {
    const richtung = req.body.richtung === '-1' ? -1 : 1;
    const nachbar = db.prepare(
      richtung === -1
        ? 'SELECT * FROM seiten WHERE sortierung < ? ORDER BY sortierung DESC LIMIT 1'
        : 'SELECT * FROM seiten WHERE sortierung > ? ORDER BY sortierung ASC LIMIT 1'
    ).get(s.sortierung);
    if (nachbar) {
      db.prepare('UPDATE seiten SET sortierung = ? WHERE id = ?').run(nachbar.sortierung, s.id);
      db.prepare('UPDATE seiten SET sortierung = ? WHERE id = ?').run(s.sortierung, nachbar.id);
    }
  }
  res.redirect('/verwaltung/website');
});

router.post('/website/:id/loeschen', (req, res) => {
  db.prepare("DELETE FROM seiten WHERE id = ? AND slug != 'index'").run(req.params.id);
  req.session.meldung = 'Seite gelöscht.';
  res.redirect('/verwaltung/website');
});

// --- Seiten-Editor -----------------------------------------------------------

function blockFormular(seiteId, block) {
  const daten = JSON.parse(block.daten);
  const felder = Object.entries(daten).map(([schluessel, wert]) => {
    if (Array.isArray(wert)) {
      const text = wert.map(z => typeof z === 'object' ? JSON.stringify(z) : z).join('\n');
      return `<label>${esc(schluessel)} <span class="klein">(eine Zeile pro Eintrag${typeof wert[0] === 'object' ? ', JSON-Format' : ''})</span>
        <textarea name="feld_${esc(schluessel)}" rows="${Math.min(8, wert.length + 2)}" data-art="liste">${esc(text)}</textarea></label>`;
    }
    if (typeof wert === 'boolean') {
      return `<label class="zeile"><input type="checkbox" name="feld_${esc(schluessel)}" ${wert ? 'checked' : ''} data-art="bool"> ${esc(schluessel)}</label>`;
    }
    if (String(wert).length > 90 || String(wert).includes('\n')) {
      return `<label>${esc(schluessel)}<textarea name="feld_${esc(schluessel)}" rows="4">${esc(wert)}</textarea></label>`;
    }
    const istBild = /^(bild|foto)/.test(schluessel) && typeof wert === 'string';
    return `<label>${esc(schluessel)}<input type="text" name="feld_${esc(schluessel)}" value="${esc(wert)}"></label>` +
      (istBild && wert ? `<img class="mini-vorschau" src="${esc(wert)}" alt="">` : '');
  }).join('\n');

  return `<div class="karte block-karte">
    <div class="block-kopf">
      <strong>${esc(BLOCK_NAMEN[block.typ] || block.typ)}</strong>
      <span class="knopfleiste">
        <form method="post" action="/verwaltung/website/${seiteId}/block/${block.id}/verschieben" class="inline"><input type="hidden" name="richtung" value="-1"><button class="knopf klein-knopf">↑</button></form>
        <form method="post" action="/verwaltung/website/${seiteId}/block/${block.id}/verschieben" class="inline"><input type="hidden" name="richtung" value="1"><button class="knopf klein-knopf">↓</button></form>
        <form method="post" action="/verwaltung/website/${seiteId}/block/${block.id}/loeschen" class="inline" onsubmit="return confirm('Block wirklich entfernen?')"><button class="knopf klein-knopf rot">Entfernen</button></form>
      </span>
    </div>
    <form method="post" action="/verwaltung/website/${seiteId}/block/${block.id}">
      ${felder || '<p class="klein">Dieser Block hat keine Einstellungen.</p>'}
      <button class="knopf">Block speichern</button>
    </form>
  </div>`;
}

router.get('/website/:id', (req, res) => {
  const s = db.prepare('SELECT * FROM seiten WHERE id = ?').get(req.params.id);
  if (!s) return res.redirect('/verwaltung/website');
  const bloecke = db.prepare('SELECT * FROM bloecke WHERE seite_id = ? ORDER BY position').all(s.id);
  const auswahl = Object.entries(BLOCK_NAMEN).map(([typ, name]) =>
    `<option value="${typ}">${esc(name)}</option>`).join('');
  res.send(seite(req, `Seite: ${s.nav_titel}`, `
    <p><a href="/verwaltung/website">← Alle Seiten</a> · <a href="/${s.slug === 'index' ? '' : s.slug}" target="_blank">Seite ansehen ↗</a></p>
    <form method="post" action="/verwaltung/website/${s.id}/einstellungen" class="karte formular-karte">
      <h2>Seiten-Einstellungen</h2>
      <div class="formzeile">
        <label>Menü-Titel<input type="text" name="nav_titel" value="${esc(s.nav_titel)}"></label>
        <label>Browser-Titel<input type="text" name="titel" value="${esc(s.titel)}"></label>
      </div>
      <label>Beschreibung (Suchmaschinen)<textarea name="beschreibung" rows="2">${esc(s.beschreibung)}</textarea></label>
      <div class="formzeile">
        <label class="zeile"><input type="checkbox" name="in_navigation" ${s.in_navigation ? 'checked' : ''}> Im Menü zeigen</label>
        <label class="zeile"><input type="checkbox" name="sichtbar" ${s.sichtbar ? 'checked' : ''}> Seite sichtbar</label>
      </div>
      <button class="knopf">Speichern</button>
    </form>

    <form method="post" action="/verwaltung/website/${s.id}/bild" enctype="multipart/form-data" class="karte formular-karte">
      <h2>Bild hochladen</h2>
      <p class="klein">Lädt ein Bild hoch und zeigt die Adresse an, die ihr in Blöcke (Felder „bild“) eintragen könnt.</p>
      <div class="formzeile">
        <label>Bilddatei<input type="file" name="bild" accept="image/*" required></label>
        <button class="knopf">Hochladen</button>
      </div>
    </form>

    <h2>Blöcke</h2>
    ${bloecke.map(b => blockFormular(s.id, b)).join('\n') || '<p class="klein">Noch keine Blöcke.</p>'}

    <form method="post" action="/verwaltung/website/${s.id}/block" class="karte formular-karte">
      <h2>Block hinzufügen</h2>
      <div class="formzeile">
        <label>Art<select name="typ">${auswahl}</select></label>
        <button class="knopf">Hinzufügen</button>
      </div>
    </form>`));
});

router.post('/website/:id/einstellungen', (req, res) => {
  db.prepare('UPDATE seiten SET nav_titel = ?, titel = ?, beschreibung = ?, in_navigation = ?, sichtbar = ? WHERE id = ?')
    .run(String(req.body.nav_titel || ''), String(req.body.titel || ''), String(req.body.beschreibung || ''),
      req.body.in_navigation ? 1 : 0, req.body.sichtbar ? 1 : 0, req.params.id);
  req.session.meldung = 'Seiten-Einstellungen gespeichert.';
  res.redirect(`/verwaltung/website/${req.params.id}`);
});

router.post('/website/:id/bild', upload.single('bild'), (req, res) => {
  req.session.meldung = req.file
    ? `Bild hochgeladen – Adresse: /uploads/${req.file.filename}`
    : 'Bild konnte nicht hochgeladen werden.';
  res.redirect(`/verwaltung/website/${req.params.id}`);
});

const STANDARD_DATEN = {
  hero: { bild: '/images/hero-muehle-abend.jpg', alt: '', ueberschrift: 'Überschrift' },
  seitenkopf: { ueberschrift: 'Überschrift', text: '' },
  intro: { lead: 'Einleitungssatz …', text: '', knopf_text: '', knopf_ziel: '', bild: '', bild_alt: '', bild_unterschrift: '' },
  stats: { werte: [{ zahl: '35', text: 'Betten im Haus' }] },
  ueberschrift_text: { ueberschrift: 'Überschrift', text: 'Text …' },
  fotoreihe: { ueberschrift: '', fotos: [{ bild: '/images/pferd-portrait.jpg', alt: '', unterschrift: '' }] },
  zitat: { text: 'Zitat …' },
  text_bild: { ueberschrift: 'Überschrift', text: 'Text …', liste: [], bild: '', bild_alt: '', bild_unterschrift: '', bild_links: false },
  chronik: { ueberschrift: 'Chronik', eintraege: ['1424|Erste Erwähnung'], bild: '', bild_alt: '', bild_unterschrift: '' },
  grossfoto: { bild: '', alt: '', unterschrift: '' },
  freitext: { ueberschrift: '', text: 'Text …' },
  cta: { ueberschrift: 'Lust auf Mühle bekommen?', text: '', knopf_text: 'Jetzt buchen', knopf_ziel: '/buchen' },
  kontakt: { ueberschrift: 'So erreicht ihr uns', bild: '', bild_alt: '', bild_unterschrift: '' },
  termine: { ueberschrift: 'Termine', text: '', typ: 'singleeltern' }
};

router.post('/website/:id/block', (req, res) => {
  const typ = String(req.body.typ || '');
  if (BLOCK_TYPEN.includes(typ)) {
    const max = db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM bloecke WHERE seite_id = ?').get(req.params.id).m;
    db.prepare('INSERT INTO bloecke (seite_id, typ, position, daten) VALUES (?, ?, ?, ?)')
      .run(req.params.id, typ, max + 1, JSON.stringify(STANDARD_DATEN[typ] || {}));
    req.session.meldung = 'Block hinzugefügt – jetzt unten ausfüllen.';
  }
  res.redirect(`/verwaltung/website/${req.params.id}`);
});

router.post('/website/:id/block/:blockId', (req, res) => {
  const block = db.prepare('SELECT * FROM bloecke WHERE id = ? AND seite_id = ?').get(req.params.blockId, req.params.id);
  if (block) {
    const alt = JSON.parse(block.daten);
    const neu = {};
    for (const [schluessel, altWert] of Object.entries(alt)) {
      const eingabe = req.body['feld_' + schluessel];
      if (typeof altWert === 'boolean') {
        neu[schluessel] = !!eingabe;
      } else if (Array.isArray(altWert)) {
        const zeilen = String(eingabe || '').split('\n').map(z => z.trim()).filter(Boolean);
        neu[schluessel] = typeof altWert[0] === 'object'
          ? zeilen.map(z => { try { return JSON.parse(z); } catch { return null; } }).filter(Boolean)
          : zeilen;
      } else {
        neu[schluessel] = String(eingabe != null ? eingabe : altWert);
      }
    }
    db.prepare('UPDATE bloecke SET daten = ? WHERE id = ?').run(JSON.stringify(neu), block.id);
    req.session.meldung = 'Block gespeichert.';
  }
  res.redirect(`/verwaltung/website/${req.params.id}`);
});

router.post('/website/:id/block/:blockId/verschieben', (req, res) => {
  const block = db.prepare('SELECT * FROM bloecke WHERE id = ? AND seite_id = ?').get(req.params.blockId, req.params.id);
  if (block) {
    const richtung = req.body.richtung === '-1' ? -1 : 1;
    const nachbar = db.prepare(
      richtung === -1
        ? 'SELECT * FROM bloecke WHERE seite_id = ? AND position < ? ORDER BY position DESC LIMIT 1'
        : 'SELECT * FROM bloecke WHERE seite_id = ? AND position > ? ORDER BY position ASC LIMIT 1'
    ).get(req.params.id, block.position);
    if (nachbar) {
      db.prepare('UPDATE bloecke SET position = ? WHERE id = ?').run(nachbar.position, block.id);
      db.prepare('UPDATE bloecke SET position = ? WHERE id = ?').run(block.position, nachbar.id);
    }
  }
  res.redirect(`/verwaltung/website/${req.params.id}`);
});

router.post('/website/:id/block/:blockId/loeschen', (req, res) => {
  db.prepare('DELETE FROM bloecke WHERE id = ? AND seite_id = ?').run(req.params.blockId, req.params.id);
  req.session.meldung = 'Block entfernt.';
  res.redirect(`/verwaltung/website/${req.params.id}`);
});

// ---------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------

const EINSTELLUNGS_FELDER = [
  ['verein_name', 'Vereinsname'],
  ['verein_strasse', 'Straße'],
  ['verein_ort', 'PLZ und Ort'],
  ['verein_telefon', 'Telefon'],
  ['verein_email', 'E-Mail'],
  ['bank_inhaber', 'Kontoinhaber'],
  ['bank_iban', 'IBAN'],
  ['bank_name', 'Bank'],
  ['zahlungsziel_tage', 'Zahlungsziel (Tage)'],
  ['rechnung_hinweis', 'Hinweis auf Rechnungen']
];

router.get('/einstellungen', (req, res) => {
  const felder = EINSTELLUNGS_FELDER.map(([schluessel, label]) =>
    `<label>${esc(label)}<input type="text" name="${schluessel}" value="${esc(einstellung(schluessel))}"></label>`).join('\n');
  res.send(seite(req, 'Einstellungen', `
    <div class="spalten">
      <form method="post" action="/verwaltung/einstellungen" class="karte">
        <h2>Verein & Rechnungen</h2>
        ${felder}
        <button class="knopf">Speichern</button>
      </form>
      <div>
        <form method="post" action="/verwaltung/einstellungen/passwort" class="karte">
          <h2>Passwort ändern</h2>
          <label>Neues Passwort<input type="password" name="passwort" minlength="8" required></label>
          <label>Wiederholen<input type="password" name="passwort2" minlength="8" required></label>
          <button class="knopf">Passwort setzen</button>
        </form>
        <div class="karte">
          <h2>Technik-Status</h2>
          <ul class="liste">
            <li>E-Mail-Versand (SMTP): <strong>${process.env.SMTP_HOST ? 'eingerichtet' : 'nicht eingerichtet – E-Mails bleiben im Postausgang'}</strong></li>
            <li>Online-Zahlung (Stripe): <strong>${process.env.STRIPE_SECRET_KEY ? 'eingerichtet' : 'nicht eingerichtet – Buchungen laufen per Überweisung'}</strong></li>
          </ul>
          <p class="klein">Beides wird in der Datei <code>.env</code> auf dem Server eingetragen (Vorlage: <code>.env.beispiel</code>).</p>
        </div>
      </div>
    </div>`));
});

router.post('/einstellungen', (req, res) => {
  for (const [schluessel] of EINSTELLUNGS_FELDER) {
    if (req.body[schluessel] != null) setzeEinstellung(schluessel, String(req.body[schluessel]));
  }
  req.session.meldung = 'Einstellungen gespeichert.';
  res.redirect('/verwaltung/einstellungen');
});

router.post('/einstellungen/passwort', (req, res) => {
  if (req.body.passwort && req.body.passwort === req.body.passwort2) {
    db.prepare('UPDATE admins SET pass_hash = ? WHERE id = ?')
      .run(bcrypt.hashSync(String(req.body.passwort), 10), req.session.adminId);
    req.session.meldung = 'Passwort geändert.';
  } else {
    req.session.meldung = 'Die Passwörter stimmen nicht überein.';
  }
  res.redirect('/verwaltung/einstellungen');
});

module.exports = { router };
