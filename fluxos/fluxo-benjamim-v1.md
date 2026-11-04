# Fluxo Benjamim v1 (ez.flow) — Imbatível Atacadista

Canal: WhatsApp 43 3339-2510 · Agente: Benjamim · Fluxo: **Fluxo Benjamim v1** (fluxo padrão do canal)
Fonte da verdade dos nós: `ezchat-platform-map.md` (06/10, `claude-packs.zip`). Só nós mapeados.
Scripts: `fluxos/scripts/` (testados em Node com `testes/scripts_teste.js`, 42 casos). Funções: `fluxos/funcoes/`.

> **Implantação (03/11):** o que foi montado no EZ difere deste desenho em alguns pontos (prompt XML de 36 mil caracteres no gpt-5.1, carteira dentro do fluxo, preços via n8n, pipeline no CRM, avisos só como Observação). Ver `docs/registro-implantacao.md` § 9. Quando discordarem, vale o registro.

Atualização de 27/10 (regras passadas pelo cliente): lead vai a Pablo se o pedido passa de R$ 10 mil e a Pedro até R$ 10 mil, com ficha e resumo · cliente cadastrado fica sempre com o vendedor e o dia de rota vinculados · lista de ofertas por rota · contato novo só vê condições depois do cadastro · aviso ao grupo de faturamento a cada pedido confirmado · caso grave avisa o gerente · financeiro de quem não tem cadastro vai à gerência.

Princípio: **o agente decide o que dizer; o fluxo decide para onde vai e guarda o estado.** Toda informação que precisa sobreviver a um script, a uma espera ou a uma nova conversa vive numa variável `flow.*` (vale na execução) ou `user.*` (vale para sempre no contato). Nada importante fica só na memória da LLM.

---

## 1. Antes de montar

### 1.1 Variáveis do projeto (Configurações → Sistema → Variáveis de projeto)

| Chave | Tipo | Valor |
|---|---|---|
| `feriados_ano` | Texto | `2026-11-02,2026-11-15,2026-11-20,2026-12-25,2027-01-01,2027-03-26,2027-04-21,2027-05-01,2027-09-07,2027-10-12,2027-11-02,2027-11-15,2027-11-20,2027-12-25` (153 caracteres; feriados nacionais. Faltam os municipais de Jataizinho, Carnaval e Corpus Christi: P12) |
| `teste_horario` | Texto | vazio em produção. Para teste: `dentro`, `fora`, `intervalo` ou `AAAA-MM-DDTHH:mm` (ex.: `2026-10-31T10:00` = sábado) |
| `consulta_cliente_ativa` | Texto | `nao` até a integração da carteira existir (P2). Depois `sim` |
| `url_consulta_cliente` | Texto | URL do endpoint de consulta (contrato em `integracao/contrato-consulta-cliente.md`) |
| `url_ofertas_semana` | Texto | Link público `https://` do PDF de ofertas **geral** (contato novo e cliente sem rota). Trocar toda semana (P7) |
| `url_ofertas_segunda` … `url_ofertas_sexta` | Texto | Cinco variáveis, uma por dia de rota: link do PDF da rota daquele dia. Vazia = a rota recebe a lista geral |
| `ofertas_validade_ate` | Texto | Último dia em que as listas valem, `AAAA-MM-DD`. Trocar junto com os PDFs. Vencida = o fluxo não envia |
| `url_aviso_interno` | Texto | Endpoint que publica o aviso no grupo de faturamento ou manda ao gerente (contrato em `integracao/contrato-aviso-interno.md`, spike S7) |
| `grupo_faturamento` | Texto | Nome ou ID do grupo de faturamento no WhatsApp |
| `telefone_faturamento` | Texto | `+5543996346901` (Tati, faturamento e efetivação cadastral). Destino do aviso se o grupo não puder ser usado |
| `telefone_gerencia` | Texto | Telefone da gerência para casos graves (passado como 43 9697-2349: conferir o dígito que falta antes de gravar) |

### 1.2 Variável de ambiente (Configurações → Sistema → Variáveis de ambiente)

| Nome | Valor | Uso |
|---|---|---|
| `token_consulta_cliente` | token do endpoint (mascarado `••••`) | Só no cabeçalho `Authorization` da Requisição API do nó 11. **Nunca** em Mensagem, Observação ou texto |
| `token_aviso_interno` | token do endpoint de aviso | Só no cabeçalho `Authorization` das Requisições API de aviso (nós 58c e 86) |

Os telefones internos ficam em variável de projeto e só saem pela Requisição API de aviso. Nunca entram nas Instruções extras: o Benjamim não conhece nenhum número da equipe.

### 1.3 Departamentos (nó Departamento → Criar novo)

| Departamento | Quem | Recebe |
|---|---|---|
| `Atendimento Inicial` | Pedro | Lead com pedido até R$ 10 mil (ficha + resumo) · lead que se cadastrou e saiu sem pedido · novo contato que pediu humano |
| `Gerência` | Pablo Chaves | Lead com pedido acima de R$ 10 mil (ficha + resumo) · fornecedor (compras) · financeiro e caso grave de quem não tem cadastro |
| `Vendedor <Nome>` (um por vendedor) | cada vendedor da carteira | **Tudo** do cliente cadastrado dele: pedido confirmado, acompanhamento, logística, financeiro e caso grave (o gerente recebe aviso à parte) |
| `Comercial` | Pedro + Pablo (fallback) | Vendedor não identificado · erro do agente |

Os vendedores e seus códigos vêm da relação de carteiras (P2). Exemplo usado neste documento: `V01` = Vendedor João, `V02` = Vendedor Maria.

### 1.4 Tags (Atribuir tag → Criar nova Tag)

`origem-anuncio` · `cliente-cadastrado` · `novo-contato` · `ofertas-enviadas` · `ofertas-indisponiveis` · `pedido-em-montagem` · `pedido-confirmado` · `cadastro-novo` · `lead-ate-10mil` · `lead-acima-10mil` · `encaminhado-vendedor` · `encaminhado-gerencia` · `fornecedor` · `urgente` · `aviso-nao-enviado` · `fora-expediente` · `sem-interesse` · `fora-perfil` · `pediu-humano` · `erro-ia`

Atribuir tag é dropdown (sem tag dinâmica): estado, segmento e motivo ficam em `{{user.*}}` e na Observação.

### 1.5 Funções do agente

Criar pela aba Ferramentas do nó 19 (AI Studio - Agente), com os JSON de `fluxos/funcoes/`. **Montar um único nó AI Studio neste fluxo**: cada nó novo cria mais uma `transferir_para_atendente_<sufixo>` no agente. Todas as voltas ao agente reaproveitam o nó 19 pela cadeia REENTRADA.

