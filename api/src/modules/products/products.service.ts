import { Injectable, UnprocessableEntityException } from '@nestjs/common'
import { conflict, notFound } from '../../common/exceptions/domain.exceptions'
import { ERROR_CODE } from '../../common/constants/error-codes'
import { PaginatedResult } from '../../common/dto/paginated-result'
import { slugify } from '../../common/utils/text'
import { CategoriesRepository } from '../categories/categories.repository'
import type { CreateProductDto } from './dto/create-product.dto'
import { PRODUCT_SORT, type ProductQueryDto } from './dto/product-query.dto'
import type { UpdateProductDto } from './dto/update-product.dto'
import { ProductEntity } from './entities/product.entity'
import { deriveProductFields } from './product-derived-fields'
import { ProductsRepository, type ProductWithCategory } from './products.repository'

/** Quantos relacionados a pagina de produto exibe. Espelha o padrao do frontend. */
const RELATED_LIMIT = 3

@Injectable()
export class ProductsService {
  constructor(
    private readonly products: ProductsRepository,
    private readonly categories: CategoriesRepository,
  ) {}

  async findAll(query: ProductQueryDto): Promise<PaginatedResult<ProductEntity>> {
    const categoryId = await this.resolveCategoryFilter(query.category)

    /*
     * Categoria inexistente devolve lista VAZIA, nao 404.
     *
     * `?category=inexistente` e um filtro que nao casa com nada — semanticamente igual a
     * uma busca sem resultado. Um 404 diria que o RECURSO `/products` nao existe, o que e
     * falso, e obrigaria o cliente a tratar como erro algo que e um resultado legitimo.
     */
    if (query.category && !categoryId) {
      return PaginatedResult.create([], 0, query.page, query.limit)
    }

    const [products, total] = await this.products.findManyPaginated({
      search: query.search,
      categoryId,
      inStock: query.inStock,
      sort: query.sort ?? PRODUCT_SORT.relevance,
      skip: query.skip,
      take: query.limit,
    })

    return PaginatedResult.create(ProductEntity.fromMany(products), total, query.page, query.limit)
  }

  async findByIdOrSlug(identifier: string): Promise<ProductEntity> {
    return ProductEntity.from(await this.getOrFail(identifier))
  }

  async findRelated(identifier: string): Promise<ProductEntity[]> {
    const product = await this.getOrFail(identifier)

    return ProductEntity.fromMany(await this.products.findRelated(product, RELATED_LIMIT))
  }

  async create(dto: CreateProductDto): Promise<ProductEntity> {
    const category = await this.categories.findByIdOrSlug(dto.category)

    if (!category) {
      /*
       * 422 e nao 404: quem nao existe e um CAMPO DO CORPO, nao o recurso da URL. Um 404
       * aqui diria que `/products` nao existe, o que e falso. Como qualquer outra falha de
       * preenchimento, o erro aponta o campo e o cliente trata pelo mesmo caminho.
       */
      throw this.unknownCategory()
    }

    const slug = dto.slug ?? slugify(dto.name)

    if (await this.products.slugExists(slug)) {
      throw conflict('Já existe um produto com este slug.', [
        { field: 'slug', message: 'Slug já utilizado.' },
      ])
    }

    const rating = dto.rating ?? 0
    const reviewCount = dto.reviewCount ?? 0

    const created = await this.products.create({
      slug,
      name: dto.name,
      brand: dto.brand,
      description: dto.description,
      priceInCents: dto.priceInCents,
      imageUrl: dto.imageUrl,
      stock: dto.stock,
      rating,
      reviewCount,
      ...deriveProductFields({ ...dto, rating, reviewCount }, category.name),
      category: { connect: { id: category.id } },
    })

    return ProductEntity.from(created)
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductEntity> {
    // `includeInactive`: sem isso, um produto retirado de catalogo responderia 404 ao
    // proprio administrador — e nao haveria como reativa-lo por lugar nenhum.
    const current = await this.getOrFail(id, true)

    const category = dto.category
      ? await this.categories.findByIdOrSlug(dto.category)
      : current.category

    if (!category) {
      throw this.unknownCategory()
    }

    if (dto.slug && (await this.products.slugExists(dto.slug, current.id))) {
      throw conflict('Já existe um produto com este slug.', [
        { field: 'slug', message: 'Slug já utilizado.' },
      ])
    }

    /*
     * Os campos derivados sao recalculados a partir do estado FINAL — o atual mesclado com
     * o que veio no corpo. Recalcular so com o DTO produziria um indice de busca refletindo
     * apenas os campos enviados, e uma atualizacao de preco apagaria o indice inteiro.
     */
    const merged = {
      name: dto.name ?? current.name,
      brand: dto.brand ?? current.brand,
      description: dto.description ?? current.description,
      rating: dto.rating ?? current.rating,
      reviewCount: dto.reviewCount ?? current.reviewCount,
    }

    const updated = await this.products.update(current.id, {
      ...merged,
      slug: dto.slug ?? current.slug,
      priceInCents: dto.priceInCents ?? current.priceInCents,
      imageUrl: dto.imageUrl ?? current.imageUrl,
      stock: dto.stock ?? current.stock,
      isActive: dto.isActive ?? current.isActive,
      ...deriveProductFields(merged, category.name),
      category: { connect: { id: category.id } },
    })

    return ProductEntity.from(updated)
  }

  async remove(id: string): Promise<null> {
    const product = await this.getOrFail(id, true)
    await this.products.deactivate(product.id)

    return null
  }

  private unknownCategory(): UnprocessableEntityException {
    return new UnprocessableEntityException({
      message: 'Falha na validacao dos dados enviados.',
      code: ERROR_CODE.VALIDATION_ERROR,
      errors: [{ field: 'category', message: 'Categoria não encontrada.' }],
    })
  }

  /**
   * `includeInactive` separa as duas visoes do catalogo: o cliente so enxerga o que esta a
   * venda; o administrador precisa alcançar tambem o que foi retirado, para editar ou
   * recolocar. A mesma consulta com um parametro evita duas versoes divergentes dela.
   */
  private async getOrFail(
    identifier: string,
    includeInactive = false,
  ): Promise<ProductWithCategory> {
    const product = await this.products.findByIdOrSlug(identifier, !includeInactive)

    if (!product) {
      throw notFound('Produto não encontrado.')
    }

    return product
  }

  private async resolveCategoryFilter(value?: string): Promise<string | undefined> {
    if (!value) return undefined

    const category = await this.categories.findByNameOrSlug(value)

    return category?.id
  }
}
