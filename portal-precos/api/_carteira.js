// Carteira de clientes dos vendedores: leitura da LISTA DE CLIENTES (PDF do sistema da Imbatível)
// e a consulta que o fluxo da EZ faz pelo telefone do contato (antes ficava embutida no nó 10 do fluxo).
//
// O PDF é um relatório em colunas. O navegador manda cada linha como [[x, texto], ...] (x = posição na página),
// e aqui cada palavra vai para a sua coluna pela posição. Cada cliente ocupa 4 ou 5 linhas:
//   1  CLIEN | RAZAO SOCIAL | CANAL | EMP
//   2  ENDERECO | BAIRRO | CEP | EXCL | ESP
//   3  CIDADE | UF | COMPRADOR | FONE | ANIVER.
//   4  CGC | INSCRICAO EST. | VEN | ROTA | SEQ-VI | SEQ-EN | FREQ.
//   5  (opcional) observação ... TAB: 99 A VISTA

// Vendedor novo: incluir aqui e criar o caminho dele nos nós 15b e V5 do fluxo da EZ.
const VENDEDORES = { '4': 'Pedro', '8': 'Leonardo', '13': 'Cléber', '30': 'Lucas', '40': 'Alessandro' };
const DIAS = { '2': 'segunda-feira', '3': 'terça-feira', '4': 'quarta-feira', '5': 'quinta-feira', '6': 'sexta-feira' };

const CABECALHO = /^(IMBATIVEL\s+ATACADISTA|CLIEN\s+RAZAO|ENDERECO\s+BAIRRO|CIDADE\s+UF\s+COMPRADOR|CGC\s+INSCRICAO)/;

// Junta as palavras de uma linha que caem entre as posições ini e fim
const faixa = (linha, ini, fim) => linha.filter(([x]) => x >= ini && x < fim).map(([, s]) => s).join(' ').replace(/\s+/g, ' ').trim();
const texto = linha => linha.map(([, s]) => s).join(' ');

function lerListaClientes(linhas) {
  const ls = (linhas || [])
    .filter(l => Array.isArray(l) && l.length)
    .map(l => l.filter(p => Array.isArray(p) && p.length === 2 && String(p[1]).trim()).map(([x, s]) => [Number(x) || 0, String(s).trim()]).sort((a, b) => a[0] - b[0]))
    .filter(l => l.length);
  let dataLista = '', totalRodape = null;
  const clientes = [];
  let atual = null;
  const fechar = () => { if (atual) clientes.push(montar(atual)); atual = null; };

  for (const l of ls) {
    const t = texto(l);
    if (CABECALHO.test(t)) {
      if (!dataLista) { const m = t.match(/\b(\d{2}\/\d{2}\/\d{2,4})\b/); if (m) dataLista = m[1]; }
      continue;
    }
    // rodapé "257 CLIENTES LISTADOS": confere se nenhum cliente ficou de fora
    const rod = t.match(/^(\d+)\s+CLIENTES\s+LISTADOS/i);
    if (rod) { fechar(); totalRodape = +rod[1]; continue; }
    // linha 1: código do cliente encostado na margem
    if (l[0][0] < 50 && /^\d+$/.test(l[0][1])) { fechar(); atual = { l1: l, resto: [] }; continue; }
    if (atual) atual.resto.push(l);
  }
  fechar();
  return { data_lista: dataLista, total_rodape: totalRodape, clientes: clientes.filter(c => c.codigo) };
}

