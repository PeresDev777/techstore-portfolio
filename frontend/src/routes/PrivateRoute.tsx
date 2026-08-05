import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { FullPageSpinner } from '@/components/ui/FullPageSpinner'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/routes/paths'

/**
 * Guarda de rotas autenticadas.
 *
 * Implementado como rota de layout (`<Outlet />`) e não como wrapper por página: um único
 * ponto no arquivo de rotas protege um grupo inteiro, e é impossível esquecer de envolver
 * uma tela nova.
 */
export function PrivateRoute() {
  const { isAuthenticated, isRestoringSession } = useAuth()
  const location = useLocation()

  /*
   * Sem este early return, um usuário com sessão válida seria expulso para o login no
   * primeiro render — a restauração da sessão é assíncrona e `isAuthenticated` ainda é
   * false nesse instante.
   */
  if (isRestoringSession) {
    return <FullPageSpinner label="Carregando sua sessão..." />
  }

  if (!isAuthenticated) {
    /*
     * `state.from` guarda a rota pretendida e `replace` evita empilhar a rota protegida
     * no histórico — sem isso, o "voltar" do navegador devolveria o usuário a um loop de
     * redirecionamento.
     */
    return <Navigate to={ROUTES.login} state={{ from: location }} replace />
  }

  return <Outlet />
}
