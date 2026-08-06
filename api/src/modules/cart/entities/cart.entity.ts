import { ApiProperty } from '@nestjs/swagger'
import { ProductEntity } from '../../products/entities/product.entity'
import type { CartTotals } from '../cart-totals'

export class CartTotalsEntity implements CartTotals {
  @ApiProperty({ example: 3, description: 'Soma das quantidades.' })
  itemCount: number

  @ApiProperty({ example: 2, description: 'Linhas distintas no carrinho.' })
  lineCount: number

  @ApiProperty({ example: 179980, description: 'Em centavos.' })
  subtotal: number

  @ApiProperty({ example: 0, description: 'Em centavos. Zero acima de R$ 500,00.' })
  shipping: number

  @ApiProperty({ example: 179980, description: 'Em centavos.' })
  total: number
}

export class CartItemEntity {
  @ApiProperty()
  id: string

  @ApiProperty({ type: ProductEntity })
  product: ProductEntity

  @ApiProperty({ example: 2 })
  quantity: number

  @ApiProperty({ example: 259980, description: 'preço × quantidade, em centavos.' })
  lineTotal: number

  /**
   * O item nao pode ser comprado agora.
   *
   * Acontece quando o produto saiu de catalogo ou quando o estoque caiu abaixo da
   * quantidade reservada DEPOIS de o item ter entrado no carrinho — um carrinho fica
   * parado por dias, e o catalogo nao para.
   *
   * O item continua aparecendo, sinalizado, em vez de sumir em silencio: um total que
   * muda sozinho sem explicacao e pior que um aviso.
   */
  @ApiProperty({ example: false })
  unavailable: boolean

  @ApiProperty({ example: 'Estoque insuficiente.', required: false })
  unavailableReason?: string
}

export class CartEntity {
  @ApiProperty({ type: [CartItemEntity] })
  items: CartItemEntity[]

  /**
   * Totais CALCULADOS, nunca persistidos.
   *
   * Guardar o total no carrinho criaria uma segunda fonte de verdade que pode divergir dos
   * itens — o bug classico de carrinho. No PEDIDO e o oposto: la os totais sao gravados,
   * porque um pedido registra o que foi cobrado, nao o que seria cobrado hoje.
   *
   * Itens indisponiveis NAO entram nos totais: somar o que nao da para comprar produziria
   * um valor que o checkout nunca cobraria.
   */
  @ApiProperty({ type: CartTotalsEntity })
  totals: CartTotalsEntity
}
