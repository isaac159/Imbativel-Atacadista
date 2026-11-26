// /api/manual (com sessão): aba "Manual" do portal. A lógica fica em _manual.js.
//   GET → produtos da tabela, ofertas do PDF, ofertas manuais, contatos manuais por vendedor e o registro
//   POST { acao: 'precos', itens: [...] }             → lança preços de tabela e ofertas de uma vez
//   POST { acao: 'remover_oferta', id }               → tira uma oferta manual do ar
//   POST { acao: 'contato', vendedor, nome, estabelecimento, telefone } → inclui cliente na carteira do vendedor
//   POST { acao: 'remover_contato', vendedor, id }    → tira o contato manual
// Toda resposta de sucesso traz o estado atualizado da aba (mesmo formato do GET).
const { lerSessao, lerCorpoJson, json } = require('./_sessao');
const { agoraBR } = require('./_leitura');
const { VENDEDORES } = require('./_carteira');
const m = require('./_manual');
const armazem = require('./_armazem');

const MAX_ITENS = 100;
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

async function estado() {
  const [precos, carteira, registro] = await Promise.all([
    armazem.lerPrecos(),
    armazem.lerCarteira(),
    armazem.lerRegistroManual()
  ]);
  const hoje = m.hojeISO();
  const ofertasPdf = precos.ofertas || { validade: null, itens: [] };
  return {
    hoje,
    tabela: ((precos.tabela && precos.tabela.itens) || []).map(it => ({
      codigo: it.codigo,
      nome: it.nome,
      unidade: it.unidade,
      embalagem: it.embalagem,
      preco: it.preco,
      manual: !!it.manual
    })),
    ofertas: {
      validade: ofertasPdf.validade,
      situacao: m.situacao(ofertasPdf.validade, hoje),
      itens: (ofertasPdf.itens || []).map(it => ({
        produto: it.produto,
        variacoes: it.variacoes,
        preco_oferta: it.preco_oferta,
        faixas: it.faixas
      }))
    },
    ofertas_manuais: (precos.ofertas_manuais || [])
      .map(o => ({ ...o, situacao: m.situacao(o.validade, hoje) }))
      .filter(o => o.situacao !== 'vencida'),
    vendedores: Object.entries(VENDEDORES).map(([codigo, nome]) => {
      const lista = (carteira.vendedores || {})[codigo];
      return {
        codigo,
        nome,
        lista_enviada: !!lista,
        total_lista: lista ? lista.total : 0,
        manuais: ((carteira.manuais || {})[codigo] || []).map(c => ({
          id: c.id,
          codigo: c.codigo,
          nome: c.comprador,
          estabelecimento: c.razao !== c.comprador ? c.razao : '',
          telefone: m.telefoneLegivel(c.telefone),
          criado_em: c.criado_em,
          usuario: c.usuario
        }))
      };
    }),
    registro
  };
}

async function lancarPrecos(corpo, sessao, quando) {
  const brutos = Array.isArray(corpo.itens) ? corpo.itens : [];
  if (!brutos.length) return [422, { erro: 'Adicione pelo menos um preço à lista.' }];
  if (brutos.length > MAX_ITENS) return [422, { erro: `Envie no máximo ${MAX_ITENS} lançamentos por vez.` }];

  // confere tudo antes de gravar qualquer coisa
  const itens = [];
  for (const [i, b] of brutos.entries()) {
    const r = m.validarPreco(b);
    if (r.erro) return [422, { erro: `Item ${i + 1}: ${r.erro}`, item: i }];
    itens.push(r.item);
  }

  const precos = await armazem.lerPrecos();
  const novo = { ...precos, tabela: precos.tabela && { ...precos.tabela, itens: [...(precos.tabela.itens || [])] } };
  if (novo.tabela) novo.tabela.itens = novo.tabela.itens.map(it => ({ ...it }));
  novo.ofertas_manuais = m.semVencidas(precos.ofertas_manuais);
  const feitos = itens.map(l =>
    l.tipo === 'tabela' ? m.lancarTabela(novo, l) : m.lancarOferta(novo, l, sessao.u, quando)
  );
  novo.manual_atualizado_em = quando;

  await armazem.gravarPrecos(novo);
  await armazem.registrarManual(feitos.map(f => ({ ...f, em: quando, usuario: sessao.u })));
  const nTab = feitos.filter(f => f.tipo === 'tabela').length;
  const nOf = feitos.length - nTab;
  const partes = [nTab && plural(nTab, 'preço de tabela', 'preços de tabela'), nOf && plural(nOf, 'oferta', 'ofertas')];
  await armazem.registrarEnvio({
    em: quando,
    usuario: sessao.u,
    arquivos: ['Manual: ' + partes.filter(Boolean).join(' e ')]
  });
  console.log(JSON.stringify({ evento: 'manual_precos', usuario: sessao.u, tabela: nTab, ofertas: nOf }));
  return [200, { ok: true, feitos }];
}

