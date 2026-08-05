// Öffentliche Website: gerenderte Seiten, Buchungsstrecke und Gruppenanfrage.
const express = require('express');
const { db, naechsteNummer, einstellung } = require('../db');
const { renderSeite, seitenGeruest, esc, euro, datumSchoen } = require('../render');
const { sende } = require('../mail');

const router = express.Router();

const stripe = process.env.STRIPE_SECRET_KEY
  ? require('stripe')(process.env.STRIPE_SECRET_KEY)
  : null;

function basisUrl(req) {
  return process.env.BASIS_URL || `${req.protocol}://${req.get('host')}`;
}

function freiePlaetze(termin) {
  const belegt = db.prepare(
    "SELECT COALESCE(SUM(erwachsene + kinder), 0) AS n FROM buchungen WHERE termin_id = ? AND status IN ('angefragt','bestaetigt','bezahlt')"
  ).get(termin.id).n;
  return Math.max(0, termin.plaetze - belegt);
}

function preisFuer(termin, erwachsene, kinder) {
  if (termin.preis_pauschal > 0) return termin.preis_pauschal;
  return erwachsene * termin.preis_erwachsener + kinder * termin.preis_kind;
}

// ---------------------------------------------------------------------------
// Buchen: Übersicht
// ---------------------------------------------------------------------------

router.get('/buchen', (req, res) => {
  const termine = db.prepare(
    "SELECT * FROM termine WHERE buchbar = 1 AND ende >= date('now') ORDER BY beginn"
  ).all();
  const karten = termine.map(t => {
    const frei = freiePlaetze(t);
    const preis = t.preis_pauschal > 0
      ? `${euro(t.preis_pauschal)} pauschal`
      : `${euro(t.preis_erwachsener)} pro Erwachsener · ${euro(t.preis_kind)} pro Kind`;
    return `<div class="termin-karte">
      <div>
        <h3>${esc(t.titel)}</h3>
        <p class="muted">${datumSchoen(t.beginn)} – ${datumSchoen(t.ende)} · ${preis}</p>
        ${t.beschreibung ? `<p class="muted">${esc(t.beschreibung)}</p>` : ''}
      </div>
      <div class="termin-aktion">
        <span class="frei${frei === 0 ? ' voll' : ''}">${frei === 0 ? 'Ausgebucht' : `${frei} Plätze frei`}</span>
        ${frei > 0 ? `<a class="btn-line" href="/buchen/${t.id}">Jetzt buchen</a>` : ''}
      </div>
    </div>`;
  }).join('\n');

  const inhalt = `
    <section class="page-head"><div class="container">
      <h1 data-rb-split>Buchen</h1>
      <p class="intro">Ferienwochen für Singleeltern direkt online buchen – oder für Gruppen und Schulklassen den Wunschzeitraum anfragen.</p>
    </div></section>
    <section class="block"><div class="container">
      <h2 style="margin-bottom: 1.5rem;">Ferienwochen für Singleeltern</h2>
      <div class="termin-liste">${karten || '<p class="muted">Zurzeit sind keine Termine online buchbar – meldet euch gerne direkt bei uns.</p>'}</div>
    </div></section>
    <section class="cta-solid"><div class="container">
      <h2>Gruppe oder Schulklasse?</h2>
      <p>Nennt uns euren Wunschzeitraum – wir melden uns mit freien Terminen und einem Angebot.</p>
      <a class="btn-line" href="/anfrage">Anfrage stellen</a>
    </div></section>`;
  res.send(seitenGeruest({ slug: 'buchen', titel: 'Buchen | Wertacher Mühle', beschreibung: 'Ferienwochen in der Wertacher Mühle online buchen.', inhalt, mitHero: false }));
});

// ---------------------------------------------------------------------------
// Buchen: Formular für einen Termin
// ---------------------------------------------------------------------------

