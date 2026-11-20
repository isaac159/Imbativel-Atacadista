# Portal de preços · Imbatível Atacadista

Portal com login onde a equipe da Imbatível envia o **PDF das ofertas da semana** e a **tabela de preços padrão (Excel)** que o Benjamim usa, e vê o que mudou.
O portal faz o que o formulário do n8n fazia: lê os arquivos, guarda os preços e compara com a versão anterior. O n8n fica só com a consulta do EZ: a cada pergunta de preço, ele busca os dados no portal.

```
EZ (Benjamim) ──POST busca──▶ n8n "Consulta de preços (EZ)" ──GET /api/dados──▶ portal ──▶ Upstash Redis
                                                                                  ▲
                         equipe Imbatível ──login──▶ /painel (envia PDF e Excel) ─┘   /resumo (o que mudou)
```

```
index.html        login (logo Imbatível + "Tecnologia Matte")
painel.html       envio dos dois arquivos + últimos envios da equipe
resumo.html       números, o que mudou no último envio e a lista de preços valendo
clientes.html     um quadro por vendedor para enviar a LISTA DE CLIENTES (PDF) de cada um
assets/           estilo.css, logos e ícones
api/login.js      POST: confere usuário e senha e grava o cookie de sessão (12 h)
api/sessao.js     GET: quem está logado · DELETE: sair
api/atualizar.js  POST (sessão): recebe texto do PDF / linhas do Excel, lê, compara e salva
api/resumo.js     GET (sessão): preços atuais + histórico de envios
api/dados.js      GET (chave do n8n): tabela e ofertas para a busca do Benjamim
api/clientes.js   GET/POST (sessão): resumo das carteiras / troca a lista de um vendedor
api/carteira.js   POST (mesma chave do n8n): consulta do fluxo da EZ pelo telefone do contato (nó 10)
api/_carteira.js  leitura da LISTA DE CLIENTES por colunas, consulta (mesma lógica do antigo nó 10) e comparação
api/_leitura.js   leitura do PDF e da planilha (mesma regra dos nós do n8n) e comparação
api/_armazem.js   Upstash Redis na Vercel, pasta .dados/ no computador
api/_inicial.json dados de partida (os mesmos que estavam no n8n)
n8n/consulta-precos-ez.json   fluxo novo da consulta para importar no n8n
dev.js            servidor local que imita a Vercel
```

**Por que o arquivo não sobe inteiro:** o PDF de ofertas tem uns 50 MB e a Vercel aceita no máximo 4,5 MB por envio. Então o navegador lê o PDF (pdf.js) e a planilha (SheetJS) e manda só o texto e as linhas, uns 50 KB. A interpretação, a conferência e a gravação acontecem no servidor (`api/_leitura.js`).

## Rodar no VS Code
```bash
npm run dev
```
Abra http://localhost:3000 e entre com o usuário `teste` e a senha `teste123` (padrão do `dev.js` quando o `.env.local` não define outro).
Sem banco configurado, os preços ficam na pasta `.dados/`. Apague essa pasta para voltar aos dados iniciais. A chave local do n8n é `chave-local-de-teste-do-n8n-0000`.

## Publicar na Vercel
1. Suba esta pasta num repositório Git (ou use `vercel` pela linha de comando dentro dela).
2. Vercel → Add New Project → importar → Framework: **Other**. Não precisa de build (a Vercel instala sozinha o pacote `redis`).
3. Vercel → Storage → **Redis** ou **Upstash for Redis** (plano grátis) → Connect ao projeto. O Redis cria `REDIS_URL`; o Upstash cria `KV_REST_API_URL` e `KV_REST_API_TOKEN`. O portal aceita os dois.
4. Settings → Environment Variables (Production):
   - `PORTAL_USUARIOS`: `imbativel:SENHA-FORTE`. Para mais de um usuário, separe com `;`.
   - `PORTAL_SEGREDO` e `PORTAL_CHAVE_N8N`: gere cada um com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
5. Deploy.

