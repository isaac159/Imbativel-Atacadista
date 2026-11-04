# Análise do projeto — Imbatível Atacadista (EZ Chat)

Data: 2026-10-26
Fontes: `docs/briefing.md` (briefing v1.0 de 21/10/2026), skill `ezchat-agent-instructions` (SKILL.md + template + **mapa de 06/10**, a versão do `claude-packs.zip`, que já traz variáveis, JSON Schema e funções do ez.flow), `_padroes/` (convenções, cenários base, catálogo de falhas).

> A cópia do `ezchat-agent-instructions.zip` (11/09) ainda diz "aba Fluxos não mapeada". A fonte da verdade aqui é a do `claude-packs.zip` (06/10), a mesma usada na Faculdade da Costura.

---

## 1. Resumo do projeto

| | |
|---|---|
| Cliente | Imbatível Atacadista LTDA, Jataizinho/PR. Atacado de bebidas (foco em destilados) para revenda, há mais de 15 anos |
| Agente | **Benjamim**, assistente virtual de atendimento e vendas, sempre identificado como IA |
| Canal | WhatsApp +55 43 3339-2510 (confirmar se é API oficial, P3) |
| Disponibilidade | IA 24h/7d. Equipe humana seg a sex, 07h30–12h00 e 13h30–17h30 |
| Onde a IA para | Prévia do pedido confirmada pelo cliente → vendedor lança no ERP. Cliente da carteira → sempre o vendedor vinculado. Lead → cadastro antes das condições; ficha + resumo + pedido para Pedro (até R$ 10 mil) ou Pablo (acima de R$ 10 mil). Todo pedido confirmado avisa o grupo de faturamento |
| Fora do escopo do cliente | Integração direta com ERP (o vendedor digita o pedido) |

**Um agente, um número, um fluxo.** Diferente da Faculdade da Costura (dois agentes com pontes), aqui tudo cabe num único agente com três jornadas (A cadastrado, B novo, C tráfego pago) e roteamento por pessoa (vendedor vinculado, Pedro, Pablo).

---

## 2. O que muda em relação a um agente "comum"

Este é o projeto mais operacional que fizemos no EZ Chat. Três exigências do briefing não cabem só no prompt e por isso vão para o fluxo:

| Exigência do briefing | Por que o prompt sozinho falha | Solução no ez.flow |
|---|---|---|
| Reconhecer cliente cadastrado e o vendedor dele (seção 06 A, 15) | A LLM não tem acesso à carteira do ERP | **Requisição API** no início do fluxo consulta a carteira pelo telefone; resultado vai para `{{user.*}}` e para as Instruções extras do agente |
| Calcular o total da prévia corretamente (seção 12, cenário de homologação) | LLM erra conta com 6+ itens e esquece item em conversa longa | Função de fluxo `montar_pedido`: o agente manda a lista completa, o **Executar script** calcula subtotais e total, grava o pedido em `{{user.pedido_*}}` e o **fluxo** envia a prévia |
| Encaminhar ao responsável certo por cadastro, motivo e volume (matriz da seção 15) | Roteamento a critério da LLM é instável | Funções de fluxo com parâmetros enumerados (`motivo`) e **Condicional** decidindo o Departamento pelo cadastro e pelo total calculado do pedido (regra de R$ 10 mil), nunca pela LLM |

Regra de divisão (mesma da Faculdade): **o agente decide o que dizer; o fluxo decide para onde vai e guarda o estado.** Horário, cadastro, vendedor, total do pedido, mínimo de bar/lanchonete e departamento nunca ficam a critério da LLM.

---

## 3. Arquitetura no EZ Chat

```
Projeto EZ Chat "Imbatível Atacadista"
├── Canal:        WhatsApp 43 3339-2510
├── AI Studio:    Benjamim                       ← personalidade, base, skills, guardrails, funções
├── Fluxo:        Fluxo Benjamim v1 (fluxo padrão do canal)
├── Departamentos: Atendimento Inicial (Pedro) · Gerência (Pablo) · Vendedor <nome> (um por vendedor) · Comercial (fallback)
├── Variáveis do projeto: feriados_ano, teste_horario, consulta_cliente_ativa, url_consulta_cliente,
│                         url_ofertas_semana, ofertas_validade_ate
├── Variáveis de ambiente: token_consulta_cliente (segredo, só no cabeçalho da Requisição API)
├── Integração:   endpoint de consulta da carteira (contrato em integracao/contrato-consulta-cliente.md)
└── Tags:         origem-*, cliente-cadastrado, novo-contato, ofertas-enviadas, pedido-*, cadastro-*, encaminhado-*, ...
```

### 3.1 Desenho do fluxo (visão geral; nó a nó em `fluxos/fluxo-benjamim-v1.md`)