function buchungsFormular(termin, fehler = '', werte = {}) {
  const frei = freiePlaetze(termin);
  const preis = termin.preis_pauschal > 0
    ? `${euro(termin.preis_pauschal)} pauschal`
    : `${euro(termin.preis_erwachsener)} pro Erwachsener, ${euro(termin.preis_kind)} pro Kind`;
  const w = k => esc(werte[k] || '');
  return `
    <section class="page-head"><div class="container">
      <h1 data-rb-split>${esc(termin.titel)}</h1>
      <p class="intro">${datumSchoen(termin.beginn)} – ${datumSchoen(termin.ende)} · ${preis} · ${frei} Plätze frei</p>
    </div></section>
    <section class="block"><div class="container"><div class="narrow">
      ${fehler ? `<p class="formular-fehler">${esc(fehler)}</p>` : ''}
      <form method="post" action="/buchen/${termin.id}" class="formular">
        <div class="feld-reihe">
          <label>Erwachsene
            <input type="number" name="erwachsene" min="1" max="${frei}" value="${w('erwachsene') || '1'}" required>
          </label>
          <label>Kinder
            <input type="number" name="kinder" min="0" max="${frei}" value="${w('kinder') || '0'}" required>
          </label>
        </div>
        <label>Name<input type="text" name="name" value="${w('name')}" required></label>
        <label>E-Mail<input type="email" name="email" value="${w('email')}" required></label>
        <label>Telefon<input type="tel" name="telefon" value="${w('telefon')}"></label>
        <label>Straße und Hausnummer<input type="text" name="strasse" value="${w('strasse')}" required></label>
        <label>PLZ und Ort<input type="text" name="plz_ort" value="${w('plz_ort')}" required></label>
        <label>Nachricht an uns (optional)<textarea name="nachricht" rows="4">${w('nachricht')}</textarea></label>
        <p class="muted klein">Mit dem Absenden stimmt ihr der Verarbeitung eurer Daten zur Abwicklung der Buchung zu (siehe <a href="/datenschutz">Datenschutz</a>).</p>
        <button class="btn-line" type="submit">${stripe ? 'Weiter zur Bezahlung' : 'Verbindlich buchen (Zahlung per Überweisung)'}</button>
      </form>
    </div></div></section>`;
}

router.get('/buchen/:id', (req, res) => {
  const termin = db.prepare('SELECT * FROM termine WHERE id = ? AND buchbar = 1').get(req.params.id);
  if (!termin) return res.redirect('/buchen');
  res.send(seitenGeruest({
    slug: 'buchen', titel: `Buchen: ${termin.titel} | Wertacher Mühle`, beschreibung: '',
    inhalt: buchungsFormular(termin), mitHero: false
  }));
});