## Ligar o n8n ao portal
1. No n8n, importe `n8n/consulta-precos-ez.json` (ou edite o fluxo atual da consulta: entre o Webhook e o "Buscar preços" entra o nó HTTP **Dados do portal**).
2. No nó **Dados do portal**, troque `SEU-PORTAL.vercel.app` pelo endereço do portal e `COLE_AQUI_A_PORTAL_CHAVE_N8N` pela chave da Vercel. O ideal é guardar a chave numa credencial "Header Auth" do n8n.
3. O webhook continua com o mesmo caminho (`72fa7362-…`), então o EZ não muda nada.
4. Teste: envie um arquivo pelo portal e pergunte um preço ao Benjamim. Depois **desative o fluxo do formulário antigo** ("Atualizar preços do Benjamim"), que deixou de ser usado.

Se o portal não responder, o nó tenta 3 vezes e a busca devolve `ok: false` com a orientação "vendedor confirma o preço", e o Benjamim não inventa valor.

## Carteira de clientes (aba "Clientes dos vendedores")
Cada vendedor tem um quadro. O PDF "LISTA DE CLIENTES" do sistema da Imbatível é lido no navegador (posição de cada palavra) e o servidor separa as colunas (`api/_carteira.js`).
- **Confere o vendedor**: se a lista enviada for de outro vendedor (coluna VEN), o portal recusa e diz de quem é.
- **Confere se leu tudo**: compara com o rodapé "N CLIENTES LISTADOS".
- **Telefone**: guarda já no formato do WhatsApp. Completa o DDD 43 quando falta (8 dígitos, ou 9 começando com 9). Os que não dá para usar aparecem no quadro como "clientes que o Benjamim não reconhece", para a equipe corrigir no sistema.
- Não guarda CPF/CNPJ, inscrição nem aniversário. Não há dado de cliente no código: a carteira vale a partir do primeiro envio de cada vendedor.
- **Vendedor novo**: incluir em `VENDEDORES` (`api/_carteira.js`) e criar o caminho dele nos nós 15b e V5 do fluxo da EZ.

### Ligar a EZ à carteira (troca o nó 10 do fluxo)
Antes de trocar, envie as 5 listas pelo portal em produção. Sem nenhuma lista, `/api/carteira` responde erro e o fluxo cai em "carteira indisponível".
1. Apague o nó **10 · Consultar carteira (planilhas dos vendedores)** (o Executar código com a base embutida).
2. No lugar, crie uma **Requisição API** "10 · Consultar carteira (portal)":
   - POST `https://SEU-PORTAL.vercel.app/api/carteira`
   - Cabeçalhos: `Content-Type: application/json` e `Authorization: Bearer <PORTAL_CHAVE_N8N>`
   - Corpo: `{"teste_telefone": "{{flow.teste_telefone}}", "telefone_consulta": "{{flow.telefone_consulta}}", "identifier": "{{user.identifier}}", "codigo_cliente": "{{user.codigo_cliente}}", "pedido_vendedor_codigo": "{{user.pedido_vendedor_codigo}}"}`
3. Depois dela, um **Executar código** "10b · Ler resposta da carteira" com o código de `fluxos/scripts/ler_carteira_portal.js`.
4. Ligações: entradas que iam para o 10 (9 · Veio de anúncio? e 9b · Salvar última origem) → 10. Saída de sucesso do 10 → 10b. Saída de erro do 10 → 16 · Carteira indisponível. Sucesso do 10b → 13 · Salvar cadastro da carteira. Erro do 10b → 16.
5. O resto do fluxo (13, 14a, 15, 15b, V5…) não muda: o portal devolve os mesmos campos `cadastro_encontrado` e `cad_*`.

## Limites
- O PDF precisa estar no modelo de sempre, com o texto selecionável. PDF escaneado como imagem não tem texto para ler, e o portal avisa "Não achei ofertas".
- O resumo compara cada envio com o anterior. O primeiro envio compara com os dados iniciais.
- O histórico guarda os últimos 30 envios.
- Senha errada leva cerca de 0,6 s para responder, para frear tentativas em série. Não há bloqueio por número de tentativas.
