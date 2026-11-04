// GET /api/resumo  (com sessão) → preços que o Benjamim usa agora + histórico de envios da equipe
const { lerSessao, json } = require('./_sessao');
const { lerPrecos, lerHistorico } = require('./_armazem');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { erro: 'Método não permitido' });
  let sessao;
  try { sessao = lerSessao(req); } catch (e) { return json(res, 500, { erro: 'Portal não configurado. Avise a Matte.' }); }
  if (!sessao) return json(res, 401, { erro: 'Sua sessão expirou. Entre de novo.' });
  try {
    const [precos, historico] = await Promise.all([lerPrecos(), lerHistorico()]);
    return json(res, 200, { precos, historico });
  } catch (e) {
    console.error(e);
    return json(res, 500, { erro: 'Não consegui carregar o resumo agora.' });
  }
};
