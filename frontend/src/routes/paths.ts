/**
 * Fonte única de verdade das rotas.
 *
 * Nenhum componente escreve `/login` como string solta: renomear uma rota vira uma
 * alteração em um lugar só, e o TypeScript aponta qualquer uso quebrado. A suíte de
 * automação espelha estes valores em `automation/utils/routes.ts`.
 */
export const ROUTES = {
  login: '/login',
  dashboard: '/dashboard',
  products: '/products',
  productDetail: '/products/:productId',
  cart: '/cart',
  checkout: '/checkout',
  orderSuccess: '/pedido/sucesso',
} as const

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES]

/** Monta a URL de um produto sem espalhar interpolação de string pela aplicação. */
export function productDetailPath(productId: string): string {
  return ROUTES.productDetail.replace(':productId', productId)
}
