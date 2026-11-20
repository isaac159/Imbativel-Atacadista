// Menu do topo com botões "blob": as bolhas brancas sobem e enchem o botão, com efeito gosmento (filtro SVG #goo).
// O JS monta as bolhas dentro de cada link e faz elas entrarem pelo lado de onde o mouse veio (cima ou baixo)
// e saírem pelo lado por onde ele foi embora. A página atual (aria-current) fica sempre cheia.
(function () {
  const BOLHAS = 4;

  // filtro que gruda as bolhas umas nas outras
  if (!document.getElementById('goo')) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    svg.innerHTML = '<defs><filter id="goo"><feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="10"></feGaussianBlur>'
      + '<feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 21 -7" result="goo"></feColorMatrix>'
      + '<feBlend in2="goo" in="SourceGraphic" result="mix"></feBlend></filter></defs>';
    document.body.appendChild(svg);
  }

  // de onde o ponteiro entrou/saiu: acima da metade do botão = cima
  const lado = (el, e) => {
    const r = el.getBoundingClientRect();
    return e.clientY < r.top + r.height / 2 ? '-150%' : '150%';
  };

  document.querySelectorAll('.topo nav a, .abas-pagina a').forEach(link => {
    link.classList.add('blob-btn');
    const interno = document.createElement('span');
    interno.className = 'blob-btn__inner';
    interno.setAttribute('aria-hidden', 'true');
    const grupo = document.createElement('span');
    grupo.className = 'blob-btn__blobs';
    for (let i = 0; i < BOLHAS; i++) {
      const b = document.createElement('span');
      b.className = 'blob-btn__blob';
      grupo.appendChild(b);
    }
    interno.appendChild(grupo);
    link.appendChild(interno);

    if (link.getAttribute('aria-current') === 'page') return;

    link.addEventListener('pointerenter', e => {
      if (e.pointerType === 'touch') return;
      // posiciona as bolhas do lado certo sem animar e só então enche
      link.classList.add('sem-transicao');
      link.style.setProperty('--blob-y', lado(link, e));
      void link.offsetWidth;
      link.classList.remove('sem-transicao');
      link.classList.add('cheio');
    });
    link.addEventListener('pointerleave', e => {
      link.style.setProperty('--blob-y', lado(link, e));
      link.classList.remove('cheio');
    });
    // clique: aperta o botão antes de trocar de página
    link.addEventListener('pointerdown', () => link.classList.add('apertado'));
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => link.addEventListener(ev, () => link.classList.remove('apertado')));
  });
})();