function montar({ l1, resto }) {
  const obs = resto.find(l => l.some(([, s]) => s === 'TAB:'));
  const [l2, l3, l4] = resto.filter(l => l !== obs);
  const c = { codigo: l1[0][1], razao: faixa(l1, 50, 270), canal: faixa(l1, 270, 450) };
  if (l2) { c.endereco = faixa(l2, 50, 270); c.bairro = faixa(l2, 270, 405); }
  if (l3) {
    c.cidade = faixa(l3, 50, 235);
    c.uf = faixa(l3, 235, 270);
    c.comprador = faixa(l3, 270, 385);
    c.telefone = faixa(l3, 385, 488).replace(/\D/g, '');
  }
  if (l4) {
    c.vendedor = faixa(l4, 330, 366).replace(/\D/g, '');
    c.rota = faixa(l4, 366, 405).replace(/\D/g, '');
  }
  const dia = String(c.rota || '').slice(-1);
  c.dia = DIAS[dia] ? dia : '0';
  if (obs) { const i = obs.findIndex(([, s]) => s === 'TAB:'); c.obs = obs.slice(0, i).map(([, s]) => s).join(' ').trim(); }
  return c;
}

// Telefone no formato 55 + DDD + número (com o 9 dos celulares)
function normTelefone(t) {
  let d = String(t || '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) d = '55' + d;
  if (d.length === 12 && d.startsWith('55') && /[6-9]/.test(d[4])) d = d.slice(0, 4) + '9' + d.slice(4);
  return d;
}

// ---------- Autocorreção do telefone do cadastro ----------
// O cadastro da Imbatível tem muitos telefones digitados fora do padrão. Aqui cada um vira o formato do WhatsApp
// (55 + DDD + 9 + 8 dígitos no celular; 55 + DDD + 8 dígitos no fixo) quando só existe UMA leitura possível.
// Quando há mais de uma leitura (ex.: "84 086 7033"), não chuta: um número errado poderia ser o WhatsApp de outra pessoa.
const DDD_PADRAO = '43'; // a carteira é da região de Londrina
const DDDS = new Set(('11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 '
  + '61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99').split(' '));

// número (sem DDD) válido: celular 9 + 8 dígitos, ou fixo [2-5] + 7 dígitos; sem número de mentira (9999 9999)
const numeroValido = n => (/^9[1-9]\d{7}$/.test(n) || /^[2-5]\d{7}$/.test(n)) && !/^(\d)\1+$/.test(n.slice(-8));

// DDD + número (10 ou 11 dígitos) → 55+DDD+número, com o 9 nos celulares antigos de 8 dígitos; '' se não for válido
function montarNumero(d) {
  if (d.length !== 10 && d.length !== 11) return '';
  const ddd = d.slice(0, 2);
  let n = d.slice(2);
  if (!DDDS.has(ddd)) return '';
  if (n.length === 8 && /^[6-9]/.test(n)) n = '9' + n; // celular antigo, sem o 9
  return numeroValido(n) ? '55' + ddd + n : '';
}

// { numero: '5543999691796' | '', situacao: 'ok' | 'corrigido' | 'sem_telefone' | 'sem_conserto', como: texto da correção }
function corrigirTelefone(bruto) {
  let d = String(bruto || '').replace(/\D/g, '');
  if (!d || /^0+$/.test(d) || /^(\d)\1+$/.test(d)) return { numero: '', situacao: 'sem_telefone', como: '' };
  const original = d;
  // prefixos que não são parte do número: 0 de discagem, 0 + operadora (015, 021…), 55 duplicado
  if (/^0\d{2}\d{10,11}$/.test(d)) d = d.slice(3);           // 0 + operadora + DDD + número
  else if (/^0\d{10,11}$/.test(d)) d = d.slice(1);          // 0 + DDD + número
  if (/^55\d{10,11}$/.test(d)) d = d.slice(2);              // já vinha com 55
  const opcoes = [];
  const tenta = (cand, como) => { const n = montarNumero(cand); if (n && !opcoes.some(o => o.numero === n)) opcoes.push({ numero: n, como }); };
  if (d.length === 10 || d.length === 11) tenta(d, 'formato');
  else if (d.length === 8 || (d.length === 9 && d[0] === '9')) tenta(DDD_PADRAO + d, 'DDD 43 incluído');
  else if (d.length === 9 && d[0] === DDD_PADRAO[0] && /[6-9]/.test(d[1])) tenta(DDD_PADRAO + d.slice(1), 'DDD 43 completado');
  if (opcoes.length !== 1) return { numero: '', situacao: d.length ? 'sem_conserto' : 'sem_telefone', como: '' };
  // pôr o 55 e o 9 do celular é só o formato do WhatsApp (o sistema guarda DDD + 8 dígitos); correção é completar o DDD
  const como = opcoes[0].como === 'formato' ? '' : opcoes[0].como;
  return { numero: opcoes[0].numero, situacao: como ? 'corrigido' : 'ok', como, original };
}

const telefoneDaLista = bruto => corrigirTelefone(bruto).numero;

// Telefones que foram corrigidos sozinhos e os que ficaram sem conserto (aparecem no quadro do vendedor)
function analisarTelefones(clientes) {
  const corrigidos = [], semConserto = [];
  for (const c of clientes || []) {
    const r = corrigirTelefone(c.telefone);
    const base = { codigo: c.codigo, razao: c.razao, telefone: String(c.telefone || '').replace(/\D/g, '') };
    if (r.situacao === 'corrigido') corrigidos.push({ ...base, numero: r.numero, como: r.como });
    else if (r.situacao !== 'ok') semConserto.push({ ...base, motivo: r.situacao === 'sem_telefone' ? 'sem telefone' : 'telefone incompleto' });
  }
  return { corrigidos, semConserto };
}
// compatibilidade: só os que o Benjamim não reconhece
const telefonesComProblema = clientes => analisarTelefones(clientes).semConserto;

// Valor vindo da EZ: variável vazia às vezes chega como "{{user.x}}" literal
const limpo = v => String(v == null ? '' : v).replace(/\{\{.*?\}\}/g, '').trim();
const titulo = s => String(s || '').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
const nomeVen = v => VENDEDORES[v] || 'Vendedor ' + v;

// Mesma resposta que o nó 10 do fluxo devolvia (cadastro_encontrado, cad_*), agora com a carteira vinda do portal.
// p = { teste_telefone, telefone_consulta, identifier, codigo_cliente, pedido_vendedor_codigo }
function consultarCarteira(carteira, p) {
  const tinhaCarteira = !!limpo(p.codigo_cliente);
  const vazio = { cadastro_encontrado: 'nao', cad_nome_contato: '', cad_estabelecimento: '', cad_segmento: '', cad_cidade: '', cad_uf: '',
    cad_vendedor_codigo: '', cad_vendedor_nome: '', cad_modalidade: '', cad_ativo: '', cad_dia_rota: '', cad_codigo_cliente: '',
    cad_bairro: '', cad_rota: '', cad_cadastros_vinculados: '', cad_vinculados_json: '', cad_limpar: tinhaCarteira ? 'sim' : 'nao' };

  const alvo = normTelefone(limpo(p.teste_telefone) || limpo(p.telefone_consulta) || limpo(p.identifier));
  if (!alvo) return vazio;
  const achados = [];
  for (const [ven, lista] of Object.entries((carteira && carteira.vendedores) || {})) {
    for (const c of lista.clientes || []) {
      if (!c.telefone || normTelefone(c.telefone) !== alvo) continue;
      if (!achados.some(a => a.codigo === c.codigo && a.ven === ven)) {
        achados.push({ codigo: c.codigo, razao: c.razao, bairro: c.bairro || '', comprador: c.comprador || '', ven, rota: c.rota || '', dia: c.dia || '0',
          cidade: c.cidade || '', fantasia: c.obs || '' });
      }
    }
  }
  if (!achados.length) return vazio;

  const vends = [...new Set(achados.map(a => a.ven))];
  // número com mais de um vendedor: usa o vendedor do estabelecimento escolhido no último pedido, se for um deles
  const pedVen = limpo(p.pedido_vendedor_codigo);
  const escolhido = vends.length > 1 && vends.includes(pedVen) ? pedVen : '';
  const doVendedor = escolhido ? achados.filter(a => a.ven === escolhido) : achados;
  const p0 = doVendedor[0];
  const vendedor = vends.length === 1 ? vends[0] : escolhido;
  const dias = [...new Set(doVendedor.map(a => a.dia))];
  const ddd = alvo.slice(2, 4);
  const vinculados = achados.length > 1
    ? achados.map(a => `${a.codigo} ${a.razao}${a.fantasia && !/^(abre|fecha|recebe|entrega|apos|após)/i.test(a.fantasia) ? ' (' + a.fantasia + ')' : ''} (${titulo(a.bairro)}, ${titulo(a.cidade)}, vendedor ${nomeVen(a.ven)}, rota ${DIAS[a.dia] || 'a conferir'})`).join('; ')
    : '';
  return {
    cadastro_encontrado: 'sim',
    cad_nome_contato: titulo(p0.comprador),
    cad_estabelecimento: achados.length > 1 ? achados.map(a => a.razao).join(' / ') : p0.razao,
    cad_segmento: '',
    cad_cidade: titulo(p0.cidade),
    cad_uf: /^4[1-6]$/.test(ddd) ? 'PR' : '',
    cad_vendedor_codigo: vendedor,
    cad_vendedor_nome: vendedor ? nomeVen(vendedor) : '',
    cad_modalidade: '',
    cad_ativo: 'sim',
    cad_dia_rota: vendedor && dias.length === 1 ? (DIAS[dias[0]] || '') : '',
    cad_codigo_cliente: achados.map(a => a.codigo).join(', '),
    cad_bairro: titulo(p0.bairro),
    cad_rota: [...new Set(achados.map(a => a.rota))].join(', '),
    cad_cadastros_vinculados: vinculados,
    cad_vinculados_json: achados.length > 1 ? JSON.stringify(achados.map(a => ({ codigo: a.codigo, razao: a.razao, fantasia: a.fantasia, ven: a.ven, dia: a.dia }))) : '',
    cad_limpar: 'nao'
  };
}

// O que mudou na carteira de um vendedor entre duas listas
function compararCarteira(antes, depois) {
  const mapa = new Map((antes || []).map(c => [c.codigo, c]));
  const vistos = new Set();
  const novos = [], mudaram = [];
  for (const c of depois || []) {
    vistos.add(c.codigo);
    const v = mapa.get(c.codigo);
    if (!v) { novos.push({ codigo: c.codigo, razao: c.razao, cidade: c.cidade }); continue; }
    const mud = [];
    if ((v.dia || '') !== (c.dia || '')) mud.push(`rota: ${DIAS[v.dia] || 'a conferir'} → ${DIAS[c.dia] || 'a conferir'}`);
    if (normTelefone(v.telefone) !== normTelefone(c.telefone)) mud.push('telefone');
    if (mud.length) mudaram.push({ codigo: c.codigo, razao: c.razao, mudancas: mud.join(', ') });
  }
  const sairam = [...mapa.values()].filter(c => !vistos.has(c.codigo)).map(c => ({ codigo: c.codigo, razao: c.razao, cidade: c.cidade }));
  return { novos, sairam, mudaram };
}

// Só o que a consulta e o resumo usam (CPF/CNPJ, inscrição e aniversário não ficam guardados)
// O telefone fica já no formato do WhatsApp (55+DDD+número), ou vazio se o cadastro não tiver um válido.
const enxuto = c => ({ codigo: c.codigo, razao: c.razao, bairro: c.bairro || '', cidade: c.cidade || '', comprador: c.comprador || '',
  telefone: telefoneDaLista(c.telefone), rota: c.rota || '', dia: c.dia || '0', obs: c.obs || '' });

module.exports = { VENDEDORES, DIAS, lerListaClientes, consultarCarteira, compararCarteira, normTelefone, corrigirTelefone, telefoneDaLista,
  analisarTelefones, telefonesComProblema, enxuto };
