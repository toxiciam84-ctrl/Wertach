// Gemeinsame Logik: Rechnung für eine Buchung zusammenstellen und versenden.
const { db, einstellung } = require('./db');
const { erstelleRechnung } = require('./rechnung');
const { sende } = require('./mail');

function euro(cent) {
  return (cent / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €';
}

function datumSchoen(iso) {
  if (!iso) return '';
  const [j, m, t] = String(iso).slice(0, 10).split('-');
  return `${t}.${m}.${j}`;
}

// Stellt die Rechnungspositionen zusammen: Unterkunft + alle Posten
// (Getränke, Extras). art: 'rechnung' (nur Unterkunft) oder 'endabrechnung'.
function positionenFuer(buchung, art) {
  const positionen = [];
  const termin = buchung.termin_id
    ? db.prepare('SELECT * FROM termine WHERE id = ?').get(buchung.termin_id)
    : null;

  if (buchung.betrag > 0) {
    const zeitraum = termin
      ? `${termin.titel} (${datumSchoen(termin.beginn)} – ${datumSchoen(termin.ende)})`
      : `Aufenthalt ${datumSchoen(buchung.wunsch_beginn)} – ${datumSchoen(buchung.wunsch_ende)}`;
    positionen.push({
      bezeichnung: `${zeitraum} – ${buchung.erwachsene} Erwachsene, ${buchung.kinder} Kinder`,
      menge: 1,
      einzelpreis: buchung.betrag
    });
  }

  if (art === 'endabrechnung') {
    const posten = db.prepare('SELECT * FROM posten WHERE buchung_id = ? ORDER BY id').all(buchung.id);
    for (const p of posten) {
      positionen.push({ bezeichnung: p.bezeichnung, menge: p.menge, einzelpreis: p.einzelpreis });
    }
    // Bereits bezahlte Unterkunft abziehen
    if (buchung.status === 'bezahlt' || buchung.zahlart === 'karte') {
      const bezahlt = db.prepare(
        "SELECT COALESCE(SUM(betrag), 0) AS s FROM rechnungen WHERE buchung_id = ? AND art = 'rechnung'"
      ).get(buchung.id).s;
      if (bezahlt > 0) {
        positionen.push({ bezeichnung: 'Bereits bezahlt', menge: 1, einzelpreis: -bezahlt });
      }
    }
  }
  return positionen;
}

// Erstellt die Rechnung als PDF und schickt sie per E-Mail an den Gast.
async function rechnungFuerBuchung(buchungId, art = 'rechnung') {
  const buchung = db.prepare('SELECT * FROM buchungen WHERE id = ?').get(buchungId);
  if (!buchung) throw new Error('Buchung nicht gefunden');
  const positionen = positionenFuer(buchung, art);
  if (positionen.length === 0) throw new Error('Keine Rechnungspositionen vorhanden');

  const rechnung = erstelleRechnung(buchung, positionen, art);

  const titel = art === 'endabrechnung' ? 'Endabrechnung' : 'Rechnung';
  const text = `Liebe/r ${buchung.name},

anbei erhaltet ihr die ${titel} ${rechnung.nummer} zu eurer Buchung ${buchung.nummer}
über ${euro(rechnung.summe)}.

${buchung.zahlart === 'karte' && art === 'rechnung'
    ? 'Der Betrag wurde bereits online bezahlt – vielen Dank!'
    : 'Die Bankverbindung findet ihr auf der Rechnung.'}

Herzliche Grüße aus Wertach
${einstellung('verein_name')}
${einstellung('verein_telefon')} · ${einstellung('verein_email')}`;

  await sende({
    an: buchung.email,
    betreff: `${titel} ${rechnung.nummer} – Wertacher Mühle`,
    text,
    anhangPfad: rechnung.pfad,
    buchungId: buchung.id
  });
  return rechnung;
}

module.exports = { rechnungFuerBuchung, positionenFuer, euro, datumSchoen };
