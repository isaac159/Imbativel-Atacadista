// Nó: Executar script "Devolver mensagem" (sempre o nó imediatamente antes do AI Studio - Agente)
// Recoloca a mensagem do cliente no {{input}} para o agente ler {{input.text}}.
// Mantém áudio, imagem e arquivo: devolve o objeto original inteiro.
async (input, user, flow, env) => {
  let original = {};
  try { original = JSON.parse(flow.msg_original || '{}'); } catch (e) { original = {}; }
  return { ...original, text: original.text || flow.texto_cliente || '' };
}
