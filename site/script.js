const menuButton = document.querySelector('.menu-button');
const nav = document.querySelector('.topbar nav');
menuButton?.addEventListener('click', () => nav?.classList.toggle('nav-open'));
nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => nav.classList.remove('nav-open')));

document.querySelectorAll('[data-risk-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-risk-filter]').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    const level = button.dataset.riskFilter;
    document.querySelectorAll('[data-risk]').forEach((card) => {
      card.classList.toggle('hidden-risk', level !== 'all' && card.dataset.risk !== level);
    });
  });
});