```
Início
 └─ [ENTRADA] Guardar mensagem → Salvar no fluxo (msg_original, texto_cliente)
 └─ Verificar Atend. Humano ── Sim → Fim (vendedor está falando; Benjamim não responde)
 └─ Carregar variáveis → Preparar contexto (horário, saudação, telefone, origem) → Salvar no fluxo
 └─ Condicional consulta_cliente_ativa = sim
        ├─ Requisição API (carteira) ── 2XX → Normalizar cadastro → Salvar no fluxo → Condicional encontrado = sim → Salvar no usuário (cadastro, vendedor) + tag cliente-cadastrado
        │                             └─ 4XX/5XX → Salvar no fluxo cadastro_encontrado = indisponivel
        └─ Senão → Salvar no fluxo cadastro_encontrado = indisponivel
 └─ Devolver mensagem → AI Studio - Agente (Benjamim)   ◄──────────────── [REENTRADA] (toda volta ao agente passa por aqui)
        ├─ enviar_catalogo (fluxo)   → valida ofertas vigentes → Arquivo PDF → Mensagem (aguarda resposta) → REENTRADA
        ├─ montar_pedido (fluxo)     → calcula prévia → Salvar no usuário (pedido) → Mensagem prévia (aguarda resposta) → REENTRADA
        ├─ confirmar_previa (fluxo)  → confere prévia salva → faixa de volume → vendedor / Pablo / Pedro
        ├─ registrar_cadastro (fluxo)→ salva a ficha → libera as condições → Mensagem → REENTRADA (a ficha vai com o pedido)
        ├─ encaminhar_vendedor (fluxo)   → vendedor vinculado (ou Pedro se novo, Comercial se sem vínculo)
        ├─ encaminhar_gerencia (fluxo)   → Pablo
        ├─ encaminhar_fornecedor (fluxo) → Pablo (compras)
        ├─ cliente_sem_interesse (saída) → tag + estado → Fim
        ├─ contato_fora_perfil (saída)   → tag + estado → Fim
        ├─ transferir_para_atendente (saída, já existe) → vendedor / Pedro
        └─ Erro → Observação → Comercial
```

### 3.2 Por que as mensagens não se perdem (requisito do usuário)

Cinco garantias, todas com variável de fluxo ou de usuário:

1. **Mensagem do cliente guardada antes de qualquer script/API.** `Guardar mensagem` grava `flow.msg_original` (JSON inteiro: texto, áudio, imagem) e `flow.texto_cliente` logo depois do Início. `Devolver mensagem` recoloca no `{{input}}` antes do agente. Sem isso o EZ responde "Não entendi sua mensagem" (mapa, 25/09).
2. **Um único ponto de reentrada.** Toda vez que o fluxo envia algo e espera o cliente (prévia, lista de ofertas, aviso de mínimo), a resposta volta pela cadeia `REENTRADA` (guardar → verificar humano → devolver → agente). Nenhum ramo liga direto no agente.
3. **Saída de nó gravada no nó seguinte.** Toda Requisição API, Executar script e Função de fluxo é seguida de um Salvar no fluxo/usuário, porque o próximo script troca o `{{input}}`.
4. **Estado do pedido fora do histórico da conversa.** O pedido em montagem fica em `user.pedido_itens_json`, `user.pedido_previa_texto`, `user.pedido_total` e `user.pedido_status`, e volta ao agente em toda execução pelas Instruções extras. Se a conversa passar de 50 mensagens, cair, ou o cliente voltar no dia seguinte, o pedido continua lá.
5. **Encaminhamento usa o que o fluxo gravou, não o que a LLM lembra.** `confirmar_previa` não recebe os itens de novo: lê `user.pedido_previa_texto` salvo pelo `montar_pedido`. A Observação para o vendedor sai do estado gravado, sem risco de a LLM reescrever o pedido diferente do que o cliente aprovou.

Dicionário completo de variáveis (onde nasce, quem lê): `fluxos/fluxo-benjamim-v1.md` › seção 2.

---

## 4. Mapeamento briefing → EZ Chat