| Função | Tipo | Encerrar run | Saída leva a |
|---|---|---|---|
| `enviar_catalogo` | Função de fluxo | Ligado | nó 29 |
| `montar_pedido` | Função de fluxo | Ligado | nó 39 |
| `confirmar_previa` | Função de fluxo | Ligado | nó 50 |
| `registrar_cadastro` | Função de fluxo | Ligado | nó 60 |
| `encaminhar_vendedor` | Função de fluxo | Ligado | nó 70 |
| `encaminhar_gerencia` | Função de fluxo | Ligado | nó 80 |
| `encaminhar_fornecedor` | Função de fluxo | Ligado | nó 90 |
| `cliente_sem_interesse` | Função de saída | — (Enviar mensagem de transferência = Sim) | nó 100 |
| `contato_fora_perfil` | Função de saída | — (Enviar mensagem de transferência = Sim) | nó 110 |
| `transferir_para_atendente` | Função de saída (já existe) | — (Enviar mensagem de transferência = Sim) | nó 120 |
| Erro (saída fixa) | — | — | nó 130 |

Sem Exemplos nas funções na v1: com 3 ou mais o Classifier passa a esconder a função quando a mensagem não casa com os exemplos.

---

## 2. Dicionário de variáveis

### 2.1 `flow.*` (vale só nesta execução do fluxo)

| Variável | Gravada no nó | Valor | Lida por |
|---|---|---|---|
| `msg_original` | 3, R2 | Mensagem do cliente inteira em JSON (texto, áudio, imagem) | 18 Devolver mensagem |
| `texto_cliente` | 3, R2 | Texto da mensagem | 7 (origem), 18 |
| `feriados` · `teste_horario` · `consulta_ativa` | 6 | Cópia das variáveis do projeto | 7, 10 |
| `grupo_faturamento` · `tel_faturamento` · `tel_gerencia` | 6 | Cópia das variáveis do projeto | script montar_aviso |
| `situacao_horario` | 8 / 8b | `DENTRO` · `INTERVALO` · `FORA` | Instruções extras, blocos V/P/G (tag fora-expediente) |
| `proximo_atendimento` | 8 / 8b | ex.: "amanhã, terça-feira, a partir das 7h30" | Instruções extras (despedida) |
| `saudacao` | 8 / 8b | Bom dia · Boa tarde · Boa noite (fallback "Olá") | Instruções extras |
| `data_hora_local` · `dia_semana` | 8 / 8b | `2026-10-26 10:00` · segunda-feira | Instruções extras, carimbos de data |
| `telefone` | 8 / 8b | `+5543984347570` (com o 9) | Observações, ficha |
| `telefone_consulta` | 8 / 8b | `5543984347570` | 11 Requisição API |
| `origem` | 8 / 8b | `anuncio` · `organico` | 9 Condicional, Instruções extras, ficha |
| `cadastro_encontrado` | 13 / 16 | `sim` · `nao` · `indisponivel` | 14, Instruções extras |
| `cad_*` (nome_contato, estabelecimento, segmento, cidade, uf, vendedor_codigo, vendedor_nome, modalidade, ativo, dia_rota) | 13 | Dados da carteira | 15 (copia para `user.*`) |
| `url_ofertas` · `url_ofertas_segunda` … `url_ofertas_sexta` · `ofertas_validade_ate` | 30 | Cópia das variáveis do projeto | 31 |
| `ofertas_ok` · `ofertas_validade_fmt` · `ofertas_motivo` · `url_ofertas_envio` · `ofertas_rotulo` | 32 | `sim`/`nao` · `DD/MM` · `ok`/`vencida`/`sem_arquivo`/`rota_sem_arquivo_enviou_geral` · link escolhido · " da sua rota de terça" ou vazio | 33, 34, 35 |
| `confirmacao_cliente` · `resumo` · `pendencias` · `aviso_tipo` | 50 | Argumentos de `confirmar_previa` · `pedido` | 53, 55, 57, 58 |
| `ficha_texto` · `responsavel_encaminhamento` · `destino` | 57a (pedido de lead) · 63 / 63b (cadastro) · 56a (cadastrado) | Ficha montada · responsável · `vendedor`/`pedro`/`pablo` | 57b, 58, 59, 64 |
| `aviso_json` | 58a, 85a | Corpo do aviso interno em JSON | 58c, 86 |
| `motivo` · `resumo` · `dados_pedido` · `urgencia` | 70 | Argumentos de `encaminhar_vendedor` | 71, 72 |
| `motivo` · `assunto` · `resumo` · `urgencia` · `aviso_tipo` | 80 | Argumentos de `encaminhar_gerencia` · `gerente` | 81, 82, 85 |
| `forn_*` (nome, empresa, produtos, catalogo, telefone, obs) | 91 | Argumentos de `encaminhar_fornecedor` | 92 |

### 2.2 `user.*` (fica no contato, vale nas próximas conversas)

| Variável | Gravada no nó | Valor | Lida por |
|---|---|---|---|
| `nome_contato` · `estabelecimento` · `segmento` · `cidade` · `uf` · `modalidade` | 15 (carteira) ou 60 (cadastro) | Dados do cliente | Instruções extras, Observações, script montar_pedido (segmento) |
| `vendedor_codigo` · `vendedor_nome` · `dia_rota` | 15 | `V01` · João · terça | Bloco V (roteamento), Instruções extras, script verificar_ofertas (lista da rota), aviso ao faturamento. Só a carteira grava: o agente nunca troca vendedor nem rota |
| `cliente_ativo` | 15 | `sim` / `nao` | Observação |
| `cadastro_status` | 15 / 63a / 57c | `cadastrado` (carteira) · `dados_coletados` (lead fez o cadastro, condições liberadas) · `ficha_enviada` (ficha foi com o pedido) · vazio | Instruções extras, 29, 39, 56, 72, 88, 100a, 122 |
| `ultima_origem` | 9b | `anuncio` | Observação, relatório |
| `tipo_pessoa` · `cnpj` · `cep` · `endereco` · `ponto_referencia` · `email` · `produtos_interesse` · `volume_estimado` · `situacao_elegibilidade` · `origem_contato` | 60 | Ficha de novo cliente | Script montar_ficha no nó 57 (a ficha vai com o pedido) |
| `pedido_itens_json` | 41 | Itens consolidados em JSON | Instruções extras (base para a próxima chamada de `montar_pedido`) |
| `pedido_previa_texto` | 41 | Texto da prévia, com total calculado | 43 Mensagem, Instruções extras, 55 Observação, ficha |
| `pedido_total` · `pedido_total_fmt` · `pedido_qtd_itens` · `pedido_sem_preco` · `pedido_minimo_ok` · `pedido_modalidade` | 41 | Números e flags do pedido | 52, 52a, 55 |
| `pedido_status` | 41 / 53 | `aguardando_confirmacao` · `confirmado_cliente` | 51, Instruções extras, ficha |
| `pedido_atualizado_em` · `pedido_confirmado_em` · `pedido_confirmacao` | 41 / 53 | Carimbos e palavras do aceite | Observação (rastreabilidade) |
| `estado` | 33a, 41, 53, 63a, 57c, V1, G1, 90, 100, 110 | Estado operacional (2.3) | Instruções extras, relatório |
| `ofertas_enviadas_em` | 33a | Data e hora | Relatório |
| `tipo_contato` | 90 | `fornecedor` | Instruções extras (não vender para fornecedor) |

