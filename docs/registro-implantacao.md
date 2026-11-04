# Registro da implantação — Imbatível Atacadista (Benjamim)

O que foi montado na plataforma EZ Chat e no n8n, de 27 a 30/10/2026. Registrado em 03/11/2026 a partir do relato de quem montou.
O que ficou diferente do desenho de `benjamim/instructions/v1.md` e `fluxos/fluxo-benjamim-v1.md` está na seção 9. **Quando os dois discordam, vale o que está montado e registrado aqui.**

## 1. Prompt do agente (27/10)
- Prompt do Benjamim em XML, nas regras da skill `ghl-agent-prompt` e sem nada de GHL: **36.406 caracteres** (limite do campo: 40 mil).
- Colado no agente do AI Studio. Começou com `gemini-3.1-flash-lite` e depois passou para o **`gpt-5.1`**.

## 2. Fluxo no EZ (27/10)
- Fluxo **"Agente Atacadista"**, montado a partir do briefing e do documento de fluxo:
  - contexto e horário de atendimento;
  - origem anúncio;
  - cadastro de lead novo e ficha;
  - envio das ofertas;
  - prévia e confirmação do pedido, com o mínimo de R$ 1.000 para bar e lanchonete;
  - encaminhamento para vendedor, gerência, fornecedor e humano;
  - saídas sem interesse e fora do perfil;
  - reentrada depois das mensagens do fluxo.
- 6 departamentos: Atendimento Inicial, Gerência, Comercial, Cléber, Lucas e Alessandro.
- 23 tags e as variáveis do projeto (feriados, links das ofertas, validade, faturamento etc.).

## 3. Carteira dos vendedores (27/10)
- Os webhooks de consulta saíram. As 3 planilhas dos vendedores viraram uma **base dentro do fluxo**:
  - 1.042 telefones;
  - colunas: código, razão social, bairro, comprador, vendedor, rota e dia.
- O fluxo identifica a carteira pelo código do vendedor: 13 Cléber, 30 Lucas, 40 Alessandro. Depois aplica a tag da carteira e encaminha ao departamento do vendedor.
- Faltam as planilhas de 2 vendedores.

## 4. Avisos internos e validação (27/10)
- Os webhooks de aviso externo saíram. Os avisos viraram **Observações dentro da plataforma**.
- Validação:
  - 61 testes de script passando;
  - 43 cenários de caminho, cobrindo 100% dos nós;
  - simulador: cliente da carteira, lead completo, anúncio, fornecedor, caso grave, pedido de humano e fora do perfil.
- Correções:
  - despedida na transferência;
  - "*" da prévia virando negrito no WhatsApp;
  - loop do mínimo quando o item vinha sem preço;
  - conexão do Comercial que sumia ao recarregar o editor.

## 5. Pipeline no CRM (28/10)
- Pipeline **"Vendas WhatsApp (Benjamim)"**, com valor em R$. Etapas:
  1. Novo atendimento
  2. Em qualificação
  3. Cadastro feito
  4. Ofertas enviadas
  5. Prévia enviada
  6. Pedido confirmado (lançar no ERP)
- 8 motivos de perda, entre eles "Não era venda (fornecedor)".
- 9 campos no card: código do cliente, vendedor, cidade, dia da rota, segmento, modalidade, prévia, pendências e resumo.
- Limite da plataforma: a % de chance e os dias de card parado não salvam no EZ.

## 6. CRM automático no fluxo (28/10)
- Fluxo duplicado para não mexer no que funcionava. A cópia **"Agente Atacadista (Com Crm)"** move o card sozinho:
  - primeira mensagem: cria o card em Em qualificação (sem checagem de contato novo);
  - cadastro feito, ofertas, prévia (com valor) e pedido confirmado (com os campos);
  - sem interesse, fora do perfil e fornecedor: perdido, com o motivo de cada um.
- O card nunca volta de etapa.
- Com o `gpt-5.1`, toda função do agente precisa ter **todos os campos como obrigatórios**. Corrigido e publicado; isso consertou os dois fluxos.
- Testado no simulador: lead completo até o pedido confirmado, fora do perfil, sem interesse e fornecedor.

