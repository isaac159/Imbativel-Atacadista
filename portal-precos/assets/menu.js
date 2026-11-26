// Menu lateral do portal + botões "blob".
//
// Cada página tem só <aside class="lateral" id="lateral"></aside>; o menu é montado aqui, a partir de PAGINAS,
// então para incluir uma página nova basta acrescentar uma linha. O script entra no <head> com "defer" e roda antes
// do script da página, que já encontra #quem e #sair prontos.
//
// Interações:
//   - botões "blob": as bolhas brancas entram pelo lado de onde o mouse veio e saem por onde ele foi embora
//     (filtro SVG #goo deixa o efeito gosmento). Página atual (aria-current) e aba ativa (aria-pressed) ficam cheias.
//   - recolher: o menu encolhe só para os ícones (fica lembrado no navegador).
//   - celular: o menu vira gaveta, aberta pelo botão da barra do topo.
(function () {
  const PAGINAS = [
    {
      href: '/painel',
      nome: 'Atualizar arquivos',
      icone: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>'
    },
    {
      href: '/resumo',
      nome: 'Resumo dos preços',
      icone: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'
    },
    {
      href: '/clientes',
      nome: 'Clientes dos vendedores',
      icone:
        '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>'
    },
    {
      href: '/manual',
      nome: 'Manual',
      icone: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'
    }
  ];
  const BOLHAS = 4;
  const CHAVE_RECOLHIDO = 'portal-menu-recolhido';
  const svg = (desenho, extra = '') =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${desenho}</svg>`;

  // ---------- botões blob ----------

  // filtro que gruda as bolhas umas nas outras
  function filtroGoo() {
    if (document.getElementById('goo')) return;
    const ns = 'http://www.w3.org/2000/svg';
    const el = document.createElementNS(ns, 'svg');
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('width', '0');
    el.setAttribute('height', '0');
    el.style.position = 'absolute';
    el.innerHTML =
      '<defs><filter id="goo"><feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="10"></feGaussianBlur>' +
      '<feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 21 -7" result="goo"></feColorMatrix>' +
      '<feBlend in2="goo" in="SourceGraphic" result="mix"></feBlend></filter></defs>';
    document.body.appendChild(el);
  }

  // de onde o ponteiro entrou/saiu: acima da metade do botão = cima
  const lado = (el, e) => {
    const r = el.getBoundingClientRect();
    return e.clientY < r.top + r.height / 2 ? '-150%' : '150%';
  };

  // Transforma um link ou botão em botão blob (pode ser chamado de novo para elementos criados depois)
  function blob(el) {
    if (el.classList.contains('blob-btn')) return el;
    el.classList.add('blob-btn');
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
    el.appendChild(interno);

    el.addEventListener('pointerenter', e => {
      if (e.pointerType === 'touch') return;
      // posiciona as bolhas do lado certo sem animar e só então enche
      el.classList.add('sem-transicao');
      el.style.setProperty('--blob-y', lado(el, e));
      void el.offsetWidth;
      el.classList.remove('sem-transicao');
      el.classList.add('cheio');
    });
    el.addEventListener('pointerleave', e => {
      el.style.setProperty('--blob-y', lado(el, e));
      el.classList.remove('cheio');
    });
    // clique: aperta o botão
    el.addEventListener('pointerdown', () => el.classList.add('apertado'));
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev =>
      el.addEventListener(ev, () => el.classList.remove('apertado'))
    );
    return el;
  }

  // ---------- menu lateral ----------

  function montarMenu(lateral) {
    const aqui = location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
    const links = PAGINAS.map(
      p =>
        `<a href="${p.href}" title="${p.nome}"${p.href === aqui ? ' aria-current="page"' : ''}>` +
        `<span class="lateral-icone">${svg(p.icone)}</span><span class="lateral-rotulo">${p.nome}</span></a>`
    ).join('');

    lateral.setAttribute('aria-label', 'Menu do portal');
    lateral.innerHTML = `
      <div class="lateral-topo">
        <a class="lateral-marcas" href="/painel" title="Início">
          <img class="logo-imb" src="assets/logo-imbativel.webp" alt="Imbatível Atacadista">
          <img class="logo-imb-quadrado" src="assets/logo-imbativel-quadrado.png" alt="">
        </a>
        <button class="lateral-recolher" type="button" aria-label="Recolher menu" title="Recolher menu">${svg('<path d="M15 6l-6 6 6 6"/>')}</button>
      </div>
      <div class="lateral-titulo">Páginas</div>
      <nav class="lateral-nav">${links}</nav>
      <div class="lateral-pe">
        <div class="lateral-usuario"><span class="lateral-avatar" id="avatar">·</span><span class="lateral-rotulo"><small>Conectado como</small><b id="quem"></b></span></div>
        <button class="lateral-sair" id="sair" type="button" title="Sair">${svg('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/>')}<span class="lateral-rotulo">Sair</span></button>
        <div class="lateral-matte"><span class="lateral-rotulo">Tecnologia</span><img src="assets/logo-matte.png" alt="Matte"></div>
      </div>`;

    // barra do celular (logo + botão que abre a gaveta) e o véu escuro atrás da gaveta
    const barra = document.createElement('header');
    barra.className = 'barra-movel';
    barra.innerHTML = `<button class="barra-movel-menu" type="button" aria-label="Abrir menu" aria-expanded="false">${svg('<path d="M4 7h16M4 12h16M4 17h16"/>')}</button>
      <img src="assets/logo-imbativel.webp" alt="Imbatível Atacadista">`;
    const veu = document.createElement('div');
    veu.className = 'lateral-veu';
    lateral.before(barra);
    lateral.after(veu);

    const corpo = document.body;
    const botaoMenu = barra.querySelector('.barra-movel-menu');
    const abrir = sim => {
      corpo.classList.toggle('menu-aberto', sim);
      botaoMenu.setAttribute('aria-expanded', String(sim));
    };
    botaoMenu.addEventListener('click', () => abrir(!corpo.classList.contains('menu-aberto')));
    veu.addEventListener('click', () => abrir(false));
    document.addEventListener('keydown', e => e.key === 'Escape' && abrir(false));

    // recolher só os ícones (desktop); o navegador lembra a escolha
    const recolher = lateral.querySelector('.lateral-recolher');
    const aplicarRecolhido = sim => {
      corpo.classList.toggle('menu-recolhido', sim);
      recolher.setAttribute('aria-label', sim ? 'Abrir menu' : 'Recolher menu');
      recolher.title = sim ? 'Abrir menu' : 'Recolher menu';
    };
    try {
      aplicarRecolhido(localStorage.getItem(CHAVE_RECOLHIDO) === '1');
    } catch (e) {
      aplicarRecolhido(false);
    }
    recolher.addEventListener('click', () => {
      const sim = !corpo.classList.contains('menu-recolhido');
      aplicarRecolhido(sim);
      try {
        localStorage.setItem(CHAVE_RECOLHIDO, sim ? '1' : '0');
      } catch (e) {
        /* navegador sem armazenamento: só não lembra */
      }
    });

    // inicial do usuário no círculo, assim que o script da página preencher #quem
    const quem = lateral.querySelector('#quem');
    new MutationObserver(() => {
      lateral.querySelector('#avatar').textContent = (quem.textContent.trim()[0] || '·').toUpperCase();
    }).observe(quem, { childList: true, characterData: true, subtree: true });

    lateral.querySelectorAll('.lateral-nav a').forEach(blob);
  }

  function iniciar() {
    filtroGoo();
    const lateral = document.getElementById('lateral');
    if (lateral) montarMenu(lateral);
    document.querySelectorAll('[data-blob]').forEach(blob);
  }

  window.portalBlob = blob;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
