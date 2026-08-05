import { useEffect, useRef } from 'react'
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
   * Registra se houve sessão ativa durante a vida deste componente.
   *
   * O efeito roda DEPOIS do render, então na renderização em que a sessão cai o ref ainda
   * reflete o estado anterior — exatamente a informação necessária para distinguir
   * "logout" de "acesso direto sem nunca ter logado".
   */
  const hadSessionRef = useRef(false)

  useEffect(() => {
    if (isAuthenticated) {
      hadSessionRef.current = true
    }
  }, [isAuthenticated])

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
     * `from` só é gravado quando alguém tenta abrir uma rota protegida SEM nunca ter
     * logado — o único caso em que faz sentido devolver a pessoa ao destino após o login.
     *
     * Se havia sessão, isto é um logout. Gravar a rota aqui faria o PRÓXIMO usuário a
     * entrar neste navegador aterrissar na última página do usuário anterior: em um
     * computador compartilhado, vazamento de contexto entre contas.
     *
     * `replace` evita empilhar a rota protegida no histórico — sem isso, o "voltar" do
     * navegador devolveria o usuário a um loop de redirecionamento.
     */
    const isLoggingOut = hadSessionRef.current

    return <Navigate to={ROUTES.login} state={isLoggingOut ? null : { from: location }} replace />
  }

  return <Outlet />
}
