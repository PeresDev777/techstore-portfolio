import { Module } from '@nestjs/common'
import { CategoriesModule } from '../categories/categories.module'
import { ProductsController } from './products.controller'
import { ProductsRepository } from './products.repository'
import { ProductsService } from './products.service'

@Module({
  // Importa o modulo inteiro, nao o repositorio solto: quem decide o que fica visivel e o
  // CategoriesModule, atraves do seu `exports`. E o que impede produtos de alcancarem
  // internals de categorias so porque estao no mesmo processo.
  imports: [CategoriesModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductsRepository],
  // Exportado para o carrinho (Sprint 5), que precisa validar produto e estoque.
  exports: [ProductsRepository],
})
export class ProductsModule {}
