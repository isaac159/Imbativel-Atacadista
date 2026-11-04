// Leitura dos arquivos que a Imbatível envia (o mesmo que os nós "Salvar ofertas" e "Salvar tabela" faziam no n8n)
// e comparação com a versão anterior, para o resumo mostrar o que mudou.
// O navegador extrai o texto do PDF e as linhas da planilha; aqui o texto vira {validade, itens}.

// PDF semanal de ofertas → {validade: {inicio, fim}, itens}
// Funciona com o texto em linhas ou tudo numa linha só (ordem do PDF: nome, variações, OFERTA, preço, faixas).
function lerOfertas(texto) {
  const t = String(texto || '').replace(/ /g, ' ');
  const val = t.match(/(\d{2}\/\d{2}\/\d{4})\s*a\s*(\d{2}\/\d{2}\/\d{4})/);
  const tokens = t.split(/\s+/).filter(Boolean);
  const num = s => parseFloat(String(s).replace(/\./g, '').replace(',', '.'));
  const temMinuscula = w => /[a-zà-ÿ]/.test(w);
  const semLetra = w => !/[A-Za-zÀ-ÿ]/.test(w);
  const UNID = /^(ML|L|LT|LTS|LITRO|LITROS|KG|G|UN|UND)$/;
  const itens = [];
  let i = 0, inicioSeg = 0;
  while (i < tokens.length) {
    if (tokens[i] !== 'OFERTA') { i++; continue; }
    // segmento antes do OFERTA: [lixo de página] NOME (maiúsculas) [variações com minúsculas]
    const seg = tokens.slice(inicioSeg, i);
    let k = seg.length - 1;
    // variações: tokens com minúscula, aceitando números/pontuação no meio ("Pack com 18 unidades")
    const varTok = [];
    while (k >= 0 && (temMinuscula(seg[k]) || (semLetra(seg[k]) && varTok.length && k > 0 && (temMinuscula(seg[k - 1]) || UNID.test(seg[k - 1]))))) { varTok.unshift(seg[k]); k--; }
    // nome: tokens sem minúscula até achar texto de cabeçalho/rodapé
    const nomeTok = [];
    while (k >= 0 && !temMinuscula(seg[k])) { nomeTok.unshift(seg[k]); k--; }
    // tira restos de rodapé do começo do nome ("01 / 34")
    while (nomeTok.length && /^[\d/]+$/.test(nomeTok[0])) nomeTok.shift();
    i++;
    if (tokens[i] !== 'R$') { inicioSeg = i; continue; }
    const base = num(tokens[i + 1]); i += 2;
    const faixas = [];
    while (tokens[i] === 'ACIMA' && tokens[i + 1] === 'DE') {
      const cond = []; let j = i + 2;
      while (j < tokens.length && tokens[j] !== 'R$') { cond.push(tokens[j]); j++; }
      if (tokens[j] !== 'R$') break;
      faixas.push({ condicao: 'acima de ' + cond.join(' ').toLowerCase(), minimo: parseInt(cond[0], 10) || null,
        unidade: cond.slice(1).join(' ').toLowerCase().replace(/\.$/, ''), preco: num(tokens[j + 1]) });
      i = j + 2;
    }
    inicioSeg = i;
    const nome = nomeTok.join(' ').trim();
    if (nome && !isNaN(base)) itens.push({ produto: nome, variacoes: varTok.join(' ').trim(), preco_oferta: base, faixas });
  }
  return { validade: val ? { inicio: val[1], fim: val[2] } : null, itens };
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
