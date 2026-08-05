import { BrowserRouter } from 'react-router-dom'

import { AuthProvider } from '@/contexts/AuthProvider'
import { CartProvider } from '@/contexts/CartProvider'
import { AppRoutes } from '@/routes/AppRoutes'

/**
 * Composição raiz da aplicação.
 *
 * A ordem dos providers é uma dependência real, não estilo:
 * - `BrowserRouter` primeiro, porque o fluxo de autenticação navega e lê a rota atual;
 * - `AuthProvider` antes de `CartProvider`, porque o carrinho é persistido por usuário e
 *   precisa saber quem está logado para carregar o carrinho certo e esvaziá-lo no logout.
 *
 * Manter o App como pura composição — sem estado nem lógica — deixa o ponto de entrada
 * legível e trivial de estender.
 */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <AppRoutes />
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
