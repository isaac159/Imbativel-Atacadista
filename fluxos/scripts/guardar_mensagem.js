// Nó: Executar script "Guardar mensagem" (ENTRADA: logo depois do Início · REENTRADA: primeiro nó da volta ao agente)
// Guarda a mensagem original do cliente antes de qualquer script ou Requisição API trocar o {{input}}.
// O nó AI Studio - Agente lê {{input.text}}; sem isso o EZ responde "Não entendi sua mensagem".
// Saída: {{input.msg_original}} (JSON em texto, mantém áudio, imagem e arquivo) e {{input.texto_cliente}}
// Próximo nó: Salvar no fluxo  msg_original = {{input.msg_original}} · texto_cliente = {{input.texto_cliente}}
async (input, user, flow, env) => {
  return {
    msg_original: JSON.stringify(input || {}),
    texto_cliente: (input && input.text) || ''
  };
}
