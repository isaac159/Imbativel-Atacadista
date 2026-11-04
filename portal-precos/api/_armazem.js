// Onde ficam a tabela, as ofertas e o histórico de envios. Aceita os dois bancos da Vercel → Storage:
//   Redis (nativo):  cria REDIS_URL e o portal conecta direto (pacote "redis").
//   Upstash for Redis: cria KV_REST_API_URL e KV_REST_API_TOKEN (ou UPSTASH_REDIS_REST_URL / _TOKEN).
// No computador (npm run dev), sem essas variáveis: arquivos JSON na pasta .dados/.
// Enquanto ninguém enviou nada, vale o que está em api/_inicial.json (os mesmos dados que o n8n tinha).
const fs = require('fs');
const path = require('path');
const INICIAL = require('./_inicial.json');

const PREFIXO = 'imb:';
const URL_KV = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN_KV = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const URL_REDIS = process.env.REDIS_URL;
const PASTA = path.join(__dirname, '..', '.dados');
const SEM_BANCO = 'Banco não configurado (REDIS_URL ou KV_REST_API_URL / KV_REST_API_TOKEN)';

// Upstash: um comando por requisição HTTP
async function upstash(comando) {
  const r = await fetch(URL_KV, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN_KV}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(comando)
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error('Redis: ' + (d.error || r.status));
  return d.result;
}

// Redis nativo: uma conexão reaproveitada enquanto a função estiver "quente"
let conexao = null;
function redisNativo() {
  if (!conexao) {
    const { createClient } = require('redis');
    const cliente = createClient({ url: URL_REDIS, socket: { connectTimeout: 5000 } });
    cliente.on('error', e => console.error('Redis:', e.message));
    conexao = cliente.connect().then(() => cliente).catch(e => { conexao = null; throw e; });
  }
  return conexao;
}

async function comando(cmd, ...args) {
  if (URL_REDIS) {
    const c = await redisNativo();
    return cmd === 'GET' ? c.get(args[0]) : c.set(args[0], args[1]);
  }
  return upstash([cmd, ...args]);
}

const temBanco = () => !!(URL_REDIS || (URL_KV && TOKEN_KV));

async function ler(nome) {
  if (temBanco()) {
    const v = await comando('GET', PREFIXO + nome);
    return v == null ? null : JSON.parse(v);
  }
  if (process.env.VERCEL) throw new Error(SEM_BANCO);
  const arq = path.join(PASTA, nome + '.json');
  return fs.existsSync(arq) ? JSON.parse(fs.readFileSync(arq, 'utf8')) : null;
}

async function gravar(nome, valor) {
  if (temBanco()) return comando('SET', PREFIXO + nome, JSON.stringify(valor));
  if (process.env.VERCEL) throw new Error(SEM_BANCO);
  fs.mkdirSync(PASTA, { recursive: true });
  fs.writeFileSync(path.join(PASTA, nome + '.json'), JSON.stringify(valor));
}

// Dados que o Benjamim consulta: {tabela, ofertas, tabela_atualizada_em, ofertas_atualizadas_em}
async function lerPrecos() {
  return (await ler('precos')) || INICIAL;
}

// Resumo do que mudou em cada envio, mais recente primeiro
async function lerHistorico() {
  return (await ler('historico')) || [];
}

async function registrarEnvio(item) {
  const hist = await lerHistorico();
  await gravar('historico', [item, ...hist].slice(0, 30));
}

module.exports = { lerPrecos, gravarPrecos: v => gravar('precos', v), lerHistorico, registrarEnvio };
