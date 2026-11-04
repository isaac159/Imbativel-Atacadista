# Testes — Imbatível Atacadista (Benjamim)

Cenários: seção 7 de `benjamim/instructions/v1.md` (T01 a T35).
Base: `_padroes/cenarios-base.md` C01 a C10 e catálogo de falhas F01 a F12.

## Onde roda cada teste
- **Playground do agente** (Testar agente): T01 a T08, T10, T12, T14, T15, T23 a T26, T29, T31. Sem contexto do fluxo: todo contato é novo e a saudação é "Olá".
- **Simulador do fluxo** (Testar fluxo), testes (S): horário pela variável `teste_horario` (`dentro`, `fora`, `intervalo` ou `AAAA-MM-DDTHH:mm`) e cadastro pela variável `consulta_cliente_ativa` + endpoint de teste. Apagar `teste_horario` antes de ativar Piloto/Todos.
- **Número real em "Só a equipe"**, testes (R): áudio, despedida depois do Departamento, silêncio do Benjamim enquanto o vendedor atende.

## Scripts dos nós Executar script
`node testes/scripts_teste.js fluxos/scripts` (precisa de `moment` instalado: `npm install moment@2.30.1`). 42 casos: horário com intervalo de almoço, véspera de feriado, sábado, telefone sem o 9, origem por texto e por referral, guardar/devolver texto e áudio, carteira encontrada e não encontrada, prévia com consolidação de item duplicado, caixa por preço unitário, item sem preço, mínimo de bar (1.000,00 exato não passa), ficha no cadastro e com pedido (lead acima de R$ 10 mil → Pablo; exatamente R$ 10 mil e abaixo → Pedro), lista de ofertas vigente/vencida/sem arquivo, lista da rota do cliente e rota sem arquivo (vai a geral), aviso ao faturamento e ao gerente em JSON válido, dia de rota da carteira.
Rodada de 2026-10-27 (regras novas do cliente): **42/42 ok**. O JavaScript ainda precisa rodar no nó Executar script do EZ (ambiente com `moment`).

## Homologação do briefing (seção 19) → testes

| Cenário de homologação | Teste |
|---|---|
| Reconhece cliente cadastrado e recupera seu vendedor | T11, T18 |
| Qualifica novo comerciante sem repetir informações | T02, T07 |
| Não libera ofertas a contato desconhecido sem qualificação e cadastro | T01, T12, T21 |
| Atende pedidos de retirada fora do raio de entrega | T29 |
| Encaminha lead com pedido até R$ 10 mil para Pedro (regra nova, substitui 4 paletes) | T21, T30 |
| Encaminha lead com pedido acima de R$ 10 mil para Pablo (regra nova) | T22, T30 |
| Não oferece pagamento a prazo nem descontos não autorizados | T23 |
| Envia apenas a lista semanal vigente | T13 |
| Registra corretamente vários itens de uma mesma mensagem | T16 |
| Sugere caixa fechada só quando a quantidade é válida | T14 |
| Interrompe sugestões após recusa | T15 |
| Atualiza o pedido quando o cliente altera quantidades | T17 |
| Calcula corretamente o total | T16 + `scripts_teste.js` |
| Pede confirmação antes de encaminhar a prévia | T19 |
| Não afirma faturamento sem confirmação | T18 |
| Direciona problemas logísticos ao vendedor | T24 |
| Coleta corretamente os dados de fornecedores | T25 |
| Trata demandas graves sem revelar contatos não autorizados | T26 |
| Respeita áudios e preferências de resposta | T28 (voz do ElevenLabs, P10) |
| Encaminha histórico e resumo nas transferências | T18, T21 (Observação) |
| Respeita o horário humano e não promete retorno imediato | T09, T22 |

Regras novas de 27/10 sem cenário no briefing: lista da rota (T13), vendedor e rota fixos (T18, T32), Patrão/Patroa (T31), financeiro sem cadastro (T33), caso grave com aviso ao gerente (T34), lead cadastrado sem pedido (T35).

## Registro
Salvar cada rodada como `testes/TESTE-AAAA-MM-DD.md`, no formato:

```
CENÁRIO Tnn: nome
TRANSCRIPT:
  lead: ...
  agente: ...
RESULTADO: PASSOU | FALHOU
SE FALHOU: qual regra permitiu o erro (tag do bloco, skill, guardrail ou nó do fluxo)
```

Na dúvida, FALHOU.