### 2.3 Estados operacionais do briefing (seção 16) → onde o fluxo grava

| Estado | Gravado por | Observação |
|---|---|---|
| `novo_contato` | (implícito) | `user.estado` vazio + tag `novo-contato` no nó 17 |
| `em_qualificacao` | — | Fase da conversa, não gera evento no fluxo. Aparece como `novo_contato` até um desfecho |
| `cliente_cadastrado` | nó 15 | Carteira encontrou o telefone |
| `em_atendimento_comercial` | nó 33a | Lista de ofertas enviada |
| `pedido_em_montagem` / `aguardando_confirmacao` | nó 41 | O script grava `aguardando_confirmacao` a cada prévia (a montagem sempre termina numa prévia) |
| `pedido_confirmado_cliente` | nó 53 | Logo em seguida vira `encaminhado_*` no bloco de destino; o aceite fica em `user.pedido_status` = `confirmado_cliente` |
| `cadastro_pendente` | nós 63a e 57c | Cadastro coletado (63a) e ficha enviada com o pedido (57c) |
| `encaminhado_vendedor` | bloco V (nó V1) | |
| `encaminhado_gerencia` | bloco G (nó G1) | |
| `sem_interesse` · `fora_perfil` | nós 100 · 110 | |
| `atendimento_finalizado` | — | Quem finaliza é o atendente ao fechar o ticket (Classificar atendimento, v2) |

---

## 3. Nós, na ordem

### 3.1 ENTRADA (toda mensagem nova começa aqui)

| # | Nó | Configuração | Saída → |
|---|---|---|---|
| 1 | **Início do Fluxo** | — | 2 |
| 2 | **Executar script** "Guardar mensagem" | `scripts/guardar_mensagem.js` | sucesso → 3 · erro → 3 |
| 3 | **Salvar no fluxo** | `msg_original` = `{{input.msg_original}}` · `texto_cliente` = `{{input.texto_cliente}}` | 4 |
| 4 | **Verificar Atend. Humano** | — | Sim → 5 · Não → 6 |
| 5 | **Fim de fluxo** | (um atendente está na conversa; o Benjamim não fala) | — |

### 3.2 CONTEXTO (horário, saudação, telefone, origem)

| # | Nó | Configuração | Saída → |
|---|---|---|---|
| 6 | **Salvar no fluxo** "Carregar variáveis" | `feriados` = `{{project.feriados_ano}}` · `teste_horario` = `{{project.teste_horario}}` · `consulta_ativa` = `{{project.consulta_cliente_ativa}}` · `grupo_faturamento` = `{{project.grupo_faturamento}}` · `tel_faturamento` = `{{project.telefone_faturamento}}` · `tel_gerencia` = `{{project.telefone_gerencia}}` | 7 |
| 7 | **Executar script** "Preparar contexto" | `scripts/preparar_contexto.js` | sucesso → 8 · erro → 8b |
| 8 | **Salvar no fluxo** | `situacao_horario` · `proximo_atendimento` · `saudacao` · `data_hora_local` · `dia_semana` · `telefone` · `telefone_consulta` · `origem`, cada um = `{{input.<mesmo nome>}}` | 9 |
| 8b | **Salvar no fluxo** (fallback) | `situacao_horario` = `FORA` · `proximo_atendimento` = `no próximo horário de atendimento, a partir das 7h30` · `saudacao` = `Olá` · `telefone` = `+{{user.identifier}}` · `telefone_consulta` = `{{user.identifier}}` · `origem` = `organico` · `data_hora_local` = vazio · `dia_semana` = vazio | 9 |
| 9 | **Condicional** "Origem" | C1: `{{flow.origem}}` `=` `anuncio` | C1 → 9a · Senão → 10 |
| 9a | **Atribuir tag** | `origem-anuncio` | 9b |
| 9b | **Salvar no usuário** | `ultima_origem` = `anuncio` | 10 |

### 3.3 CADASTRO (consulta da carteira pelo telefone)

| # | Nó | Configuração | Saída → |
|---|---|---|---|
| 10 | **Condicional** "Consulta ativa?" | C1: `{{flow.consulta_ativa}}` `=` `sim` | C1 → 11 · Senão → 16 |
| 11 | **Requisição API** "Consultar carteira" | Método `GET` · URL `{{project.url_consulta_cliente}}?telefone={{flow.telefone_consulta}}` · Cabeçalho `Authorization` = `Bearer {{env.token_consulta_cliente}}` | Sucesso 2XX → 12 · Erro 4XX → 16 |
| 12 | **Executar script** "Normalizar cadastro" | `scripts/normalizar_cadastro.js` | sucesso → 13 · erro → 16 |
| 13 | **Salvar no fluxo** | `cadastro_encontrado` · `cad_nome_contato` · `cad_estabelecimento` · `cad_segmento` · `cad_cidade` · `cad_uf` · `cad_vendedor_codigo` · `cad_vendedor_nome` · `cad_modalidade` · `cad_ativo` · `cad_dia_rota`, cada um = `{{input.<mesmo nome>}}` | 14 |
| 14 | **Condicional** "Encontrou?" | C1: `{{flow.cadastro_encontrado}}` `=` `sim` | C1 → 15 · Senão → 17 |
| 15 | **Salvar no usuário** | `nome_contato` = `{{flow.cad_nome_contato}}` · `estabelecimento` = `{{flow.cad_estabelecimento}}` · `segmento` = `{{flow.cad_segmento}}` · `cidade` = `{{flow.cad_cidade}}` · `uf` = `{{flow.cad_uf}}` · `vendedor_codigo` = `{{flow.cad_vendedor_codigo}}` · `vendedor_nome` = `{{flow.cad_vendedor_nome}}` · `modalidade` = `{{flow.cad_modalidade}}` · `cliente_ativo` = `{{flow.cad_ativo}}` · `dia_rota` = `{{flow.cad_dia_rota}}` · `cadastro_status` = `cadastrado` · `estado` = `cliente_cadastrado` | 15a |
| 15a | **Atribuir tag** | `cliente-cadastrado` | 18 |
| 16 | **Salvar no fluxo** | `cadastro_encontrado` = `indisponivel` | 18 |
| 17 | **Atribuir tag** | `novo-contato` | 18 |

Por que o nó 15 só roda quando encontrou: Salvar no usuário com valor vazio apaga o que já existia. Quem não está na carteira mantém o que contou em conversas anteriores (nome, cidade, ficha enviada), e o agente não pergunta de novo.

