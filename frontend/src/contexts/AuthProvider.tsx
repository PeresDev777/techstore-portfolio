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
     * O token e capturado ANTES de limpar porque o servidor precisa dele para revogar a
     * familia inteira — e depois disso nao ha mais de onde le-lo.
     *
     * Esta ordem corrige um defeito que a suite E2E flagrou. `setUser(null)` sozinho muda
     * apenas o estado do React: e o suficiente para a tela redirecionar para /login, mas o
     * `localStorage` continuava com uma sessao valida ate a resposta do servidor chegar,
     * porque a limpeza morava num `finally` DEPOIS do await. Qualquer navegacao nessa
     * janela — um F5, um link, fechar e reabrir a aba — restaurava a sessao pelo
     * `GET /auth/me`, com o access token ainda valido por ate 15 minutos.
     *
     * O sintoma era o pior possivel: o usuario clicava em "sair", via a tela de login, e
     * continuava autenticado. Exatamente o modo de falha que o ADR-012 existe para impedir.
     */
    const refreshToken = readSession()?.refreshToken

    setUser(null)
    clearSession()

    if (!refreshToken) return

    try {
      await authService.logout(refreshToken)
    } catch {
      // Best-effort: a sessao local ja acabou. Falhar aqui nao a devolve.
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
