import { Injectable } from '@nestjs/common'
import type { Category, Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'

export type CategoryWithCount = Category & { _count: { products: number } }

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista com a contagem de produtos ATIVOS de cada categoria.
   *
   * O `_count` com filtro resolve em uma consulta o que seria um N+1 classico: listar
   * categorias e, para cada uma, contar produtos. Com seis categorias ninguem notaria;
   * o habito e que importa, porque com seiscentas o mesmo codigo derruba o banco.
   */
  findAll(): Promise<CategoryWithCount[]> {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: { where: { isActive: true } } } } },
    })
  }

  /** Aceita id ou slug — ver a razao em `products.repository.ts`. */
  findByIdOrSlug(identifier: string): Promise<CategoryWithCount | null> {
    return this.prisma.category.findFirst({
      where: { OR: [{ id: identifier }, { slug: identifier }] },
      include: { _count: { select: { products: { where: { isActive: true } } } } },
    })
  }

  /**
   * Resolve o filtro de categoria da listagem, aceitando NOME ou SLUG.
   *
   * O frontend atual manda o nome de exibicao ("Áudio", vindo da query string da UI);
   * um cliente novo mandaria o slug. Aceitar os dois evita quebrar o que ja funciona sem
   * condenar a API a uma escolha ruim para sempre.
   */
  findByNameOrSlug(value: string): Promise<Category | null> {
    return this.prisma.category.findFirst({
      where: {
        OR: [{ name: { equals: value, mode: 'insensitive' } }, { slug: value.toLowerCase() }],
      },
    })
  }

  /**
   * Conta TODOS os produtos da categoria, inclusive os retirados de catalogo.
   *
   * A distincao importa: o `_count` das listagens filtra `isActive: true`, porque a UI quer
   * mostrar quantos itens a pessoa pode comprar. A chave estrangeira, por outro lado, nao
   * sabe o que e "ativo" — ela restringe a exclusao enquanto existir QUALQUER linha
   * apontando para a categoria. Usar a contagem de ativos aqui deixaria passar o caso em
   * que todos os produtos foram desativados, e o banco recusaria a exclusao mesmo assim.
   */
  countProducts(categoryId: string): Promise<number> {
    return this.prisma.product.count({ where: { categoryId } })
  }

  create(data: Prisma.CategoryCreateInput): Promise<Category> {
    return this.prisma.category.create({ data })
  }

  update(id: string, data: Prisma.CategoryUpdateInput): Promise<Category> {
    return this.prisma.category.update({ where: { id }, data })
  }

  /**
   * Remocao fisica — e proposital que ela FALHE quando houver produtos.
   *
   * A chave estrangeira e `onDelete: Restrict`, entao o Postgres recusa e o Prisma lanca
   * P2003, traduzido para 409 pelo filtro global. Categoria e classificacao, nao registro
   * historico: se ninguem a usa, apagar de verdade e o comportamento correto.
   */
  async remove(id: string): Promise<void> {
    await this.prisma.category.delete({ where: { id } })
  }
}
