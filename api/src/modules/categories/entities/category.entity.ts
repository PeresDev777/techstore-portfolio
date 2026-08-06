import { ApiProperty } from '@nestjs/swagger'
import type { Category } from '@prisma/client'

export class CategoryEntity {
  @ApiProperty({ example: 'cat-audio' })
  id: string

  @ApiProperty({ example: 'Áudio', description: 'Nome de exibição, com acento.' })
  name: string

  @ApiProperty({ example: 'audio', description: 'Versão para URL, sem acento.' })
  slug: string

  @ApiProperty({ example: 2, required: false, description: 'Quantidade de produtos ativos.' })
  productCount?: number

  static from(category: Category & { _count?: { products: number } }): CategoryEntity {
    const entity = new CategoryEntity()

    entity.id = category.id
    entity.name = category.name
    entity.slug = category.slug

    // `_count` so vem quando a consulta pediu; omitir a chave e melhor que devolver 0 e
    // fazer o cliente acreditar que a categoria esta vazia.
    if (category._count) entity.productCount = category._count.products

    return entity
  }

  static fromMany(categories: (Category & { _count?: { products: number } })[]): CategoryEntity[] {
    return categories.map((category) => CategoryEntity.from(category))
  }
}
