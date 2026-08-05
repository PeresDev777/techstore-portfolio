/**
 * Rotas da aplicação sob teste.
 *
 * Espelha `frontend/src/routes/paths.ts`. A duplicação é DELIBERADA: a suíte não importa
 * código da aplicação, senão um refactor interno poderia mudar o teste junto e o teste
 * deixaria de ser um observador independente. Se uma rota mudar aqui sem mudar lá, os
 * testes falham — que é exatamente o alarme que se espera.
 */
export const ROUTES = {
  login: '/login',
  dashboard: '/dashboard',
  products: '/products',
  cart: '/cart',
  checkout: '/checkout',
  orderSuccess: '/pedido/sucesso',
} as const

export function productDetail(productId: string): string {
  return `/products/${productId}`
}

/** Query string da listagem, para navegar direto a um estado de filtro. */
export const PRODUCT_PARAMS = {
  search: 'q',
  category: 'categoria',
  sort: 'ordenar',
  inStock: 'estoque',
} as const

export function productsWith(params: Record<string, string>): string {
  const query = new URLSearchParams(params).toString()
  return `${ROUTES.products}?${query}`
}
