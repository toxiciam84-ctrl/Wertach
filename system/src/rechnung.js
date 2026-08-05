// Erstellt Rechnungs-PDFs (pdfkit) mit fortlaufender Nummer.
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { db, einstellung, naechsteNummer, DATA_DIR } = require('./db');

function euro(cent) {
  return (cent / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' EUR';
}

function datumSchoen(iso) {
  if (!iso) return '';
  const [j, m, t] = String(iso).slice(0, 10).split('-');
  return `${t}.${m}.${j}`;
}

// Erzeugt die Rechnung für eine Buchung. positionen: [{bezeichnung, menge, einzelpreis}]
function erstelleRechnung(buchung, positionen, art = 'rechnung') {
  const nummer = naechsteNummer('rechnung');
  const dateiname = nummer + '.pdf';
  const pfad = path.join(DATA_DIR, 'rechnungen', dateiname);
  const summe = positionen.reduce((s, p) => s + p.menge * p.einzelpreis, 0);

  const doc = new PDFDocument({ size: 'A4', margin: 56 });
  doc.pipe(fs.createWriteStream(pfad));

  // Kopf
  doc.font('Helvetica-Bold').fontSize(16).text(einstellung('verein_name'));
  doc.font('Helvetica').fontSize(9).fillColor('#555')
    .text(`${einstellung('verein_strasse')} · ${einstellung('verein_ort')} · Tel. ${einstellung('verein_telefon')} · ${einstellung('verein_email')}`);
  doc.moveDown(2);

  // Empfänger
  doc.fillColor('#000').fontSize(11);
  doc.text(buchung.name);
  if (buchung.strasse) doc.text(buchung.strasse);
  if (buchung.plz_ort) doc.text(buchung.plz_ort);
  doc.moveDown(2);

  // Titel + Metadaten
  const titel = art === 'endabrechnung' ? 'Endabrechnung' : 'Rechnung';
  doc.font('Helvetica-Bold').fontSize(15).text(`${titel} ${nummer}`);
  doc.font('Helvetica').fontSize(10).fillColor('#555')
    .text(`Datum: ${datumSchoen(new Date().toISOString())} · Buchung: ${buchung.nummer}`);
  doc.moveDown(1.5);

  // Tabelle
  const links = doc.page.margins.left;
  const breit = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const spalten = { bez: links, menge: links + breit - 190, einzel: links + breit - 130, gesamt: links + breit - 60 };

  doc.fillColor('#000').font('Helvetica-Bold').fontSize(10);
  doc.text('Leistung', spalten.bez, doc.y, { width: breit - 200 });
  doc.moveUp();
  doc.text('Menge', spalten.menge, doc.y, { width: 50, align: 'right' });
  doc.moveUp();
  doc.text('Einzeln', spalten.einzel, doc.y, { width: 60, align: 'right' });
  doc.moveUp();
  doc.text('Gesamt', spalten.gesamt, doc.y, { width: 60, align: 'right' });
  doc.moveDown(0.4);
  doc.moveTo(links, doc.y).lineTo(links + breit, doc.y).strokeColor('#999').stroke();
  doc.moveDown(0.4);

  doc.font('Helvetica').fontSize(10);
  for (const p of positionen) {
    const y = doc.y;
    doc.text(p.bezeichnung, spalten.bez, y, { width: breit - 200 });
    const zeilenEnde = doc.y;
    doc.text(String(p.menge), spalten.menge, y, { width: 50, align: 'right' });
    doc.text(euro(p.einzelpreis), spalten.einzel, y, { width: 60, align: 'right' });
    doc.text(euro(p.menge * p.einzelpreis), spalten.gesamt, y, { width: 60, align: 'right' });
    doc.y = Math.max(doc.y, zeilenEnde);
    doc.moveDown(0.3);
  }

  doc.moveDown(0.2);
  doc.moveTo(links, doc.y).lineTo(links + breit, doc.y).strokeColor('#999').stroke();
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(11);
  doc.text('Gesamtbetrag', spalten.bez, doc.y, { width: breit - 200 });
  doc.moveUp();
  doc.text(euro(summe), spalten.gesamt, doc.y, { width: 60, align: 'right' });
  doc.moveDown(2);

  // Zahlungshinweis – Cursor zurück an den linken Rand, volle Breite
  doc.x = links;
  doc.font('Helvetica').fontSize(10).fillColor('#000');
  if (buchung.zahlart === 'karte' && art !== 'endabrechnung') {
    doc.text('Der Betrag wurde bereits online bezahlt. Vielen Dank!', links, doc.y, { width: breit });
  } else {
    const ziel = einstellung('zahlungsziel_tage', '14');
    doc.text(`Bitte überweist den Betrag innerhalb von ${ziel} Tagen auf folgendes Konto:`, links, doc.y, { width: breit });
    doc.moveDown(0.5);
    doc.text(`${einstellung('bank_inhaber')}`, links, doc.y, { width: breit });
    doc.text(`IBAN: ${einstellung('bank_iban')}`, links, doc.y, { width: breit });
    doc.text(`Bank: ${einstellung('bank_name')}`, links, doc.y, { width: breit });
    doc.text(`Verwendungszweck: ${nummer}`, links, doc.y, { width: breit });
  }
  doc.moveDown(1);
  doc.fontSize(9).fillColor('#555').text(einstellung('rechnung_hinweis'), links, doc.y, { width: breit });

  doc.end();

  db.prepare(
    'INSERT INTO rechnungen (nummer, buchung_id, art, betrag, pfad) VALUES (?, ?, ?, ?, ?)'
  ).run(nummer, buchung.id, art, summe, pfad);

  return { nummer, pfad, summe };
}

module.exports = { erstelleRechnung };