### 3.4 AGENTE

| # | Nó | Configuração | Saída → |
|---|---|---|---|
| 18 | **Executar script** "Devolver mensagem" | `scripts/devolver_mensagem.js` (recoloca `{{input.text}}`) | sucesso → 19 · erro → 19 |
| 19 | **AI Studio - Agente** | ver 3.5 | funções (3.7 em diante) · Erro → 130 |

### 3.5 Nó 19 · AI Studio - Agente

- Agente do AI Studio: **Benjamim**
- Iniciar conversa nova?: **Não** (continua o histórico; obrigatório para as voltas pela REENTRADA)
- Enviar mensagem de transferência?: **Sim**
- Follow-ups automáticos: **Desligado** (v1; briefing pede respeito a recusa e sem pressão)
- Primeira mensagem: vazio (o Benjamim abre pelo Comportamento, com a SAUDAÇÃO abaixo)
- Instruções extras (colar):

```
CONTEXTO DESTA CONVERSA (vem do sistema; nunca mostre estes rótulos ao cliente)
SAUDAÇÃO: {{flow.saudacao}}
SITUAÇÃO DA EQUIPE: {{flow.situacao_horario}} (DENTRO, INTERVALO ou FORA do expediente)
PRÓXIMO ATENDIMENTO DA EQUIPE: {{flow.proximo_atendimento}}
HOJE: {{flow.dia_semana}}, {{flow.data_hora_local}}
ORIGEM: {{flow.origem}} (anuncio = veio de anúncio)

CADASTRO NA CARTEIRA: {{flow.cadastro_encontrado}} (sim, nao ou indisponivel)
SITUAÇÃO DO CADASTRO: {{user.cadastro_status}} (cadastrado, dados_coletados, ficha_enviada ou vazio)
CLIENTE: {{user.nome_contato}} | ESTABELECIMENTO: {{user.estabelecimento}} | SEGMENTO: {{user.segmento}}
CIDADE: {{user.cidade}}/{{user.uf}} | MODALIDADE PREFERIDA: {{user.modalidade}}
VENDEDOR RESPONSÁVEL: {{user.vendedor_nome}} | DIA DA ROTA: {{user.dia_rota}}
TIPO DE CONTATO: {{user.tipo_contato}}
ESTADO DO ÚLTIMO ATENDIMENTO: {{user.estado}}

PEDIDO SALVO (status {{user.pedido_status}}, atualizado em {{user.pedido_atualizado_em}}):
{{user.pedido_previa_texto}}
ITENS DO PEDIDO SALVO: {{user.pedido_itens_json}}

Como usar o contexto:
- Campo vazio = ainda não sabemos. Nunca pergunte o que já está preenchido.
- CADASTRO NA CARTEIRA = sim ou SITUAÇÃO DO CADASTRO = cadastrado: é cliente cadastrado. Ele fica sempre com o VENDEDOR RESPONSÁVEL e o DIA DA ROTA; você nunca troca nenhum dos dois (pedido de troca vai ao vendedor).
- SITUAÇÃO DO CADASTRO = dados_coletados ou ficha_enviada: o contato novo já fez o cadastro; não colete de novo e pode passar ofertas, preços e condições.
- SITUAÇÃO DO CADASTRO vazio e não está na carteira: ofertas, preços e condições só depois do cadastro rápido (registrar_cadastro).
- PEDIDO SALVO com status aguardando_confirmacao: existe prévia aberta; retome por ela e use os ITENS DO PEDIDO SALVO como base ao chamar montar_pedido de novo.
- PEDIDO SALVO com status confirmado_cliente: esse pedido já foi para a equipe; um pedido novo começa do zero.
- Nunca diga a SITUAÇÃO DA EQUIPE nem o horário interno. Use o PRÓXIMO ATENDIMENTO só na despedida de um encaminhamento quando a situação não for DENTRO.
```

### 3.6 REENTRADA (volta ao agente depois de uma mensagem do fluxo)

Toda Mensagem do fluxo que espera o cliente (prévia, lista de ofertas, avisos) liga em R1. Nenhum ramo liga direto no nó 19.

| # | Nó | Configuração | Saída → |
|---|---|---|---|
| R1 | **Executar script** "Guardar mensagem" | `scripts/guardar_mensagem.js` (mesmo código do nó 2) | sucesso → R2 · erro → R2 |
| R2 | **Salvar no fluxo** | `msg_original` = `{{input.msg_original}}` · `texto_cliente` = `{{input.texto_cliente}}` | R3 |
| R3 | **Verificar Atend. Humano** | — (o vendedor pode ter assumido enquanto o cliente lia a prévia) | Sim → R4 · Não → 18 |
| R4 | **Fim de fluxo** | — | — |

As variáveis de CONTEXTO e CADASTRO (`flow.*` dos nós 8 e 13) continuam valendo na reentrada: é a mesma execução do fluxo.

---

### 3.7 Ramo `enviar_catalogo` (Função de fluxo)

| # | Nó | Configuração | Saída → |
|---|---|---|---|
| 29 | **Condicional** "Cadastro feito?" | C1: `{{user.cadastro_status}}` `=` `cadastrado` · C2: `=` `dados_coletados` · C3: `=` `ficha_enviada` | C1, C2, C3 → 30 · Senão → 29a |
| 29a | **Mensagem** "Cadastro antes" | Texto abaixo · Aguardar resposta: Ligado | resposta → R1 |
| 30 | **Salvar no fluxo** "Carregar ofertas" | `url_ofertas` = `{{project.url_ofertas_semana}}` · `url_ofertas_segunda` = `{{project.url_ofertas_segunda}}` · idem `_terca`, `_quarta`, `_quinta`, `_sexta` · `ofertas_validade_ate` = `{{project.ofertas_validade_ate}}` | 31 |
| 31 | **Executar script** "Verificar ofertas" | `scripts/verificar_ofertas.js` (escolhe a lista da rota de `{{user.dia_rota}}`; sem rota, a geral) | sucesso → 32 · erro → 35 |
| 32 | **Salvar no fluxo** | `ofertas_ok` · `ofertas_validade_fmt` · `ofertas_motivo` · `url_ofertas_envio` · `ofertas_rotulo` = `{{input.<mesmo nome>}}` | 33 |
| 33 | **Condicional** "Lista vigente?" | C1: `{{flow.ofertas_ok}}` `=` `sim` | C1 → 33a · Senão → 35 |
| 33a | **Salvar no usuário** | `estado` = `em_atendimento_comercial` · `ofertas_enviadas_em` = `{{flow.data_hora_local}}` | 33b |
| 33b | **Atribuir tag** | `ofertas-enviadas` | 34 |
| 34 | **Mensagem** "Lista de ofertas" | WhatsApp: elemento **Arquivo** = `{{flow.url_ofertas_envio}}` + elemento **Texto** abaixo · **Aguardar resposta do usuário**: Ligado | resposta → R1 |
| 35 | **Observação** | `Lista de ofertas não enviada ({{flow.ofertas_motivo}}). Atualizar os links de ofertas e ofertas_validade_ate nas variáveis do projeto.` | 35a |
| 35a | **Atribuir tag** | `ofertas-indisponiveis` | 36 |
| 36 | **Mensagem** "Lista indisponível" | Texto abaixo · Aguardar resposta: Ligado | resposta → R1 |

