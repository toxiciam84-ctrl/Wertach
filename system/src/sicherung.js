// Automatische Sicherung der Datenbank (Buchungen, Rechnungen, Inhalte).
// Legt Kopien unter data/sicherungen/ ab und behält die letzten 14.
const path = require('path');
const fs = require('fs');
const { db, DATA_DIR } = require('./db');

const ORDNER = path.join(DATA_DIR, 'sicherungen');
const BEHALTEN = 14;

fs.mkdirSync(ORDNER, { recursive: true });

function zeitstempel() {
  const d = new Date();
  const z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}_${z(d.getHours())}-${z(d.getMinutes())}`;
}

async function sicherungAnlegen() {
  const ziel = path.join(ORDNER, `muehle-${zeitstempel()}.db`);
  await db.backup(ziel);
  alteAufraeumen();
  return ziel;
}

function alteAufraeumen() {
  const dateien = fs.readdirSync(ORDNER)
    .filter(n => n.startsWith('muehle-') && n.endsWith('.db'))
    .sort();
  for (const alt of dateien.slice(0, Math.max(0, dateien.length - BEHALTEN))) {
    try {
      fs.unlinkSync(path.join(ORDNER, alt));
    } catch (e) {
      console.error('[Sicherung] Konnte alte Sicherung nicht löschen:', e.message);
    }
  }
}

// Beim Start einmal sichern, danach täglich.
function sicherungenStarten(intervallStunden = 24) {
  const lauf = () => sicherungAnlegen()
    .then(ziel => console.log('[Sicherung] angelegt:', path.basename(ziel)))
    .catch(e => console.error('[Sicherung] fehlgeschlagen:', e.message));

  lauf();
  const uhr = setInterval(lauf, intervallStunden * 60 * 60 * 1000);
  uhr.unref();
  return uhr;
}

function sicherungenAuflisten() {
  return fs.readdirSync(ORDNER)
    .filter(n => n.startsWith('muehle-') && n.endsWith('.db'))
    .sort()
    .reverse()
    .map(name => {
      const s = fs.statSync(path.join(ORDNER, name));
      return { name, groesse: s.size, zeit: s.mtime.toISOString().slice(0, 16).replace('T', ' ') };
    });
}

module.exports = { sicherungAnlegen, sicherungenStarten, sicherungenAuflisten, ORDNER };
