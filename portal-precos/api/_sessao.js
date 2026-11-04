// Sessão do portal: cookie assinado com HMAC (sem banco de dados).
// Variáveis de ambiente (Vercel → Settings → Environment Variables):
//   PORTAL_USUARIOS  "usuario:senha" separados por ";"   ex.: imbativel:Senha@2026;pablo:OutraSenha
//   PORTAL_SEGREDO   texto longo e aleatório para assinar o cookie (gerar com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
const crypto = require('crypto');

const COOKIE = 'imb_sessao';
const DURACAO_H = 12;

function segredo() {
  const s = process.env.PORTAL_SEGREDO || '';
  if (s.length < 32) throw new Error('PORTAL_SEGREDO ausente ou curto (mínimo 32 caracteres)');
  return s;
}

function usuarios() {
  return (process.env.PORTAL_USUARIOS || '')
    .split(';')
    .map(par => par.trim())
    .filter(Boolean)
    .map(par => {
      const i = par.indexOf(':');
      return { usuario: par.slice(0, i).trim().toLowerCase(), senha: par.slice(i + 1) };
    })
    .filter(u => u.usuario && u.senha);
}

// Comparação em tempo constante (não revela pelo tempo quantos caracteres acertou)
function iguais(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function conferirLogin(usuario, senha) {
  const u = String(usuario || '').trim().toLowerCase();
  let ok = false;
  for (const cad of usuarios()) {
    if (iguais(cad.usuario, u) & iguais(cad.senha, senha || '')) ok = true;
  }
  return ok ? u : null;
}

function assinar(dados) {
  return crypto.createHmac('sha256', segredo()).update(dados).digest('base64url');
}

function criarCookie(usuario) {
  const exp = Date.now() + DURACAO_H * 3600 * 1000;
  const dados = Buffer.from(JSON.stringify({ u: usuario, exp })).toString('base64url');
  const valor = `${dados}.${assinar(dados)}`;
  const seguro = process.env.VERCEL ? '; Secure' : '';
  return `${COOKIE}=${valor}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${DURACAO_H * 3600}${seguro}`;
}

function apagarCookie() {
  const seguro = process.env.VERCEL ? '; Secure' : '';
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${seguro}`;
}

function lerSessao(req) {
  const cookies = Object.fromEntries(
    String(req.headers.cookie || '').split(';').map(c => {
      const i = c.indexOf('=');
      return [c.slice(0, i).trim(), c.slice(i + 1).trim()];
    })
  );
  const valor = cookies[COOKIE];
  if (!valor || !valor.includes('.')) return null;
  const [dados, assinatura] = valor.split('.');
  if (!iguais(assinar(dados), assinatura)) return null;
  try {
    const s = JSON.parse(Buffer.from(dados, 'base64url').toString('utf8'));
    return s.exp > Date.now() ? s : null;
  } catch (e) {
    return null;
  }
}

// Corpo JSON da requisição. Na Vercel o req.body já vem pronto; no dev.js lemos o fluxo.
async function lerCorpoJson(req, limite) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const partes = []; let n = 0;
  for await (const p of req) { n += p.length; if (n > limite) throw new Error('grande demais'); partes.push(p); }
  return JSON.parse(Buffer.concat(partes).toString('utf8') || '{}');
}

function json(res, status, corpo, extras = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(extras)) res.setHeader(k, v);
  res.end(JSON.stringify(corpo));
}

module.exports = { conferirLogin, criarCookie, apagarCookie, lerSessao, lerCorpoJson, iguais, json };