O nó 29 é a trava do fluxo para a regra "contato novo passa pela qualificação e pelo cadastro antes de acessar as condições": mesmo que o agente chame `enviar_catalogo` cedo, a lista não sai.

Texto do nó 29a:
```
Antes de te passar as nossas condições, preciso fazer um cadastro rápido do seu comércio. Qual é o nome do estabelecimento?
```
Texto do nó 34:
```
Aqui está nossa lista de ofertas da semana{{flow.ofertas_rotulo}}, válida até {{flow.ofertas_validade_fmt}}! Além desses produtos, tem algum outro item que você precisa para o seu comércio e gostaria de consultar o preço?
```
Texto do nó 36:
```
A lista de ofertas desta semana está sendo atualizada e ainda não consigo te enviar o arquivo. Quais produtos você precisa? Eu consulto o preço para você.
```

### 3.8 Ramo `montar_pedido` (Função de fluxo)

| # | Nó | Configuração | Saída → |
|---|---|---|---|
| 39 | **Condicional** "Cadastro feito?" | igual ao nó 29 | C1, C2, C3 → 40 · Senão → 29a |
| 40 | **Executar script** "Montar prévia" | `scripts/montar_pedido.js` (lê os argumentos da função em `{{input}}`) | sucesso → 41 · erro → 45 |
| 41 | **Salvar no usuário** | `pedido_itens_json` · `pedido_previa_texto` · `pedido_total` · `pedido_total_fmt` · `pedido_qtd_itens` · `pedido_sem_preco` · `pedido_minimo_ok` · `pedido_modalidade` · `pedido_status` · `pedido_atualizado_em` · `estado`, cada um = `{{input.<mesmo nome>}}` | 42 |
| 42 | **Atribuir tag** | `pedido-em-montagem` | 43 |
| 43 | **Mensagem** "Prévia" | Texto: `{{user.pedido_previa_texto}}` · Aguardar resposta: Ligado | resposta → R1 |
| 45 | **Mensagem** "Erro na prévia" | Texto abaixo · Aguardar resposta: Ligado | resposta → R1 |

Texto do nó 45:
```
Não consegui fechar o resumo agora. Pode me mandar de novo os produtos e as quantidades, um por linha?
```
A prévia sai do nó 41 em `user.*` (spike V2: o valor salvo já vale no nó seguinte). Por isso o nó 43 lê `{{user.pedido_previa_texto}}` e não `{{input...}}`. A mesma variável volta ao agente pelas Instruções extras na reentrada, então ele enxerga o pedido certo mesmo que não veja a mensagem enviada pelo fluxo (spike S2).

### 3.9 Ramo `confirmar_previa` (Função de fluxo)

| # | Nó | Configuração | Saída → |
|---|---|---|---|
| 50 | **Salvar no fluxo** | `confirmacao_cliente` = `{{input.confirmacao_cliente}}` · `resumo` = `{{input.resumo}}` · `pendencias` = `{{input.pendencias}}` · `aviso_tipo` = `pedido` | 51 |
| 51 | **Condicional** "Tem prévia aberta?" | C1: `{{user.pedido_status}}` `=` `aguardando_confirmacao` | C1 → 52 · Senão → 51a |
| 51a | **Mensagem** "Sem prévia" | `Antes de encaminhar, quero te mostrar o resumo do pedido para você conferir. Quais produtos e quantidades ficaram?` · Aguardar resposta: Ligado | resposta → R1 |
| 52 | **Condicional** "Mínimo de bar" | C1: `{{user.pedido_minimo_ok}}` `=` `nao` | C1 → 52a · Senão → 53 |
| 52a | **Mensagem** "Abaixo do mínimo" | `Para bares e lanchonetes, atendemos pedidos acima de R$ 1.000,00, e o seu está em {{user.pedido_total_fmt}}. Quer incluir mais algum item para completar?` · Aguardar resposta: Ligado | resposta → R1 |
| 53 | **Salvar no usuário** | `pedido_status` = `confirmado_cliente` · `pedido_confirmado_em` = `{{flow.data_hora_local}}` · `pedido_confirmacao` = `{{flow.confirmacao_cliente}}` · `estado` = `pedido_confirmado_cliente` | 54 |
| 54 | **Atribuir tag** | `pedido-confirmado` | 55 |
| 55 | **Observação** | texto abaixo, destaque colorido | 56 |
| 56 | **Condicional** "Cliente da carteira?" | C1: `{{user.cadastro_status}}` `=` `cadastrado` | C1 → 56a · Senão → 57 |
| 56a | **Salvar no fluxo** | `responsavel_encaminhamento` = `Vendedor {{user.vendedor_nome}}` · `destino` = `vendedor` | 58 |
| 57 | **Executar script** "Montar ficha" | `scripts/montar_ficha.js` (mesmo código do nó 62; aqui lê os dados do cadastro em `user.*` e decide pelo valor: acima de R$ 10 mil Pablo, até R$ 10 mil Pedro) | sucesso → 57a · erro → 57e |
| 57a | **Salvar no fluxo** | `ficha_texto` · `responsavel_encaminhamento` · `destino` = `{{input.<mesmo nome>}}` | 57b |
| 57e | **Salvar no fluxo** (fallback) | `ficha_texto` = `📋 NOVO CLIENTE COM PEDIDO (ficha automática falhou) · {{user.nome_contato}} · {{user.estabelecimento}} · {{user.cidade}}/{{user.uf}} · Total {{user.pedido_total_fmt}}` · `responsavel_encaminhamento` = `Pedro (atendimento inicial)` · `destino` = `pedro` | 57b |
| 57b | **Observação** | `{{flow.ficha_texto}}` (destaque colorido; ficha + resumo da conversa + pedido) | 57c |
| 57c | **Salvar no usuário** | `cadastro_status` = `ficha_enviada` · `estado` = `cadastro_pendente` | 58 |
| 58 | **Executar script** "Montar aviso" | `scripts/montar_aviso.js` (`flow.aviso_tipo` = `pedido`) | sucesso → 58a · erro → 58e |
| 58a | **Salvar no fluxo** | `aviso_json` = `{{input.aviso_json}}` | 58c |
| 58c | **Requisição API** "Avisar faturamento" | Método `POST` · URL `{{project.url_aviso_interno}}` · Cabeçalhos `Authorization` = `Bearer {{env.token_aviso_interno}}` e `Content-Type` = `application/json` · Corpo `{{flow.aviso_json}}` | Sucesso 2XX → 59 · Erro 4XX → 58e |
| 58e | **Observação** | `⚠️ Aviso ao grupo de faturamento NÃO foi enviado. Repassar este pedido ao faturamento manualmente.` | 58f |
| 58f | **Atribuir tag** | `aviso-nao-enviado` | 59 |
| 59 | **Condicional** "Destino do pedido" | C1: `{{flow.destino}}` `=` `vendedor` · C2: `{{flow.destino}}` `=` `pablo` | C1 → V1 · C2 → 59a · Senão → 59b |
| 59a | **Atribuir tag** | `lead-acima-10mil` | G1 |
| 59b | **Atribuir tag** | `lead-ate-10mil` | P1 |

