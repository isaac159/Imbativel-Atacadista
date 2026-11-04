// Nó: Executar script "Montar aviso" (blocos F e A do fluxo: grupo de faturamento e gerente)
// Monta o corpo JSON da Requisição API "Aviso interno" (contrato em integracao/contrato-aviso-interno.md).
// O texto do pedido tem aspas e quebras de linha: montar o JSON aqui evita corpo quebrado na Requisição API.
// Antes dele: Salvar no fluxo  aviso_tipo = pedido | gerente  (e, no nó 6, grupo_faturamento · tel_faturamento · tel_gerencia)
// Depois dele: Salvar no fluxo  aviso_json = {{input.aviso_json}} → Requisição API POST corpo {{flow.aviso_json}}
async (input, user, flow, env) => {
  const t = v => String(v === undefined || v === null ? '' : v).trim();
  const ou = (v, alt = 'não informado') => t(v) || alt;
  const tipo = t(flow.aviso_tipo) === 'gerente' ? 'gerente' : 'pedido';
  const cliente = `${ou(user.nome_contato)} · ${ou(user.estabelecimento)} · ${ou(user.cidade)}/${ou(user.uf, '?')}`;
  const tel = ou(flow.telefone || user.identifier);

  const texto = tipo === 'pedido'
    ? [
        '🧾 PEDIDO CONFIRMADO PELO WHATSAPP (Benjamim)',
        `Cliente: ${cliente}`,
        `WhatsApp: ${tel}`,
        `Cadastro: ${t(user.cadastro_status) === 'cadastrado' ? 'cliente da carteira' : 'cliente novo (ficha na conversa)'}`,
        `Responsável: ${ou(flow.responsavel_encaminhamento)}`,
        t(user.dia_rota) ? `Rota: ${t(user.dia_rota)}` : '',
        `Total: ${ou(user.pedido_total_fmt)} · Aceite em ${ou(user.pedido_confirmado_em)}`,
        '',
        t(user.pedido_previa_texto),
        '',
        'Prévia aprovada pelo cliente, ainda não lançada no ERP.'
      ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n')
    : [
        '⚠️ CASO GRAVE PARA A GERÊNCIA (Benjamim)',
        `Cliente: ${cliente}`,
        `WhatsApp: ${tel}`,
        `Cadastro: ${ou(user.cadastro_status, 'sem cadastro')} · Vendedor: ${ou(user.vendedor_nome, 'nenhum')}`,
        `Motivo: ${ou(flow.motivo)} · Urgência: ${ou(flow.urgencia)}`,
        `Assunto: ${ou(flow.assunto)}`,
        `Resumo: ${ou(flow.resumo)}`
      ].join('\n');

  return {
    aviso_json: JSON.stringify({
      tipo,
      destino: tipo === 'pedido' ? 'faturamento' : 'gerencia',
      grupo: tipo === 'pedido' ? t(flow.grupo_faturamento) : '',
      telefone: tipo === 'pedido' ? t(flow.tel_faturamento) : t(flow.tel_gerencia),
      texto: texto.slice(0, 3500)
    })
  };
}
