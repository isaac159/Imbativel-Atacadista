// POST /api/carteira  → { cadastro_encontrado, cad_nome_contato, cad_vendedor_codigo, cad_dia_rota, ... }
// Quem chama é o fluxo da EZ (nó "10 · Consultar carteira"), no lugar da base que ficava embutida no código do nó.
// Corpo (JSON): { teste_telefone, telefone_consulta, identifier, codigo_cliente, pedido_vendedor_codigo }
// Protegido por chave: cabeçalho  Authorization: Bearer <PORTAL_CHAVE_N8N>  (a mesma chave da consulta de preços)
const { iguais, lerCorpoJson, json } = require('./_sessao');
const { consultarCarteira } = require('./_carteira');
const { lerCarteira } = require('./_armazem');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { erro: 'Método não permitido' });
  const chave = process.env.PORTAL_CHAVE_N8N || '';
  if (chave.length < 24) return json(res, 500, { erro: 'PORTAL_CHAVE_N8N ausente ou curta (mínimo 24 caracteres)' });
  const enviada = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!iguais(enviada, chave)) return json(res, 401, { erro: 'Chave inválida' });

  let corpo;
  try { corpo = await lerCorpoJson(req, 64 * 1024); } catch (e) { return json(res, 400, { erro: 'Corpo inválido' }); }
  try {
    const carteira = await lerCarteira();
    // nenhuma lista enviada ainda: responde erro para o fluxo seguir pelo caminho "carteira indisponível"
    if (!Object.keys(carteira.vendedores || {}).length) return json(res, 503, { erro: 'Nenhuma lista de clientes enviada ainda' });
    return json(res, 200, consultarCarteira(carteira, corpo || {}));
  } catch (e) {
    console.error(e);
    return json(res, 500, { erro: 'Não consegui consultar a carteira agora' });
  }
};
