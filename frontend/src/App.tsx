import { BrowserRouter } from 'react-router-dom'

import { AuthProvider } from '@/contexts/AuthProvider'
import { AppRoutes } from '@/routes/AppRoutes'

/**
 * Composição raiz da aplicação.
 *
 * Ordem dos providers importa: `BrowserRouter` envolve o `AuthProvider` porque o fluxo de
 * autenticação precisa navegar e ler a rota atual. Manter o App como pura composição —
 * sem estado nem lógica — deixa o ponto de entrada legível e trivial de estender.
 */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