async function removerOferta(corpo, sessao, quando) {
  const precos = await armazem.lerPrecos();
  const lista = precos.ofertas_manuais || [];
  const oferta = lista.find(o => o.id === String(corpo.id || ''));
  if (!oferta) return [404, { erro: 'Essa oferta já tinha saído do ar.' }];
  await armazem.gravarPrecos({ ...precos, ofertas_manuais: m.semVencidas(lista.filter(o => o !== oferta)) });
  await armazem.registrarManual([
    {
      tipo: 'remocao',
      produto: `Oferta retirada: ${oferta.produto}`,
      antes: oferta.preco_oferta,
      agora: null,
      em: quando,
      usuario: sessao.u
    }
  ]);
  return [200, { ok: true }];
}

async function incluirContato(corpo, sessao, quando) {
  const carteira = await armazem.lerCarteira();
  const r = m.incluirContato(carteira, corpo, sessao.u, quando);
  if (r.erro) return [422, { erro: r.erro }];
  await armazem.gravarCarteira(carteira);
  const ven = VENDEDORES[corpo.vendedor];
  await armazem.registrarManual([
    {
      tipo: 'contato',
      produto: `${r.contato.comprador} → ${ven}`,
      detalhe: m.telefoneLegivel(r.contato.telefone),
      em: quando,
      usuario: sessao.u
    }
  ]);
  console.log(JSON.stringify({ evento: 'manual_contato', usuario: sessao.u, vendedor: corpo.vendedor }));
  return [
    200,
    {
      ok: true,
      contato: { ...r.contato, telefone: m.telefoneLegivel(r.contato.telefone) },
      avisos: r.avisos,
      corrigido: r.corrigido
    }
  ];
}

async function removerContato(corpo, sessao, quando) {
  const carteira = await armazem.lerCarteira();
  const ven = String(corpo.vendedor || '');
  const contato = m.removerContato(carteira, ven, String(corpo.id || ''));
  if (!contato) return [404, { erro: 'Esse contato já tinha sido tirado.' }];
  await armazem.gravarCarteira(carteira);
  await armazem.registrarManual([
    {
      tipo: 'remocao',
      produto: `Contato retirado: ${contato.comprador} (${VENDEDORES[ven] || ven})`,
      em: quando,
      usuario: sessao.u
    }
  ]);
  return [200, { ok: true }];
}

const ACOES = {
  precos: lancarPrecos,
  remover_oferta: removerOferta,
  contato: incluirContato,
  remover_contato: removerContato
};

module.exports = async (req, res) => {
  let sessao;
  try {
    sessao = lerSessao(req);
  } catch (e) {
    return json(res, 500, { erro: 'Portal não configurado. Avise a Matte.' });
  }
  if (!sessao) return json(res, 401, { erro: 'Sua sessão expirou. Entre de novo.' });

  try {
    if (req.method === 'GET') return json(res, 200, await estado());
    if (req.method !== 'POST') return json(res, 405, { erro: 'Método não permitido' });

    let corpo;
    try {
      corpo = (await lerCorpoJson(req, 512 * 1024)) || {};
    } catch (e) {
      return json(res, 400, { erro: 'Envio inválido.' });
    }
    const acao = ACOES[corpo.acao];
    if (!acao) return json(res, 400, { erro: 'Ação inválida.' });
    const [status, resposta] = await acao(corpo, sessao, agoraBR());
    if (status !== 200) return json(res, status, resposta);
    return json(res, 200, { ...resposta, estado: await estado() });
  } catch (e) {
    console.error(e);
    return json(res, 500, { erro: 'Não consegui salvar agora. Tente de novo em alguns minutos.' });
  }
};
