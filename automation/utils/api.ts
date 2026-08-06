import type { APIRequestContext } from '@playwright/test'

/**
 * Acesso direto à API, para PREPARAR estado — nunca para asseverar comportamento.
 *
 * A distinção importa: um teste E2E que verifica pelo backend aquilo que deveria ver na
 * tela deixa de testar a aplicação. O uso aqui é o oposto — colocar o sistema num estado
 * conhecido antes de exercitar a interface.
 */

export const API_URL = process.env.API_URL ?? 'http://localhost:3000/api/v1'

/**
 * Devolve o banco ao estado de contrato: 6 categorias, 4 usuários e 12 produtos com ids
 * e estoques do seed.
 *
 * Por que isto passou a ser necessário. Enquanto o carrinho vivia no `localStorage`, cada
 * teste ganhava um contexto de navegador novo e, com ele, um carrinho vazio de graça — o
 * isolamento era um efeito colateral da arquitetura.
 *
 * Com o carrinho e os pedidos no servidor, o estado é COMPARTILHADO: um teste que compra
 * dois notebooks baixa o estoque para todos os testes seguintes, e dois testes do mesmo
 * usuário disputam o mesmo carrinho. Foi exatamente o que aconteceu na primeira execução
 * contra a API real — 19 falhas, todas por interferência entre testes.
 *
 * O endpoint existe só fora de produção: o módulo não é registrado quando
 * `NODE_ENV=production` (ADR-041).
 */
export async function resetDatabase(request: APIRequestContext): Promise<void> {
  const response = await request.post(`${API_URL}/test/reset`)

  if (!response.ok()) {
    throw new Error(
      `Falha ao reiniciar o banco (${response.status()}). ` +
        `A API está no ar em ${API_URL} e fora de produção?`,
    )
  }
}
