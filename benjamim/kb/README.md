# Base de conhecimento — materiais do Benjamim

Nada aqui foi recebido ainda (P1, P5, P7 em `benjamim/instructions/v1.md`). Este arquivo diz ao cliente o formato e à Matte como preparar.

## 1. Tabela de produtos e preços (P1)

Planilha com **uma linha por item vendável** (mesmo produto em embalagem diferente = outra linha). Colunas:

| Coluna | Exemplo | Obrigatória |
|---|---|---|
| Categoria | Destilados · Uísques · Cervejas · Refrigerantes · Sucos · Energéticos · Água mineral | sim |
| Produto e marca | Cerveja Skol | sim |
| Apresentação | Lata 350 ml | sim |
| Unidade de venda | caixa · fardo · unidade · palete | sim |
| Unidades por caixa/fardo | 12 | sim |
| Preço unitário (R$) | 3,50 | sim, se vende por unidade |
| Preço por caixa/fardo (R$) | 42,00 | sim, se vende por caixa |
| Faixas por volume | 10+ caixas: R$ 40,00 a caixa | se houver |
| Preço de retirada no CD | R$ 39,00 a caixa | se houver |
| Caixas por palete | 120 | opcional (ajuda a regra de carga fechada de 12 paletes) |
| Disponível | sim / não | sim |
| Validade da tabela | 31/10/2026 | sim (uma vez, no topo) |

Preparação (regra da skill `ezchat-agent-instructions`, tabela de embedding):
1. Converter para **DOCX** (Word): um **Título 2** por item, no formato `Produto e marca · Apresentação`, e embaixo cada coluna como parágrafo `Campo: valor`. `.md` não sobe e `.txt` perde os títulos.
2. Itens com "Disponível = não" ficam fora do DOCX (o agente nunca oferece indisponível).
3. Contar os itens: 30 ou mais **e** 5 ou mais começando pela mesma palavra → `text-embedding-3-large` (P16, aprovação do cliente). Senão `small`.
4. Subir, "Estrutura do documento", 1024 / 0, pré-visualizar e Processar. **Remover preços: Desligado.**
5. Tabela nova substitui a anterior (excluir a antiga antes de processar a nova).

## 2. Lista semanal de ofertas em PDF (P7)

- Uma lista por **dia de rota** (segunda a sexta) e uma **geral** para contato novo. Cliente da carteira recebe a lista da rota vinculada ao cadastro.
- Cada PDF vai para dois lugares: link público `https://` (variáveis `url_ofertas_segunda` … `url_ofertas_sexta` e `url_ofertas_semana` para a geral; o fluxo envia o arquivo) e Documentos (o agente lê os preços).
- Nome no Documentos: `Ofertas rota de terça até DD/MM`, `Ofertas gerais até DD/MM`. O nome com a rota é o que impede o Benjamim de cotar a oferta de uma rota para cliente de outra.
- Rotina completa: `fluxos/fluxo-benjamim-v1.md` › 6.

## 3. Cidades atendidas (P5)

DOCX com um parágrafo por cidade: `Cidade/UF: entrega regional (até 100 km)` ou `Cidade/UF: só carga fechada (12 paletes) ou retirada`. "Por parágrafos e frases", 1024 / 100. Enquanto não existir, o Benjamim não confirma cobertura.
