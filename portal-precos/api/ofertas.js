// POST /api/ofertas (com sessão): lê o PDF de ofertas antes de salvar. O painel chama em duas etapas:
//   { acao: 'regras', texto }  → leitores por regra (instantâneo). Responde se a leitura é confiável
//                                e se a IA está disponível para quando não for.
//   { acao: 'ia', paginas: [{numero, texto}] } → leitura por IA de algumas páginas (o painel manda em lotes).
// Quem grava é o /api/atualizar, com as ofertas já lidas.
const { lerSessao, lerCorpoJson, json } = require('./_sessao');
const { lerOfertas, leituraConfiavel } = require('./_leitura');
const { iaDisponivel, lerOfertasComIA } = require('./_ia');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { erro: 'Método não permitido' });
  let sessao;
  try { sessao = lerSessao(req); } catch (e) { return json(res, 500, { erro: 'Portal não configurado. Avise a Matte.' }); }
  if (!sessao) return json(res, 401, { erro: 'Sua sessão expirou. Entre de novo.' });

  let corpo;
  try { corpo = await lerCorpoJson(req, 4 * 1024 * 1024); } catch (e) { return json(res, 400, { erro: 'Envio inválido.' }); }

  if (corpo && corpo.acao === 'regras') {
    const r = lerOfertas(corpo.texto);
    return json(res, 200, { confiavel: leituraConfiavel(r), itens: r.itens, validade: r.validade, blocos_de_preco: r.blocos_de_preco, ia_disponivel: iaDisponivel() });
  }

  if (corpo && corpo.acao === 'ia') {
    if (!iaDisponivel()) return json(res, 503, { erro: 'A leitura por IA não está ligada (falta ANTHROPIC_API_KEY na Vercel). Avise a Matte.' });
    const paginas = (Array.isArray(corpo.paginas) ? corpo.paginas : []).slice(0, 6)
      .map(p => ({ numero: Number(p && p.numero) || 0, texto: String((p && p.texto) || '').slice(0, 60000) }))
      .filter(p => p.texto.trim());
    if (!paginas.length) return json(res, 200, { itens: [], validade: null });
    try {
      return json(res, 200, await lerOfertasComIA(paginas));
    } catch (e) {
      console.error('ofertas_ia', e && e.status, e && e.message);
      return json(res, 502, { erro: 'A leitura por IA falhou nestas páginas. Tente de novo em alguns minutos.' });
    }
  }

  return json(res, 400, { erro: 'Ação inválida.' });
};
