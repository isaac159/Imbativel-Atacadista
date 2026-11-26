// Tela de carregamento da Matte, entre as páginas do portal e no login.
//
// Animação (modelo matte-loader.js): o "m" e o "tte" entram na seta rosa, a seta dá um impulso ↗ e as letras voltam.
// Na saída, as letras entram de vez na seta, ela sai voando e a tela some.
//
// Trocar de página recarrega tudo, então a animação continua de onde parou: quem abre a tela grava em sessionStorage
// a hora em que ela abriu, e a página nova (este script entra no <head> sem "defer", depois do estilo.css) já abre a
// tela no mesmo ponto da animação, antes de desenhar qualquer coisa. Quando os dados chegam, a página chama pronto().
//
// Uso:
//   portalCarregando.ir('/resumo', { texto: 'Abrindo o resumo…' })                → abre a tela e troca de página
//   portalCarregando.ir('/', { texto: 'Saindo…', antes: () => fetch(…), substituir: true })
//   portalCarregando.pronto()                                                      → página carregou: saída animada
// Os estilos ficam em estilo.css ("Tela de carregamento").
(function () {
  // Logo vetorizada (viewBox da arte original 480x480)
  const PATH_M =
    'M59.05 284.70C58.82 284.47 58.75 277.12 58.75 252.14C58.76 234.39 58.85 219.73 58.96 219.56C59.11 219.31 60.82 219.24 66.37 219.23C70.33 219.22 73.66 219.31 73.78 219.43C73.89 219.54 74.02 221.37 74.06 223.49C74.11 226.28 74.21 227.36 74.44 227.44C74.61 227.49 74.87 227.22 75.02 226.83C75.36 225.91 79.68 221.68 81.03 220.95C81.60 220.63 82.42 220.19 82.85 219.95C86.34 218.07 95.15 216.69 98.62 217.49C99.17 217.62 100.53 217.83 101.63 217.97C102.74 218.11 103.97 218.40 104.38 218.61C104.79 218.82 105.29 219.00 105.50 219.00C105.71 219.00 106.24 219.23 106.69 219.50C107.14 219.78 107.62 220.00 107.76 220.00C108.16 220.00 111.30 222.26 112.31 223.27C113.54 224.50 114.90 226.30 115.11 226.97C115.40 227.87 116.10 227.57 117.52 225.94C121.07 221.85 123.65 220.21 129.12 218.55C133.00 217.38 138.95 216.92 142.62 217.50C143.45 217.63 144.81 217.84 145.65 217.97C148.71 218.44 154.04 220.50 155.20 221.67C155.39 221.85 155.63 222.00 155.75 222.00C156.13 222.00 158.80 224.58 159.74 225.87C162.06 229.04 163.37 232.51 164.54 238.62C165.12 241.61 165.12 241.72 165.12 263.25L165.12 284.88L157.62 284.88L150.12 284.88L149.99 264.50C149.87 246.26 149.81 243.98 149.43 242.75C149.20 241.99 149.00 241.14 149.00 240.84C149.00 239.99 147.83 237.59 146.69 236.08C145.80 234.90 145.10 234.29 143.40 233.20C141.41 231.93 137.57 231.38 133.53 231.78C132.07 231.93 130.43 232.22 129.88 232.42C129.32 232.63 128.57 232.85 128.20 232.92C127.83 232.99 127.34 233.27 127.10 233.53C126.87 233.79 126.55 234.00 126.40 234.00C125.49 234.02 121.00 239.21 121.00 240.25C121.00 240.39 120.75 241.16 120.45 241.94C119.89 243.37 119.89 243.40 119.81 263.86C119.75 277.97 119.64 284.45 119.46 284.68C119.25 284.93 117.57 285.00 112.00 285.00C105.83 285.00 104.77 284.95 104.49 284.61C104.24 284.31 104.20 280.54 104.32 265.68C104.41 254.34 104.37 246.10 104.22 244.50C103.97 241.74 103.21 238.83 102.45 237.71C102.20 237.35 102.00 236.95 102.00 236.84C102.00 236.52 99.73 234.17 98.98 233.70C96.31 232.02 92.44 231.37 87.74 231.79C85.84 231.97 84.61 232.21 84.02 232.53C83.53 232.79 82.97 233.00 82.78 233.00C82.17 233.00 79.85 234.69 78.72 235.96C77.75 237.03 77.40 237.57 76.33 239.62C75.93 240.38 75.06 243.37 74.58 245.62C74.21 247.37 74.13 249.98 74.01 266.25L73.88 284.88L66.62 284.94C61.18 284.99 59.28 284.93 59.05 284.70Z';
  const PATH_SETA =
    'M171.60 284.64C171.52 284.43 172.02 283.62 172.79 282.69C176.07 278.79 177.42 277.15 178.00 276.39C178.34 275.94 179.47 274.57 180.49 273.35C181.52 272.12 182.45 271.01 182.55 270.88C182.65 270.74 183.21 270.05 183.80 269.34C184.39 268.63 185.41 267.39 186.06 266.59C186.71 265.78 188.17 264.00 189.31 262.62C190.44 261.25 191.45 260.01 191.55 259.88C191.65 259.74 192.21 259.04 192.80 258.33C193.39 257.62 194.38 256.41 195.00 255.63C195.62 254.86 196.53 253.75 197.02 253.17C198.09 251.92 201.82 247.36 202.88 246.02C203.29 245.50 204.47 244.08 205.50 242.87C207.58 240.43 208.76 238.99 210.21 237.12C210.74 236.44 211.36 235.72 211.59 235.53C211.81 235.34 212.00 235.07 212.00 234.93C212.00 234.78 212.18 234.46 212.41 234.22C212.63 233.97 212.74 233.59 212.66 233.38C212.53 233.03 210.61 232.99 194.85 233.01C185.13 233.01 177.13 232.97 177.07 232.90C176.91 232.74 176.99 219.72 177.15 219.46C177.22 219.34 190.94 219.25 207.65 219.25L238.01 219.25L238.25 219.88C238.61 220.83 238.58 284.23 238.22 284.67C237.87 285.09 224.51 285.16 223.73 284.74C223.26 284.49 223.25 284.01 223.25 265.24L223.25 246.00L222.62 246.00C222.28 246.00 222.00 246.11 222.00 246.24C222.00 246.37 221.41 247.17 220.69 248.02C219.97 248.87 219.09 249.94 218.75 250.39C217.80 251.64 210.28 260.92 209.00 262.42C208.38 263.15 207.43 264.31 206.88 265.00C206.32 265.70 205.47 266.74 204.98 267.32C204.49 267.90 202.92 269.84 201.49 271.62C200.07 273.41 198.50 275.34 198.01 275.91C197.52 276.47 196.56 277.64 195.88 278.50C195.19 279.36 194.06 280.71 193.38 281.50C192.69 282.29 191.75 283.40 191.30 283.97L190.47 285.00L181.10 285.00C173.20 285.00 171.71 284.94 171.60 284.64Z';
  const PATH_TTE =
    'M384.38 286.84C383.82 286.78 382.48 286.58 381.38 286.38C380.27 286.18 378.84 285.96 378.19 285.87C377.54 285.79 376.95 285.62 376.88 285.50C376.80 285.38 376.21 285.20 375.56 285.11C374.91 285.02 373.93 284.75 373.38 284.50C372.82 284.26 371.56 283.74 370.56 283.36C369.56 282.98 368.62 282.52 368.47 282.33C368.31 282.15 368.05 282.00 367.88 282.00C367.72 282.00 367.37 281.77 367.12 281.50C366.88 281.23 366.57 281.00 366.45 281.00C366.10 281.00 363.46 279.00 362.52 278.02C360.79 276.21 357.00 270.62 357.00 269.87C357.00 269.67 356.79 269.03 356.53 268.44C355.04 265.07 354.13 261.25 353.76 256.83C353.41 252.73 353.43 250.51 353.86 246.47C354.21 243.19 354.44 242.12 355.51 238.88C355.78 238.05 356.00 237.23 356.00 237.04C356.00 236.60 358.87 230.66 359.30 230.22C359.49 230.03 359.89 229.48 360.18 229.00C361.41 227.01 365.79 223.17 368.19 221.97C368.78 221.68 369.32 221.34 369.39 221.22C369.47 221.10 369.70 221.00 369.91 221.00C370.12 221.00 370.60 220.79 370.96 220.53C371.33 220.28 371.96 220.01 372.38 219.93C372.79 219.86 373.63 219.63 374.25 219.42C377.15 218.45 378.20 218.20 380.33 217.98C381.59 217.85 382.79 217.69 383.00 217.63C384.19 217.26 389.27 217.04 391.69 217.26C395.97 217.64 401.33 218.71 403.62 219.64C404.98 220.18 406.79 221.00 407.25 221.27C407.67 221.52 408.96 222.22 410.19 222.86C410.63 223.09 411.00 223.38 411.00 223.50C411.00 223.62 411.20 223.78 411.44 223.86C412.06 224.06 414.20 226.10 415.81 228.03C416.56 228.93 417.71 230.75 418.35 232.07C419.99 235.42 420.73 238.35 421.05 242.75C421.36 247.15 421.09 256.48 420.65 256.65C420.49 256.71 409.06 256.79 395.24 256.82L370.12 256.88L370.13 258.26C370.13 260.28 371.52 264.46 372.86 266.50C373.89 268.06 376.49 270.63 377.52 271.10C377.99 271.31 378.54 271.59 378.75 271.71C380.12 272.51 381.03 272.87 382.48 273.16C385.80 273.84 387.19 273.99 390.38 273.99C392.99 273.99 394.11 273.87 396.12 273.38C398.50 272.79 400.02 272.28 401.12 271.68C401.40 271.53 401.89 271.27 402.22 271.10C403.26 270.55 405.44 268.54 406.18 267.44C406.57 266.85 407.09 265.81 407.34 265.12C407.59 264.44 407.91 263.55 408.07 263.15L408.34 262.42L414.45 262.57C417.94 262.65 420.67 262.82 420.81 262.96C421.25 263.40 420.87 269.94 420.32 271.38C419.81 272.71 418.78 274.79 418.53 275.00C418.44 275.07 418.06 275.60 417.69 276.18C416.78 277.58 414.39 279.99 413.02 280.90C411.07 282.19 410.13 282.76 409.75 282.90C409.54 282.97 409.18 283.14 408.94 283.27C408.70 283.40 408.30 283.60 408.06 283.73C407.39 284.09 405.07 284.90 403.12 285.46C399.23 286.58 397.09 286.83 391.12 286.89C387.96 286.92 384.93 286.90 384.38 286.84ZM263.38 284.76C263.30 284.63 263.24 273.13 263.24 259.20C263.24 245.27 263.15 233.73 263.04 233.55C262.87 233.29 261.29 233.23 255.57 233.24C249.65 233.26 248.27 233.20 248.03 232.91C247.82 232.66 247.76 230.69 247.81 225.97L247.88 219.38L255.46 219.25C262.60 219.13 263.06 219.10 263.40 218.64C263.59 218.37 263.76 218.04 263.76 217.89C263.78 217.57 264.31 214.77 264.99 211.38C265.93 206.70 266.48 203.88 266.75 202.38C266.90 201.55 267.24 199.81 267.51 198.50C267.77 197.19 268.06 195.59 268.14 194.94C268.37 193.02 268.42 193.00 273.46 193.00C275.89 193.01 278.02 193.10 278.20 193.21C278.66 193.50 278.92 210.82 278.53 215.38C278.29 218.31 278.30 218.65 278.68 218.94C279.00 219.18 282.08 219.25 292.11 219.25C299.27 219.24 305.28 219.15 305.46 219.03C305.64 218.91 305.96 217.93 306.17 216.85C306.37 215.76 306.74 213.81 306.99 212.50C307.24 211.19 307.63 209.17 307.85 208.00C308.07 206.83 308.32 205.71 308.40 205.50C308.48 205.29 308.77 204.00 309.03 202.62C309.30 201.25 309.74 199.00 310.02 197.62C310.29 196.25 310.58 194.76 310.66 194.32C310.74 193.88 310.95 193.40 311.12 193.25C311.33 193.08 313.11 193.01 316.15 193.06L320.86 193.12L320.92 205.96C320.95 213.03 321.04 218.88 321.13 218.96C321.22 219.05 328.57 219.18 337.46 219.25L353.62 219.38L353.69 226.19C353.73 229.93 353.73 233.03 353.69 233.06C353.65 233.09 346.37 233.17 337.50 233.25L321.38 233.38L321.21 258.83C321.11 272.83 320.98 284.45 320.90 284.64C320.79 284.94 319.56 285.00 313.56 285.00C308.29 285.00 306.27 284.92 306.05 284.70C305.82 284.47 305.75 278.41 305.75 258.96C305.75 244.63 305.65 233.47 305.53 233.39C305.41 233.32 299.43 233.25 292.24 233.25C281.86 233.24 279.12 233.30 278.96 233.55C278.85 233.73 278.76 245.27 278.76 259.20C278.76 273.13 278.69 284.64 278.61 284.77C278.42 285.08 263.58 285.08 263.38 284.76ZM407.10 244.84C407.43 244.00 406.40 240.33 405.46 238.96C405.21 238.60 405.00 238.13 405.00 237.92C405.00 237.51 400.62 233.00 400.22 233.00C400.09 233.00 399.69 232.81 399.34 232.58C397.58 231.42 392.62 230.24 389.38 230.20C387.05 230.17 382.54 230.97 381.20 231.66C380.83 231.85 380.31 232.00 380.05 232.00C379.79 232.00 379.37 232.22 379.12 232.50C378.88 232.78 378.58 233.00 378.47 233.00C378.00 233.00 375.96 234.61 375.06 235.69C373.90 237.09 372.00 239.88 372.00 240.18C372.00 240.30 371.77 240.84 371.50 241.38C371.23 241.91 371.00 242.56 371.00 242.81C371.00 243.06 370.82 243.55 370.60 243.89C370.27 244.38 370.25 244.58 370.50 244.88C370.77 245.20 373.15 245.25 388.88 245.25C405.37 245.25 406.96 245.21 407.10 244.84Z';

  const VIEWBOX = '50 180 380 116';
  const BORDA_ESQ_SETA = 171.5; // o "m" some ao passar daqui
  const BORDA_DIR_SETA = 238.3; // o "tte" some ao passar daqui
  const DIST_M = 116; // quanto o "m" anda até sumir inteiro na seta
  const DIST_TTE = -186; // quanto o "tte" anda até sumir inteiro na seta
  const CICLO = 2600; // uma volta do carregamento (ms)
  const ENTRADA = 1120; // a entrada termina quando o "tte" assenta (440 + 680 ms)
  const MINIMO = 1200; // a tela fica pelo menos isso, contando desde o clique
  const LIMITE = 12000; // se a página nunca avisar que carregou, a tela sai sozinha
  const FADE = 350;
  const CHAVE = 'portal-carregando';
  const VALIDADE = 8000; // aviso gravado há mais tempo que isso é ignorado

  const SUGA = 'cubic-bezier(.6,0,.95,.45)'; // entra acelerando, como se fosse puxado
  const SOLTA = 'cubic-bezier(.16,.9,.32,1.12)'; // sai rápido e assenta com um leve passe
  const NS = 'http://www.w3.org/2000/svg';

  let contador = 0;
  let atual = null; // a tela aberta agora (só uma por vez)
  let indo = false; // já está trocando de página

  const esperar = ms => new Promise(ok => setTimeout(ok, ms));
  const fim = anim => anim.finished.catch(() => {});
  const semMovimento = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const tx = v => `translateX(${v}px)`;

  function el(tag, attrs, pai) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (pai) pai.appendChild(n);
    return n;
  }

  function montar(texto) {
    const id = 'carregando' + ++contador;
    const raiz = document.createElement('div');
    raiz.className = 'carregando';
    raiz.setAttribute('role', 'status');
    raiz.setAttribute('aria-live', 'polite');
    raiz.setAttribute('aria-busy', 'true');

    const svg = el('svg', { viewBox: VIEWBOX, 'aria-hidden': 'true', focusable: 'false' });
    const defs = el('defs', {}, svg);
    el(
      'rect',
      { x: -1000, y: -1000, width: 1000 + BORDA_ESQ_SETA, height: 3000 },
      el('clipPath', { id: id + '-m' }, defs)
    );
    el('rect', { x: BORDA_DIR_SETA, y: -1000, width: 3000, height: 3000 }, el('clipPath', { id: id + '-t' }, defs));

    // cada grupo de letras fica recortado na borda da seta: ao andar até ela, some "dentro" da seta
    const m = el('g', {}, el('g', { 'clip-path': `url(#${id}-m)` }, svg));
    el('path', { d: PATH_M, class: 'carregando-letra' }, m);
    const tte = el('g', {}, el('g', { 'clip-path': `url(#${id}-t)` }, svg));
    el('path', { d: PATH_TTE, class: 'carregando-letra' }, tte);
    const fantasma = el('path', { d: PATH_SETA, class: 'carregando-fantasma' }, svg);
    const seta = el('path', { d: PATH_SETA, class: 'carregando-seta' }, svg);

    const barra = document.createElement('div');
    barra.className = 'carregando-barra vai-e-vem';
    const preench = document.createElement('div');
    preench.className = 'carregando-preench';
    barra.appendChild(preench);

    const frase = document.createElement('p');
    frase.className = 'carregando-texto';
    frase.textContent = texto || '';

    const leitor = document.createElement('span');
    leitor.className = 'oculto-leitor';
    leitor.textContent = 'Carregando';

    raiz.append(svg, barra, frase, leitor);
    return { raiz, m, tte, seta, fantasma, barra, preench, frase };
  }

  // Seta aparece girando e as letras saem dela. "decorrido" pula para o ponto certo quando a página é nova.
  function entrar(p, decorrido) {
    if (decorrido >= ENTRADA) return Promise.resolve();
    p.m.style.transform = tx(DIST_M);
    p.tte.style.transform = tx(DIST_TTE);
    const anims = [
      p.seta.animate(
        [
          { transform: 'scale(0) rotate(-90deg)', opacity: 0 },
          { offset: 0.7, transform: 'scale(1.15) rotate(6deg)', opacity: 1 },
          { transform: 'scale(1) rotate(0)', opacity: 1 }
        ],
        { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' }
      ),
      p.m.animate([{ transform: tx(DIST_M) }, { transform: tx(0) }], {
        duration: 620,
        delay: 380,
        easing: SOLTA,
        fill: 'backwards'
      }),
      p.tte.animate([{ transform: tx(DIST_TTE) }, { transform: tx(0) }], {
        duration: 680,
        delay: 440,
        easing: SOLTA,
        fill: 'backwards'
      })
    ];
    anims.forEach(a => (a.currentTime = decorrido));
    return Promise.all(anims.map(fim)).then(() => {
      p.m.style.transform = '';
      p.tte.style.transform = '';
    });
  }

  // Uma volta: letras paradas → entram na seta → seta dá o impulso ↗ → letras saem de volta
  function ciclo(p, decorrido) {
    const o = { duration: CICLO, iterations: Infinity };
    const anims = [
      p.m.animate(
        [
          { offset: 0, transform: tx(0) },
          { offset: 0.2, transform: tx(0), easing: SUGA },
          { offset: 0.4, transform: tx(DIST_M) },
          { offset: 0.66, transform: tx(DIST_M), easing: SOLTA },
          { offset: 0.88, transform: tx(0) },
          { offset: 1, transform: tx(0) }
        ],
        o
      ),
      p.tte.animate(
        [
          { offset: 0, transform: tx(0) },
          { offset: 0.24, transform: tx(0), easing: SUGA },
          { offset: 0.46, transform: tx(DIST_TTE) },
          { offset: 0.68, transform: tx(DIST_TTE), easing: SOLTA },
          { offset: 0.92, transform: tx(0) },
          { offset: 1, transform: tx(0) }
        ],
        o
      ),
      p.seta.animate(
        [
          { offset: 0, transform: 'translate(0,0) scale(1)' },
          { offset: 0.38, transform: 'translate(0,0) scale(1)' },
          { offset: 0.43, transform: 'translate(0,0) scale(1.1)' }, // engole o "m"
          { offset: 0.47, transform: 'translate(0,0) scale(1.14)' }, // engole o "tte"
          { offset: 0.52, transform: 'translate(0,0) scale(.95)', easing: 'cubic-bezier(.3,0,.2,1)' },
          { offset: 0.58, transform: 'translate(7px,-7px) scale(1)', easing: 'cubic-bezier(.5,0,.3,1)' }, // impulso ↗
          { offset: 0.65, transform: 'translate(0,0) scale(1)' },
          { offset: 0.7, transform: 'translate(0,0) scale(.93)' }, // cospe as letras
          { offset: 0.76, transform: 'translate(0,0) scale(1)' },
          { offset: 1, transform: 'translate(0,0) scale(1)' }
        ],
        o
      ),
      p.fantasma.animate(
        [
          { offset: 0, opacity: 0, transform: 'translate(0,0)' },
          { offset: 0.54, opacity: 0, transform: 'translate(0,0)' },
          { offset: 0.57, opacity: 0.4, transform: 'translate(4px,-4px)' },
          { offset: 0.72, opacity: 0, transform: 'translate(30px,-30px)' },
          { offset: 1, opacity: 0, transform: 'translate(30px,-30px)' }
        ],
        o
      )
    ];
    anims.forEach(a => (a.currentTime = Math.max(0, decorrido - ENTRADA)));
    return anims;
  }

  class Carregamento {
    // continua: a tela já estava aberta na página anterior (aparece sem o fade de entrada)
    constructor(texto, inicio, continua) {
      this.inicio = inicio;
      this.calmo = semMovimento();
      this.p = montar(texto);
      this.animacoes = [];
      // no <head> ainda não existe <body>: a tela entra direto no <html>
      (document.body || document.documentElement).appendChild(this.p.raiz);
      if (continua) this.p.raiz.classList.add('imediato');
      void this.p.raiz.offsetWidth; // força o layout antes de ligar a transição de opacidade
      this.p.raiz.classList.add('visivel');
      const decorrido = Date.now() - inicio;
      this.entrada = (this.calmo ? Promise.resolve() : entrar(this.p, decorrido)).then(() => {
        if (this.saindo) return;
        this.animacoes = this.calmo
          ? [
              this.p.seta.animate([{ opacity: 1 }, { opacity: 0.45 }, { opacity: 1 }], {
                duration: 1600,
                iterations: Infinity
              })
            ]
          : ciclo(this.p, Date.now() - this.inicio);
      });
      this.limite = setTimeout(() => this.esconder(), LIMITE);
    }

    texto(frase) {
      this.p.frase.textContent = frase || '';
    }

    barraCheia() {
      const { barra, preench } = this.p;
      barra.className = 'carregando-barra medida';
      preench.style.width = '0%';
      void preench.offsetWidth;
      preench.style.width = '100%';
    }

    // letras entram na seta, a seta sai voando para cima e a tela some
    esconder() {
      if (this.saindo) return this.saindo;
      clearTimeout(this.limite);
      const p = this.p;
      this.saindo = this.entrada
        .then(() => esperar(MINIMO - (Date.now() - this.inicio)))
        .then(() => {
          this.animacoes.forEach(a => {
            try {
              a.commitStyles();
            } catch (e) {
              /* elemento fora da tela: não tem estilo para guardar */
            }
            a.cancel();
          });
          this.barraCheia();
          if (this.calmo) return esperar(250);
          const m = p.m.animate([{ transform: tx(DIST_M) }], { duration: 460, easing: SUGA, fill: 'forwards' });
          const t = p.tte.animate([{ transform: tx(DIST_TTE) }], {
            duration: 500,
            delay: 60,
            easing: SUGA,
            fill: 'forwards'
          });
          return Promise.all([fim(m), fim(t)])
            .then(() => {
              p.fantasma.style.opacity = '0';
              return fim(
                p.seta.animate(
                  [{ transform: 'translate(0,0) scale(1)' }, { transform: 'translate(0,0) scale(1.16)' }],
                  {
                    duration: 140,
                    easing: 'ease-out',
                    fill: 'forwards'
                  }
                )
              );
            })
            .then(() =>
              fim(
                p.seta.animate(
                  [
                    { transform: 'translate(0,0) scale(1.16)', opacity: 1 },
                    { offset: 0.25, transform: 'translate(-6px,6px) scale(1)', opacity: 1 },
                    { transform: 'translate(90px,-90px) scale(.7)', opacity: 0 }
                  ],
                  { duration: 520, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' }
                )
              )
            );
        })
        .then(() => {
          p.raiz.classList.remove('imediato', 'visivel');
          p.raiz.setAttribute('aria-busy', 'false');
          return esperar(FADE + 10);
        })
        .then(() => this.remover());
      return this.saindo;
    }

    remover() {
      clearTimeout(this.limite);
      this.p.raiz.remove();
    }
  }

  function guardar(aviso) {
    try {
      sessionStorage.setItem(CHAVE, JSON.stringify(aviso));
    } catch (e) {
      /* navegador sem armazenamento: a página nova só não continua a animação */
    }
  }

  function lerAviso() {
    try {
      const aviso = JSON.parse(sessionStorage.getItem(CHAVE) || 'null');
      sessionStorage.removeItem(CHAVE);
      return aviso && Date.now() - aviso.em < VALIDADE ? aviso : null;
    } catch (e) {
      return null;
    }
  }

  const portalCarregando = {
    // abre a tela (ou troca a frase, se já estiver aberta)
    abrir(texto) {
      if (atual) atual.texto(texto);
      else atual = new Carregamento(texto, Date.now(), false);
      return atual;
    },

    // abre a tela, espera o fade (e o "antes", se houver) e troca de página; a página nova continua a animação
    async ir(url, { texto = 'Carregando…', antes, substituir = false } = {}) {
      if (indo) return;
      indo = true;
      const c = portalCarregando.abrir(texto);
      guardar({ em: c.inicio, texto });
      await Promise.all([
        esperar(FADE),
        antes
          ? Promise.resolve()
              .then(antes)
              .catch(() => {})
          : null
      ]);
      if (substituir) location.replace(url);
      else location.assign(url);
    },

    // a página terminou de carregar: saída animada
    pronto() {
      if (!atual || indo) return Promise.resolve();
      const c = atual;
      atual = null;
      return c.esconder();
    }
  };

  // Voltar pelo navegador pode restaurar a página antiga com a tela ainda aberta: tira na hora
  window.addEventListener('pageshow', e => {
    if (!e.persisted) return;
    indo = false;
    if (atual) atual.remover();
    atual = null;
  });

  // Veio de outra página do portal? Continua a animação de onde ela parou.
  const aviso = lerAviso();
  if (aviso) atual = new Carregamento(aviso.texto, aviso.em, true);

  window.portalCarregando = portalCarregando;
})();
