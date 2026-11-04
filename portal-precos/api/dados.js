// GET /api/dados  → {tabela, ofertas, tabela_atualizada_em, ofertas_atualizadas_em}
// Quem chama é o n8n, no fluxo "Consulta de preços (EZ)", a cada pergunta de preço do Benjamim.
// Protegido por chave: cabeçalho  Authorization: Bearer <PORTAL_CHAVE_N8N>
const { iguais, json } = require('./_sessao');
const { lerPrecos } = require('./_armazem');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { erro: 'Método não permitido' });
  const chave = process.env.PORTAL_CHAVE_N8N || '';
  if (chave.length < 24) return json(res, 500, { erro: 'PORTAL_CHAVE_N8N ausente ou curta (mínimo 24 caracteres)' });
  const enviada = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!iguais(enviada, chave)) return json(res, 401, { erro: 'Chave inválida' });
  try {
    return json(res, 200, await lerPrecos());
  } catch (e) {
    console.error(e);
    return json(res, 500, { erro: 'Não consegui ler os preços agora' });
  }
};
