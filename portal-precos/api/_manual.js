// Aba "Manual": preços de tabela, ofertas e contatos digitados no portal, sem enviar o arquivo inteiro.
//
// Preço de tabela: muda (ou inclui) o produto direto na tabela que o Benjamim usa. Vale até a próxima
//   planilha enviada em "Atualizar arquivos", que substitui a tabela inteira.
// Oferta: fica guardada à parte (precos.ofertas_manuais), cada uma com a sua validade. O /api/dados junta
//   com as ofertas do PDF só enquanto ela estiver valendo, e ela some sozinha depois do fim.
// Contato: cliente de um vendedor (nome + WhatsApp), guardado em carteira.manuais. A consulta da EZ procura
//   nas listas em PDF e nos contatos manuais.
const crypto = require('crypto');
const { agoraBR, chaveTabela, chaveOferta, normalizarOfertas } = require('./_leitura');
const { VENDEDORES, corrigirTelefone, normTelefone } = require('./_carteira');

const MAX_TEXTO = 160;
const PRECO_MAX = 100000;

const texto = (v, max = MAX_TEXTO) =>
  String(v == null ? '' : v)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
const centavos = v => Math.round(Number(v) * 100) / 100;
const novoId = () => crypto.randomBytes(5).toString('hex');
const hojeISO = () => agoraBR().slice(0, 10);

