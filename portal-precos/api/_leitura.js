// Leitura dos arquivos que a Imbatível envia (o mesmo que os nós "Salvar ofertas" e "Salvar tabela" faziam no n8n)
// e comparação com a versão anterior, para o resumo mostrar o que mudou.
// O navegador extrai o texto do PDF e as linhas da planilha; aqui o texto vira {validade, itens}.

// PDF de ofertas → {validade: {inicio, fim}, itens, blocos_de_preco}
// Cada semana a Imbatível manda um modelo diferente. Três leitores rodam e fica o que achou mais ofertas:
//   genérico: acha os blocos de preço em qualquer formato (POR UNIDADE/PACOTE, POR APENAS … DE, OFERTA, Acima de N …),
//             tira o cabeçalho/rodapé que se repete nas páginas e pega o nome do produto no que sobra
//             (nome em MAIÚSCULAS ou em texto normal com o tamanho "• 500 ml");
//   clássico ("Ofertas fecha mês") e em volume ("Pré Black Friday"): os primeiros modelos, mantidos como conferência.
// O navegador separa as páginas com \f; sem isso, o texto inteiro conta como uma página.
// blocos_de_preco = quantos blocos de preço existem no texto, para o portal avisar se a leitura achou bem menos produtos.
function lerOfertas(texto) {
  const t = String(texto || '').replace(/ /g, ' ');
  const tokens = t.split(/\s+/).filter(Boolean);
  const leituras = [lerOfertasGenerico(t), lerOfertasVolume(tokens), lerOfertasClassico(tokens)];
  const itens = leituras.reduce((a, b) => (b.length > a.length ? b : a));
  return { validade: lerValidade(t), itens, blocos_de_preco: contarBlocosDePreco(t) };
}

// Quantos produtos com preço o texto tem: conta cada bloco de linhas de preço que vem depois de texto que não é preço
function contarBlocosDePreco(t) {
  let n = 0, emBloco = false;
  for (const l of t.split(/\n|\f/).map(s => s.trim()).filter(Boolean)) {
    const preco = /R\$\s*\d/.test(l) || /^(acima\s+de\b.*|por\s+\S+|oferta|de|r\$)\s*$/i.test(l);
    if (preco && !emBloco && !/compras\s+acima/i.test(l)) n++;
    emBloco = preco;
  }
  return n;
}

const TAMANHO = /\d+([.,]\d+)?\s*(ml|l|lt|lts|litros?|kg|g|gr)\b/i;
const soMaiusculas = l => /[A-ZÀ-Ý]/.test(l) && !/[a-zà-ÿ]/.test(l);

