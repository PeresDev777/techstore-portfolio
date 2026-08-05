import { useCallback, useState, type FormEvent } from 'react'

import { isApiError } from '@/services/apiError'

export type FormValues = Record<string, string>
export type FormErrors<TValues extends FormValues> = Partial<Record<keyof TValues, string>>

interface UseFormOptions<TValues extends FormValues> {
  initialValues: TValues
  /** Recebe todos os valores e devolve os erros por campo. Campo ausente = campo válido. */
  validate: (values: TValues) => FormErrors<TValues>
  onSubmit: (values: TValues) => Promise<void>
  /** Mensagem exibida quando o erro não é um `ApiError` conhecido. */
  fallbackErrorMessage?: string
}

/**
 * Estado e ciclo de vida de um formulário.
 *
 * Extraído porque Login e Checkout repetiam exatamente o mesmo desenho: valores, erros
 * por campo, erro geral, estado de envio, validação no submit e limpeza do erro ao
 * corrigir o campo. Com 11 campos no checkout, replicar isso à mão seria a maior fonte
 * de inconsistência da aplicação — cada tela acabaria com um comportamento sutilmente
 * diferente.
 *
 * O hook não conhece máscara, layout nem regra de negócio: recebe `validate` e
 * `onSubmit` e cuida apenas do ciclo. Quem decide o que é válido é a tela.
 */
export function useForm<TValues extends FormValues>({
  initialValues,
  validate,
  onSubmit,
  fallbackErrorMessage = 'Não foi possível concluir. Tente novamente.',
}: UseFormOptions<TValues>) {
  const [values, setValues] = useState<TValues>(initialValues)
  const [errors, setErrors] = useState<FormErrors<TValues>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  /**
   * Atualiza um campo e apaga o erro dele.
   *
   * Manter a mensagem enquanto a pessoa corrige o campo é ruído: o erro já não descreve
   * o estado atual. A revalidação acontece no próximo submit.
   */
  const setValue = useCallback((field: keyof TValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setFormError(null)
  }, [])

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      const nextErrors = validate(values)
      setErrors(nextErrors)

      /*
       * `Object.values(...).some(Boolean)` e não `Object.keys(...).length`: o `setValue`
       * grava `undefined` nos campos corrigidos, então a chave continua existindo no
       * objeto. Contar chaves daria "formulário inválido" para sempre depois do primeiro
       * erro — bug silencioso e difícil de enxergar.
       */
      if (Object.values(nextErrors).some(Boolean)) return

      setFormError(null)
      setIsSubmitting(true)

      try {
        await onSubmit(values)
      } catch (error) {
        setFormError(isApiError(error) ? error.message : fallbackErrorMessage)
      } finally {
        setIsSubmitting(false)
      }
    },
    [values, validate, onSubmit, fallbackErrorMessage],
  )

  return { values, errors, formError, isSubmitting, setValue, handleSubmit }
}