// "25/11/2026" ⇄ "2026-11-25"
const iso = s => {
  const m = String(s || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
};
const br = s => {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};

// Validade { inicio, fim } em dd/mm/aaaa: 'vigente', 'agendada' (começa depois) ou 'vencida'
function situacao(validade, hoje = hojeISO()) {
  const ini = iso(validade && validade.inicio);
  const fim = iso(validade && validade.fim);
  if (!fim || hoje > fim) return 'vencida';
  if (ini && hoje < ini) return 'agendada';
  return 'vigente';
}

// ---------- Preços ----------

// Confere um lançamento vindo da tela. Devolve { item } pronto para gravar ou { erro } com o motivo.
function validarPreco(bruto, hoje = hojeISO()) {
  const l = bruto || {};
  if (l.tipo === 'tabela') {
    const nome = texto(l.nome);
    const preco = Number(l.preco);
    if (!nome) return { erro: 'Falta o nome do produto.' };
    if (!(preco > 0) || preco > PRECO_MAX) return { erro: `Preço inválido para "${nome}".` };
    return {
      item: {
        tipo: 'tabela',
        chave: texto(l.chave, 400),
        codigo: texto(l.codigo, 30),
        nome,
        unidade: texto(l.unidade, 20).toUpperCase(),
        embalagem: texto(l.embalagem, 60),
        preco: centavos(preco)
      }
    };
  }
  if (l.tipo === 'oferta') {
    const [oferta] = normalizarOfertas([
      { produto: l.produto, variacoes: l.variacoes, preco_oferta: l.preco_oferta, faixas: l.faixas }
    ]);
    if (!texto(l.produto)) return { erro: 'Falta o nome do produto da oferta.' };
    if (!oferta) return { erro: `Preço inválido para a oferta "${texto(l.produto)}".` };
    const v = l.validade || {};
    const inicio = iso(v.inicio) ? v.inicio : br(hoje);
    if (!iso(v.fim)) return { erro: `Falta a data final da oferta "${oferta.produto}".` };
    if (iso(v.fim) < hoje) return { erro: `A oferta "${oferta.produto}" já venceu em ${v.fim}.` };
    if (iso(v.fim) < iso(inicio)) return { erro: `A data final da oferta "${oferta.produto}" é antes da inicial.` };
    return {
      item: { tipo: 'oferta', ...oferta, substitui: texto(l.substitui, 400), validade: { inicio, fim: v.fim } }
    };
  }
  return { erro: 'Tipo de lançamento inválido.' };
}

// Muda ou inclui o produto na tabela. Devolve o que entra no registro ("antes" vazio = produto novo).
function lancarTabela(precos, l) {
  const tabela = precos.tabela && Array.isArray(precos.tabela.itens) ? precos.tabela : { validade: '', itens: [] };
  precos.tabela = tabela;
  const alvo =
    (l.chave && tabela.itens.find(it => chaveTabela(it) === l.chave)) ||
    (l.codigo && tabela.itens.find(it => String(it.codigo) === l.codigo)) ||
    tabela.itens.find(it => it.nome.toUpperCase() === l.nome.toUpperCase() && (it.embalagem || '') === l.embalagem);
  if (alvo) {
    const antes = alvo.preco;
    Object.assign(alvo, {
      preco: l.preco,
      unidade: l.unidade || alvo.unidade,
      embalagem: l.embalagem || alvo.embalagem,
      manual: true
    });
    return { tipo: 'tabela', produto: rotuloTabela(alvo), antes, agora: l.preco };
  }
  const novo = {
    codigo: l.codigo,
    nome: l.nome,
    categoria: 'Lançado no portal',
    unidade: l.unidade,
    embalagem: l.embalagem,
    preco: l.preco,
    manual: true
  };
  tabela.itens.push(novo);
  return { tipo: 'tabela', produto: rotuloTabela(novo), antes: null, agora: l.preco };
}

const rotuloTabela = it => [it.codigo, it.nome, it.embalagem].filter(Boolean).join(' · ');

// Guarda a oferta manual. Se já houver uma manual para o mesmo produto, a nova toma o lugar dela.
function lancarOferta(precos, l, usuario, quando) {
  const lista = (precos.ofertas_manuais || []).filter(o => chaveOferta(o) !== chaveOferta(l));
  const { tipo, ...oferta } = l;
  lista.push({ id: novoId(), ...oferta, criada_em: quando, usuario });
  precos.ofertas_manuais = lista;
  const faixas = l.faixas.map(f => `${f.condicao}: R$ ${String(f.preco.toFixed(2)).replace('.', ',')}`).join(' · ');
  return {
    tipo: 'oferta',
    produto: [l.produto, l.variacoes].filter(Boolean).join(' · '),
    antes: null,
    agora: l.preco_oferta,
    detalhe: [faixas, `${l.validade.inicio} a ${l.validade.fim}`].filter(Boolean).join(' · ')
  };
}

// Tira da lista as ofertas manuais que já venceram (chamado a cada gravação)
const semVencidas = (lista, hoje = hojeISO()) => (lista || []).filter(o => situacao(o.validade, hoje) !== 'vencida');

// Ofertas que o Benjamim enxerga agora: as do PDF + as manuais que estão valendo.
// O n8n confere uma validade só para a lista toda, então:
//   - PDF valendo: fica a validade do PDF, e a oferta manual que termina em outra data leva "válida até" no texto;
//   - PDF vencido: só as manuais, com a validade de hoje até a última data entre elas.
// A oferta manual de um produto que também está no PDF toma o lugar da do PDF.
function ofertasEfetivas(precos, hoje = hojeISO()) {
  const pdf = precos.ofertas && Array.isArray(precos.ofertas.itens) ? precos.ofertas : { validade: null, itens: [] };
  const manuais = (precos.ofertas_manuais || []).filter(o => situacao(o.validade, hoje) === 'vigente');
  if (!manuais.length) return pdf;

  const pdfVale = situacao(pdf.validade, hoje) === 'vigente';
  const trocadas = new Set(manuais.flatMap(o => [o.substitui, chaveOferta(o)]).filter(Boolean));
  const doPdf = pdfVale ? pdf.itens.filter(it => !trocadas.has(chaveOferta(it))) : [];
  const fins = manuais.map(o => iso(o.validade.fim)).sort();
  const validade = pdfVale ? pdf.validade : { inicio: br(hoje), fim: br(fins[fins.length - 1]) };
  const fimGeral = iso(validade.fim);

  const extras = manuais.map(o => {
    const ate = iso(o.validade.fim) !== fimGeral ? `válida até ${o.validade.fim}` : '';
    const item = {
      produto: o.produto,
      variacoes: [o.variacoes, ate].filter(Boolean).join(' · '),
      preco_oferta: o.preco_oferta,
      faixas: o.faixas,
      manual: true
    };
    if (o.preco_de) item.preco_de = o.preco_de;
    return item;
  });
  return { validade, itens: [...doPdf, ...extras] };
}

// O que o /api/dados entrega ao n8n (mesmo formato de sempre)
function precosParaBenjamim(precos, hoje = hojeISO()) {
  const { ofertas_manuais, ...resto } = precos;
  return { ...resto, ofertas: ofertasEfetivas(precos, hoje) };
}

// ---------- Contatos ----------

// Telefone para mostrar: 5543999691796 → +55 43 99969-1796
function telefoneLegivel(n) {
  const d = String(n || '');
  if (!/^55\d{10,11}$/.test(d)) return d;
  const num = d.slice(4);
  return `+55 ${d.slice(2, 4)} ${num.slice(0, num.length - 4)}-${num.slice(-4)}`;
}

// Quem já tem este número (listas em PDF e contatos manuais): [{ vendedor, codigo, razao, manual }]
function donosDoNumero(carteira, numero) {
  const alvo = normTelefone(numero);
  const achados = [];
  for (const [ven, lista] of Object.entries(carteira.vendedores || {})) {
    for (const c of lista.clientes || []) {
      if (c.telefone && normTelefone(c.telefone) === alvo)
        achados.push({ vendedor: ven, codigo: c.codigo, razao: c.razao });
    }
  }
  for (const [ven, lista] of Object.entries(carteira.manuais || {})) {
    for (const c of lista || []) {
      if (normTelefone(c.telefone) === alvo)
        achados.push({ vendedor: ven, codigo: c.codigo, razao: c.razao, manual: true });
    }
  }
  return achados;
}

// Inclui o contato manual. Devolve { contato, avisos } ou { erro }.
function incluirContato(carteira, bruto, usuario, quando) {
  const ven = String((bruto && bruto.vendedor) || '');
  if (!VENDEDORES[ven]) return { erro: 'Escolha o vendedor.' };
  const nome = texto(bruto.nome, 80);
  const estabelecimento = texto(bruto.estabelecimento, 120);
  if (!nome) return { erro: 'Falta o nome do cliente.' };
  const tel = corrigirTelefone(bruto.telefone);
  if (!tel.numero) {
    return {
      erro: String(bruto.telefone || '').replace(/\D/g, '')
        ? 'Esse WhatsApp não parece certo. Digite com DDD, por exemplo (43) 9 9969-1796.'
        : 'Falta o WhatsApp do cliente.'
    };
  }
  const donos = donosDoNumero(carteira, tel.numero);
  const mesmo = donos.find(d => d.vendedor === ven);
  if (mesmo) {
    const onde = mesmo.manual ? 'nos contatos manuais' : `na lista do ${VENDEDORES[ven]} (cliente ${mesmo.codigo})`;
    return { erro: `Esse número já está ${onde}: ${mesmo.razao}.` };
  }
  const avisos = [...new Set(donos.map(d => d.vendedor))].map(
    v =>
      `Esse número também está na carteira do ${VENDEDORES[v] || 'vendedor ' + v}. O Benjamim usa o vendedor do último pedido do cliente.`
  );
  carteira.seq_manual = (carteira.seq_manual || 0) + 1;
  const contato = {
    id: novoId(),
    codigo: 'M' + carteira.seq_manual,
    razao: (estabelecimento || nome).toUpperCase(),
    comprador: nome.toUpperCase(),
    telefone: tel.numero,
    bairro: '',
    cidade: '',
    rota: '',
    dia: '0',
    obs: '',
    manual: true,
    criado_em: quando,
    usuario
  };
  carteira.manuais = carteira.manuais || {};
  carteira.manuais[ven] = [...(carteira.manuais[ven] || []), contato];
  return { contato, avisos, corrigido: tel.situacao === 'corrigido' ? tel.como : '' };
}

function removerContato(carteira, ven, id) {
  const lista = (carteira.manuais && carteira.manuais[ven]) || [];
  const contato = lista.find(c => c.id === id);
  if (!contato) return null;
  carteira.manuais[ven] = lista.filter(c => c.id !== id);
  return contato;
}

// Lista nova em PDF de um vendedor: o contato manual cujo número veio na lista sai da lista manual.
function limparContatosRepetidos(carteira, ven) {
  const lista = (carteira.manuais && carteira.manuais[ven]) || [];
  if (!lista.length) return [];
  const naLista = new Set(
    (((carteira.vendedores || {})[ven] || {}).clientes || []).filter(c => c.telefone).map(c => normTelefone(c.telefone))
  );
  const sairam = lista.filter(c => naLista.has(normTelefone(c.telefone)));
  if (sairam.length) carteira.manuais[ven] = lista.filter(c => !sairam.includes(c));
  return sairam;
}

module.exports = {
  iso,
  br,
  hojeISO,
  situacao,
  validarPreco,
  lancarTabela,
  lancarOferta,
  semVencidas,
  ofertasEfetivas,
  precosParaBenjamim,
  telefoneLegivel,
  incluirContato,
  removerContato,
  limparContatosRepetidos
};