// Leitor genérico: blocos de preço pelos tokens (cada token sabe de que linha veio) e nome/variações pelas linhas
function lerOfertasGenerico(texto) {
  const paginas = String(texto || '').split('\f');
  // linha que se repete em boa parte das páginas é cabeçalho/rodapé (números viram # para "01 / 28" = "02 / 28")
  const chave = l => l.replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().toLowerCase();
  const presenca = new Map();
  for (const p of paginas) for (const k of new Set(p.split('\n').map(chave).filter(Boolean))) presenca.set(k, (presenca.get(k) || 0) + 1);
  const repetida = l => paginas.length >= 3 && (presenca.get(chave(l)) || 0) >= Math.max(3, paginas.length * 0.6);

  const linhas = [], tok = [], lin = [];
  for (const p of paginas) for (const bruta of p.split('\n')) {
    const l = bruta.replace(/\s+/g, ' ').trim();
    if (!l) continue;
    const idx = linhas.push({ texto: l, rep: repetida(l) }) - 1;
    for (const w of l.split(' ')) { tok.push(w); lin.push(idx); }
  }
  const eh = (i, re) => i < tok.length && re.test(tok[i]);
  const rs = (i, ate) => { for (let j = i + 1; j <= i + ate && j < tok.length; j++) if (tok[j] === 'R$') return j; return -1; };
  // posição do R$ se o token i abre um item de preço; senão -1
  const inicioPreco = i => {
    if (i >= tok.length || linhas[lin[i]].rep) return -1;
    if (eh(i, /^acima$/i) && eh(i + 1, /^de$/i) && eh(i + 2, /^\d/)) return rs(i + 1, 6);
    if (eh(i, /^por$/i)) return rs(i, 3);
    if (eh(i, /^oferta$/i) && tok[i + 1] === 'R$') return i + 1;
    if (eh(i, /^de$/i) && tok[i + 1] === 'R$') return i + 1;
    return -1;
  };

  const itens = [], vistos = new Set();
  let i = 0, inicioSeg = 0;
  while (i < tok.length) {
    if (inicioPreco(i) < 0) { i++; continue; }
    // linhas antes do bloco de preço, sem cabeçalho/rodapé e sem contador de página
    const ls = [];
    for (let k = inicioSeg; k < i; k++) if (!ls.length || ls[ls.length - 1] !== lin[k]) ls.push(lin[k]);
    const seg = ls.map(n => linhas[n]).filter(l => !l.rep && !/^\d+\s*\/\s*\d+\b/.test(l.texto)).map(l => l.texto);
    let base = null, de = null, j;
    const faixas = [];
    while ((j = inicioPreco(i)) >= 0) {
      const valor = num(tok[j + 1]);
      if (/^acima$/i.test(tok[i])) faixas.push(faixa(tok.slice(i + 2, j), valor));
      else if (/^de$/i.test(tok[i])) de = valor;
      else base = valor; // POR UNIDADE / POR PACOTE / POR APENAS / OFERTA
      i = j + 2;
    }
    inicioSeg = i;
    const { nome, variacoes } = nomeDoSegmento(seg);
    faixas.sort((a, b) => (a.minimo || 0) - (b.minimo || 0));
    if (base == null && faixas.length) base = faixas[0].preco;
    if (!nome || base == null || isNaN(base)) continue;
    const item = { produto: nome, variacoes, preco_oferta: base, faixas };
    if (de != null && !isNaN(de)) item.preco_de = de;
    const k = JSON.stringify(item);
    if (vistos.has(k)) continue; // a mesma oferta repetida no PDF
    vistos.add(k);
    itens.push(item);
  }
  return itens;
}

// Nome e variações a partir das linhas que vêm antes do preço
function nomeDoSegmento(seg) {
  if (!seg.length) return { nome: '', variacoes: '' };
  let nomeL, resto;
  const ultMai = seg.map(soMaiusculas).lastIndexOf(true);
  if (ultMai >= 0) {
    // nome em MAIÚSCULAS (pode quebrar em mais de uma linha); o que vem depois são as variações
    let ini = ultMai;
    while (ini > 0 && soMaiusculas(seg[ini - 1])) ini--;
    nomeL = seg.slice(ini, ultMai + 1);
    resto = seg.slice(ultMai + 1);
  } else {
    // nome em texto normal: vai até a linha com o tamanho ("• 500 ml"), no máximo 3 linhas
    const max = Math.min(seg.length, 3);
    let fim = 0;
    while (fim < max && !TAMANHO.test(seg.slice(0, fim + 1).join(' '))) fim++;
    if (fim >= max) fim = 0;
    nomeL = seg.slice(0, fim + 1);
    resto = seg.slice(fim + 1);
  }
  // linha que só repete as palavras da anterior (rótulos das fotos: "Green   Blue") sai
  const vars = resto.filter((l, k) => {
    if (!k) return true;
    const ant = resto[k - 1].toLowerCase();
    return !l.toLowerCase().split(/\s+/).every(w => ant.includes(w));
  });
  return { nome: nomeL.join(' ').replace(/\s+/g, ' ').trim(), variacoes: vars.join(' ').replace(/\s+/g, ' ').trim() };
}

const num = s => parseFloat(String(s).replace(/\./g, '').replace(',', '.'));
const temMinuscula = w => /[a-zà-ÿ]/.test(w);
const semLetra = w => !/[A-Za-zÀ-ÿ]/.test(w);
const UNID = /^(ML|L|LT|LTS|LITRO|LITROS|KG|G|UN|UND)$/;

