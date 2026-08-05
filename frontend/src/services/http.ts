/**
 * Simulação da camada de transporte.
 *
 * Existe para que os serviços se comportem como chamadas de rede reais: assíncronas e
 * com latência. Isso não é enfeite — sem latência, os estados de `loading` nunca
 * apareceriam e a aplicação esconderia bugs de concorrência que só surgem em produção.
 * Quando um backend real entrar, este arquivo é substituído por `fetch` e os serviços
 * permanecem intactos.
 */

/** Latência artificial padrão, em ms. Curta o bastante para não tornar a suíte lenta. */
const DEFAULT_LATENCY_MS = 400

export function delay(ms: number = DEFAULT_LATENCY_MS): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * Envolve uma leitura de dados mockados em uma Promise com latência.
 * O `structuredClone` impede que um consumidor mute acidentalmente a "base de dados"
 * em memória — um backend real jamais devolveria uma referência viva.
 */
export async function respondWith<T>(data: T, latencyMs?: number): Promise<T> {
  await delay(latencyMs)
  return structuredClone(data)
}
