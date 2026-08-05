import { useCallback } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/hooks/useAuth'
import { useForm } from '@/hooks/useForm'
import { ROUTES } from '@/routes/paths'
import { validateLoginForm } from '@/utils/validators'

const INITIAL_VALUES = { email: '', password: '' }

/** Rota pretendida antes do redirecionamento para o login, injetada pelo `PrivateRoute`. */
interface LocationState {
  from?: { pathname: string }
}

export function LoginPage() {
  const { login, isAuthenticated, isRestoringSession } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const redirectTo = (location.state as LocationState | null)?.from?.pathname ?? ROUTES.dashboard

  const handleLogin = useCallback(
    async (credentials: typeof INITIAL_VALUES) => {
      await login(credentials)
      // `replace`: o login não deve ficar no histórico depois de autenticado.
      void navigate(redirectTo, { replace: true })
    },
    [login, navigate, redirectTo],
  )

  /*
   * O ciclo do formulário (valores, erros por campo, erro geral, estado de envio) vive no
   * `useForm`, compartilhado com o checkout. Esta tela cuida apenas do que é específico
   * dela: para onde ir depois do login e como apresentar os campos.
   */
  const { values, errors, formError, isSubmitting, setValue, handleSubmit } = useForm({
    initialValues: INITIAL_VALUES,
    validate: validateLoginForm,
    onSubmit: handleLogin,
    fallbackErrorMessage: 'Não foi possível entrar. Tente novamente.',
  })

  // Usuário já logado não deve ver a tela de login — devolve para onde ele queria ir.
  if (isAuthenticated && !isRestoringSession) {
    return <Navigate to={redirectTo} replace />
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-ink-900 text-2xl font-bold">TechStore</h1>
          <p className="text-ink-500 mt-1 text-sm">Entre para continuar suas compras.</p>
        </div>

        <form
          noValidate
          onSubmit={(event) => void handleSubmit(event)}
          data-testid="login-form"
          className="rounded-card flex flex-col gap-4 bg-white p-6 shadow-sm ring-1 ring-black/5"
        >
          {formError && (
            <Alert tone="error" data-testid="login-error">
              {formError}
            </Alert>
          )}

          <Input
            label="E-mail"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            data-testid="login-email"
            value={values.email}
            error={errors.email}
            onChange={(event) => setValue('email', event.target.value)}
          />

          <Input
            label="Senha"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            data-testid="login-password"
            value={values.password}
            error={errors.password}
            onChange={(event) => setValue('password', event.target.value)}
          />

          <Button type="submit" fullWidth isLoading={isSubmitting} data-testid="login-submit">
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        {/*
          Credenciais visíveis por ser um projeto de portfólio: quem avalia consegue
          entrar sem procurar no código, e a automação documenta o mesmo contrato.
        */}
        <p className="text-ink-400 mt-6 text-center text-xs" data-testid="login-hint">
          Acesso de demonstração: <strong>qa@techstore.com</strong> / <strong>Test@1234</strong>
        </p>
      </div>
    </main>
  )
}
