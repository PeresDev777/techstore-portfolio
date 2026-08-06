import { randomUUID } from 'node:crypto'

import { fakerPT_BR as faker } from '@faker-js/faker'

import type { CreateProductInput } from '@services/ProductService'

/** Categorias do seed. Criar produto em categoria inexistente responde 422. */
export const SEED_CATEGORIES = [
  'Áudio',
  'Notebooks',
  'Smartphones',
  'Periféricos',
  'Monitores',
  'Wearables',
] as const

/**
 * Produtos criados via API, por administrador.
 *
 * Servem a dois cenarios que nao existem no navegador, porque o frontend nao tem tela
 * administrativa:
 *
 * 1. **Autorizacao** — um cliente tentando criar produto recebe 403.
 * 2. **Imutabilidade do snapshot** — criar produto, comprar, reajustar o preco e provar que
 *    o pedido existente nao muda (ADR-026). Fazer isso com produto do SEED contaminaria a
 *    massa de contrato de que os 79 cenarios E2E dependem; com produto proprio, o teste e
 *    dono do que altera.
 *
 * O nome carrega um sufixo unico porque o `slug` e derivado dele e tem restricao de
 * unicidade no banco — sem isso, a segunda execucao encontraria 409.
 */
export const ProductFactory = {
  build(overrides: Partial<CreateProductInput> = {}): CreateProductInput {
    const suffix = randomUUID().slice(0, 8)

    return {
      name: `${faker.commerce.productName()} ${suffix}`,
      brand: faker.company.name(),
      description: faker.commerce.productDescription(),
      /* Em CENTAVOS, inteiro: dinheiro em ponto flutuante acumula erro (ADR-008). */
      priceInCents: faker.number.int({ min: 1000, max: 900000 }),
      category: faker.helpers.arrayElement(SEED_CATEGORIES),
      stock: faker.number.int({ min: 1, max: 50 }),
      ...overrides,
    }
  },

  /**
   * Produto com estoque exato — a massa dos cenarios de concorrencia e de limite.
   *
   * `stock: 1` e o que torna "dois pedidos simultaneos para a ultima unidade" reproduzivel.
   * O seed nao tem nenhum produto com uma unidade, e baixar o estoque de um produto do seed
   * quebraria os testes E2E que asseveram os valores de contrato.
   */
  withStock(stock: number, overrides: Partial<CreateProductInput> = {}): CreateProductInput {
    return ProductFactory.build({ stock, ...overrides })
  },

  /** Variantes invalidas, nomeadas pelo campo que deve falhar. */
  invalid: {
    /** `priceInCents` — dinheiro nao pode ser negativo. */
    negativePrice: (): CreateProductInput => ProductFactory.build({ priceInCents: -100 }),

    /** `priceInCents` — decimal, quando o contrato e inteiro em centavos. */
    fractionalPrice: (): CreateProductInput => ProductFactory.build({ priceInCents: 99.99 }),

    /** `stock` — negativo. */
    negativeStock: (): CreateProductInput => ProductFactory.build({ stock: -1 }),

    /** `category` — inexistente no seed. */
    unknownCategory: (): CreateProductInput =>
      ProductFactory.build({ category: 'Categoria Que Nao Existe' }),
  },
}