Texto do nó 55 (Observação):
```
🧾 PEDIDO CONFIRMADO PELO CLIENTE (lançar no ERP)
Cliente: {{user.nome_contato}} · {{user.estabelecimento}} · {{user.segmento}}
Cidade: {{user.cidade}}/{{user.uf}} · WhatsApp: {{flow.telefone}}
Vendedor: {{user.vendedor_nome}} ({{user.vendedor_codigo}}) · Rota: {{user.dia_rota}}
Aceite: "{{flow.confirmacao_cliente}}" em {{user.pedido_confirmado_em}}

{{user.pedido_previa_texto}}

Resumo: {{flow.resumo}}
Pendências: {{flow.pendencias}}
Ação: conferir preços com *, cobertura e data de entrega, e lançar no ERP. A confirmação do cliente não é faturamento.
```

O pedido encaminhado é **o texto que o cliente aprovou** (`user.pedido_previa_texto`), não uma nova versão escrita pela LLM. O nó 52 repete a trava de mínimo do script: mesmo que o agente chame `confirmar_previa` cedo, pedido de bar abaixo do mínimo não sai.

Quem decide o destino é o fluxo, não o agente: cliente da carteira vai sempre ao vendedor dele (nó 56); lead vai a Pablo ou a Pedro pelo `user.pedido_total` calculado no nó 40 (nó 57), com a ficha e o resumo da conversa. Todo pedido confirmado gera o aviso ao grupo de faturamento (nós 58 a 58c) antes do Departamento; se o aviso falhar, a Observação 58e e a tag `aviso-nao-enviado` avisam a equipe e o atendimento segue.

### 3.10 Ramo `registrar_cadastro` (Função de fluxo)

| # | Nó | Configuração | Saída → |
|---|---|---|---|
| 60 | **Salvar no usuário** | `nome_contato` · `estabelecimento` · `segmento` · `tipo_pessoa` · `cnpj` · `cidade` · `uf` · `cep` · `endereco` · `ponto_referencia` · `email` · `modalidade` · `produtos_interesse` · `volume_estimado` · `situacao_elegibilidade` · `origem_contato`, cada um = `{{input.<mesmo nome>}}` | 62 |
| 62 | **Executar script** "Montar ficha" | `scripts/montar_ficha.js` (o Salvar no usuário não troca o `input`: o script ainda lê os argumentos) | sucesso → 63 · erro → 63b |
| 63 | **Salvar no fluxo** | `ficha_texto` = `{{input.ficha_texto}}` | 63a |
| 63b | **Salvar no fluxo** (fallback) | `ficha_texto` = `📋 NOVO CLIENTE (ficha automática falhou) · Nome: {{user.nome_contato}} · Estabelecimento: {{user.estabelecimento}} · Cidade: {{user.cidade}}/{{user.uf}} · Volume: {{user.volume_estimado}} · WhatsApp: {{user.identifier}}` | 63a |
| 63a | **Salvar no usuário** | `cadastro_status` = `dados_coletados` · `estado` = `cadastro_pendente` | 64 |
| 64 | **Observação** | `{{flow.ficha_texto}}` (destaque colorido) | 65 |
| 65 | **Atribuir tag** | `cadastro-novo` | 66 |
| 66 | **Mensagem** "Cadastro anotado" | Texto abaixo · Aguardar resposta: Ligado | resposta → R1 |

Texto do nó 66:
```
Cadastro anotado! Agora já posso te passar as nossas condições. Quer receber a lista de ofertas da semana ou prefere me dizer os produtos que está procurando?
```

O cadastro **não** vai para ninguém neste ponto: ele libera as condições (nós 29 e 39) e fica salvo em `user.*`. A ficha segue para a equipe junto com o pedido confirmado (nó 57), e o valor do pedido decide se vai a Pablo ou a Pedro. Lead que se cadastra e sai sem pedido vai a Pedro pelo nó 100a.

### 3.11 Ramo `encaminhar_vendedor` (Função de fluxo)

| # | Nó | Configuração | Saída → |
|---|---|---|---|
| 70 | **Salvar no fluxo** | `motivo` · `resumo` · `dados_pedido` · `urgencia` = `{{input.<mesmo nome>}}` | 71 |
| 71 | **Observação** | texto abaixo | 72 |
| 72 | **Condicional** "Tem vendedor?" | C1: `{{user.cadastro_status}}` `=` `cadastrado` · C2: `{{flow.motivo}}` `=` `financeiro` | C1 → V1 · C2 → G1 · Senão → P1 |

Financeiro: cliente da carteira fica com o vendedor (C1); quem não tem cadastro vai à gerência (C2), mesmo que o agente tenha escolhido `encaminhar_vendedor`.

Texto do nó 71:
```
🔁 SOLICITAÇÃO PARA O VENDEDOR
Cliente: {{user.nome_contato}} · {{user.estabelecimento}} · WhatsApp: {{flow.telefone}}
Motivo: {{flow.motivo}} · Urgência: {{flow.urgencia}}
Pedido citado: {{flow.dados_pedido}}
Resumo: {{flow.resumo}}
Pedido salvo no contato: {{user.pedido_status}} ({{user.pedido_total_fmt}})
```

### 3.12 Ramo `encaminhar_gerencia` (Função de fluxo)

| # | Nó | Configuração | Saída → |
|---|---|---|---|
| 80 | **Salvar no fluxo** | `motivo` · `assunto` · `resumo` · `urgencia` = `{{input.<mesmo nome>}}` · `aviso_tipo` = `gerente` | 81 |
| 81 | **Observação** | texto abaixo, destaque colorido | 82 |
| 82 | **Condicional** "Grave?" | C1: `{{flow.urgencia}}` `=` `alta` · C2: `{{flow.motivo}}` `=` `problema_grave_urgente` · C3: `{{flow.motivo}}` `=` `financeiro_grave` | C1, C2, C3 → 83 · Senão → 88 |
| 83 | **Atribuir tag** | `urgente` | 85 |
| 85 | **Executar script** "Montar aviso" | `scripts/montar_aviso.js` (`flow.aviso_tipo` = `gerente`) | sucesso → 85a · erro → 86e |
| 85a | **Salvar no fluxo** | `aviso_json` = `{{input.aviso_json}}` | 86 |
| 86 | **Requisição API** "Avisar gerente" | igual ao nó 58c | Sucesso 2XX → 88 · Erro 4XX → 86e |
| 86e | **Observação** | `⚠️ Aviso ao gerente NÃO foi enviado. Caso grave: avisar a gerência manualmente.` | 86f |
| 86f | **Atribuir tag** | `aviso-nao-enviado` | 88 |
| 88 | **Condicional** "Cliente da carteira?" | C1: `{{user.cadastro_status}}` `=` `cadastrado` | C1 → V1 · Senão → G1 |

