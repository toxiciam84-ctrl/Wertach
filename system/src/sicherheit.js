// Schutzfunktionen: CSRF-Schutz fürs Dashboard, Anmelde-/Formularbremse
// und Spam-Falle für die öffentlichen Formulare.
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// CSRF-Schutz
//
// Jede Sitzung bekommt ein Geheimwort. Alle POST-Formulare im Dashboard
// müssen es mitsenden – sonst wird die Anfrage abgelehnt. Das verhindert,
// dass eine fremde Seite im eingeloggten Browser Aktionen auslöst.
// Das versteckte Feld wird automatisch in jedes Formular eingefügt.
// ---------------------------------------------------------------------------

function gleich(a, b) {
  const pa = Buffer.from(String(a));
  const pb = Buffer.from(String(b));
  return pa.length === pb.length && crypto.timingSafeEqual(pa, pb);
}

function csrfSchutz(req, res, next) {
  if (!req.session.csrf) {
    req.session.csrf = crypto.randomBytes(24).toString('hex');
  }
  const token = req.session.csrf;

  if (req.method === 'POST') {
    if (!req.body || !req.body._csrf || !gleich(req.body._csrf, token)) {
      return res.status(403).send(
        '<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">' +
        '<title>Abgelehnt</title><link rel="stylesheet" href="/css/verwaltung.css"></head>' +
        '<body><main><h1>Anfrage abgelehnt</h1>' +
        '<p>Das Sicherheitsmerkmal des Formulars fehlt oder ist abgelaufen. ' +
        'Das passiert, wenn die Seite lange offen lag.</p>' +
        '<p><a href="/verwaltung">Zurück zum Dashboard</a> – dort bitte neu laden und den Vorgang wiederholen.</p>' +
        '</main></body></html>'
      );
    }
  }

  // Versteckten Token in jedes POST-Formular der Antwort einsetzen
  const original = res.send.bind(res);
  res.send = (koerper) => {
    if (typeof koerper === 'string' && koerper.includes('<form')) {
      koerper = koerper.replace(
        /<form\b[^>]*\bmethod\s*=\s*["']?post["']?[^>]*>/gi,
        treffer => `${treffer}<input type="hidden" name="_csrf" value="${token}">`
      );
    }
    return original(koerper);
  };
  next();
}

// ---------------------------------------------------------------------------
// Bremse gegen zu viele Versuche (Passwort raten, Formular-Spam)
// ---------------------------------------------------------------------------

const speicher = new Map();

function aufraeumen(jetzt) {
  for (const [schluessel, zeiten] of speicher) {
    const frisch = zeiten.filter(z => z > jetzt - 60 * 60 * 1000);
    if (frisch.length) speicher.set(schluessel, frisch);
    else speicher.delete(schluessel);
  }
}

// versuche: erlaubte Anzahl, fensterMinuten: Zeitraum, name: eigener Zähler
function bremse({ versuche = 5, fensterMinuten = 10, name = 'standard', hinweis }) {
  return (req, res, next) => {
    const jetzt = Date.now();
    if (speicher.size > 5000) aufraeumen(jetzt);

    const schluessel = `${name}:${req.ip}`;
    const fenster = fensterMinuten * 60 * 1000;
    const zeiten = (speicher.get(schluessel) || []).filter(z => z > jetzt - fenster);

    if (zeiten.length >= versuche) {
      const wartenMin = Math.ceil((zeiten[0] + fenster - jetzt) / 60000);
      return res.status(429).send(
        '<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">' +
        '<title>Zu viele Versuche</title><link rel="stylesheet" href="/css/verwaltung.css"></head>' +
        '<body><main><h1>Zu viele Versuche</h1>' +
        `<p>${hinweis || 'Bitte versucht es in einigen Minuten noch einmal.'} ` +
        `(Wieder möglich in etwa ${wartenMin} Minute${wartenMin === 1 ? '' : 'n'}.)</p>` +
        '<p><a href="/">Zur Startseite</a></p></main></body></html>'
      );
    }

    zeiten.push(jetzt);
    speicher.set(schluessel, zeiten);
    next();
  };
}

// Zähler zurücksetzen (z. B. nach erfolgreicher Anmeldung)
function bremseZuruecksetzen(name, req) {
  speicher.delete(`${name}:${req.ip}`);
}

// ---------------------------------------------------------------------------
// Spam-Falle für öffentliche Formulare
//
// Ein für Menschen unsichtbares Feld: Bots füllen es aus, echte Gäste nicht.
// ---------------------------------------------------------------------------

const SPAM_FELD = 'webseite';

function spamFalle() {
  return `<div class="spamfalle" aria-hidden="true">
    <label>Dieses Feld bitte frei lassen
      <input type="text" name="${SPAM_FELD}" tabindex="-1" autocomplete="off">
    </label>
  </div>`;
}

function istSpam(req) {
  return !!(req.body && String(req.body[SPAM_FELD] || '').trim());
}

module.exports = { csrfSchutz, bremse, bremseZuruecksetzen, spamFalle, istSpam };
