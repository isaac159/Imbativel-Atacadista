// Harness: carrega os scripts do EZ (arrow functions soltas) e roda casos.
const fs = require('fs');
const path = require('path');
global.moment = require('moment');
const dir = process.argv[2];
const load = f => eval('(' + fs.readFileSync(path.join(dir, f), 'utf8').replace(/^\s*\/\/.*$/gm, '') + ')');
const assert = (c, m) => { if (!c) { console.log('FALHOU:', m); process.exitCode = 1; } else console.log('ok  ', m); };

(async () => {
  const ctx = load('preparar_contexto.js');
  const fer = '2026-11-02,2026-11-15,2026-11-20,2026-12-25,2027-01-01';
  const c = async (t, extra = {}) => ctx({}, { identifier: '554384347570' }, { feriados: fer, teste_horario: t, ...extra }, {});
  let r;
  r = await c('2026-10-26T10:00'); assert(r.situacao_horario === 'DENTRO' && r.saudacao === 'Bom dia', `seg 10h dentro ${JSON.stringify(r)}`);
  r = await c('2026-10-26T07:29'); assert(r.situacao_horario === 'FORA' && r.proximo_atendimento === 'hoje, a partir das 7h30', `seg 7h29 ${r.proximo_atendimento}`);
  r = await c('2026-10-26T12:30'); assert(r.situacao_horario === 'INTERVALO' && r.proximo_atendimento === 'hoje, a partir das 13h30' && r.saudacao === 'Boa tarde', `seg 12h30 ${r.situacao_horario} ${r.proximo_atendimento}`);
  r = await c('2026-10-26T17:29'); assert(r.situacao_horario === 'DENTRO', 'seg 17h29 dentro');
  r = await c('2026-10-26T17:30'); assert(r.situacao_horario === 'FORA' && r.proximo_atendimento === 'amanhã, terça-feira, a partir das 7h30', `seg 17h30 ${r.proximo_atendimento}`);
  r = await c('2026-10-30T19:00'); assert(r.proximo_atendimento === 'na terça-feira, a partir das 7h30' && r.saudacao === 'Boa noite', `sex 19h ${r.proximo_atendimento}`);
  r = await c('2026-10-31T10:00'); assert(r.situacao_horario === 'FORA' && r.proximo_atendimento === 'na terça-feira, a partir das 7h30', `sab 10h ${r.proximo_atendimento}`);
  r = await c('2026-11-01T10:00'); assert(r.proximo_atendimento === 'na terça-feira, a partir das 7h30', `dom antes de Finados ${r.proximo_atendimento}`);
  r = await c('2026-11-06T18:00'); assert(r.proximo_atendimento === 'na segunda-feira, a partir das 7h30', 'sex comum 18h → segunda ' + r.proximo_atendimento);
  r = await c('2026-11-19T18:00'); assert(r.proximo_atendimento === 'na segunda-feira, a partir das 7h30', `qui 18h antes de feriado 20/11 ${r.proximo_atendimento}`);
  r = await c('2026-12-24T18:00'); assert(r.proximo_atendimento === 'na segunda-feira, a partir das 7h30', `24/12 18h ${r.proximo_atendimento}`);
  r = await c('dentro'); assert(r.situacao_horario === 'DENTRO', 'forçar dentro');
  r = await c('fora'); assert(r.situacao_horario === 'FORA' && !r.proximo_atendimento.startsWith('agora'), `forçar fora ${r.proximo_atendimento}`);
  assert(r.telefone === '+5543984347570' && r.telefone_consulta === '5543984347570', `telefone 12 dígitos ganha o 9 ${r.telefone}`);
  r = await ctx({}, { identifier: '554333392510' }, { teste_horario: 'dentro' }, {}); assert(r.telefone === '+554333392510', `fixo sem 9 ${r.telefone}`);
  r = await c('dentro', { texto_cliente: 'Olá, vi o anúncio de vocês' }); assert(r.origem === 'anuncio', 'origem anuncio por texto');
  r = await c('dentro', { texto_cliente: 'oi' }); assert(r.origem === 'organico', 'origem organico');
  r = await c('dentro', { msg_original: JSON.stringify({ text: 'oi', referral: { source_type: 'ad' } }) }); assert(r.origem === 'anuncio', 'origem por referral');

  const g = load('guardar_mensagem.js'), d = load('devolver_mensagem.js');
  const msg = { text: 'quero 3 cx de skol', type: 'text' };
  const gs = await g(msg); const back = await d({ statusCode: 200 }, {}, { msg_original: gs.msg_original, texto_cliente: gs.texto_cliente }, {});
  assert(back.text === msg.text && back.type === 'text', 'guardar/devolver preserva mensagem');
  const audio = { type: 'audio', audio: { url: 'x' } };
  const ga = await g(audio); const ba = await d({}, {}, { msg_original: ga.msg_original, texto_cliente: ga.texto_cliente }, {});
  assert(ba.type === 'audio' && ba.audio.url === 'x', 'guardar/devolver preserva áudio');

  const n = load('normalizar_cadastro.js');
  r = await n({ statusCode: 200, body: { encontrado: true, nome_contato: 'Carlos', estabelecimento: 'Mercado Bom Preço', vendedor_codigo: 'v01', vendedor_nome: 'João', uf: 'pr' } });
  assert(r.cadastro_encontrado === 'sim' && r.cad_vendedor_codigo === 'V01' && r.cad_uf === 'PR' && r.cad_segmento === '', 'cadastro encontrado');
  r = await n({ statusCode: 200, body: '{"encontrado":false}' }); assert(r.cadastro_encontrado === 'nao' && r.cad_nome_contato === '', 'não encontrado (body string)');

  const p = load('montar_pedido.js');
  r = await p({ itens: [
    { produto: 'Cerveja X', apresentacao: 'lata 350 ml', unidade_venda: 'caixa', quantidade: 3, qtd_por_caixa: 12, preco_caixa: 120 },
    { produto: 'Energético Y', apresentacao: '2 L', unidade_venda: 'caixa', quantidade: 2, qtd_por_caixa: 6, preco_unitario: '15,00' },
    { produto: 'Refrigerante Z', apresentacao: '2 L', unidade_venda: 'caixa', quantidade: 4, preco_caixa: 'R$ 60,00' },
    { produto: 'cerveja x', apresentacao: 'Lata 350 ml', unidade_venda: 'Caixa', quantidade: 1, qtd_por_caixa: 12, preco_caixa: 120 }
  ], modalidade: 'entrega' }, { segmento: 'supermercado', vendedor_codigo: 'V01' }, {}, {});
  assert(r.pedido_total === '900.00', `total 4x120 + 2x90 + 4x60 = 900: ${r.pedido_total}`);
  console.log(r.pedido_previa_texto);
  assert(r.pedido_qtd_itens === '3', 'consolidou item duplicado');
  assert(!r.pedido_previa_texto.includes('—'), 'sem travessão');
  assert(r.pedido_minimo_ok === 'na', 'mínimo não se aplica a supermercado');
  r = await p({ itens: [{ produto: 'Vodka K', apresentacao: '1 L', unidade_venda: 'caixa', quantidade: 1, preco_caixa: 1000 }] }, { segmento: 'Bar' }, {}, {});
  assert(r.pedido_minimo_ok === 'nao' && r.pedido_previa_texto.includes('Faltam R$ 0,01'), `bar com exatamente 1000 não passa ${r.pedido_minimo_ok}`);
  r = await p({ itens: [{ produto: 'Vodka K', apresentacao: '1 L', unidade_venda: 'caixa', quantidade: 1, preco_caixa: 1000.01 }] }, { segmento: 'lanchonete' }, {}, {});
  assert(r.pedido_minimo_ok === 'sim', 'bar acima de 1000 passa');
  r = await p({ itens_texto: 'Uísque W; 1 L; caixa; 2; 80,00; ; 6\nÁgua A; 500 ml; fardo; 5; ; ; 12' }, {}, {}, {});
  assert(r.pedido_total === '960.00' && r.pedido_sem_preco === 'sim', `itens_texto plano B: ${r.pedido_total} sem_preco=${r.pedido_sem_preco}`);
  console.log(r.pedido_previa_texto);
  try { await p({ itens: [] }, {}, {}, {}); assert(false, 'lista vazia deveria lançar erro'); } catch (e) { assert(true, 'lista vazia vai para saída erro'); }

  const f = load('montar_ficha.js');
  r = await f({ nome_contato: 'Ana', estabelecimento: 'Mercearia da Ana', cidade: 'Londrina', uf: 'PR' }, { pedido_status: 'aguardando_confirmacao', pedido_previa_texto: 'Resumo...' }, { telefone: '+5543999990000', origem: 'anuncio' }, {});
  assert(r.destino === 'pedro' && r.ficha_texto.includes('faltou coletar CNPJ, CEP, endereço, e-mail') && r.ficha_texto.includes('Pedido em montagem') && r.ficha_texto.includes('ainda sem pedido'), 'ficha no cadastro (sem pedido confirmado) → Pedro, responsável a definir');
  console.log(r.ficha_texto);
  const lead = { nome_contato: 'Ana', estabelecimento: 'Mercearia da Ana', cnpj: '123', cidade: 'Londrina', uf: 'PR', pedido_status: 'confirmado_cliente', pedido_previa_texto: 'Resumo...' };
  r = await f({ confirmacao_cliente: 'pode mandar', resumo: 'Pediu cervejas' }, { ...lead, pedido_total: '10000.01', pedido_total_fmt: 'R$ 10.000,01' }, {}, {});
  assert(r.destino === 'pablo' && r.ficha_texto.includes('Estabelecimento: Mercearia da Ana') && r.ficha_texto.includes('Resumo da conversa: Pediu cervejas') && r.ficha_texto.includes('NOVO CLIENTE COM PEDIDO'), 'lead com pedido acima de 10 mil → Pablo (dados vêm do user)');
  r = await f({}, { ...lead, pedido_total: '10000.00' }, {}, {}); assert(r.destino === 'pedro', 'lead com pedido de exatamente 10 mil → Pedro');
  r = await f({}, { ...lead, pedido_total: '850.00' }, {}, {}); assert(r.destino === 'pedro' && r.responsavel_encaminhamento.startsWith('Pedro'), 'lead com pedido abaixo de 10 mil → Pedro');

  const o = load('verificar_ofertas.js');
  const hoje = moment().utcOffset(-180).format('YYYY-MM-DD');
  r = await o({}, {}, { url_ofertas: 'https://x.com/a.pdf', ofertas_validade_ate: hoje }, {}); assert(r.ofertas_ok === 'sim' && r.url_ofertas_envio === 'https://x.com/a.pdf' && r.ofertas_rotulo === '', 'ofertas gerais vigentes até hoje');
  r = await o({}, {}, { url_ofertas: 'https://x.com/a.pdf', ofertas_validade_ate: '2020-01-01' }, {}); assert(r.ofertas_ok === 'nao' && r.ofertas_motivo === 'vencida', 'ofertas vencidas');
  r = await o({}, {}, { url_ofertas: '', ofertas_validade_ate: hoje }, {}); assert(r.ofertas_motivo === 'sem_arquivo', 'sem arquivo');
  const rotas = { url_ofertas: 'https://x.com/geral.pdf', url_ofertas_terca: 'https://x.com/terca.pdf', ofertas_validade_ate: hoje };
  r = await o({}, { dia_rota: 'Terça-feira' }, rotas, {}); assert(r.url_ofertas_envio === 'https://x.com/terca.pdf' && r.ofertas_rotulo === ' da sua rota de terça', 'cadastrado recebe a lista da rota dele');
  r = await o({}, { dia_rota: 'quinta' }, rotas, {}); assert(r.ofertas_ok === 'sim' && r.url_ofertas_envio === 'https://x.com/geral.pdf' && r.ofertas_motivo === 'rota_sem_arquivo_enviou_geral', 'rota sem arquivo na semana → lista geral');

  const a = load('montar_aviso.js');
  const ctxAviso = { telefone: '+5543999990000', responsavel_encaminhamento: 'Vendedor João', grupo_faturamento: 'Faturamento Imbatível', tel_faturamento: '+5543996346901', tel_gerencia: '+55439697234' };
  r = await a({}, { nome_contato: 'Carlos', estabelecimento: 'Mercado "Bom Preço"', cadastro_status: 'cadastrado', dia_rota: 'terça', pedido_total_fmt: 'R$ 900,00', pedido_previa_texto: 'Linha 1\nLinha 2' }, { ...ctxAviso, aviso_tipo: 'pedido' }, {});
  let av = JSON.parse(r.aviso_json);
  assert(av.destino === 'faturamento' && av.grupo === 'Faturamento Imbatível' && av.texto.includes('Mercado "Bom Preço"') && av.texto.includes('Linha 1\nLinha 2') && av.texto.includes('Rota: terça'), 'aviso de pedido ao faturamento é JSON válido com aspas e quebras');
  r = await a({}, { nome_contato: 'Carlos' }, { ...ctxAviso, aviso_tipo: 'gerente', motivo: 'problema_grave_urgente', urgencia: 'alta', assunto: 'produto quebrado' }, {});
  av = JSON.parse(r.aviso_json);
  assert(av.destino === 'gerencia' && av.telefone === '+55439697234' && av.texto.includes('produto quebrado') && !av.grupo, 'aviso grave vai ao telefone da gerência');

  r = await n({ statusCode: 200, body: { encontrado: true, dia_rota: 'Terça' } }); assert(r.cad_dia_rota === 'terça', 'carteira traz o dia da rota');
})();
