// Leitura dos arquivos que a Imbatível envia (o mesmo que os nós "Salvar ofertas" e "Salvar tabela" faziam no n8n)
// e comparação com a versão anterior, para o resumo mostrar o que mudou.
// O navegador extrai o texto do PDF e as linhas da planilha; aqui o texto vira {validade, itens}.

// PDF de ofertas → {validade: {inicio, fim}, itens}
// A Imbatível já usou dois modelos de PDF, e o leitor entende os dois:
//   clássico ("Ofertas fecha mês"):  NOME [variações] OFERTA R$ x [ACIMA DE n UN. R$ y ...]
//   em volume ("Pré Black Friday"):  NOME [variações] [ACIMA DE n UNIDADES R$ y ...] POR UNIDADE R$ x
//                                     ou NOME [variações] POR APENAS R$ x DE R$ antigo
// Roda os dois e fica com o que achou mais ofertas.
// Funciona com o texto em linhas ou tudo numa linha só.
function lerOfertas(texto) {
  const t = String(texto || '').replace(/ /g, ' ');
  const tokens = t.split(/\s+/).filter(Boolean);
  const classico = lerOfertasClassico(tokens), volume = lerOfertasVolume(tokens);
  const itens = volume.length > classico.length ? volume : classico;
  return { validade: lerValidade(t), itens };
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

module.exports = { lerOfertas, lerTabela, compararTabela, compararOfertas, agoraBR };
