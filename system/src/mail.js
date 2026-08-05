// E-Mail-Versand über SMTP (nodemailer). Ohne SMTP-Konfiguration landen
// E-Mails im Postausgang des Dashboards und werden dort angezeigt.
const nodemailer = require('nodemailer');
const { db } = require('./db');

function transporter() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_PORT === '465',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined
  });
}

async function sende({ an, betreff, text, anhangPfad = '', buchungId = null }) {
  const eintrag = db.prepare(
    'INSERT INTO emails (buchung_id, an, betreff, text, anhang, status) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(buchungId, an, betreff, text, anhangPfad, 'ausgang');

  const smtp = transporter();
  if (!smtp) {
    return { gesendet: false, hinweis: 'Kein SMTP konfiguriert – E-Mail liegt im Postausgang.' };
  }
  try {
    await smtp.sendMail({
      from: process.env.SMTP_ABSENDER || process.env.SMTP_USER,
      to: an,
      subject: betreff,
      text,
      attachments: anhangPfad ? [{ path: anhangPfad }] : []
    });
    db.prepare("UPDATE emails SET status = 'gesendet' WHERE id = ?").run(eintrag.lastInsertRowid);
    return { gesendet: true };
  } catch (e) {
    db.prepare("UPDATE emails SET status = 'fehler: ' || ? WHERE id = ?").run(e.message, eintrag.lastInsertRowid);
    return { gesendet: false, hinweis: 'Versand fehlgeschlagen: ' + e.message };
  }
}

module.exports = { sende };
