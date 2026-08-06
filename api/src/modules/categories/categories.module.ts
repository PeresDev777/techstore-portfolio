import { Module } from '@nestjs/common'
import { CategoriesController } from './categories.controller'
import { CategoriesRepository } from './categories.repository'
import { CategoriesService } from './categories.service'

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService, CategoriesRepository],
  // O modulo de produtos precisa resolver "categoria informada no filtro" e validar a
  // categoria de um produto novo. Exporta-se o repositorio, nao o service: produtos nao
  // criam nem removem categorias.
  exports: [CategoriesRepository],
})
export class CategoriesModule {}
