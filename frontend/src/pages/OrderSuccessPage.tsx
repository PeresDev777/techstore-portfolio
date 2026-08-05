import { Link, Navigate, useLocation } from 'react-router-dom'

import { OrderSummary } from '@/components/checkout/OrderSummary'
import { ROUTES } from '@/routes/paths'
import type { Order } from '@/types/order'
import { maskCep, maskCpf, maskPhone } from '@/utils/masks'

interface SuccessLocationState {
  order?: Order
}

export function OrderSuccessPage() {
  const location = useLocation()
  const order = (location.state as SuccessLocationState | null)?.order

  /*
   * Sem pedido no state, alguém chegou aqui digitando a URL ou recarregando a página.
   * Renderizar uma confirmação vazia — ou pior, um "compra concluída" sem compra — seria
   * enganoso. Devolvemos ao catálogo.
   */
  if (!order) {
    return <Navigate to={ROUTES.products} replace />
  }

  const { address, customer } = order

  return (
    <div className="flex flex-col gap-8" data-testid="order-success-page">
      <header className="flex flex-col items-center gap-3 text-center">
        <span
          aria-hidden="true"
          className="bg-success-50 text-success-600 flex size-14 items-center justify-center rounded-full text-3xl"
        >
          ✓
        </span>

        <h1 className="text-ink-900 text-2xl font-bold">Compra concluída!</h1>

        <p className="text-ink-500 max-w-md text-sm">
          Enviamos a confirmação para <strong>{customer.email}</strong>. Você pode acompanhar o
          pedido pelo número abaixo.
        </p>

        <p
          data-testid="order-number"
          className="bg-brand-50 text-brand-700 rounded-lg px-4 py-2 font-mono text-lg font-bold"
        >
          {order.id}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
        <section className="rounded-card flex flex-col gap-5 bg-white p-5 ring-1 ring-black/5">
          <div className="flex flex-col gap-1">
            <h2 className="text-ink-900 text-sm font-semibold">Dados do comprador</h2>
            <p data-testid="order-customer-name" className="text-ink-700 text-sm">
              {customer.fullName}
            </p>
            <p data-testid="order-customer-cpf" className="text-ink-500 text-sm">
              CPF {maskCpf(customer.cpf)}
            </p>
            <p data-testid="order-customer-phone" className="text-ink-500 text-sm">
              {maskPhone(customer.phone)}
            </p>
          </div>

          <div className="border-ink-400/20 flex flex-col gap-1 border-t pt-4">
            <h2 className="text-ink-900 text-sm font-semibold">Endereço de entrega</h2>
            <address data-testid="order-address" className="text-ink-700 text-sm not-italic">
              {address.street}, {address.number}
              {address.complement && ` — ${address.complement}`}
              <br />
              {address.district} — {address.city}/{address.state}
              <br />
              CEP {maskCep(address.zipCode)}
            </address>
          </div>
        </section>

        <OrderSummary items={order.items} totals={order.totals} data-testid="order-summary" />
      </div>

      <div className="flex justify-center">
        <Link
          to={ROUTES.products}
          data-testid="order-continue"
          className="bg-brand-600 hover:bg-brand-700 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          Continuar comprando
        </Link>
      </div>
    </div>
  )
}