| Seção do briefing | Destino |
|---|---|
| 01 Identificação, diferenciais | Base › Sobre o negócio + FAQ |
| 02 Agente, estilo, aberturas | Personalidade › Nome, Tom (Próxima e simpática), bloco `<persona>`, `<linguagem>`, `<mensagens_de_referencia>` |
| 02 Cumprimentar conforme horário | Script `preparar_contexto` calcula `flow.saudacao` → Instruções extras. No playground o agente usa "Olá" |
| 02 Texto e áudio | Inteligência › Entender áudio Ligado. Responder em áudio Ligado com a voz masculina do ElevenLabs (P10) |
| 03 Pode / não pode | `<o_que_nunca_fazer>` + guardrails |
| 04 Produtos | Base › Documentos (tabela de produtos e preços, **não recebida**, P1) |
| 05 Público e qualificação | `<roteiro>` etapas 2–3 + skill S1 |
| 06 Fluxos A, B, C | `<roteiro>` com ramos por CADASTRO e ORIGEM vindos do fluxo |
| 07 Cadastro + ficha + roteamento | Função de fluxo `registrar_cadastro` (antes das condições) + script `montar_ficha` no `confirmar_previa` + Condicional por `destino` (valor do pedido, R$ 10 mil) |
| 08 Pagamento | Base › Formas de pagamento + skill S3 + guardrail |
| 09 Logística, programação de entregas | Base › Entrega e frete + FAQ. Cobertura por cidade: P5 |
| 10 Ofertas PDF | Função de fluxo `enviar_catalogo` + variáveis `url_ofertas_<dia>` por rota, `url_ofertas_semana` (geral) e `ofertas_validade_ate` + Documentos (PDFs da semana) |
| 11 Upsell, frequência de sugestões | Skill S4 |
| 12 Prévia e confirmação | Funções `montar_pedido` e `confirmar_previa` + script `montar_pedido` |
| 13 FAQ (16 situações) | Base › Perguntas frequentes (12 pares) + skills S6/S7 para as situações de encaminhamento |
| 14 Objeções | Skill S3 |
| 15 Encaminhamentos | Funções `encaminhar_*` + Departamentos |
| 16 Estados operacionais | `user.estado` gravado pelo fluxo em cada ramo + tags (tabela no fluxo, seção 2.3) |
| 16 Ferramentas funcionais | Ver 4.1 |
| 17 Regras prioritárias | Bloco + guardrails |
| 18 Pontos de validação | Pendências (seção 0 do v1) com a regra provisória adotada |
| 19 Homologação | Testes T01–T30 (`benjamim/instructions/v1.md` seção 7; mapa em `testes/README.md`) |

### 4.1 As 17 ferramentas funcionais do briefing (seção 16) na plataforma

| Ferramenta do briefing | Como fica no EZ Chat |
|---|---|
| consultar_cliente, consultar_vendedor | Requisição API no início do fluxo (não é função da LLM) |
| consultar_produtos, consultar_precos, consultar_ofertas | Busca na base (Ferramentas do EZ Chat) sobre a tabela de produtos e o PDF da semana |
| enviar_catalogo | Função de fluxo `enviar_catalogo` |
| verificar_regiao_entrega | Base (lista de cidades atendidas, P5). Até lá o agente não confirma cobertura |
| consultar_pedido | Sem sistema de pedidos na v1: `encaminhar_vendedor` com motivo `acompanhamento_pedido` |
| montar_pedido, atualizar_pedido | Uma função só, `montar_pedido`: sempre recebe a **lista completa**, o que impede item duplicado |
| confirmar_previa | Função de fluxo `confirmar_previa` |
| registrar_cadastro | Função de fluxo `registrar_cadastro` |
| encaminhar_vendedor, encaminhar_gerencia, encaminhar_fornecedor | Funções de fluxo com os mesmos nomes |
| finalizar_atendimento | Duas Funções de saída: `cliente_sem_interesse` e `contato_fora_perfil` (saída envia a despedida antes de sair) |

---

## 5. Divergências e correções no briefing