Cliente da carteira fica sempre com o vendedor dele, inclusive em caso grave: o gerente recebe o aviso (nó 86) e a conversa vai ao Departamento do vendedor. Quem não tem cadastro vai ao Departamento Gerência.

Texto do nó 81:
```
⚠️ PARA A GERÊNCIA
Cliente: {{user.nome_contato}} · {{user.estabelecimento}} · WhatsApp: {{flow.telefone}}
Cadastro: {{user.cadastro_status}} · Vendedor: {{user.vendedor_nome}}
Motivo: {{flow.motivo}} · Urgência: {{flow.urgencia}}
Assunto: {{flow.assunto}}
Resumo: {{flow.resumo}}
```

### 3.13 Ramo `encaminhar_fornecedor` (Função de fluxo)

| # | Nó | Configuração | Saída → |
|---|---|---|---|
| 90 | **Salvar no usuário** | `tipo_contato` = `fornecedor` | 91 |
| 91 | **Salvar no fluxo** | `forn_nome` = `{{input.nome_contato}}` · `forn_empresa` = `{{input.empresa}}` · `forn_produtos` = `{{input.produtos_representados}}` · `forn_catalogo` = `{{input.catalogo_recebido}}` · `forn_telefone` = `{{input.telefone_contato}}` · `forn_obs` = `{{input.observacoes}}` | 92 |
| 92 | **Observação** | texto abaixo | 93 |
| 93 | **Atribuir tag** | `fornecedor` | G1 |

Texto do nó 92 (modelo "Novo contato fornecedor" da seção 15):
```
🏭 NOVO CONTATO FORNECEDOR (setor de compras)
Nome: {{flow.forn_nome}}
Empresa / indústria: {{flow.forn_empresa}}
Produtos representados: {{flow.forn_produtos}}
Catálogo recebido: {{flow.forn_catalogo}}
Telefone / WhatsApp: {{flow.forn_telefone}} (conversa: {{flow.telefone}})
Observações: {{flow.forn_obs}}
Destino: setor de compras / Pablo
```

### 3.14 Ramos de saída sem encaminhamento

| # | Nó | Configuração | Saída → |
|---|---|---|---|
| 100 | **Salvar no usuário** (`cliente_sem_interesse`) | `estado` = `sem_interesse` | 101 |
| 101 | **Atribuir tag** | `sem-interesse` | 100a |
| 100a | **Condicional** "Lead cadastrado sem pedido?" | C1: `{{user.cadastro_status}}` `=` `dados_coletados` | C1 → 100b · Senão → 102 |
| 100b | **Observação** | `📋 Lead fez o cadastro e saiu sem pedido. Ficha nas notas anteriores desta conversa. Retomar quando for oportuno.` | P1 |
| 102 | **Fim de fluxo** | — | — |
| 110 | **Salvar no usuário** (`contato_fora_perfil`) | `estado` = `fora_perfil` | 111 |
| 111 | **Atribuir tag** | `fora-perfil` | 112 |
| 112 | **Fim de fluxo** | — | — |

A despedida sai do próprio agente (Função de saída com "Enviar mensagem de transferência?" = Sim, V4).

### 3.15 Ramo `transferir_para_atendente` (Função de saída, já existe)

| # | Nó | Configuração | Saída → |
|---|---|---|---|
| 120 | **Atribuir tag** | `pediu-humano` | 121 |
| 121 | **Observação** | `Cliente pediu atendimento humano. {{user.nome_contato}} · {{user.estabelecimento}} · WhatsApp {{flow.telefone}} · Cadastro: {{user.cadastro_status}} · Pedido salvo: {{user.pedido_status}}` | 122 |
| 122 | **Condicional** | C1: `{{user.cadastro_status}}` `=` `cadastrado` | C1 → V1 · Senão → P1 |

### 3.16 Saída Erro do nó 19

| # | Nó | Configuração | Saída → |
|---|---|---|---|
| 130 | **Observação** | `Erro no agente de IA. Assumir a conversa. Última mensagem do cliente: {{flow.texto_cliente}}` | 131 |
| 131 | **Atribuir tag** | `erro-ia` | 132 |
| 132 | **Departamento** | `Comercial` · Continuar o fluxo após o atendimento: Desligado | — |

---

### 3.17 Blocos de destino (compartilhados; vários ramos ligam neles)

**Bloco V · Vendedor vinculado**

| # | Nó | Configuração | Saída → |
|---|---|---|---|
| V1 | **Salvar no usuário** | `estado` = `encaminhado_vendedor` | V2 |
| V2 | **Atribuir tag** | `encaminhado-vendedor` | V3 |
| V3 | **Condicional** "Expediente" | C1: `{{flow.situacao_horario}}` `=` `DENTRO` | C1 → V5 · Senão → V4 |
| V4 | **Atribuir tag** | `fora-expediente` | V5 |
| V5 | **Condicional** "Qual vendedor" | C1: `{{user.vendedor_codigo}}` `=` `V01` · C2: `{{user.vendedor_codigo}}` `=` `V02` · … uma linha por vendedor (P2) | C1 → V6 · C2 → V7 · … · Senão → V9 |
| V6 | **Departamento** | `Vendedor João` · Continuar o fluxo: Desligado · Observações: `Ver nota com o resumo.` | — |
| V7 | **Departamento** | `Vendedor Maria` · idem | — |
| V9 | **Observação** | `Vendedor não identificado no cadastro (código "{{user.vendedor_codigo}}"). Distribuir para o vendedor da carteira.` | V10 |
| V10 | **Departamento** | `Comercial` · Continuar o fluxo: Desligado | — |

**Bloco P · Pedro (atendimento inicial)**

| # | Nó | Configuração | Saída → |
|---|---|---|---|
| P1 | **Condicional** "Expediente" | C1: `{{flow.situacao_horario}}` `=` `DENTRO` | C1 → P3 · Senão → P2 |
| P2 | **Atribuir tag** | `fora-expediente` | P3 |
| P3 | **Departamento** | `Atendimento Inicial` · Continuar o fluxo: Desligado · Observações: `Ver nota com a ficha/resumo.` | — |

**Bloco G · Pablo (gerência)**

