// 10b · Ler resposta da carteira (portal)
// Vem depois da Requisição "10 · Consultar carteira (portal)", que chama POST <portal>/api/carteira.
// Acha a resposta do portal (pode vir direto, em body, data ou como texto) e devolve os campos cad_* que o nó 13 salva.
// Sem resposta válida: dá erro, e o fluxo segue pela saída de erro para o nó 16 (carteira indisponível).
async (input, user, flow, env) => {
  const acha = (o, d = 0) => {
    if (!o || d > 5) return null;
    if (typeof o === 'string') { try { return acha(JSON.parse(o), d + 1); } catch (e) { return null; } }
    if (typeof o !== 'object') return null;
    if (typeof o.cadastro_encontrado === 'string') return o;
    for (const k of Object.keys(o)) { const r = acha(o[k], d + 1); if (r) return r; }
    return null;
  };
  const r = acha(input);
  if (!r) throw new Error('Carteira indisponível: o portal não respondeu');
  return r;
}