| # | Onde | O que tem | O que adotei |
|---|---|---|---|
| D1 | Ficha de novo cliente (seção 07) | Variáveis `{{input.nam}}`, `{{input.credencial_identificação }}` (acento e espaço no fim), `{{input.endereço}}`, `{{input.ponto_de_referência}}`, `{{input.responsavel_transporte}}` | Chaves sem acento e sem espaço: `nome_contato`, `cpf_cnpj`, `endereco`, `ponto_referencia`, `responsavel_encaminhamento`. Acento ou espaço em chave quebra a leitura `{{input.x}}` |
| D2 | Ficha | "Responsável pelo encaminhamento" vinha como `responsavel_transporte` | Calculado pelo script a partir do total do pedido (regra de R$ 10 mil), não preenchido pela LLM |
| D3 | Seção 18 | Telefone de Pablo com dois números | Nenhum número de Pablo no agente; encaminhamento interno (Departamento Gerência) |
| D4 | Seção 18 + atualização de 27/10 | Cadastro com Tati ou com Pedro; corte por 4 paletes | Substituído pela regra nova: lead com pedido acima de R$ 10 mil → Pablo, até R$ 10 mil → Pedro, com ficha e resumo. Tati recebe pelo grupo de faturamento. O corte por paletes saiu do agente e do fluxo |
| D5 | Seção 05 / 18 | Bar e lanchonete "acima de R$ 1.000,00" | Regra estrita no script: total **maior que** 1000,00. Exatamente 1000,00 não passa |
| D6 | Seção 02 | "Áudio recebido gera resposta em áudio" | Resolvido: Responder em áudio Ligado com a voz masculina do ElevenLabs escolhida pelo cliente. A prévia e as listas saem em texto pelo fluxo. Falta testar se o toggle espelha o formato (T28, P10) |
| D10 | Atualização de 27/10 | Raio de entrega de 150 km no briefing | 100 km do CD em toda a base, FAQ e testes |
| D11 | Atualização de 27/10 | "Repasse a financeiro: enviar para gerência, somente se não for lead cadastrado" | Lido como: financeiro de cliente da carteira fica com o vendedor; de quem não tem cadastro vai à Gerência (nó 72). Confirmar com o cliente |
| D12 | Atualização de 27/10 | "Casos graves também repassar para o gerente" + "cliente cadastrado sempre permanece ao vendedor" | Caso grave de cliente da carteira fica no Departamento do vendedor e o gerente recebe aviso; sem cadastro vai à Gerência (nós 82 a 88) |
| D7 | Seção 02 / skill | "Cumprimentar conforme horário" vs regra da skill (sem variável de hora no agente) | Saudação calculada no fluxo (`flow.saudacao`), entra pelas Instruções extras. Cumpre o briefing sem variável no bloco |
| D8 | Seção 07 | CPF/CNPJ na ficha vs guardrail "Não pedir dados sensíveis" | v1 coleta **CNPJ** (dado público de empresa). **CPF não**: fica para Pedro no cadastro. P9 |
| D9 | Seção 12 | Exemplos de mensagem com travessão ("Cerveja — caixa") | Prévia gerada sem travessão (convenção 1) |

---

## 6. Riscos e spikes antes de montar

| # | Ponto não testado no mapa | Teste no simulador | Se falhar |
|---|---|---|---|
| S1 | Ligar uma saída de função de volta no **mesmo** nó AI Studio (laço de reentrada) | `montar_pedido` → Mensagem com Aguardar resposta → REENTRADA → agente responde à resposta do cliente | Usar **Mudar de fluxo** para o próprio fluxo com payload, começando no Início (o Início já faz a ENTRADA) |
| S2 | O agente enxerga no histórico a prévia que o fluxo enviou (V7 mostrou isso para saudação) | Depois da prévia, cliente diz "tira o energético"; o agente deve chamar `montar_pedido` sem o energético | A prévia já vai para as Instruções extras via `{{user.pedido_previa_texto}}`: o agente vê o pedido mesmo que não veja a mensagem |
| S3 | Parâmetro do tipo **array** (`itens`) em Função de fluxo | Log do Executar script mostra `input.itens` como lista | Trocar `itens` por `itens_texto` (uma linha por item, `produto; apresentacao; unidade; qtd; preco_unit; preco_caixa; qtd_por_caixa`) e o script faz o parse. O script já aceita os dois formatos |
| S4 | Depois de Função de fluxo **sem** Departamento (enviar_catalogo, montar_pedido) o agente fica calado (V4) | Ver se sai só a mensagem do fluxo | Se o agente também escrever, o bloco já manda não escrever nada depois dessas funções; reforçar na descrição da função |
| S5 | Instruções extras com `{{user.x}}` vazio | Primeiro contato sem cadastro | Variável inexistente vira texto vazio (mapa); sem impacto |
| S6 | Referral de anúncio (Click-to-WhatsApp) no `{{input}}` | Mandar mensagem por um anúncio real e ler o log do Início | Origem só pelo texto (palavras "anúncio", "vi no Instagram", mensagem pré-preenchida do anúncio, P6) |
| S7 | Aviso no **grupo de faturamento** e ao gerente. O EZ não tem nó mapeado para escrever em grupo de WhatsApp | Requisição API POST para `url_aviso_interno` (contrato em `integracao/contrato-aviso-interno.md`) e conferir a mensagem no grupo | Mesmo endpoint manda ao telefone da Tati (template Utility, P14). Último recurso: nó Alerta via E-mail para o faturamento |
| S8 | Toggle **Responder em áudio** com a voz do ElevenLabs | Mandar áudio e texto no número real (T28) | Se responder tudo em áudio, alinhar com o cliente; a prévia continua em texto pelo fluxo |

---

## 7. O que precisa do cliente para lançar

Lista completa na seção 0 de `benjamim/instructions/v1.md`. Bloqueiam o lançamento: **P1** (tabela de produtos e preços), **P2** (carteira de clientes × vendedores), **P3** (canal API oficial), **P4** (equipe usando o EZ Chat como caixa de entrada). Sem P1 o Benjamim qualifica, cadastra e encaminha, mas não monta pedido com preço: a regra provisória da seção 18 ("sem base, encaminha ao vendedor") já está no bloco.
