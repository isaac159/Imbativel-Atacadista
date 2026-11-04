// Onde ficam a tabela, as ofertas e o histórico de envios.
// Na Vercel: Upstash Redis (Vercel → Storage → Upstash for Redis → Connect), que cria sozinho
//   KV_REST_API_URL e KV_REST_API_TOKEN (ou UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN).
// No computador (npm run dev), sem essas variáveis: arquivos JSON na pasta .dados/.
// Enquanto ninguém enviou nada, vale o que está em api/_inicial.json (os mesmos dados que o n8n tinha).
const fs = require('fs');
const path = require('path');
const INICIAL = require('./_inicial.json');

const PREFIXO = 'imb:';
const URL_KV = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN_KV = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const PASTA = path.join(__dirname, '..', '.dados');

async function redis(comando) {
  const r = await fetch(URL_KV, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN_KV}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(comando)
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error('Redis: ' + (d.error || r.status));
  return d.result;
}

async function ler(nome) {
  if (URL_KV && TOKEN_KV) {
    const v = await redis(['GET', PREFIXO + nome]);
    return v == null ? null : JSON.parse(v);
  }
  if (process.env.VERCEL) throw new Error('Banco não configurado (KV_REST_API_URL / KV_REST_API_TOKEN)');
  const arq = path.join(PASTA, nome + '.json');
  return fs.existsSync(arq) ? JSON.parse(fs.readFileSync(arq, 'utf8')) : null;
}

async function gravar(nome, valor) {
  if (URL_KV && TOKEN_KV) return redis(['SET', PREFIXO + nome, JSON.stringify(valor)]);
  if (process.env.VERCEL) throw new Error('Banco não configurado (KV_REST_API_URL / KV_REST_API_TOKEN)');
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
