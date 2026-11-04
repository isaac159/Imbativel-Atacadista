// Nó: Executar script "Preparar contexto"
// Antes dele: Salvar no fluxo  feriados = {{project.feriados_ano}} · teste_horario = {{project.teste_horario}}
// Depois dele: Salvar no fluxo  situacao_horario · proximo_atendimento · saudacao · data_hora_local · dia_semana ·
//              telefone · telefone_consulta · origem   (todos = {{input.<mesmo nome>}})
//
// Regras (briefing seções 01, 02, 09):
//   equipe humana: segunda a sexta 07h30–12h00 e 13h30–17h30 · sábado, domingo e feriado sem equipe
//   a IA atende 24h; o horário só muda a despedida do encaminhamento e o que o agente promete
//   saudação conforme o horário local (Jataizinho/PR, UTC-3, sem horário de verão)
//
// flow.feriados: datas "AAAA-MM-DD" separadas por vírgula (variável do projeto feriados_ano, até 255 caracteres)
// flow.teste_horario (só para teste, apagar antes de ativar para Todos):
//   "dentro" | "fora" | "intervalo" | data e hora "AAAA-MM-DDTHH:mm" para simular um momento (ex.: "2026-10-31T10:00", sábado)
async (input, user, flow, env) => {
  const teste = String(flow.teste_horario || '').trim().toLowerCase();
  const agora = /^\d{4}-\d{2}-\d{2}t\d{2}:\d{2}$/.test(teste)
    ? moment(teste.toUpperCase() + '-03:00', 'YYYY-MM-DDTHH:mmZ').utcOffset(-180)
    : moment().utcOffset(-180);

  const feriados = String(flow.feriados || '').split(',').map(s => s.trim()).filter(Boolean);
  const ehFeriado = d => feriados.includes(d.format('YYYY-MM-DD'));

  // janelas da equipe no dia, em minutos: [[abre, fecha], ...] ou [] se não tem expediente
  const janelas = d => {
    if (ehFeriado(d) || d.day() === 0 || d.day() === 6) return [];
    return [[7 * 60 + 30, 12 * 60], [13 * 60 + 30, 17 * 60 + 30]];
  };
  const hhmm = m => `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`;

  const min = agora.hours() * 60 + agora.minutes();
  const hoje = janelas(agora);
  let situacao = hoje.some(([a, f]) => min >= a && min < f) ? 'DENTRO'
    : (hoje.length && min >= 12 * 60 && min < 13 * 60 + 30) ? 'INTERVALO' : 'FORA';
  if (['dentro', 'fora', 'intervalo'].includes(teste)) situacao = teste.toUpperCase();

  // próximo início de expediente: ainda hoje (antes das 7h30 ou no intervalo) ou o próximo dia útil
  const dias = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  let proximo_atendimento;
  const aindaHoje = hoje.find(([a]) => min < a);
  if (situacao === 'DENTRO') {
    proximo_atendimento = 'agora, no horário de atendimento';
  } else if (aindaHoje && teste !== 'fora') {
    proximo_atendimento = `hoje, a partir das ${hhmm(aindaHoje[0])}`;
  } else {
    const prox = agora.clone().startOf('day').add(1, 'day');
    let guarda = 0;
    while (!janelas(prox).length && guarda < 15) { prox.add(1, 'day'); guarda++; }
    const diff = prox.diff(agora.clone().startOf('day'), 'days');
    const quando = diff === 1 ? `amanhã, ${dias[prox.day()]}` : diff < 7 ? `na ${dias[prox.day()]}` : `no dia ${prox.format('DD/MM')}`;
    proximo_atendimento = `${quando}, a partir das 7h30`;
  }

  const h = agora.hours();
  const saudacao = h >= 5 && h < 12 ? 'Bom dia' : h >= 12 && h < 18 ? 'Boa tarde' : 'Boa noite';

  // telefone: WhatsApp entrega 55DDDNNNNNNNN sem "+"; celular antigo pode vir sem o 9 (12 dígitos)
  let tel = String(user.identifier || '').replace(/\D/g, '');
  if (tel.length === 12 && tel.startsWith('55') && /[6-9]/.test(tel[4])) tel = tel.slice(0, 4) + '9' + tel.slice(4);
  const telefone = tel ? '+' + tel : '';

  // origem: referral do anúncio (Click-to-WhatsApp), se vier no objeto da mensagem, ou palavras na primeira mensagem
  let original = {};
  try { original = JSON.parse(flow.msg_original || '{}'); } catch (e) { original = {}; }
  const temReferral = !!(original.referral || (original.context && original.context.referral));
  const texto = String(flow.texto_cliente || '').toLowerCase();
  const porTexto = /an[uú]ncio|propaganda|patrocinad|vi (no|na|o seu|seu) (insta|face|post|v[ií]deo)/.test(texto);
  const origem = temReferral || porTexto ? 'anuncio' : 'organico';

  return {
    situacao_horario: situacao,
    proximo_atendimento,
    saudacao,
    data_hora_local: agora.format('YYYY-MM-DD HH:mm'),
    dia_semana: dias[agora.day()],
    telefone,
    telefone_consulta: tel,
    origem
  };
}
