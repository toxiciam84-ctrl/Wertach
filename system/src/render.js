// Rendert die öffentliche Website aus den Baukasten-Blöcken – im selben
// Design wie die bisherige statische Seite (css/style.css bleibt die Basis).
const { db } = require('./db');

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function absaetze(text, klasse = 'muted') {
  return String(text || '')
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map(a => `<p class="${klasse}">${esc(a).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

function euro(cent) {
  return (cent / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €';
}

function datumSchoen(iso) {
  if (!iso) return '';
  const [j, m, t] = iso.split('-');
  return `${t}.${m}.${j}`;
}

function figur(daten, extraKlasse = '') {
  if (!daten.bild) return '';
  const cls = daten.bild_oben ? ' class="crop-top"' : '';
  return `<figure${extraKlasse ? ` class="${extraKlasse}"` : ''}>
    <span><img${cls} src="${esc(daten.bild)}" alt="${esc(daten.bild_alt || '')}" loading="lazy"></span>
    ${daten.bild_unterschrift ? `<figcaption>${esc(daten.bild_unterschrift)}</figcaption>` : ''}
  </figure>`;
}

// ---------------------------------------------------------------------------
// Block-Renderer
// ---------------------------------------------------------------------------

const BLOECKE = {
  hero(d) {
    return `<section class="hero-full">
      <img class="bg" src="${esc(d.bild)}" alt="${esc(d.alt || '')}">
      <div class="container"><h1 data-rb-split>${esc(d.ueberschrift)}</h1></div>
    </section>`;
  },

  seitenkopf(d) {
    return `<section class="page-head"><div class="container">
      <h1 data-rb-split>${esc(d.ueberschrift)}</h1>
      ${d.text ? `<p class="intro">${esc(d.text)}</p>` : ''}
    </div></section>`;
  },

  intro(d) {
    return `<section class="block"><div class="container two-col">
      <div>
        <p class="lead">${esc(d.lead)}</p>
        ${d.text ? `<p style="margin-top: 1.4em;" class="muted">${esc(d.text)}</p>` : ''}
        ${d.knopf_text ? `<a class="btn-line" href="${esc(d.knopf_ziel || '#')}">${esc(d.knopf_text)}</a>` : ''}
      </div>
      ${figur(d)}
    </div></section>`;
  },

  stats(d) {
    const werte = (d.werte || []).map(w => {
      const zahl = /^\d+$/.test(String(w.zahl).trim())
        ? `<span data-rb-count="${esc(w.zahl)}"${w.einheit ? ` data-rb-suffix="${esc(w.einheit)}"` : ''}>${esc(w.zahl)}${esc(w.einheit || '')}</span>`
        : esc(String(w.zahl) + (w.einheit || ''));
      return `<div class="stat"><div class="num">${zahl}</div><div class="desc">${esc(w.text)}</div></div>`;
    }).join('\n');
    return `<section class="band-dark stats-band block"><div class="container"><div class="grid">${werte}</div></div></section>`;
  },

  ueberschrift_text(d) {
    return `<section class="block"><div class="container">
      <div class="two-col"><h2>${esc(d.ueberschrift)}</h2><p class="muted">${esc(d.text)}</p></div>
    </div></section>`;
  },

  fotoreihe(d) {
    const fotos = (d.fotos || []).map(f => `<figure>
      <span><img src="${esc(f.bild)}" alt="${esc(f.alt || '')}" loading="lazy"></span>
      ${f.unterschrift ? `<figcaption>${esc(f.unterschrift)}</figcaption>` : ''}
    </figure>`).join('\n');
    return `<section class="block"><div class="container">
      ${d.ueberschrift ? `<div class="narrow" style="margin-bottom: 2rem;"><h2>${esc(d.ueberschrift)}</h2></div>` : ''}
      <div class="photo-row">${fotos}</div>
    </div></section>`;
  },

  zitat(d) {
    return `<section class="quote-band"><div class="container">
      <span class="mark"></span><blockquote>${esc(d.text)}</blockquote>
    </div></section>`;
  },

  text_bild(d) {
    const liste = (d.liste || []).map(zeile => {
      const teile = String(zeile).split('|');
      if (teile.length >= 2) {
        return `<li><a href="${esc(teile[1])}">${esc(teile[0])}</a>${esc(teile[2] || '')}</li>`;
      }
      return `<li>${esc(zeile)}</li>`;
    }).join('\n');
    const textSpalte = `<div>
      <h2>${esc(d.ueberschrift)}</h2>
      ${absaetze(d.text)}
      ${liste ? `<ul class="plain-list">${liste}</ul>` : ''}
      ${d.knopf_text ? `<a class="btn-line" href="${esc(d.knopf_ziel || '#')}">${esc(d.knopf_text)}</a>` : ''}
    </div>`;
    const bild = figur(d);
    const inhalt = d.bild_links ? bild + textSpalte : textSpalte + bild;
    return `<section class="block"><div class="container two-col${d.bild_links ? ' flip' : ''}">${inhalt}</div></section>`;
  },

  chronik(d) {
    const zeilen = (d.eintraege || []).map(e => {
      const [jahr, ...rest] = String(e).split('|');
      return `<div class="chronik-row"><span class="jahr">${esc(jahr)}</span><p>${esc(rest.join('|'))}</p></div>`;
    }).join('\n');
    return `<section class="band-tint block"><div class="container two-col">
      <div><h2>${esc(d.ueberschrift)}</h2><div class="chronik">${zeilen}</div></div>
      ${figur(d)}
    </div></section>`;
  },

  grossfoto(d) {
    return `<section class="block"><div class="container">
      <figure class="full-photo">
        <img src="${esc(d.bild)}" alt="${esc(d.alt || '')}" loading="lazy">
        ${d.unterschrift ? `<figcaption>${esc(d.unterschrift)}</figcaption>` : ''}
      </figure>
    </div></section>`;
  },

  freitext(d) {
    return `<section class="block"><div class="container"><div class="narrow">
      ${d.ueberschrift ? `<h2 style="margin-bottom: 1rem;">${esc(d.ueberschrift)}</h2>` : ''}
      ${absaetze(d.text)}
    </div></div></section>`;
  },

  cta(d) {
    return `<section class="cta-solid">
      <div class="container">
        <h2>${esc(d.ueberschrift)}</h2>
        ${d.text ? `<p>${esc(d.text)}</p>` : ''}
        ${d.knopf_text ? `<a class="btn-line" href="${esc(d.knopf_ziel || '/buchen')}">${esc(d.knopf_text)}</a>` : ''}
      </div>
    </section>`;
  },

  kontakt(d) {
    return `<section class="block"><div class="container two-col">
      <div>
        <h2>${esc(d.ueberschrift || 'So erreicht ihr uns')}</h2>
        <ul class="kontakt-liste">
          <li><span class="art">Anschrift</span><span>Wertacher Mühle, Sonnenhof e.V.<br>Vorderschneid 7<br>87497 Wertach (im Allgäu)</span></li>
          <li><span class="art">Telefon</span><span><a href="tel:+4983651628">08365 / 1628</a><br><span class="muted">Am besten vormittags oder abends – tagsüber sind wir viel im Haus und Garten unterwegs.</span></span></li>
          <li><span class="art">E-Mail</span><span><a href="mailto:Wertachermuehle@web.de">Wertachermuehle@web.de</a><br><span class="muted">Schreibt uns, wer ihr seid und wann ihr kommen möchtet.</span></span></li>
          <li><span class="art">Mühlesocial</span><span><a href="https://www.instagram.com/wertacher_muehle" target="_blank" rel="noopener">Instagram @wertacher_muehle</a><br><a href="https://www.facebook.com/wertachermuehle" target="_blank" rel="noopener">Facebook</a></span></li>
        </ul>
      </div>
      ${figur(d)}
    </div></section>`;
  },

  termine(d) {
    const filter = d.typ ? 'AND typ = ?' : '';
    const zeilen = db.prepare(
      `SELECT * FROM termine WHERE buchbar = 1 AND ende >= date('now') ${filter} ORDER BY beginn`
    ).all(...(d.typ ? [d.typ] : []));
    const karten = zeilen.map(t => {
      const belegt = db.prepare(
        "SELECT COALESCE(SUM(erwachsene + kinder), 0) AS n FROM buchungen WHERE termin_id = ? AND status IN ('angefragt','bestaetigt','bezahlt')"
      ).get(t.id).n;
      const frei = Math.max(0, t.plaetze - belegt);
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
    return `<section class="band-tint block"><div class="container">
      <h2 style="margin-bottom: 0.6rem;">${esc(d.ueberschrift || 'Termine')}</h2>
      ${d.text ? `<p class="muted" style="max-width: 640px;">${esc(d.text)}</p>` : ''}
      <div class="termin-liste">${karten || '<p class="muted" style="margin-top: 1.5rem;">Zurzeit sind keine Termine online buchbar – meldet euch gerne direkt bei uns.</p>'}</div>
    </div></section>`;
  }
};

const BLOCK_TYPEN = Object.keys(BLOECKE);

// ---------------------------------------------------------------------------
// Seitengerüst
// ---------------------------------------------------------------------------

function navigation(aktiverSlug) {
  const seiten = db.prepare(
    'SELECT slug, nav_titel FROM seiten WHERE in_navigation = 1 AND sichtbar = 1 ORDER BY sortierung'
  ).all();
  const punkte = seiten.map(s => {
    const ziel = s.slug === 'index' ? '/' : '/' + s.slug;
    const aktiv = s.slug === aktiverSlug ? ' class="active"' : '';
    return `<li><a href="${ziel}"${aktiv}>${esc(s.nav_titel)}</a></li>`;
  });
  punkte.push(`<li><a href="/buchen"${aktiverSlug === 'buchen' ? ' class="active"' : ''}>Buchen</a></li>`);
  return punkte.join('\n');
}

function seitenGeruest({ slug, titel, beschreibung, inhalt, mitHero }) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(titel)}</title>
  ${beschreibung ? `<meta name="description" content="${esc(beschreibung)}">` : ''}
  <meta name="theme-color" content="#1f3126">
  <link rel="stylesheet" href="/css/style.css">
  <link rel="stylesheet" href="/css/system.css">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
</head>
<body>

  <header class="site-header${mitHero ? ' on-hero' : ''}">
    <div class="container nav-bar">
      <a class="brand" href="/"><span class="brand-name">Wertacher Mühle</span></a>
      <button class="nav-toggle" aria-controls="hauptnavigation" aria-expanded="false">Menü</button>
      <nav id="hauptnavigation" class="main-nav" aria-label="Hauptnavigation">
        <ul>${navigation(slug)}</ul>
      </nav>
    </div>
  </header>

  <main>
${inhalt}
  </main>

  <footer class="site-footer">
    <div class="container">
      <p class="footer-mark">Wertacher Mühle</p>
      <div class="footer-grid">
        <div>
          <h4>Anschrift</h4>
          <p>Wertacher Mühle, Sonnenhof e.V.<br>Vorderschneid 7<br>87497 Wertach (im Allgäu)<br>
          <a href="tel:+4983651628">08365 / 1628</a><br>
          <a href="mailto:Wertachermuehle@web.de">Wertachermuehle@web.de</a></p>
        </div>
        <div>
          <h4>Seiten</h4>
          <ul>${navigation('')}</ul>
        </div>
        <div>
          <h4>Mühlesocial</h4>
          <ul>
            <li><a href="https://www.instagram.com/wertacher_muehle" target="_blank" rel="noopener">Instagram</a></li>
            <li><a href="https://www.facebook.com/wertachermuehle" target="_blank" rel="noopener">Facebook</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-note">
        <span>© ${new Date().getFullYear()} Wertacher Mühle, Sonnenhof e.V.</span>
        <span><a href="/impressum">Impressum</a> · <a href="/datenschutz">Datenschutz</a></span>
      </div>
    </div>
  </footer>

  <script src="/js/main.js"></script>
  <script src="/js/reactbits-animationen.js" defer></script>
</body>
</html>`;
}

function renderSeite(slug) {
  const seite = db.prepare('SELECT * FROM seiten WHERE slug = ? AND sichtbar = 1').get(slug);
  if (!seite) return null;
  const bloecke = db.prepare('SELECT * FROM bloecke WHERE seite_id = ? ORDER BY position').all(seite.id);
  const inhalt = bloecke.map(b => {
    const renderer = BLOECKE[b.typ];
    if (!renderer) return '';
    try {
      return renderer(JSON.parse(b.daten));
    } catch (e) {
      return `<!-- Block ${b.id} (${b.typ}) fehlerhaft: ${esc(e.message)} -->`;
    }
  }).join('\n');
  const mitHero = bloecke.length > 0 && bloecke[0].typ === 'hero';
  return seitenGeruest({
    slug, titel: seite.titel, beschreibung: seite.beschreibung, inhalt, mitHero
  });
}

module.exports = { renderSeite, seitenGeruest, BLOECKE, BLOCK_TYPEN, esc, euro, datumSchoen, absaetze };
