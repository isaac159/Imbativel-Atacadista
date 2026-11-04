// POST /api/atualizar  (JSON)  { ofertas?: {arquivo, texto}, tabela?: {arquivo, linhas} }
// O painel extrai no navegador o texto do PDF e as linhas da planilha (assim o PDF pesado não precisa subir)
// e manda só isso. Aqui o texto vira ofertas/tabela, é comparado com o que havia e passa a valer para o Benjamim.
const { lerSessao, lerCorpoJson, json } = require('./_sessao');
const { lerOfertas, lerTabela, compararTabela, compararOfertas, agoraBR } = require('./_leitura');
const { lerPrecos, gravarPrecos, registrarEnvio } = require('./_armazem');

const MAX_LISTA = 300; // quantos itens de cada lista de mudanças ficam guardados no histórico

function dataISO(s) { const m = String(s || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; }
function cortar(c) { return { ...c, mudaram: c.mudaram.slice(0, MAX_LISTA), novos: c.novos.slice(0, MAX_LISTA), sairam: c.sairam.slice(0, MAX_LISTA) }; }

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { erro: 'Método não permitido' });

  let sessao;
  try { sessao = lerSessao(req); } catch (e) { return json(res, 500, { erro: 'Portal não configurado. Avise a Matte.' }); }
  if (!sessao) return json(res, 401, { erro: 'Sua sessão expirou. Entre de novo.' });

  let corpo;
  try { corpo = await lerCorpoJson(req, 4 * 1024 * 1024); } catch (e) { return json(res, 400, { erro: 'Envio inválido.' }); }
  const { ofertas: envOf, tabela: envTb } = corpo || {};
  if (!envOf && !envTb) return json(res, 400, { erro: 'Escolha pelo menos um arquivo.' });

  try {
    const atual = await lerPrecos();
    const novo = { ...atual };
    const quando = agoraBR();
    const registro = { em: quando, usuario: sessao.u, arquivos: [] };
    const avisos = [];

    if (envOf) {
      const r = lerOfertas(envOf.texto);
      if (!r.itens.length) return json(res, 422, { erro: 'Não achei ofertas nesse PDF. Confira se é o PDF de ofertas no modelo de sempre.' });
      if (!r.validade) avisos.push('Não achei a validade no PDF. O Benjamim só oferece promoções com validade, então confira o arquivo.');
      else if (dataISO(r.validade.fim) < quando.slice(0, 10)) avisos.push(`As ofertas desse PDF venceram em ${r.validade.fim}. O Benjamim não vai oferecê-las.`);
      const c = compararOfertas(atual.ofertas && atual.ofertas.itens, r.itens);
      novo.ofertas = r;
      novo.ofertas_atualizadas_em = quando;
      registro.arquivos.push(String(envOf.arquivo || 'ofertas.pdf').slice(0, 120));
      registro.ofertas = { total: r.itens.length, validade: r.validade, ...cortar(c) };
    }

    if (envTb) {
      const r = lerTabela(Array.isArray(envTb.linhas) ? envTb.linhas.slice(0, 20000) : []);
      if (!r.itens.length) return json(res, 422, { erro: 'Não achei produtos na planilha. ' + (r.erro || 'Confira se tem as colunas Nome do Item e Preço.') });
      const antes = (atual.tabela && atual.tabela.itens || []).length;
      if (antes && r.itens.length < antes * 0.5) avisos.push(`A tabela nova tem ${r.itens.length} produtos e a anterior tinha ${antes}. Confira se é a planilha completa.`);
      const c = compararTabela(atual.tabela && atual.tabela.itens, r.itens);
      novo.tabela = r;
      novo.tabela_atualizada_em = quando;
      registro.arquivos.push(String(envTb.arquivo || 'tabela.xlsx').slice(0, 120));
      registro.tabela = { total: r.itens.length, validade: r.validade, ...cortar(c) };
    }

    await gravarPrecos(novo);
    registro.avisos = avisos;
    await registrarEnvio(registro);
    console.log(JSON.stringify({ evento: 'precos_atualizados', usuario: sessao.u, arquivos: registro.arquivos,
      ofertas: registro.ofertas && registro.ofertas.total, tabela: registro.tabela && registro.tabela.total }));
    return json(res, 200, { ok: true, registro });
  } catch (e) {
    console.error(e);
    return json(res, 500, { erro: 'Não consegui salvar agora. Tente de novo em alguns minutos.' });
  }
};
