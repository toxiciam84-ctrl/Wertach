// Hängt die ReactBits-Komponenten (https://reactbits.dev) in die statischen
// Seiten ein. Ohne JavaScript – oder bei reduzierter Bewegung – bleibt die
// Seite unverändert und vollständig lesbar.
import { createRoot } from 'react-dom/client';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import SplitText from './reactbits/SplitText.jsx';
import CountUp from './reactbits/CountUp.jsx';
import FadeContent from './reactbits/FadeContent.jsx';

// Bereits verarbeitete Elemente werden markiert, damit mount() auch mehrfach
// (z. B. je Seitenwechsel in einer Vorschau) aufgerufen werden kann.
function mount(root = document) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Überschriften: SplitText (Wörter gleiten von unten ein)
  root.querySelectorAll('[data-rb-split]').forEach(el => {
    const text = el.textContent;
    const tag = el.tagName.toLowerCase();
    const className = el.className;
    const holder = document.createElement('div');
    el.replaceWith(holder);
    createRoot(holder).render(
      <SplitText
        text={text}
        tag={tag}
        className={className}
        splitType="words"
        delay={90}
        duration={0.9}
        ease="power3.out"
        from={{ opacity: 0, y: 36 }}
        to={{ opacity: 1, y: 0 }}
        threshold={0.1}
        rootMargin="0px"
        textAlign="left"
      />
    );
  });

  // Kennzahlen: CountUp (Zahlen zählen hoch, sobald sie sichtbar werden)
  root.querySelectorAll('[data-rb-count]').forEach(el => {
    if (el.dataset.rbDone) return;
    el.dataset.rbDone = '1';
    const to = parseFloat(el.dataset.rbCount);
    const suffix = el.dataset.rbSuffix || '';
    el.textContent = '';
    createRoot(el).render(
      <>
        <CountUp from={0} to={to} duration={1.4} />
        {suffix}
      </>
    );
  });

  // Bilder: FadeContent (weiches Einblenden mit Schärfeziehen)
  const figures = root.querySelectorAll('.two-col > figure, .photo-row > figure, figure.full-photo');
  figures.forEach((el, i) => {
    if (el.dataset.rbDone) return;
    el.dataset.rbDone = '1';
    const html = el.outerHTML;
    const holder = document.createElement('div');
    el.replaceWith(holder);
    createRoot(holder).render(
      <FadeContent
        blur
        duration={800}
        delay={(i % 5) * 90}
        threshold={0.12}
        initialOpacity={0}
      >
        <span dangerouslySetInnerHTML={{ __html: html }} />
      </FadeContent>
    );
  });

  ScrollTrigger.refresh();
}

window.__rbMount = mount;

function start() {
  mount(document);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
