import { Module } from '@nestjs/common'
import { TransactionService } from '../../prisma/transaction.service'
import { CartModule } from '../cart/cart.module'
import { ProductsModule } from '../products/products.module'
import { OrdersController } from './orders.controller'
import { OrdersRepository } from './orders.repository'
import { OrdersService } from './orders.service'

@Module({
  // Fechar um pedido consome o carrinho e baixa estoque: os dois modulos entram como
  // dependencia declarada, com acesso apenas ao que eles exportam.
  imports: [CartModule, ProductsModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository, TransactionService],
})
export class OrdersModule {}
