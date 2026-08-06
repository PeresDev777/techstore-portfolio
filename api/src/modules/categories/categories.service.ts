import { ConflictException, Injectable } from '@nestjs/common'
import { conflict, notFound } from '../../common/exceptions/domain.exceptions'
import { ERROR_CODE } from '../../common/constants/error-codes'
import { slugify } from '../../common/utils/text'
import { CategoriesRepository } from './categories.repository'
import type { CreateCategoryDto } from './dto/create-category.dto'
import type { UpdateCategoryDto } from './dto/update-category.dto'
import { CategoryEntity } from './entities/category.entity'

@Injectable()
export class CategoriesService {
  constructor(private readonly categories: CategoriesRepository) {}

  /**
   * Sem paginacao — de proposito.
   *
   * Categorias sao um conjunto pequeno e fechado que a UI usa para montar um seletor. Uma
   * lista paginada obrigaria o frontend a percorrer paginas para desenhar um dropdown de
   * seis itens. Se um dia passarem de algumas dezenas, paginar aqui e uma mudanca simples;
   * antes disso, seria cerimonia sem beneficio.
   */
  async findAll(): Promise<CategoryEntity[]> {
    return CategoryEntity.fromMany(await this.categories.findAll())
  }

  async findByIdOrSlug(identifier: string): Promise<CategoryEntity> {
    const category = await this.categories.findByIdOrSlug(identifier)

    if (!category) {
      throw notFound('Categoria não encontrada.')
    }

    return CategoryEntity.from(category)
  }

  async create(dto: CreateCategoryDto): Promise<CategoryEntity> {
    const slug = dto.slug ?? slugify(dto.name)

    /*
     * Checagem explicita antes de inserir, mesmo com a restricao UNIQUE no banco.
     *
     * A restricao e a garantia sob concorrencia; esta checagem existe pela MENSAGEM: ela
     * diz qual campo colidiu. O P2002 traduzido pelo filtro global responderia 409 sem
     * apontar se o conflito foi no nome ou no slug.
     */
    if (await this.categories.findByNameOrSlug(dto.name)) {
      throw this.duplicate('name', 'Já existe uma categoria com este nome.')
    }

    if (await this.categories.findByNameOrSlug(slug)) {
      throw this.duplicate('slug', 'Já existe uma categoria com este slug.')
    }

    return CategoryEntity.from(await this.categories.create({ name: dto.name, slug }))
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryEntity> {
    // Garante 404 (e nao o P2025 generico) quando o id nao existe.
    await this.findByIdOrSlug(id)

    return CategoryEntity.from(await this.categories.update(id, dto))
  }

  async remove(id: string): Promise<null> {
    const category = await this.findByIdOrSlug(id)

    /*
     * Checagem explicita antes de deletar.
     *
     * A chave estrangeira ja impede a exclusao (`onDelete: Restrict`), mas o erro que ela
     * produz e o SQLSTATE 23001, que o Prisma NAO classifica como erro conhecido — chega
     * como PrismaClientUnknownRequestError e vira 500 generico. Descoberto em teste nesta
     * sprint.
     *
     * A restricao no banco continua sendo a garantia sob concorrencia; esta verificacao
     * existe para transformar a falha em uma resposta util, com o numero de produtos que
     * precisam sair antes.
     */
    const productCount = await this.categories.countProducts(category.id)

    if (productCount > 0) {
      throw conflict(
        `Esta categoria não pode ser removida: ${productCount} produto(s) ainda a utilizam.`,
        [{ field: 'id', message: 'Categoria em uso.' }],
      )
    }

    await this.categories.remove(category.id)

    return null
  }

  private duplicate(field: string, message: string): ConflictException {
    return new ConflictException({
      message,
      code: ERROR_CODE.CONFLICT,
      errors: [{ field, message }],
    })
  }
}
