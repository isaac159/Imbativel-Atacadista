// Nó: Executar script "Montar ficha". Roda em dois pontos do fluxo:
//   nó 62 (registrar_cadastro): dados do cadastro em {{input}} (argumentos da função), ainda sem pedido
//   nó 57 (confirmar_previa, contato fora da carteira): {{input}} traz só a confirmação; os dados vêm de {{user.*}} (gravados no nó 60)
// Monta a ficha de novo cliente (modelo da seção 07 do briefing, chaves sem acento) e decide o responsável pelo VALOR do pedido.
// Depois dele: Salvar no fluxo  ficha_texto · responsavel_encaminhamento · destino   (= {{input.<mesmo nome>}})
// Regra do cliente (atualização de 27/10): pedido acima de R$ 10.000,00 → Pablo Chaves (gerência) · até R$ 10.000,00 → Pedro
//   exatamente 10.000,00 fica com Pedro ("acima de" é estrito, como no mínimo de bar). Sem pedido confirmado: Pedro
async (input, user, flow, env) => {
  const t = v => String(v === undefined || v === null ? '' : v).trim();
  const ou = (v, alt = 'não informado') => t(v) || alt;
  const campo = k => t(input[k]) || t(user[k]);
  const LIMITE = 10000;

  const status = t(user.pedido_status);
  const confirmado = status === 'confirmado_cliente';
  const total = parseFloat(t(user.pedido_total)) || 0;
  const paraPablo = confirmado && total > LIMITE;
  const responsavel = !confirmado ? 'definido pelo valor do pedido (acima de R$ 10 mil Pablo, até R$ 10 mil Pedro)'
    : paraPablo ? 'Pablo Chaves (gerência comercial)' : 'Pedro (atendimento inicial)';

  const faltando = [];
  for (const [k, rotulo] of [['estabelecimento', 'nome do estabelecimento'], ['cnpj', 'CNPJ'], ['cep', 'CEP'], ['endereco', 'endereço'], ['email', 'e-mail']]) {
    if (!campo(k)) faltando.push(rotulo);
  }
  const docs = [campo('documentos_pendentes'), faltando.length ? `faltou coletar ${faltando.join(', ')}` : '']
    .filter(Boolean).join('; ') || 'nenhum';

  const pedido = status === 'aguardando_confirmacao' || confirmado
    ? `\n\n🧾 Pedido ${confirmado ? 'confirmado pelo cliente' : 'em montagem'} (${ou(user.pedido_total_fmt, 'sem total')})\n${t(user.pedido_previa_texto)}` : '';

  const ficha = [
    confirmado ? '📋 NOVO CLIENTE COM PEDIDO' : '📋 FICHA DE NOVO CLIENTE (cadastro feito, ainda sem pedido)',
    `Nome: ${ou(campo('nome_contato'))}`,
    `Estabelecimento: ${ou(campo('estabelecimento'))}`,
    `Segmento: ${ou(campo('segmento'))}`,
    `Pessoa física/jurídica: ${ou(campo('tipo_pessoa'))}`,
    `CNPJ: ${ou(campo('cnpj'))}`,
    `Cidade/UF: ${ou(campo('cidade'))}/${ou(campo('uf'), '?')}`,
    `CEP: ${ou(campo('cep'))}`,
    `Endereço: ${ou(campo('endereco'))}`,
    `Ponto de referência: ${ou(campo('ponto_referencia'), '')}`,
    `Telefone: ${ou(flow.telefone || user.identifier)}`,
    `E-mail: ${ou(campo('email'))}`,
    `Origem do contato: ${ou(campo('origem_contato') || flow.origem)}`,
    `Modalidade: ${ou(campo('modalidade'))}`,
    `Produtos de interesse: ${ou(campo('produtos_interesse'))}`,
    `Volume estimado: ${ou(campo('volume_estimado'))}`,
    `Situação de elegibilidade: ${ou(campo('situacao_elegibilidade'))}`,
    `Documentos pendentes: ${docs}`,
    `Responsável pelo encaminhamento: ${responsavel}`,
    `Resumo da conversa: ${ou(t(input.resumo) || campo('resumo_atendimento'))}`
  ].join('\n') + pedido;

  return {
    ficha_texto: ficha.slice(0, 2000), // Observação aceita 2.048 caracteres
    responsavel_encaminhamento: responsavel,
    destino: paraPablo ? 'pablo' : 'pedro'
  };
}
