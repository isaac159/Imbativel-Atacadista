# Contrato — consulta da carteira de clientes (nó 11 do Fluxo Benjamim v1)

Resolve as ferramentas `consultar_cliente` e `consultar_vendedor` do briefing (seção 16). O fluxo chama este endpoint uma vez por conversa, antes do agente, e grava o resultado em `{{user.*}}`.

## Requisição

```
GET {{project.url_consulta_cliente}}?telefone=5543984347570
Authorization: Bearer {{env.token_consulta_cliente}}
```

- `telefone`: só dígitos, com 55 + DDD + número, celular já com o 9 (o script `preparar_contexto` normaliza).
- O endpoint deve casar pelo **final do número** (últimos 8 dígitos + DDD), porque a carteira do ERP costuma ter telefone com máscara, sem 55 ou sem o 9.
- Responder em até 5 s. Lento ou fora do ar: o fluxo segue com `cadastro_encontrado = indisponivel` (o cliente é atendido do mesmo jeito).

## Resposta 200

Encontrado:
```json
{
  "encontrado": true,
  "nome_contato": "Carlos",
  "estabelecimento": "Mercado Bom Preço",
  "segmento": "supermercado",
  "cidade": "Ibiporã",
  "uf": "PR",
  "vendedor_codigo": "V01",
  "vendedor_nome": "João",
  "modalidade_preferida": "entrega",
  "dia_rota": "terça",
  "ativo": true
}
```

Não encontrado:
```json
{ "encontrado": false }
```

- `vendedor_codigo` tem que ser igual ao usado no Condicional V5 do fluxo (um Departamento por vendedor).
- `dia_rota`: dia da semana da rota do cliente (`segunda` a `sexta`). Escolhe a lista de ofertas da rota e aparece no aviso ao faturamento. O cliente cadastrado fica sempre com este vendedor e esta rota: só a carteira muda os dois.
- `segmento` de preferência num destes valores: `supermercado`, `rede_supermercados`, `mercearia_mercado`, `conveniencia`, `distribuidora`, `bar_lanchonete` (o script `montar_pedido` usa para a trava de R$ 1.000,00 de bar e lanchonete).
- Campos ausentes viram texto vazio (script `normalizar_cadastro`).
- **Não devolver** CPF, CNPJ, limite de crédito, débitos ou dados de outros clientes (LGPD, seção 18 do briefing): o agente não precisa e o log do fluxo guarda a resposta.

## Erros
- 401 token inválido, 404 rota errada, 5XX fora do ar: todos caem na saída Erro da Requisição API e o atendimento continua como contato não identificado. Monitorar pela proporção de `cadastro_encontrado = indisponivel` no log.

## Implementação sugerida (sem API do ERP)

1. O cliente exporta do ERP, toda semana, a carteira em planilha (telefone, nome, estabelecimento, segmento, cidade, UF, código do vendedor, dia de rota) e cola numa Planilha Google privada.
2. Um Google Apps Script publicado como app da Web lê a planilha, confere o token e responde no formato acima.
3. `url_consulta_cliente` = URL do app da Web; `token_consulta_cliente` = token combinado.
4. Ligar `consulta_cliente_ativa` = `sim` depois de testar no simulador (fluxo, seção 7 item 3).

Se o ERP tiver API, o mesmo contrato vale: a Matte monta um intermediário que traduz a resposta do ERP para este formato, e o fluxo não muda.