| # | Nó | Configuração | Saída → |
|---|---|---|---|
| G1 | **Salvar no usuário** | `estado` = `encaminhado_gerencia` | G2 |
| G2 | **Atribuir tag** | `encaminhado-gerencia` | G3 |
| G3 | **Condicional** "Expediente" | C1: `{{flow.situacao_horario}}` `=` `DENTRO` | C1 → G5 · Senão → G4 |
| G4 | **Atribuir tag** | `fora-expediente` | G5 |
| G5 | **Departamento** | `Gerência` · Continuar o fluxo: Desligado · Observações: `Ver nota com o resumo.` | — |

Despedida: o Benjamim responde depois do tool result do Departamento (comportamento da plataforma desde 28/09), guiado pelo Comportamento do agente e pelo PRÓXIMO ATENDIMENTO. **Não** colocar Mensagem fixa depois dos Departamentos (duplica a despedida). Se a plataforma mudar e o Benjamim sair calado, adicionar uma Mensagem antes de cada Departamento com a frase de encaminhamento de referência.

---

## 4. Rastreio de uma mensagem (exemplo: pedido de cliente cadastrado)

```
"oi, preciso de 5 cx de skol lata e 2 de red bull"
 1 Início → 2/3 guarda msg_original e texto_cliente → 4 humano? não
 6/7/8 contexto: saudacao=Boa tarde, situacao_horario=DENTRO, telefone=+5543...
 10/11/12/13 carteira: cadastro_encontrado=sim, cad_vendedor_codigo=V01 → 15 user.* gravado
 18 devolve {{input.text}} → 19 Benjamim responde com os preços da base e sugere caixa fechada
 ... cliente aceita → Benjamim chama montar_pedido (lista completa)
 40 calcula → 41 user.pedido_* gravado → 43 envia a prévia e espera
 "pode mandar" → R1/R2 guarda a resposta → R3 humano? não → 18 devolve → 19
 Benjamim chama confirmar_previa(confirmacao="pode mandar", resumo=...)
 50 flow.* → 51 prévia aberta? sim → 52 mínimo? n/a → 53 user.pedido_status=confirmado_cliente
 55 Observação com a prévia aprovada → 56 cadastrado → 56a destino=vendedor
 58/58a/58c aviso ao grupo de faturamento → 59 vendedor → V1..V6 Departamento "Vendedor João"
 Benjamim se despede (tool result do Departamento)

Lead (fora da carteira): "oi" → qualificação → cadastro rápido → registrar_cadastro
 60 user.* → 62/63 ficha → 63a cadastro_status=dados_coletados → 64 Observação → 66 "Cadastro anotado" → R1
 → ofertas (29 libera) → montar_pedido (39 libera) → prévia → "pode mandar" → confirmar_previa
 56 não é da carteira → 57 ficha + resumo, total R$ 12.400,00 → destino=pablo → 57b Observação → 57c ficha_enviada
 58 aviso ao faturamento → 59 pablo → 59a tag lead-acima-10mil → G1..G5 Departamento "Gerência"
```

Em nenhum ponto o pedido depende de a LLM lembrar: ele está em `user.pedido_*` desde o nó 41.

---

## 5. Templates (WhatsApp) para criar no canal e aprovar na Meta (P11)

Uso: o vendedor retoma a conversa quando passaram mais de 24h desde a última mensagem do cliente (ex.: pedido confirmado sábado à noite, atendido segunda 7h30). O atendente usa o Template quando **Verificar Janela 24h** = Não.

**`retomada_pedido_vendedor`** · Utility · pt_BR
```
Olá, {{1}}! Aqui é da Imbatível Atacadista. Recebemos o seu pedido pelo WhatsApp e o vendedor {{2}} já está com ele para conferir e lançar. Podemos continuar por aqui?
```
Exemplos: {{1}} = Carlos · {{2}} = João. Botões de resposta rápida: `Sim, podemos` · `Agora não`.

**`retomada_cadastro`** · Utility · pt_BR
```
Olá, {{1}}! Aqui é da Imbatível Atacadista. Recebemos os dados do seu cadastro pelo WhatsApp e nossa equipe comercial já está analisando. Podemos continuar por aqui?
```
Exemplos: {{1}} = Ana. Botões: `Sim, podemos` · `Agora não`.

Variações e checagem dos critérios Utility: skill `templates-mensagens-utility-marketing`.

---

## 6. Operação semanal da lista de ofertas

1. Subir os PDFs novos em links públicos `https://` (P7): um por dia de rota e o geral. Trocar `url_ofertas_segunda` … `url_ofertas_sexta` e `url_ofertas_semana`. Rota sem lista na semana: deixar a variável vazia (recebe a geral).
2. Trocar `ofertas_validade_ate` para o último dia da validade (`AAAA-MM-DD`).
3. Base de conhecimento › Documentos: excluir os PDFs da semana anterior, subir os novos ("Como chamar este material": `Ofertas rota de terça até DD/MM`, `Ofertas gerais até DD/MM`), Preparação dos trechos conforme `benjamim/instructions/v1.md` 3.3 e Processar.
4. Publicar o agente (material novo só vale publicado).
5. Testar no playground: "qual o preço do item X da oferta?".

Se o passo 2 for esquecido, a lista vence e o fluxo responde "lista sendo atualizada" (nó 36) em vez de mandar arquivo velho, e a Observação do nó 35 avisa a equipe.

---

## 7. Checklist de teste no simulador

1. Rodar os spikes S1 a S8 de `docs/analise-projeto.md` antes de montar os ramos.
2. `teste_horario` = `dentro` → T21. `fora` → T22. `2026-10-30T19:00` (sexta antes de Finados) → despedida "na terça-feira, a partir das 7h30". `intervalo` → "hoje, a partir das 13h30".
3. `consulta_cliente_ativa` = `nao` → `cadastro_encontrado` = `indisponivel` no log do nó 16. Com o endpoint de teste e um telefone da carteira → `sim` e `user.vendedor_codigo` preenchido.
4. Ver no log JSON: nó 41 com `pedido_previa_texto`, nó 55 com a Observação preenchida, nó 63 com a ficha, nó 57a com `destino` (lead de R$ 10.000,01 = `pablo`, de R$ 10.000,00 = `pedro`), nó 58c com o corpo do aviso.
4b. Contato novo pede a lista antes do cadastro → nó 29a (não sai PDF). Cliente com `user.dia_rota` = terça → nó 32 com `url_ofertas_envio` da rota de terça.
4c. Apontar `url_aviso_interno` para um endpoint de teste (ex.: webhook.site) e conferir o JSON; com URL errada, conferir a Observação 58e e a tag `aviso-nao-enviado`.
5. Departamento aparece como "Transferência interceptada (modo teste)": normal. Despedida e silêncio pós-handoff só no número real (Só a equipe).
6. Manter **um editor aberto por fluxo** (duas abas revertem o draft).
7. Antes de ativar Piloto/Todos: apagar `teste_horario`.
