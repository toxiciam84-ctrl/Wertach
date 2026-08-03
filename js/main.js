// Mobile-Navigation
const toggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.main-nav');
const header = document.querySelector('.site-header');

if (toggle && nav) {
  const setOpen = (open) => {
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (header) header.classList.toggle('nav-open', open);
  };

  toggle.addEventListener('click', () => {
    setOpen(!nav.classList.contains('open'));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('open')) {
      setOpen(false);
      toggle.focus();
    }
  });
}
