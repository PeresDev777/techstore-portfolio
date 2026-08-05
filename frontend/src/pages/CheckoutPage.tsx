import { useCallback, useRef } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { OrderSummary } from '@/components/checkout/OrderSummary'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { FullPageSpinner } from '@/components/ui/FullPageSpinner'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useAuth } from '@/hooks/useAuth'
import { useCart } from '@/hooks/useCart'
import { useForm } from '@/hooks/useForm'
import { ROUTES } from '@/routes/paths'
import { createOrder } from '@/services/orderService'
import { BRAZILIAN_STATES } from '@/types/order'
import {
  CEP_LENGTH,
  CPF_LENGTH,
  PHONE_MAX_LENGTH,
  maskCep,
  maskCpf,
  maskPhone,
  onlyDigits,
} from '@/utils/masks'
import { validateCheckoutForm, type CheckoutField } from '@/utils/validators'

const STATE_OPTIONS = [
  { value: '', label: 'UF' },
  ...BRAZILIAN_STATES.map((uf) => ({ value: uf, label: uf })),
]

export function CheckoutPage() {
  const { user } = useAuth()
  const { items, totals, isHydrating, clear } = useCart()
  const navigate = useNavigate()

  /*
   * Marca que o pedido foi concluído.
   *
   * Sem isso a tela entra em contradição: ao finalizar, o carrinho é esvaziado, o
   * componente re-renderiza e a guarda de "carrinho vazio" jogaria o usuário de volta
   * para /cart antes da navegação para a página de sucesso acontecer. Um ref resolve
   * porque é lido no mesmo render em que é escrito, sem provocar re-render extra.
   */
  const orderPlacedRef = useRef(false)

  const initialValues: Record<CheckoutField, string> = {
    // Pré-preenchido com os dados da sessão: o usuário logado não deve redigitar o óbvio.
    fullName: user?.name ?? '',
    email: user?.email ?? '',
    cpf: '',
    phone: '',
    zipCode: '',
    street: '',
    number: '',
    complement: '',
    district: '',
    city: '',
    state: '',
  }

  const handleCreateOrder = useCallback(
    async (values: Record<CheckoutField, string>) => {
      const order = await createOrder({
        customer: {
          fullName: values.fullName.trim(),
          email: values.email.trim(),
          cpf: values.cpf,
          phone: values.phone,
        },
        address: {
          zipCode: values.zipCode,
          street: values.street.trim(),
          number: values.number.trim(),
          complement: values.complement.trim(),
          district: values.district.trim(),
          city: values.city.trim(),
          state: values.state,
        },
        items,
        totals,
      })

      orderPlacedRef.current = true
      clear()

      /*
       * `replace`: depois de comprar, o "voltar" do navegador não pode devolver o usuário
       * ao formulário de checkout — ele reenviaria um pedido já finalizado.
       * O pedido viaja em `state` porque não existe backend para consultá-lo por id.
       */
      void navigate(ROUTES.orderSuccess, { state: { order }, replace: true })
    },
    [items, totals, clear, navigate],
  )

  const { values, errors, formError, isSubmitting, setValue, handleSubmit } = useForm({
    initialValues,
    validate: validateCheckoutForm,
    onSubmit: handleCreateOrder,
    fallbackErrorMessage: 'Não foi possível finalizar o pedido. Tente novamente.',
  })

  /*
   * Só decide depois que o carrinho terminou de carregar.
   *
   * Em um load completo desta URL (refresh ou link direto), os itens chegam de forma
   * assíncrona: decidir no primeiro render veria o carrinho vazio e expulsaria para
   * /cart quem tem itens — perdendo o formulário já preenchido.
   */
  if (isHydrating) {
    return <FullPageSpinner label="Carregando seu pedido..." />
  }

  // Checkout sem itens não faz sentido: devolve ao carrinho em vez de mostrar total zero.
  if (items.length === 0 && !orderPlacedRef.current) {
    return <Navigate to={ROUTES.cart} replace />
  }

  /** Campo numérico: guarda dígitos no estado e aplica a máscara só na exibição. */
  function digitField(field: CheckoutField, maxLength: number, mask: (value: string) => string) {
    return {
      value: mask(values[field]),
      onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
        setValue(field, onlyDigits(event.target.value, maxLength)),
    }
  }

  return (
    <div className="flex flex-col gap-6" data-testid="checkout-page">
      <h1 className="text-ink-900 text-2xl font-bold">Finalizar compra</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
        <form
          noValidate
          onSubmit={(event) => void handleSubmit(event)}
          data-testid="checkout-form"
          className="flex flex-col gap-6"
        >
          {formError && (
            <Alert tone="error" data-testid="checkout-error">
              {formError}
            </Alert>
          )}

          <fieldset className="rounded-card flex flex-col gap-4 bg-white p-5 ring-1 ring-black/5">
            <legend className="text-ink-900 px-1 text-base font-semibold">Dados pessoais</legend>

            <Input
              label="Nome completo"
              name="fullName"
              autoComplete="name"
              data-testid="checkout-fullName"
              value={values.fullName}
              error={errors.fullName}
              onChange={(event) => setValue('fullName', event.target.value)}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="E-mail"
                name="email"
                type="email"
                autoComplete="email"
                data-testid="checkout-email"
                value={values.email}
                error={errors.email}
                onChange={(event) => setValue('email', event.target.value)}
              />

              <Input
                label="Telefone"
                name="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="(11) 98765-4321"
                data-testid="checkout-phone"
                error={errors.phone}
                {...digitField('phone', PHONE_MAX_LENGTH, maskPhone)}
              />
            </div>

            <Input
              label="CPF"
              name="cpf"
              inputMode="numeric"
              placeholder="000.000.000-00"
              data-testid="checkout-cpf"
              error={errors.cpf}
              {...digitField('cpf', CPF_LENGTH, maskCpf)}
            />
          </fieldset>

          <fieldset className="rounded-card flex flex-col gap-4 bg-white p-5 ring-1 ring-black/5">
            <legend className="text-ink-900 px-1 text-base font-semibold">
              Endereço de entrega
            </legend>

            <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
              <Input
                label="CEP"
                name="zipCode"
                inputMode="numeric"
                placeholder="00000-000"
                autoComplete="postal-code"
                data-testid="checkout-zipCode"
                error={errors.zipCode}
                {...digitField('zipCode', CEP_LENGTH, maskCep)}
              />

              <Input
                label="Endereço"
                name="street"
                autoComplete="address-line1"
                data-testid="checkout-street"
                value={values.street}
                error={errors.street}
                onChange={(event) => setValue('street', event.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
              <Input
                label="Número"
                name="number"
                data-testid="checkout-number"
                value={values.number}
                error={errors.number}
                onChange={(event) => setValue('number', event.target.value)}
              />

              <Input
                label="Complemento (opcional)"
                name="complement"
                data-testid="checkout-complement"
                value={values.complement}
                error={errors.complement}
                onChange={(event) => setValue('complement', event.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_6rem]">
              <Input
                label="Bairro"
                name="district"
                data-testid="checkout-district"
                value={values.district}
                error={errors.district}
                onChange={(event) => setValue('district', event.target.value)}
              />

              <Input
                label="Cidade"
                name="city"
                data-testid="checkout-city"
                value={values.city}
                error={errors.city}
                onChange={(event) => setValue('city', event.target.value)}
              />

              <Select
                label="Estado"
                name="state"
                data-testid="checkout-state"
                options={STATE_OPTIONS}
                value={values.state}
                onChange={(event) => setValue('state', event.target.value)}
              />
            </div>

            {errors.state && (
              <span role="alert" data-testid="state-error" className="text-danger-700 text-xs font-medium">
                {errors.state}
              </span>
            )}
          </fieldset>

          <Button
            type="submit"
            isLoading={isSubmitting}
            data-testid="checkout-submit"
            className="sm:self-start"
          >
            {isSubmitting ? 'Processando pedido...' : 'Confirmar pedido'}
          </Button>
        </form>

        <OrderSummary items={items} totals={totals} data-testid="checkout-summary" />
      </div>
    </div>
  )
}
