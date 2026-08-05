import { use } from 'react'

import { AuthContext, type AuthContextValue } from '@/contexts/authContext'

/**
 * Acesso ao contexto de autenticação.
 *
 * O guard converte um erro de montagem (componente fora do `<AuthProvider>`) em uma
 * exceção explícita no momento exato do bug, em vez de um `undefined` que só estouraria
 * páginas adiante com uma stack trace inútil.
 */
export function useAuth(): AuthContextValue {
  const context = use(AuthContext)

  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um <AuthProvider>.')
  }

  return context
}