## 7. Preços: tabela padrão e ofertas da semana (29 e 30/10)
- Workflow n8n **"Imbatível · Preços (tabela + ofertas)"**, publicado:
  - consulta: o webhook recebe os produtos e devolve o preço da tabela e a oferta vigente, com as faixas;
  - formulário de atualização: o cliente sobe o PDF semanal e/ou o Excel da tabela.
- O leitor do PDF tirou 136 ofertas, com faixas e validade. Estão carregados os 452 itens da tabela fixa.
- No EZ, só na cópia com CRM: função **`consultar_precos`**, que chama o n8n pelo fluxo, e regras de preço no nó do Benjamim.
- Testado:
  - Heineken pela oferta;
  - a Coca 2L não foi cotada, e ele perguntou por outra marca;
  - prévia com valor real (R$ 761,76).
- Corrigido:
  - "entrega" entrando como item;
  - o agente deduzindo unidades por caixa.
- Entrou também a regra do **menor preço entre tabela e oferta** (ainda **não testada**).

## 8. Pendências da implantação
1. Planilhas dos 2 vendedores que faltam.
2. Subir o PDF de ofertas pelo formulário uma vez, para validar a leitura dentro do n8n. As ofertas carregadas venceram em 30/10.
3. Definir como o cliente atualiza os preços:
   - formulário ou Google Sheets (precisa de uma conta Google no n8n);
   - automatizar a troca do link do PDF no EZ, que hoje é manual.
4. Senha no formulário de preços, ou manter o link restrito.
5. Apagar os cerca de 20 cards de teste da pipeline.
6. Colocar membros nos departamentos.
7. Trocar no canal o fluxo original pela cópia com CRM e preços, depois de um teste final no número real.
8. Testar no número real o caminho do cliente da carteira com preços (não testado no simulador para não mexer na variável de teste).

## 9. Diferenças entre o montado e o desenho do projeto

| Tema | Desenho (`v1.md` / fluxo) | Montado | O que fazer |
|---|---|---|---|
| Prompt | Bloco de 5.745 caracteres em 7 tags (skill ezchat) | XML de 36.406 caracteres (skill ghl-agent-prompt), `gpt-5.1` | O prompt montado passa a ser a fonte. Salvar uma cópia em `benjamim/instructions/` |
| Carteira | Requisição API + `contrato-consulta-cliente.md` | Base de 1.042 telefones dentro do fluxo, códigos 13/30/40 | Contrato da API fica sem uso. Base nova a cada atualização das planilhas |
| Preços | Tabela em DOCX na base de conhecimento | n8n (`consultar_precos`): 452 itens + ofertas do PDF | A KB de preços e o P16 (embedding) saem do caminho crítico |
| **Grupo de faturamento** | Aviso a cada pedido confirmado (regra do cliente de 27/10) | Só Observação na plataforma | **A regra do cliente não está atendida.** O n8n já existe e pode publicar o aviso (S7) |
| **Aviso ao gerente em caso grave** | Aviso ao telefone da gerência | Só Observação | Mesma situação. O telefone da gerência ainda está incompleto (P19) |
| Ofertas por rota | Um PDF por dia de rota | Um PDF semanal lido pelo n8n | Confirmar com o cliente se a oferta muda por rota (item 05 das pendências v2) |
| Menor preço entre tabela e oferta | Não previsto | Regra no nó do Benjamim | Testar antes da troca do fluxo no canal |
| CRM | Sem pipeline; estados em `user.estado` + tags | Pipeline de 6 etapas, 8 motivos de perda, 9 campos | Tags e `user.estado` continuam como apoio |
| Funções | Campos opcionais no JSON Schema | Todos obrigatórios (exigência do `gpt-5.1`) | Atualizar `fluxos/funcoes/` se precisar remontar |
| Vendedores | Departamento `Vendedor <Nome>` (exemplos V01/V02) | Cléber (13), Lucas (30), Alessandro (40), mais 2 a criar | Ok |
