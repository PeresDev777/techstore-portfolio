import { Navigate, Route, Routes } from 'react-router-dom'

import { AppLayout } from '@/components/layout/AppLayout'
import { CartPage } from '@/pages/CartPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ProductDetailPage } from '@/pages/ProductDetailPage'
import { ProductsPage } from '@/pages/ProductsPage'
import { PrivateRoute } from '@/routes/PrivateRoute'
import { ROUTES } from '@/routes/paths'

/**
 * Mapa de rotas da aplicação.
 *
 * Estrutura em três blocos: públicas, protegidas (aninhadas em `PrivateRoute` +
 * `AppLayout`) e fallback. Uma tela nova entra no bloco protegido e já nasce guardada e
 * com cabeçalho — não há como esquecer de proteger.
 */
export function AppRoutes() {
  return (
    <Routes>
      {/* Públicas */}
      <Route path={ROUTES.login} element={<LoginPage />} />

      {/* Protegidas */}
      <Route element={<PrivateRoute />}>
        <Route element={<AppLayout />}>
          <Route path={ROUTES.dashboard} element={<DashboardPage />} />
          <Route path={ROUTES.products} element={<ProductsPage />} />
          <Route path={ROUTES.productDetail} element={<ProductDetailPage />} />
          <Route path={ROUTES.cart} element={<CartPage />} />
        </Route>
      </Route>

      {/* A raiz não tem tela própria: delega ao dashboard, que a rota protegida avalia. */}
      <Route path="/" element={<Navigate to={ROUTES.dashboard} replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
