// Leitura de ofertas por IA (Claude), para PDFs em modelo novo que os leitores por regra não entendem.
// O navegador manda o texto de poucas páginas por vez; aqui o Claude devolve as ofertas no formato do portal.
// Precisa de ANTHROPIC_API_KEY na Vercel. Sem a chave, o portal usa só os leitores por regra.
const Anthropic = require('@anthropic-ai/sdk');

const MODELO = 'claude-opus-5-5';

const iaDisponivel = () => !!process.env.ANTHROPIC_API_KEY;

const SISTEMA = `Você extrai ofertas de um encarte de atacado de bebidas (Imbatível Atacadista) a partir do texto de páginas de um PDF.
O texto vem de um PDF diagramado: a ordem pode estar embaralhada, o mesmo produto pode aparecer repetido na página (camadas do PDF) e há cabeçalhos, rodapés e chamadas de campanha no meio.

Para cada produto com preço, devolva:
- produto: nome do produto com marca e tamanho, como aparece (ex.: "Água mineral Acqua Bonna com gás 500 ml").
- variacoes: sabores, versões, embalagem e observações do produto (ex.: "Pacote com 12", "Amendoim e coco", "Encascada"); "" se não houver. Não repita os rótulos soltos das fotos se já estiverem na frase.
- preco_oferta: o preço principal em reais (o que vem com POR UNIDADE, POR PACOTE, OFERTA, POR APENAS ou equivalente).
- preco_de: o preço antigo quando houver "DE R$ x" riscado/anterior; 0 se não houver.
- faixas: descontos por quantidade ("Acima de 5 pacotes R$ 0,99"): minimo = o número, unidade = as palavras depois do número em minúsculas ("pacotes", "unidades mistas", "caixas"), preco = o valor.

Regras:
- Liste cada produto uma vez só, mesmo que o texto repita o bloco.
- Ignore cabeçalho, rodapé, numeração de página e chamadas que não são produto (ex.: "NAS COMPRAS ACIMA DE R$ 1.000,00 ganhe...").
- Use só preços que estão no texto. Não invente produto, preço nem faixa.
- Valores em reais como número: "1.200,00" vira 1200, "0,99" vira 0.99.
- validade_inicio e validade_fim: datas de validade das ofertas se o texto disser (dd/mm/aaaa, completando mês e ano pela outra data quando faltar); "" se não houver.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['validade_inicio', 'validade_fim', 'itens'],
  properties: {
    validade_inicio: { type: 'string' },
    validade_fim: { type: 'string' },
    itens: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['produto', 'variacoes', 'preco_oferta', 'preco_de', 'faixas'],
        properties: {
          produto: { type: 'string' },
          variacoes: { type: 'string' },
          preco_oferta: { type: 'number' },
          preco_de: { type: 'number' },
          faixas: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['minimo', 'unidade', 'preco'],
              properties: { minimo: { type: 'integer' }, unidade: { type: 'string' }, preco: { type: 'number' } }
            }
          }
        }
      }
    }
  }
};

let cliente = null;
const claude = () => (cliente = cliente || new Anthropic());

// paginas: [{ numero, texto }] → { itens (formato do portal), validade: {inicio, fim} | null }
async function lerOfertasComIA(paginas) {
  const texto = paginas.map(p => `=== Página ${p.numero} ===\n${p.texto}`).join('\n\n');
  const resposta = await claude()
    .beta.messages.stream({
      model: MODELO,
      max_tokens: 32000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default', // se o Claude Opus 5.5 recusar, a própria API refaz em outro modelo
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      system: SISTEMA,
      messages: [{ role: 'user', content: `Extraia as ofertas destas páginas:\n\n${texto}` }]
    })
    .finalMessage();

  if (resposta.stop_reason === 'refusal') throw new Error('A IA recusou ler estas páginas');
  if (resposta.stop_reason === 'max_tokens') throw new Error('Páginas grandes demais para uma leitura');
  const bloco = resposta.content.find(b => b.type === 'text');
  const dados = JSON.parse(bloco ? bloco.text : '{}');
  console.log(
    JSON.stringify({
      evento: 'ofertas_ia',
      paginas: paginas.map(p => p.numero),
      itens: (dados.itens || []).length,
      entrada: resposta.usage.input_tokens,
      saida: resposta.usage.output_tokens
    })
  );
  return converter(dados);
}

const dataOk = s => /^\d{2}\/\d{2}\/\d{4}$/.test(String(s || '').trim());

// Resposta da IA → mesmo formato dos leitores por regra (conferindo números e tirando o que veio incompleto)
function converter(dados) {
  const itens = [];
  for (const it of (dados && dados.itens) || []) {
    const produto = String(it.produto || '')
      .replace(/\s+/g, ' ')
      .trim();
    const preco = Number(it.preco_oferta);
    if (!produto || !(preco > 0)) continue;
    const faixas = (it.faixas || [])
      .filter(f => Number(f.preco) > 0 && Number(f.minimo) > 0)
      .map(f => {
        const unidade = String(f.unidade || '')
          .toLowerCase()
          .trim();
        return {
          condicao: `acima de ${f.minimo} ${unidade}`.trim(),
          minimo: Math.round(Number(f.minimo)),
          unidade,
          preco: Math.round(Number(f.preco) * 100) / 100
        };
      })
      .sort((a, b) => a.minimo - b.minimo);
    const item = {
      produto,
      variacoes: String(it.variacoes || '')
        .replace(/\s+/g, ' ')
        .trim(),
      preco_oferta: Math.round(preco * 100) / 100,
      faixas
    };
    if (Number(it.preco_de) > 0) item.preco_de = Math.round(Number(it.preco_de) * 100) / 100;
    itens.push(item);
  }
  const validade =
    dataOk(dados && dados.validade_inicio) && dataOk(dados && dados.validade_fim)
      ? { inicio: dados.validade_inicio.trim(), fim: dados.validade_fim.trim() }
      : null;
  return { itens, validade };
}

module.exports = { iaDisponivel, lerOfertasComIA, converter, MODELO };
