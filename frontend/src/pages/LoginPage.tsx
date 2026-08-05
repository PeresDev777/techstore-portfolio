import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/routes/paths'
import { isApiError } from '@/services/apiError'
import { validateLoginForm, type FieldErrors, type LoginField } from '@/utils/validators'

const INITIAL_VALUES = { email: '', password: '' }

/** Rota pretendida antes do redirecionamento para o login, injetada pelo `PrivateRoute`. */
interface LocationState {
  from?: { pathname: string }
}

export function LoginPage() {
  const { login, isAuthenticated, isRestoringSession } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [values, setValues] = useState(INITIAL_VALUES)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<LoginField>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const redirectTo = (location.state as LocationState | null)?.from?.pathname ?? ROUTES.dashboard

  // Usuário já logado não deve ver a tela de login — devolve para onde ele queria ir.
  if (isAuthenticated && !isRestoringSession) {
    return <Navigate to={redirectTo} replace />
  }

  function handleChange(field: LoginField, value: string) {
    setValues((current) => ({ ...current, [field]: value }))

    /*
     * Limpa o erro do campo assim que o usuário o corrige.
     * Manter a mensagem enquanto ele digita e ruído: o erro já não reflete o estado atual.
     */
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
    setFormError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    /*
     * Validação no submit, não a cada tecla: acusar "e-mail inválido" enquanto a pessoa
     * ainda esta digitando a primeira letra e hostil. Depois do primeiro erro, o
     * `handleChange` passa a limpar o campo corrigido.
     */
    const errors = validateLoginForm(values)
    setFieldErrors(errors)

    if (Object.keys(errors).length > 0) {
      return
    }

    setFormError(null)
    setIsSubmitting(true)

    try {
      await login(values)
      // `replace`: o login não deve ficar no histórico depois de autenticado.
      void navigate(redirectTo, { replace: true })
    } catch (error) {
      /*
       * Erro conhecido da API vira mensagem para o usuário; qualquer outra coisa vira uma
       * mensagem generica — vazar `error.message` de um erro inesperado expoe detalhe
       * interno e não ajuda quem esta na tela.
       */
      setFormError(isApiError(error) ? error.message : 'Não foi possível entrar. Tente novamente.')
    } finally {
      // No `finally`: o botão precisa voltar ao normal tanto no sucesso quanto no erro.
      setIsSubmitting(false)
    }
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
          onSubmit={handleSubmit}
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
            error={fieldErrors.email}
            onChange={(event) => handleChange('email', event.target.value)}
          />

          <Input
            label="Senha"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            data-testid="login-password"
            value={values.password}
            error={fieldErrors.password}
            onChange={(event) => handleChange('password', event.target.value)}
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
