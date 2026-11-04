# Imbatível Atacadista — Agente Benjamim (EZ Chat)

Um agente, um número WhatsApp (43 3339-2510), um fluxo. Atende comerciantes 24h, reconhece cliente da carteira (sempre com o mesmo vendedor e dia de rota), qualifica e cadastra contato novo antes das condições, envia a lista de ofertas da rota, monta a prévia do pedido com total calculado pelo fluxo e encaminha ao vendedor ou, para lead, a Pedro (até R$ 10 mil) ou a Pablo (acima de R$ 10 mil). O desenho prevê aviso ao grupo de faturamento a cada pedido confirmado; na implantação ele ficou só como Observação (ver registro).

**Estado em 03/11/2026:** o agente e os fluxos "Agente Atacadista" e "Agente Atacadista (Com Crm)" estão montados no EZ. Os preços vêm do n8n. O que foi feito, as pendências da implantação e as diferenças em relação ao desenho estão em `docs/registro-implantacao.md`. Quando o registro e o desenho discordam, vale o registro.

| O quê | Onde |
|---|---|
| **Registro da implantação (o que está montado)** | `docs/registro-implantacao.md` |
| Análise do projeto, arquitetura, divergências do briefing e spikes | `docs/analise-projeto.md` |
| Briefing em texto (fonte: DOCX v1.0 de 21/10/2026) | `docs/briefing.md` |
| Benjamim: instruções aba por aba + pendências + testes | `benjamim/instructions/v1.md` |
| Formato dos materiais da base (tabela, PDF de ofertas, cidades) | `benjamim/kb/README.md` |
| Fluxo nó a nó, dicionário de variáveis, templates, rotina semanal | `fluxos/fluxo-benjamim-v1.md` |
| Código dos nós Executar script | `fluxos/scripts/` |
| Funções do agente (JSON Schema) | `fluxos/funcoes/` |
| Contrato da consulta de carteira (Requisição API) | `integracao/contrato-consulta-cliente.md` |
| Contrato do aviso ao grupo de faturamento e ao gerente | `integracao/contrato-aviso-interno.md` |
| Testes e mapa da homologação | `testes/README.md`, `testes/scripts_teste.js` |

Ordem de montagem: pendências P1–P4 → variáveis do projeto/ambiente, tags e departamentos → agente (Inteligência, Base, Personalidade) → spikes S1–S8 no simulador → funções → fluxo → testes → publicar → canal (Só a equipe → Piloto → Todos).
