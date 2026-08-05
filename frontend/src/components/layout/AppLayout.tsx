import { Outlet } from 'react-router-dom'

import { Header } from '@/components/layout/Header'

/**
 * Moldura das telas autenticadas.
 *
 * Como rota de layout, o cabeçalho e montado uma única vez e sobrevive a navegação entre
 * páginas — sem remontagem e sem duplicar a estrutura em cada tela.
 */
export function AppLayout() {
  return (
    <div className="min-h-dvh">
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
