// Nó: Executar script "Montar prévia" (primeiro nó da saída da Função de fluxo montar_pedido)
// O agente manda SEMPRE a lista completa do pedido (nunca só o item novo). O script calcula, o fluxo envia a prévia.
// Entrada: argumentos da função em {{input}}: itens (lista) ou itens_texto (uma linha por item, plano B do spike S3),
//          modalidade, observacoes, segmento
// Depois dele: Salvar no usuário  pedido_itens_json · pedido_previa_texto · pedido_total · pedido_total_fmt ·
//              pedido_qtd_itens · pedido_sem_preco · pedido_minimo_ok · pedido_modalidade · pedido_status ·
//              pedido_atualizado_em · estado   (todos = {{input.<mesmo nome>}})
// Regras (briefing seções 05, 08, 12, 18):
//   subtotal = quantidade × preço da unidade vendida (caixa usa preço por caixa; sem ele, preço unitário × unidades por caixa)
//   item sem preço na base entra marcado "preço a confirmar" e o total vira parcial
//   bar e lanchonete: só atende pedido com total MAIOR que R$ 1.000,00 (exatamente 1.000,00 não passa)
//   pagamento sempre à vista (dinheiro ou PIX); entrega sujeita à confirmação logística
async (input, user, flow, env) => {
  const num = v => {
    if (typeof v === 'number') return v;
    let s = String(v || '').replace(/[^\d,.-]/g, '');
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };
  const brl = n => 'R$ ' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const txt = v => String(v === undefined || v === null ? '' : v).trim();

  // 1. Ler itens (lista do JSON Schema ou texto "produto; apresentacao; unidade; qtd; preco_unit; preco_caixa; qtd_por_caixa")
  let brutos = input.itens;
  if (typeof brutos === 'string') { try { brutos = JSON.parse(brutos); } catch (e) { brutos = null; } }
  if (!Array.isArray(brutos)) {
    brutos = String(input.itens_texto || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const [produto, apresentacao, unidade_venda, quantidade, preco_unitario, preco_caixa, qtd_por_caixa] = l.split(';').map(x => x.trim());
      return { produto, apresentacao, unidade_venda, quantidade, preco_unitario, preco_caixa, qtd_por_caixa };
    });
  }
  if (!brutos.length) throw new Error('montar_pedido chamado sem itens');

  // 2. Consolidar: mesmo produto + apresentação + unidade vira uma linha só (soma quantidades)
  const mapa = new Map();
  for (const b of brutos) {
    const it = {
      produto: txt(b.produto),
      apresentacao: txt(b.apresentacao),
      unidade_venda: (txt(b.unidade_venda) || 'caixa').toLowerCase(),
      quantidade: num(b.quantidade),
      qtd_por_caixa: num(b.qtd_por_caixa),
      preco_unitario: num(b.preco_unitario),
      preco_caixa: num(b.preco_caixa),
      condicao: txt(b.condicao)
    };
    if (!it.produto || it.quantidade <= 0) continue;
    const chave = [it.produto, it.apresentacao, it.unidade_venda].join('|').toLowerCase();
    if (mapa.has(chave)) mapa.get(chave).quantidade += it.quantidade;
    else mapa.set(chave, it);
  }
  const itens = [...mapa.values()];
  if (!itens.length) throw new Error('nenhum item com produto e quantidade');

  // 3. Calcular
  let total = 0, semPreco = 0;
  const linhas = itens.map((it, i) => {
    const caixa = /caixa|cx|fardo|pacote|fd/.test(it.unidade_venda);
    const precoUn = caixa
      ? (it.preco_caixa || (it.preco_unitario && it.qtd_por_caixa ? it.preco_unitario * it.qtd_por_caixa : 0))
      : it.preco_unitario;
    it.preco_aplicado = Math.round(precoUn * 100) / 100;
    it.subtotal = Math.round(it.preco_aplicado * it.quantidade * 100) / 100;
    const qtd = it.quantidade % 1 ? String(it.quantidade).replace('.', ',') : it.quantidade.toFixed(0);
    const plural = it.quantidade > 1 && !it.unidade_venda.endsWith('s') ? 's' : '';
    const qtdTxt = `${qtd} ${it.unidade_venda}${plural}`;
    const porCx = caixa && it.qtd_por_caixa ? ` (${it.qtd_por_caixa} un. por ${it.unidade_venda})` : '';
    const nome = [it.produto, it.apresentacao].filter(Boolean).join(' ');
    if (!it.preco_aplicado) {
      semPreco++;
      return `${i + 1}. ${nome}, ${qtdTxt}${porCx}, preço a confirmar pelo vendedor *`;
    }
    total += it.subtotal;
    return `${i + 1}. ${nome}, ${qtdTxt}${porCx} x ${brl(it.preco_aplicado)} = ${brl(it.subtotal)}${it.condicao ? ` (${it.condicao})` : ''}`;
  });
  total = Math.round(total * 100) / 100;

  const segmento = txt(input.segmento || user.segmento).toLowerCase();
  const ehBar = /bar|lanchonete/.test(segmento);
  const minimoOk = !ehBar ? 'na' : (semPreco === 0 && total > 1000 ? 'sim' : 'nao');
  const modalidade = txt(input.modalidade || user.modalidade || 'a definir');
  const temVendedor = !!txt(user.vendedor_codigo);

  // 4. Texto da prévia (sem travessão; o fluxo envia como está)
  const partes = [
    'Resumo do seu pedido 📋', '',
    ...linhas, '',
    `Total dos produtos${semPreco ? ' (parcial)' : ''}: ${brl(total)}`,
    `Modalidade: ${modalidade}`,
    'Pagamento: à vista, no dinheiro ou PIX',
    modalidade.toLowerCase().startsWith('retirada')
      ? 'Retirada no CD de segunda a sexta, das 7h30 às 12h e das 13h30 às 17h30.'
      : 'Entrega sujeita à confirmação da logística.'
  ];
  if (semPreco) partes.push('', 'Os itens com * têm o preço confirmado pelo vendedor antes do lançamento.');
  if (txt(input.observacoes)) partes.push(`Observações: ${txt(input.observacoes)}`);
  partes.push('');
  if (minimoOk === 'nao') {
    partes.push(semPreco
      ? 'Para bares e lanchonetes, atendemos pedidos acima de R$ 1.000,00, e o vendedor confirma o valor dos itens com *. Quer incluir mais algum item?'
      : `Para bares e lanchonetes, atendemos pedidos acima de R$ 1.000,00. Faltam ${brl(Math.max(0.01, 1000.01 - total))} para chegar lá. Quer incluir mais algum item?`);
  } else {
    partes.push(temVendedor
      ? 'Conferiu tudo? Posso encaminhar essa prévia ao seu vendedor para ele lançar o pedido no sistema?'
      : 'Conferiu tudo? Posso encaminhar essa prévia para a nossa equipe comercial junto com o seu cadastro?');
  }

  return {
    pedido_itens_json: JSON.stringify(itens),
    pedido_previa_texto: partes.join('\n'),
    pedido_total: total.toFixed(2),
    pedido_total_fmt: brl(total),
    pedido_qtd_itens: String(itens.length),
    pedido_sem_preco: semPreco ? 'sim' : 'nao',
    pedido_minimo_ok: minimoOk,
    pedido_modalidade: modalidade,
    pedido_status: 'aguardando_confirmacao',
    pedido_atualizado_em: moment().utcOffset(-180).format('YYYY-MM-DD HH:mm'),
    estado: 'aguardando_confirmacao'
  };
}
