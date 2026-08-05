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

  /*
   * Encerra a sessão LOCAL antes da chamada remota — nesta ordem, de propósito.
   *
   * Com a ordem inversa, qualquer interrupção durante a chamada (reload, aba fechada,
   * rede caindo) mataria o JavaScript antes da limpeza e o usuário permaneceria logado,
   * apesar de ter pedido para sair. Em autenticação, a falha tem que cair para o lado
   * seguro: encerrar primeiro e tratar a invalidação remota como best-effort.
   */
  const logout = useCallback(async () => {
    remove(SESSION_STORAGE_KEY)
    setUser(null)

    try {
      await authService.logout()
    } catch {
      // A sessão local já foi encerrada; falha na invalidação remota não reverte isso.
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
