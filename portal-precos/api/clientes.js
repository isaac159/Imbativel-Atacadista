// /api/clientes (com sessão): carteira de clientes de cada vendedor
//   GET  → resumo de cada vendedor (quantos clientes, quando foi atualizada, o que mudou, telefones com problema)
//   POST { vendedor, arquivo, linhas } → troca a lista daquele vendedor pela do PDF enviado
// O painel extrai do PDF "LISTA DE CLIENTES" as linhas com a posição de cada palavra; a leitura fica em _carteira.js.
const { lerSessao, lerCorpoJson, json } = require('./_sessao');
const { agoraBR } = require('./_leitura');
const { VENDEDORES, lerListaClientes, compararCarteira, telefonesComProblema, enxuto } = require('./_carteira');
const { lerCarteira, gravarCarteira, registrarEnvio } = require('./_armazem');

const MAX_LISTA = 200; // quantos itens de cada lista (novos, saíram, mudaram, problemas) ficam guardados

function resumo(carteira) {
  return Object.entries(VENDEDORES).map(([codigo, nome]) => {
    const v = carteira.vendedores[codigo];
    if (!v) return { codigo, nome, enviada: false };
    const { clientes, ...info } = v;
    return { codigo, nome, enviada: true, ...info, com_telefone: clientes.filter(c => c.telefone).length };
  });
}

module.exports = async (req, res) => {
  let sessao;
  try { sessao = lerSessao(req); } catch (e) { return json(res, 500, { erro: 'Portal não configurado. Avise a Matte.' }); }
  if (!sessao) return json(res, 401, { erro: 'Sua sessão expirou. Entre de novo.' });

  try {
    if (req.method === 'GET') return json(res, 200, { vendedores: resumo(await lerCarteira()) });
    if (req.method !== 'POST') return json(res, 405, { erro: 'Método não permitido' });

    let corpo;
    try { corpo = await lerCorpoJson(req, 4 * 1024 * 1024); } catch (e) { return json(res, 400, { erro: 'Envio inválido.' }); }
    const ven = String((corpo && corpo.vendedor) || '');
    if (!VENDEDORES[ven]) return json(res, 400, { erro: 'Vendedor inválido.' });
    const nome = VENDEDORES[ven];

    const r = lerListaClientes(Array.isArray(corpo.linhas) ? corpo.linhas.slice(0, 60000) : []);
    if (!r.clientes.length) return json(res, 422, { erro: 'Não achei clientes nesse PDF. Confira se é a LISTA DE CLIENTES do sistema, no modelo de sempre.' });

    // o PDF tem que ser deste vendedor (coluna VEN)
    const cont = {};
    for (const c of r.clientes) if (c.vendedor) cont[c.vendedor] = (cont[c.vendedor] || 0) + 1;
    const [principal] = Object.entries(cont).sort((a, b) => b[1] - a[1]);
    if (!principal || principal[0] !== ven) {
      const outro = principal && VENDEDORES[principal[0]] ? ` Ela é do ${VENDEDORES[principal[0]]} (${principal[0]}).` : '';
      return json(res, 422, { erro: `Essa lista não é da carteira do ${nome} (${ven}).${outro} Envie no quadro certo.` });
    }

    const avisos = [];
    const doVendedor = r.clientes.filter(c => c.vendedor === ven);
    if (doVendedor.length < r.clientes.length) avisos.push(`${r.clientes.length - doVendedor.length} clientes da lista são de outro vendedor e ficaram de fora.`);
    if (r.total_rodape != null && r.total_rodape !== r.clientes.length) avisos.push(`O rodapé do PDF diz ${r.total_rodape} clientes e eu li ${r.clientes.length}. Confira se o PDF está completo.`);

    const carteira = await lerCarteira();
    const antes = carteira.vendedores[ven];
    if (antes && doVendedor.length < antes.total * 0.5) avisos.push(`A lista nova tem ${doVendedor.length} clientes e a anterior tinha ${antes.total}. Confira se é a lista completa.`);

    const clientes = doVendedor.map(enxuto);
    const mud = compararCarteira(antes && antes.clientes, clientes);
    const problemas = telefonesComProblema(doVendedor);
    const quando = agoraBR();
    const corta = l => l.slice(0, MAX_LISTA);
    const mudancas = antes
      ? { novos: corta(mud.novos), sairam: corta(mud.sairam), mudaram: corta(mud.mudaram), n_novos: mud.novos.length, n_sairam: mud.sairam.length, n_mudaram: mud.mudaram.length }
      : null;

    carteira.vendedores[ven] = {
      clientes, total: clientes.length, data_lista: r.data_lista, arquivo: String(corpo.arquivo || 'lista.pdf').slice(0, 120),
      atualizada_em: quando, usuario: sessao.u, mudancas, problemas: corta(problemas), n_problemas: problemas.length, avisos
    };
    await gravarCarteira(carteira);
    await registrarEnvio({ em: quando, usuario: sessao.u, arquivos: [`Clientes ${nome} (${clientes.length})`],
      carteira: { vendedor: ven, total: clientes.length, n_novos: mud.novos.length, n_sairam: mud.sairam.length, n_mudaram: mud.mudaram.length }, avisos });
    console.log(JSON.stringify({ evento: 'carteira_atualizada', usuario: sessao.u, vendedor: ven, clientes: clientes.length }));

    const [atual] = resumo(carteira).filter(v => v.codigo === ven);
    return json(res, 200, { ok: true, vendedor: atual });
  } catch (e) {
    console.error(e);
    return json(res, 500, { erro: 'Não consegui salvar agora. Tente de novo em alguns minutos.' });
  }
};