router.post('/buchen/:id', express.urlencoded({ extended: false }), async (req, res) => {
  const termin = db.prepare('SELECT * FROM termine WHERE id = ? AND buchbar = 1').get(req.params.id);
  if (!termin) return res.redirect('/buchen');

  const erwachsene = Math.max(1, parseInt(req.body.erwachsene, 10) || 1);
  const kinder = Math.max(0, parseInt(req.body.kinder, 10) || 0);
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim();

  const zeige = fehler => res.send(seitenGeruest({
    slug: 'buchen', titel: `Buchen: ${termin.titel} | Wertacher Mühle`, beschreibung: '',
    inhalt: buchungsFormular(termin, fehler, req.body), mitHero: false
  }));

  if (!name || !email.includes('@')) return zeige('Bitte Name und eine gültige E-Mail-Adresse angeben.');
  if (erwachsene + kinder > freiePlaetze(termin)) return zeige('So viele Plätze sind leider nicht mehr frei.');

  const betrag = preisFuer(termin, erwachsene, kinder);
  const nummer = naechsteNummer('buchung');
  const info = db.prepare(
    `INSERT INTO buchungen (nummer, termin_id, status, name, email, telefon, strasse, plz_ort, erwachsene, kinder, nachricht, betrag, zahlart)
     VALUES (?, ?, 'angefragt', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(nummer, termin.id, name, email, String(req.body.telefon || ''), String(req.body.strasse || ''),
    String(req.body.plz_ort || ''), erwachsene, kinder, String(req.body.nachricht || ''), betrag,
    stripe ? 'karte' : 'ueberweisung');
  const buchungId = info.lastInsertRowid;

  if (stripe) {
    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [{
          price_data: {
            currency: 'eur',
            unit_amount: betrag,
            product_data: { name: `${termin.titel} (${datumSchoen(termin.beginn)} – ${datumSchoen(termin.ende)})` }
          },
          quantity: 1
        }],
        customer_email: email,
        client_reference_id: nummer,
        success_url: `${basisUrl(req)}/buchung/bezahlt?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${basisUrl(req)}/buchung/danke/${nummer}`
      });
      db.prepare('UPDATE buchungen SET stripe_session = ? WHERE id = ?').run(session.id, buchungId);
      return res.redirect(303, session.url);
    } catch (e) {
      console.error('[Stripe]', e.message);
      db.prepare("UPDATE buchungen SET zahlart = 'ueberweisung' WHERE id = ?").run(buchungId);
    }
  }

  await bestaetigungSenden(nummer);
  res.redirect(`/buchung/danke/${nummer}`);
});

async function bestaetigungSenden(nummer) {
  const b = db.prepare('SELECT * FROM buchungen WHERE nummer = ?').get(nummer);
  if (!b) return;
  const termin = b.termin_id ? db.prepare('SELECT * FROM termine WHERE id = ?').get(b.termin_id) : null;
  const zeitraum = termin
    ? `${datumSchoen(termin.beginn)} – ${datumSchoen(termin.ende)}`
    : `${datumSchoen(b.wunsch_beginn)} – ${datumSchoen(b.wunsch_ende)}`;
  const text = `Liebe/r ${b.name},

vielen Dank für eure Buchung in der Wertacher Mühle!

Buchungsnummer: ${b.nummer}
${termin ? 'Termin: ' + termin.titel : 'Wunschzeitraum'}: ${zeitraum}
Personen: ${b.erwachsene} Erwachsene, ${b.kinder} Kinder
${b.betrag > 0 ? 'Betrag: ' + euro(b.betrag) : ''}
${b.status === 'bezahlt' ? 'Die Zahlung ist bei uns eingegangen – ihr erhaltet die Rechnung in Kürze.' : 'Wir melden uns in Kürze mit allen Details.'}

Herzliche Grüße aus Wertach
${einstellung('verein_name')}
${einstellung('verein_telefon')} · ${einstellung('verein_email')}`;
  await sende({ an: b.email, betreff: `Eure Buchung ${b.nummer} – Wertacher Mühle`, text, buchungId: b.id });
}

// ---------------------------------------------------------------------------
// Stripe-Rückkehr und Webhook
// ---------------------------------------------------------------------------

router.get('/buchung/bezahlt', async (req, res) => {
  if (stripe && req.query.session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(String(req.query.session_id));
      if (session.payment_status === 'paid') {
        markiereBezahlt(session.id, session.client_reference_id);
      }
      return res.redirect(`/buchung/danke/${session.client_reference_id}`);
    } catch (e) {
      console.error('[Stripe]', e.message);
    }
  }
  res.redirect('/buchen');
});

function markiereBezahlt(sessionId, nummer) {
  const b = db.prepare('SELECT * FROM buchungen WHERE stripe_session = ? OR nummer = ?').get(sessionId, nummer || '');
  if (!b || b.status === 'bezahlt') return;
  db.prepare("UPDATE buchungen SET status = 'bezahlt' WHERE id = ?").run(b.id);
  const { rechnungFuerBuchung } = require('../buchungsHilfe');
  rechnungFuerBuchung(b.id, 'rechnung').catch(e => console.error('[Rechnung]', e.message));
  bestaetigungSenden(b.nummer).catch(() => {});
}

// Webhook (optional; die Rückkehr-Seite deckt den Normalfall bereits ab)
router.post('/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.sendStatus(200);
  try {
    const event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      markiereBezahlt(session.id, session.client_reference_id);
    }
    res.sendStatus(200);
  } catch (e) {
    res.status(400).send('Webhook-Fehler: ' + e.message);
  }
});

// ---------------------------------------------------------------------------
// Danke-Seite
// ---------------------------------------------------------------------------

router.get('/buchung/danke/:nummer', (req, res) => {
  const b = db.prepare('SELECT * FROM buchungen WHERE nummer = ?').get(req.params.nummer);
  if (!b) return res.redirect('/');
  const bezahlt = b.status === 'bezahlt';
  const inhalt = `
    <section class="page-head"><div class="container">
      <h1 data-rb-split>${bezahlt ? 'Danke – Zahlung eingegangen!' : 'Danke für eure Buchung!'}</h1>
      <p class="intro">Buchungsnummer ${esc(b.nummer)} · Eine Bestätigung ist per E-Mail unterwegs an ${esc(b.email)}.</p>
    </div></section>
    <section class="block"><div class="container"><div class="narrow">
      <p class="muted">${bezahlt
        ? 'Eure Zahlung ist bei uns eingegangen. Die Rechnung kommt per E-Mail – wir freuen uns auf euch!'
        : 'Wir haben eure ' + (b.termin_id ? 'Buchung' : 'Anfrage') + ' erhalten und melden uns so schnell wie möglich. Bei Fragen erreicht ihr uns unter 08365 / 1628.'}</p>
      <a class="btn-line" href="/">Zurück zur Startseite</a>
    </div></div></section>`;
  res.send(seitenGeruest({ slug: 'buchen', titel: 'Danke | Wertacher Mühle', beschreibung: '', inhalt, mitHero: false }));
});

// ---------------------------------------------------------------------------
// Gruppen-/Schulklassen-Anfrage (Wunschzeitraum, ohne Bezahlung)
// ---------------------------------------------------------------------------

router.get('/anfrage', (req, res) => {
  res.send(seitenGeruest({
    slug: 'buchen', titel: 'Gruppenanfrage | Wertacher Mühle',
    beschreibung: 'Wunschzeitraum für Gruppen und Schulklassen anfragen.',
    inhalt: anfrageFormular(), mitHero: false
  }));
});

function anfrageFormular(fehler = '', werte = {}) {
  const w = k => esc(werte[k] || '');
  return `
    <section class="page-head"><div class="container">
      <h1 data-rb-split>Gruppenanfrage</h1>
      <p class="intro">Für Gruppen, Schulklassen, Freizeiten und Seminare – unverbindlich anfragen, wir melden uns mit einem Angebot.</p>
    </div></section>
    <section class="block"><div class="container"><div class="narrow">
      ${fehler ? `<p class="formular-fehler">${esc(fehler)}</p>` : ''}
      <form method="post" action="/anfrage" class="formular">
        <div class="feld-reihe">
          <label>Anreise (Wunsch)<input type="date" name="wunsch_beginn" value="${w('wunsch_beginn')}" required></label>
          <label>Abreise (Wunsch)<input type="date" name="wunsch_ende" value="${w('wunsch_ende')}" required></label>
        </div>
        <div class="feld-reihe">
          <label>Erwachsene<input type="number" name="erwachsene" min="1" max="35" value="${w('erwachsene') || '2'}" required></label>
          <label>Kinder / Jugendliche<input type="number" name="kinder" min="0" max="35" value="${w('kinder') || '0'}" required></label>
        </div>
        <label>Name / Gruppe<input type="text" name="name" value="${w('name')}" required></label>
        <label>E-Mail<input type="email" name="email" value="${w('email')}" required></label>
        <label>Telefon<input type="tel" name="telefon" value="${w('telefon')}"></label>
        <label>Was habt ihr vor?<textarea name="nachricht" rows="5" placeholder="z. B. Klassenfahrt 7. Klasse, Chorwochenende, Familienfreizeit …">${w('nachricht')}</textarea></label>
        <p class="muted klein">Mit dem Absenden stimmt ihr der Verarbeitung eurer Daten zur Bearbeitung der Anfrage zu (siehe <a href="/datenschutz">Datenschutz</a>).</p>
        <button class="btn-line" type="submit">Anfrage senden</button>
      </form>
    </div></div></section>`;
}

router.post('/anfrage', express.urlencoded({ extended: false }), async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim();
  if (!name || !email.includes('@')) {
    return res.send(seitenGeruest({
      slug: 'buchen', titel: 'Gruppenanfrage | Wertacher Mühle', beschreibung: '',
      inhalt: anfrageFormular('Bitte Name und eine gültige E-Mail-Adresse angeben.', req.body), mitHero: false
    }));
  }
  const nummer = naechsteNummer('buchung');
  db.prepare(
    `INSERT INTO buchungen (nummer, status, name, email, telefon, erwachsene, kinder, wunsch_beginn, wunsch_ende, nachricht, zahlart)
     VALUES (?, 'angefragt', ?, ?, ?, ?, ?, ?, ?, ?, 'ueberweisung')`
  ).run(nummer, name, email, String(req.body.telefon || ''),
    Math.max(1, parseInt(req.body.erwachsene, 10) || 1), Math.max(0, parseInt(req.body.kinder, 10) || 0),
    String(req.body.wunsch_beginn || ''), String(req.body.wunsch_ende || ''), String(req.body.nachricht || ''));
  await bestaetigungSenden(nummer);
  res.redirect(`/buchung/danke/${nummer}`);
});

// ---------------------------------------------------------------------------
// Gerenderte Seiten (alte .html-Adressen leiten weiter)
// ---------------------------------------------------------------------------

router.get('/:slug.html', (req, res) => res.redirect(301, '/' + (req.params.slug === 'index' ? '' : req.params.slug)));

router.get('/', (req, res) => {
  const html = renderSeite('index');
  if (!html) return res.status(404).send('Seite nicht gefunden');
  res.send(html);
});

router.get('/:slug', (req, res, next) => {
  const html = renderSeite(req.params.slug);
  if (!html) return next();
  res.send(html);
});

module.exports = { router, bestaetigungSenden };
