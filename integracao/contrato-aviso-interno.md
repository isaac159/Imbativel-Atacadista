# Contrato — aviso interno (grupo de faturamento e gerente)

Usado pelos nós 58c ("Avisar faturamento") e 86 ("Avisar gerente") do Fluxo Benjamim v1. O EZ Chat não tem nó mapeado para escrever num grupo de WhatsApp (spike S7), então o fluxo entrega o aviso pronto a um endpoint, e o endpoint publica.

## Quando o fluxo chama

| Evento | `tipo` | Destino |
|---|---|---|
| Todo pedido confirmado pelo cliente (carteira ou lead) | `pedido` | Grupo de faturamento (`grupo_faturamento`). Alternativa: Tati, `telefone_faturamento` = +55 43 99634-6901 |
| Caso grave ou urgente (`encaminhar_gerencia` com urgência alta, `problema_grave_urgente` ou `financeiro_grave`) | `gerente` | Telefone da gerência (`telefone_gerencia`, número a confirmar: P19) |

## Requisição

```
POST {{project.url_aviso_interno}}
Authorization: Bearer {{env.token_aviso_interno}}
Content-Type: application/json

{{flow.aviso_json}}
```

O corpo é montado pelo script `fluxos/scripts/montar_aviso.js` (JSON já escapado, porque a prévia tem aspas e quebras de linha):

```json
{
  "tipo": "pedido",
  "destino": "faturamento",
  "grupo": "Faturamento Imbatível",
  "telefone": "+5543996346901",
  "texto": "🧾 PEDIDO CONFIRMADO PELO WHATSAPP (Benjamim)\nCliente: Carlos · Mercado Bom Preço · Ibiporã/PR\n..."
}
```

- `texto` chega pronto para publicar, com no máximo 3.500 caracteres.
- `grupo` vazio no aviso ao gerente; `telefone` sempre preenchido com o destino alternativo.

## Resposta

- 2XX: aviso entregue. O fluxo segue para o Departamento.
- Qualquer erro: o fluxo grava a Observação "aviso NÃO foi enviado", aplica a tag `aviso-nao-enviado` e segue para o Departamento do mesmo jeito. O atendimento do cliente nunca para por causa do aviso.

## Como publicar no grupo (decidir no spike S7)

1. **API do EZ Chat**, se a conta permitir enviar para grupo ou para número interno por template Utility. É a primeira opção a testar.
2. **Automação** (n8n ou Make) que recebe o POST e publica no grupo por um número de WhatsApp da equipe que já está no grupo.
3. Se nenhuma servir: mandar o aviso de pedido para o telefone da Tati por template Utility, e trocar este nó por **Alerta via E-mail** como último recurso.

Os telefones internos ficam só em variável de projeto e neste endpoint. Nunca vão para as Instruções extras nem para mensagens ao cliente.
