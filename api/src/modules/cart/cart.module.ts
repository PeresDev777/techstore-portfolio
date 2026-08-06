import { Module } from '@nestjs/common'
import { ProductsModule } from '../products/products.module'
import { CartController } from './cart.controller'
import { CartRepository } from './cart.repository'
import { CartService } from './cart.service'

@Module({
  // Precisa resolver produto e conferir estoque. Importa o modulo, e nao o repositorio
  // solto: quem decide o que fica visivel e o `exports` do ProductsModule.
  imports: [ProductsModule],
  controllers: [CartController],
  providers: [CartService, CartRepository],
  // Exportado para os pedidos (Sprint 6): criar um pedido consome o carrinho.
  exports: [CartRepository, CartService],
})
export class CartModule {}
