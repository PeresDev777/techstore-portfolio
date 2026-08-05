import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { AuthContext, type AuthContextValue } from '@/contexts/authContext'
import * as authService from '@/services/authService'
import type { AuthSession, Credentials, User } from '@/types/user'
import { readJson, remove, writeJson } from '@/utils/storage'

const SESSION_STORAGE_KEY = 'techstore:session'

/**
 * Provider de autenticação.
 *
 * Responsabilidades: manter o usuário da sessão, expor `login`/`logout` e persistir a
 * sessão entre reloads. Toda comunicação com a "API" passa pelo `authService` — o provider
 * não conhece a origem dos dados.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isRestoringSession, setIsRestoringSession] = useState(true)

  /*
   * Restauração da sessão no boot.
   *
   * Ponto crítico de UX e de teste: sem o estado `isRestoringSession`, a aplicação
   * renderizaria por um instante como "deslogado" e a rota protegida jogaria o usuário
   * para o login mesmo com sessão válida — um flash de redirecionamento indevido.
   * O token persistido é sempre revalidado: confiar cegamente no localStorage permitiria
   * forjar uma sessão editando o storage.
   */
  useEffect(() => {
    let isMounted = true

    async function restoreSession() {
      const stored = readJson<AuthSession>(SESSION_STORAGE_KEY)

      if (!stored?.token) {
        if (isMounted) setIsRestoringSession(false)
        return
      }

      try {
        const validatedUser = await authService.validateSession(stored)
        if (isMounted) setUser(validatedUser)
      } catch {
        remove(SESSION_STORAGE_KEY)
      } finally {
        if (isMounted) setIsRestoringSession(false)
      }
    }

    void restoreSession()

    // Evita atualizar estado após desmontagem (StrictMode monta/desmonta duas vezes em dev).
    return () => {
      isMounted = false
    }
  }, [])

  /*
   * `login` deixa o erro do serviço propagar de propósito. Quem sabe como exibir a falha
   * é a tela de login — o provider não deve decidir copy nem guardar estado de erro que
   * só interessa a um componente.
   */
  const login = useCallback(async (credentials: Credentials) => {
    const session = await authService.login(credentials)
    writeJson(SESSION_STORAGE_KEY, session)
    setUser(session.user)
  }, [])

  const logout = useCallback(async () => {
    try {
      await authService.logout()
    } finally {
      // A sessão local é limpa mesmo se a chamada falhar: o usuário pediu para sair.
      remove(SESSION_STORAGE_KEY)
      setUser(null)
    }
  }, [])

  /*
   * `useMemo` evita recriar o objeto de contexto a cada render do provider, o que
   * dispararia re-render em todos os consumidores sem que nada tenha mudado.
   */
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isRestoringSession,
      login,
      logout,
    }),
    [user, isRestoringSession, login, logout],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
