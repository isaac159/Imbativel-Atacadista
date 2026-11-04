// Servidor local que imita a Vercel: arquivos estáticos + funções em /api.  Uso: npm run dev → http://localhost:3000
// Lê .env.local. Sem banco configurado, os preços ficam na pasta .dados/ (não toca nos preços reais).
const http = require('http');
const fs = require('fs');
const path = require('path');

const RAIZ = __dirname;
const PORTA = Number(process.env.PORT) || 3000;

const env = path.join(RAIZ, '.env.local');
if (fs.existsSync(env)) {
  for (const linha of fs.readFileSync(env, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
if (!process.env.PORTAL_SEGREDO) process.env.PORTAL_SEGREDO = 'segredo-local-de-desenvolvimento-nao-usar-em-producao';
if (!process.env.PORTAL_USUARIOS) process.env.PORTAL_USUARIOS = 'teste:teste123';
if (!process.env.PORTAL_CHAVE_N8N) process.env.PORTAL_CHAVE_N8N = 'chave-local-de-teste-do-n8n-0000';

const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      const nome = url.pathname.slice(5).replace(/[^a-z0-9_-]/gi, '');
      const arquivo = path.join(RAIZ, 'api', nome + '.js');
      if (nome.startsWith('_') || !fs.existsSync(arquivo)) { res.writeHead(404); return res.end('não encontrado'); }
      delete require.cache[require.resolve(arquivo)];
      return await require(arquivo)(req, res);
    }
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/index.html';
    else if (!path.extname(rel)) rel += '.html'; // cleanUrls
    const alvo = path.normalize(path.join(RAIZ, rel));
    if (!alvo.startsWith(RAIZ) || /[\\/](api|dados|n8n|\.env|\.dados)/.test(alvo.slice(RAIZ.length)) || !fs.existsSync(alvo)) { res.writeHead(404); return res.end('não encontrado'); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(alvo)] || 'application/octet-stream' });
    fs.createReadStream(alvo).pipe(res);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.writeHead(500);
    res.end('erro');
  }
}).listen(PORTA, () => console.log(`Portal em http://localhost:${PORTA}  (usuário de teste: ${process.env.PORTAL_USUARIOS.split(';')[0].split(':')[0]})`));
