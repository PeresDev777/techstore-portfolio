import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { AuthContext, type AuthContextValue } from '@/contexts/authContext'
import * as authService from '@/services/authService'
import { clearSession, readSession } from '@/services/http'
import type { Credentials, User } from '@/types/user'

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
      const stored = readSession()

      if (!stored?.accessToken) {
        if (isMounted) setIsRestoringSession(false)
        return
      }

      try {
        /*
         * `GET /auth/me` valida de verdade: a API confere assinatura, expiracao E o estado
         * atual da conta no banco. Se o access token estiver vencido, o cliente HTTP
         * renova com o refresh token e repete — por isso a sessao sobrevive a horas com a
         * aba fechada, sem que o usuario perceba.
         */
        const validatedUser = await authService.validateSession()
        if (isMounted) setUser(validatedUser)
      } catch {
        clearSession()
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
    // O proprio servico persiste a sessao: os tokens sao dele, nao do provider.
    const session = await authService.login(credentials)
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
    /*
     * A ordem importa e nao mudou com a API real — ao contrario, ficou mais relevante.
     * O `authService.logout` precisa do refresh token para revogar a familia no servidor,
     * entao a leitura acontece dentro dele ANTES de limparmos; e a limpeza local vem
     * primeiro para que qualquer interrupcao deixe o usuario deslogado, nao logado.
     */
    setUser(null)

    try {
      await authService.logout()
    } catch {
      clearSession()
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