// "23/10/2026 a 30/10/2026" ou "VÁLIDA DE 10 A 14/11/2026" (também "DE 28/11 A 02/12/2026")
function lerValidade(t) {
  const a = t.match(/(\d{2}\/\d{2}\/\d{4})\s*a\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (a) return { inicio: a[1], fim: a[2] };
  const b = t.match(/V[ÁA]LID[AO]S?\s+(?:DE\s+)?(\d{1,2})(?:\/(\d{1,2}))?(?:\/(\d{4}))?\s+(?:A|AT[ÉE])\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (!b) return null;
  const d2 = s => String(s).padStart(2, '0');
  const mesFim = +b[5], anoFim = +b[6];
  const mesIni = b[2] ? +b[2] : mesFim;
  const anoIni = b[3] ? +b[3] : (mesIni > mesFim ? anoFim - 1 : anoFim);
  return { inicio: `${d2(b[1])}/${d2(mesIni)}/${anoIni}`, fim: `${d2(b[4])}/${d2(mesFim)}/${anoFim}` };
}

// Nome e variações ficam antes do preço: [lixo de página] NOME (maiúsculas) [variações com minúsculas]
function nomeEVariacoes(seg) {
  let k = seg.length - 1;
  // variações: tokens com minúscula, aceitando números/pontuação no meio ("Pack com 18 unidades")
  // e palavras em maiúsculas no meio da frase ("Job, CLT e maçã", "Mango N’ Cherry")
  const varTok = [];
  const noMeio = j => varTok.length && j > 0 && temMinuscula(seg[j - 1]) && !/[.:]$/.test(seg[j - 1]);
  while (k >= 0 && (temMinuscula(seg[k]) || (semLetra(seg[k]) && varTok.length && k > 0 && (temMinuscula(seg[k - 1]) || UNID.test(seg[k - 1]))) || noMeio(k))) { varTok.unshift(seg[k]); k--; }
  // nome: tokens sem minúscula até achar texto de cabeçalho/rodapé
  const nomeTok = [];
  while (k >= 0 && !temMinuscula(seg[k])) { nomeTok.unshift(seg[k]); k--; }
  // tira restos de rodapé do começo do nome ("01 / 34")
  while (nomeTok.length && /^[\d/]+$/.test(nomeTok[0])) nomeTok.shift();
  return { nome: nomeTok.join(' ').trim(), variacoes: varTok.join(' ').trim() };
}

function faixa(cond, preco) {
  return { condicao: 'acima de ' + cond.join(' ').toLowerCase(), minimo: parseInt(cond[0], 10) || null,
    unidade: cond.slice(1).join(' ').toLowerCase().replace(/\.$/, ''), preco };
}

// Modelo clássico: o preço vem depois da palavra OFERTA
function lerOfertasClassico(tokens) {
  const itens = [];
  let i = 0, inicioSeg = 0;
  while (i < tokens.length) {
    if (tokens[i] !== 'OFERTA') { i++; continue; }
    const { nome, variacoes } = nomeEVariacoes(tokens.slice(inicioSeg, i));
    i++;
    if (tokens[i] !== 'R$') { inicioSeg = i; continue; }
    const base = num(tokens[i + 1]); i += 2;
    const faixas = [];
    while (tokens[i] === 'ACIMA' && tokens[i + 1] === 'DE') {
      const cond = []; let j = i + 2;
      while (j < tokens.length && tokens[j] !== 'R$') { cond.push(tokens[j]); j++; }
      if (tokens[j] !== 'R$') break;
      faixas.push(faixa(cond, num(tokens[j + 1])));
      i = j + 2;
    }
    inicioSeg = i;
    if (nome && !isNaN(base)) itens.push({ produto: nome, variacoes, preco_oferta: base, faixas });
  }
  return itens;
}

// Modelo em volume: cada produto é um bloco de preços (ACIMA DE…, POR UNIDADE…, POR APENAS…, DE…), cada um seguido de R$ valor
function lerOfertasVolume(tokens) {
  // devolve onde está o "R$" se o token i começa um item de preço; senão -1
  const rs = (i, ate) => { for (let j = i + 1; j <= i + ate && j < tokens.length; j++) if (tokens[j] === 'R$') return j; return -1; };
  const inicioPreco = i => {
    if (tokens[i] === 'ACIMA' && tokens[i + 1] === 'DE') return rs(i + 1, 5);
    if (tokens[i] === 'POR') return rs(i, 3);
    if (tokens[i] === 'DE' && tokens[i + 1] === 'R$') return i + 1;
    return -1;
  };
  const itens = [];
  let i = 0, inicioSeg = 0;
  while (i < tokens.length) {
    if (inicioPreco(i) < 0) { i++; continue; }
    const { nome, variacoes } = nomeEVariacoes(tokens.slice(inicioSeg, i));
    let base = null, de = null, j;
    const faixas = [];
    while ((j = inicioPreco(i)) >= 0) {
      const valor = num(tokens[j + 1]);
      if (tokens[i] === 'ACIMA') faixas.push(faixa(tokens.slice(i + 2, j), valor));
      else if (tokens[i] === 'DE') de = valor;
      else base = valor; // POR UNIDADE / POR PACOTE / POR APENAS
      i = j + 2;
    }
    inicioSeg = i;
    faixas.sort((a, b) => (a.minimo || 0) - (b.minimo || 0));
    if (base == null && faixas.length) base = faixas[0].preco;
    if (!nome || base == null || isNaN(base)) continue;
    const item = { produto: nome, variacoes, preco_oferta: base, faixas };
    if (de != null && !isNaN(de)) item.preco_de = de;
    itens.push(item);
  }
  return itens;
}

// Linhas da planilha fixa (arrays de células) → {validade, itens}
// Acha sozinho a linha de cabeçalho (Nome do Item / Preço), então título e legenda em cima não atrapalham.
function lerTabela(linhas) {
  const rows = (linhas || []).map(r => Array.isArray(r) ? r : (r && Array.isArray(r.row) ? r.row : Object.values(r || {})));
  const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  let h = -1, col = {};
  for (let i = 0; i < rows.length; i++) {
    const c = rows[i].map(norm);
    const nome = c.findIndex(x => x.startsWith('nome'));
    const preco = c.findIndex(x => x.startsWith('preco'));
    if (nome >= 0 && preco >= 0) {
      h = i;
      col = { categoria: c.findIndex(x => x.startsWith('categoria')), codigo: c.findIndex(x => x.startsWith('numero') || x.startsWith('codigo') || x === 'cod'),
              nome, unidade: c.findIndex(x => x.startsWith('unidade')), embalagem: c.findIndex(x => x.startsWith('embalagem')), preco };
      break;
    }
  }
  let validade = '';
  for (let i = 0; i < (h < 0 ? rows.length : h); i++) {
    const c = rows[i].map(norm); const j = c.findIndex(x => x.startsWith('datas validas') || x.startsWith('validade'));
    if (j >= 0) { validade = String(rows[i].slice(j + 1).find(v => v != null && String(v).trim() !== '') || ''); break; }
  }
  if (h < 0) return { validade, itens: [], erro: 'não achei o cabeçalho (a planilha precisa ter as colunas Nome do Item e Preço)' };
  const pega = (r, k) => col[k] >= 0 ? r[col[k]] : '';
  const preco = v => typeof v === 'number' ? v : parseFloat(String(v || '').replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  const itens = [];
  for (const r of rows.slice(h + 1)) {
    const nome = String(pega(r, 'nome') || '').trim(); const p = preco(pega(r, 'preco'));
    if (!nome || isNaN(p)) continue;
    itens.push({ codigo: String(pega(r, 'codigo') ?? '').trim(), nome, categoria: String(pega(r, 'categoria') || '').trim(),
                 unidade: String(pega(r, 'unidade') || '').trim(), embalagem: String(pega(r, 'embalagem') || '').trim(), preco: Math.round(p * 100) / 100 });
  }
  return { validade, itens };
}

// Compara duas listas pela chave e devolve o que entrou, saiu e mudou de preço
function comparar(antes, depois, chave, precoDe, rotulo) {
  const mapa = new Map((antes || []).map(it => [chave(it), it]));
  const vistos = new Set();
  const mudaram = [], novos = [];
  for (const it of depois || []) {
    const k = chave(it); vistos.add(k);
    const velho = mapa.get(k);
    if (!velho) { novos.push({ produto: rotulo(it), preco: precoDe(it) }); continue; }
    const a = precoDe(velho), b = precoDe(it);
    if (Math.abs(a - b) >= 0.005) mudaram.push({ produto: rotulo(it), antes: a, agora: b, variacao: a ? Math.round((b - a) / a * 1000) / 10 : null });
  }
  const sairam = [...mapa.entries()].filter(([k]) => !vistos.has(k)).map(([, it]) => ({ produto: rotulo(it), preco: precoDe(it) }));
  mudaram.sort((x, y) => Math.abs(y.variacao || 0) - Math.abs(x.variacao || 0));
  return {
    subiram: mudaram.filter(m => m.agora > m.antes).length,
    baixaram: mudaram.filter(m => m.agora < m.antes).length,
    mudaram, novos, sairam
  };
}

const chaveTabela = it => (it.codigo ? 'c:' + it.codigo : 'n:' + it.nome.toUpperCase()) + '|' + (it.embalagem || '').toUpperCase();
const chaveOferta = it => (it.produto + '|' + (it.variacoes || '')).toUpperCase();

function compararTabela(antes, depois) {
  return comparar(antes, depois, chaveTabela, it => it.preco, it => [it.nome, it.embalagem].filter(Boolean).join(' · '));
}

function compararOfertas(antes, depois) {
  return comparar(antes, depois, chaveOferta, it => it.preco_oferta, it => it.produto + (it.variacoes ? ' (' + it.variacoes + ')' : ''));
}

// Data e hora de Brasília (UTC-3, sem horário de verão)
function agoraBR() {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 16);
}

// A leitura por regra é confiável? Achou quase todos os blocos de preço e os nomes parecem nomes de produto.
// Quando não é (modelo de PDF novo), o portal manda o PDF para a leitura por IA.
function nomeBom(n) {
  return /[A-Za-zÀ-ÿ]{3,}/.test(n) && n.length <= 90 && !/^[•\d\s.,/-]/.test(n) && !/R\$|acima\s+de|por\s+unidade|por\s+pacote/i.test(n);
}
function leituraConfiavel(r) {
  const n = r.itens.length, blocos = r.blocos_de_preco || n;
  if (!n) return false;
  const bons = r.itens.filter(it => nomeBom(it.produto)).length;
  return bons / n >= 0.95 && n >= blocos * 0.9 && n <= blocos * 1.15;
}

// Ofertas que chegam prontas do navegador (lidas por IA): confere tipos e números antes de gravar
function normalizarOfertas(itens) {
  const out = [];
  for (const it of Array.isArray(itens) ? itens.slice(0, 3000) : []) {
    const produto = String((it && it.produto) || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    const preco = Number(it && it.preco_oferta);
    if (!produto || !(preco > 0) || preco > 100000) continue;
    const faixas = (Array.isArray(it.faixas) ? it.faixas : []).slice(0, 10)
      .filter(f => f && Number(f.preco) > 0 && Number(f.minimo) > 0)
      .map(f => {
        const unidade = String(f.unidade || '').toLowerCase().trim().slice(0, 40);
        return { condicao: `acima de ${Math.round(f.minimo)} ${unidade}`.trim(), minimo: Math.round(f.minimo), unidade, preco: Math.round(f.preco * 100) / 100 };
      });
    const item = { produto, variacoes: String(it.variacoes || '').replace(/\s+/g, ' ').trim().slice(0, 300), preco_oferta: Math.round(preco * 100) / 100, faixas };
    if (Number(it.preco_de) > 0) item.preco_de = Math.round(Number(it.preco_de) * 100) / 100;
    out.push(item);
  }
  return out;
}

module.exports = { lerOfertas, lerTabela, compararTabela, compararOfertas, agoraBR, leituraConfiavel, normalizarOfertas };
