// GET /api/sessao → { usuario } ou 401      DELETE /api/sessao → sai do portal
const { lerSessao, apagarCookie, json } = require('./_sessao');

module.exports = (req, res) => {
  if (req.method === 'DELETE') return json(res, 200, { ok: true }, { 'Set-Cookie': apagarCookie() });
  try {
    const s = lerSessao(req);
    if (!s) return json(res, 401, { erro: 'Sessão expirada' });
    return json(res, 200, { usuario: s.u, expira: s.exp });
  } catch (e) {
    console.error(e);
    return json(res, 500, { erro: 'Portal não configurado. Avise a Matte.' });
  }
};
