import { Button } from '@/components/ui/Button'
import { useCart } from '@/hooks/useCart'
import type { Product } from '@/types/product'

interface AddToCartButtonProps {
  product: Product
  quantity?: number
  fullWidth?: boolean
  /**
   * Identificador de teste. Precisa ser sobrescrito onde o componente coexiste com
   * outras instâncias na mesma tela — na página de detalhe, por exemplo, o botão
   * principal divide o DOM com os botões dos produtos relacionados. Sem distinguir a
   * ação primária, qualquer locator ficaria ambíguo.
   */
  testId?: string
}

/**
 * Botão de adicionar ao carrinho.
 *
 * Concentra em um único componente a regra de "o que fazer quando já atingi o estoque",
 * usado tanto no card da listagem quanto na página de detalhe. Sem isso, a mesma condição
 * estaria duplicada em dois lugares e divergiria na primeira alteração.
 */
export function AddToCartButton({
  product,
  quantity = 1,
  fullWidth,
  testId = 'add-to-cart',
}: AddToCartButtonProps) {
  const { addItem, getQuantity } = useCart()

  const inCart = getQuantity(product.id)
  const isOutOfStock = product.stock === 0
  const reachedStockLimit = inCart >= product.stock

  const label = isOutOfStock
    ? 'Indisponível'
    : reachedStockLimit
      ? 'Estoque máximo'
      : inCart > 0
        ? `Adicionar (${inCart} no carrinho)`
        : 'Adicionar ao carrinho'

  return (
    <Button
      fullWidth={fullWidth}
      disabled={isOutOfStock || reachedStockLimit}
      data-testid={testId}
      data-product-id={product.id}
      onClick={(event) => {
        /*
         * O card inteiro é um link para o detalhe do produto. Sem `preventDefault` +
         * `stopPropagation`, adicionar ao carrinho também navegaria — o usuário perderia
         * a listagem e o contexto da busca que fez.
         */
        event.preventDefault()
        event.stopPropagation()
        addItem(product, quantity)
      }}
    >
      {label}
    </Button>
  )
}
