// Wertacher Mühle – Buchungssystem, Dashboard und Website-Baukasten.
// Start:  npm install && npm start   (Konfiguration: .env, siehe .env.beispiel)
const fs = require('fs');
const path = require('path');

// .env einlesen (ohne Zusatzpaket)
const envPfad = path.join(__dirname, '.env');
if (fs.existsSync(envPfad)) {
  for (const zeile of fs.readFileSync(envPfad, 'utf8').split('\n')) {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(zeile);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

const express = require('express');
const cookieSession = require('cookie-session');
const { einstellung, setzeEinstellung, DATA_DIR } = require('./src/db');

const app = express();
app.disable('x-powered-by');

// Sitzungs-Schlüssel beim ersten Start erzeugen und behalten
let geheim = einstellung('session_geheim');
if (!geheim) {
  geheim = require('crypto').randomBytes(32).toString('hex');
  setzeEinstellung('session_geheim', geheim);
}
app.use(cookieSession({
  name: 'muehle',
  secret: geheim,
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 12 * 60 * 60 * 1000
}));

// Statische Dateien: Design-Assets aus dem Projektstamm, Uploads aus data/
const wurzel = path.join(__dirname, '..');
app.use('/css', express.static(path.join(wurzel, 'css')));
app.use('/js', express.static(path.join(wurzel, 'js')));
app.use('/images', express.static(path.join(wurzel, 'images')));
app.use('/fonts', express.static(path.join(wurzel, 'fonts')));
app.use('/uploads', express.static(path.join(DATA_DIR, 'uploads')));
app.use('/css/system.css', (req, res) => res.sendFile(path.join(__dirname, 'public', 'system.css')));
app.use('/css/verwaltung.css', (req, res) => res.sendFile(path.join(__dirname, 'public', 'verwaltung.css')));
app.get('/favicon.svg', (req, res) => res.sendFile(path.join(wurzel, 'favicon.svg')));

const adminRouter = require('./src/routes/admin').router;
const publicRouter = require('./src/routes/public').router;

app.use('/verwaltung', adminRouter);
app.use('/', publicRouter);

app.use((req, res) => res.status(404).send('Seite nicht gefunden – <a href="/">zur Startseite</a>'));

const port = parseInt(process.env.PORT || '3000', 10);
app.listen(port, () => {
  console.log(`Wertacher Mühle läuft auf http://localhost:${port}`);
  console.log(`Dashboard: http://localhost:${port}/verwaltung`);
});
