// Nó: Executar script "Normalizar cadastro" (saída Sucesso 2XX da Requisição API "Consultar carteira")
// Lê {{input.body}} da API (contrato em integracao/contrato-consulta-cliente.md) e devolve campos planos, nunca undefined.
// Depois dele: Salvar no fluxo  cadastro_encontrado = {{input.cadastro_encontrado}} e os campos cad_* abaixo
//   (Salvar no usuário só acontece no ramo cadastro_encontrado = sim, para não apagar dados de conversas anteriores)
async (input, user, flow, env) => {
  let body = input && input.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const s = v => (v === undefined || v === null) ? '' : String(v).trim();
  const encontrado = body.encontrado === true || s(body.encontrado).toLowerCase() === 'sim' || s(body.encontrado) === 'true';
  if (!encontrado) {
    return { cadastro_encontrado: 'nao', cad_nome_contato: '', cad_estabelecimento: '', cad_segmento: '', cad_cidade: '',
      cad_uf: '', cad_vendedor_codigo: '', cad_vendedor_nome: '', cad_modalidade: '', cad_ativo: '', cad_dia_rota: '' };
  }
  return {
    cadastro_encontrado: 'sim',
    cad_nome_contato: s(body.nome_contato),
    cad_estabelecimento: s(body.estabelecimento),
    cad_segmento: s(body.segmento),
    cad_cidade: s(body.cidade),
    cad_uf: s(body.uf).toUpperCase(),
    cad_vendedor_codigo: s(body.vendedor_codigo).toUpperCase(),
    cad_vendedor_nome: s(body.vendedor_nome),
    cad_modalidade: s(body.modalidade_preferida),
    cad_ativo: body.ativo === false ? 'nao' : 'sim',
    cad_dia_rota: s(body.dia_rota).toLowerCase() // ex.: terça (o cliente cadastrado fica sempre no vendedor e na rota vinculados)
  };
}
