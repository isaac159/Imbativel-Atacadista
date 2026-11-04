// Nó: Executar script "Verificar ofertas" (saída da Função de fluxo enviar_catalogo, depois do Salvar no fluxo "Carregar ofertas")
// Garante a regra da seção 10: arquivo antigo nunca é apresentado como oferta atual.
// Atualização de 27/10: cliente cadastrado recebe a lista da ROTA do dia vinculado ao cadastro ({{user.dia_rota}}).
//   Contato novo (sem rota) ou rota sem arquivo na semana recebe a lista geral (url_ofertas_semana).
// Antes dele: Salvar no fluxo  url_ofertas = {{project.url_ofertas_semana}} · url_ofertas_segunda … url_ofertas_sexta
//   = {{project.url_ofertas_<dia>}} · ofertas_validade_ate = {{project.ofertas_validade_ate}}
// Depois dele: Salvar no fluxo  ofertas_ok · ofertas_validade_fmt · ofertas_motivo · url_ofertas_envio · ofertas_rotulo
//   Condicional ofertas_ok = sim → Arquivo (PDF de {{flow.url_ofertas_envio}}) · Senão → Mensagem "lista indisponível"
// ofertas_validade_ate: "AAAA-MM-DD", último dia em que as listas valem (atualizar junto com os PDFs toda semana)
async (input, user, flow, env) => {
  const s = v => String(v === undefined || v === null ? '' : v).trim();
  const dia = s(user.dia_rota).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/-?feira/, '').trim();
  const nomes = { segunda: 'segunda', terca: 'terça', quarta: 'quarta', quinta: 'quinta', sexta: 'sexta' };
  const urlRota = nomes[dia] ? s(flow['url_ofertas_' + dia]) : '';
  const urlOkRe = /^https:\/\/\S+$/i;
  const daRota = urlOkRe.test(urlRota);
  const url = daRota ? urlRota : s(flow.url_ofertas);

  const validade = s(flow.ofertas_validade_ate);
  const hoje = moment().utcOffset(-180).format('YYYY-MM-DD');
  const dataOk = /^\d{4}-\d{2}-\d{2}$/.test(validade) && validade >= hoje;
  const urlOk = urlOkRe.test(url);
  return {
    ofertas_ok: dataOk && urlOk ? 'sim' : 'nao',
    ofertas_validade_fmt: dataOk ? moment(validade, 'YYYY-MM-DD').format('DD/MM') : '',
    ofertas_motivo: !urlOk ? 'sem_arquivo' : !dataOk ? 'vencida' : nomes[dia] && !daRota ? 'rota_sem_arquivo_enviou_geral' : 'ok',
    url_ofertas_envio: urlOk ? url : '',
    ofertas_rotulo: daRota ? ` da sua rota de ${nomes[dia]}` : ''
  };
}
