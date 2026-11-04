// POST /api/login  { usuario, senha }  → cookie de sessão
const { conferirLogin, criarCookie, json } = require('./_sessao');

async function lerJson(req) {
  if (req.body && typeof req.body === 'object') return req.body; // Vercel já interpretou
  const partes = [];
  for await (const p of req) partes.push(p);
  try { return JSON.parse(Buffer.concat(partes).toString('utf8') || '{}'); } catch (e) { return {}; }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { erro: 'Método não permitido' });
  try {
    const { usuario, senha } = await lerJson(req);
    const ok = conferirLogin(usuario, senha);
    if (!ok) {
      await new Promise(r => setTimeout(r, 600)); // freia tentativa em série
      return json(res, 401, { erro: 'Usuário ou senha incorretos.' });
    }
    return json(res, 200, { usuario: ok }, { 'Set-Cookie': criarCookie(ok) });
  } catch (e) {
    console.error(e);
    return json(res, 500, { erro: 'Portal não configurado. Avise a Matte.' });
  }
};
