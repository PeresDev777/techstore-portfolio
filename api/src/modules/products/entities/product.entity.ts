import { ApiProperty } from '@nestjs/swagger'
import type { Category, Product } from '@prisma/client'

/**
 * Forma publica do produto.
 *
 * Duas escolhas de nomenclatura merecem explicacao, porque divergem da coluna do banco:
 *
 * - `price` e nao `priceInCents`. O frontend ja consome `Product.price` em centavos
 *   (`frontend/src/types/product.ts`) e a suite assevera `129990`. Renomear obrigaria a
 *   mexer em componentes e testes que funcionam, para nao ganhar nada. A coluna continua
 *   `price_in_cents` no banco, onde a explicitacao vale mais que a compatibilidade.
 *
 * - `category` e a STRING do nome, nao o objeto. Mesma razao: e o formato que a UI ja usa
 *   para filtrar. `categorySlug` vem junto para quem preferir a versao de URL.
 *
 * O que NAO sai daqui: `searchIndex`, `relevanceScore`, `isActive`, `categoryId`. Sao
 * mecanismo interno, e expo-los transformaria detalhes de implementacao em contrato que
 * alguem passaria a depender.
 */
export class ProductEntity {
  @ApiProperty({ example: 'prd-001' })
  id: string

  @ApiProperty({ example: 'fone-aurora-pro' })
  slug: string

  @ApiProperty({ example: 'Fone Aurora Pro' })
  name: string

  @ApiProperty({ example: 'Aurora' })
  brand: string

  @ApiProperty()
  description: string

  @ApiProperty({ example: 129990, description: 'Preço em CENTAVOS, sempre inteiro.' })
  price: number

  @ApiProperty({ example: 'Áudio' })
  category: string

  @ApiProperty({ example: 'audio' })
  categorySlug: string

  @ApiProperty({ example: 4.8 })
  rating: number

  @ApiProperty({ example: 1243 })
  reviewCount: number

  @ApiProperty({ example: '/products/fone-aurora-pro.svg' })
  imageUrl: string

  @ApiProperty({ example: 24 })
  stock: number

  static from(product: Product & { category: Category }): ProductEntity {
    const entity = new ProductEntity()

    entity.id = product.id
    entity.slug = product.slug
    entity.name = product.name
    entity.brand = product.brand
    entity.description = product.description
    entity.price = product.priceInCents
    entity.category = product.category.name
    entity.categorySlug = product.category.slug
    entity.rating = product.rating
    entity.reviewCount = product.reviewCount
    entity.imageUrl = product.imageUrl
    entity.stock = product.stock

    return entity
  }

  static fromMany(products: (Product & { category: Category })[]): ProductEntity[] {
    return products.map((product) => ProductEntity.from(product))
  }
}
