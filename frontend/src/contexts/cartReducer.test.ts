import assert from 'node:assert/strict'
import test, { describe } from 'node:test'

import {
  calculateTotals,
  cartReducer,
  EMPTY_CART,
  FREE_SHIPPING_THRESHOLD,
  parseStoredItems,
  SHIPPING_COST,
} from './cartReducer.ts'
import type { Product } from '@/types/product'

/**
 * Testes unitários do redutor do carrinho.
 *
 * Rodam no runner nativo do Node (`node --test`), sem framework de teste, sem jsdom e sem
 * navegador — possível justamente porque o redutor é uma função pura sem dependência de
 * React. Toda a regra de negócio do carrinho é verificada aqui em milissegundos; o
 * Playwright fica livre para testar o que só o navegador prova: navegação, persistência e
 * integração entre telas. Essa divisão é a pirâmide de testes na prática.
 */

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prd-001',
    slug: 'fone',
    name: 'Fone',
    brand: 'Aurora',
    description: '',
    price: 10000,
    category: 'Áudio',
    rating: 4.5,
    reviewCount: 10,
    imageUrl: '',
    stock: 3,
    ...overrides,
  }
}

describe('cartReducer — adição', () => {
  test('adiciona um item novo', () => {
    const state = cartReducer(EMPTY_CART, {
      type: 'ADD_ITEM',
      product: makeProduct(),
      quantity: 2,
    })

    assert.equal(state.items.length, 1)
    assert.equal(state.items[0]?.quantity, 2)
  })

  test('item repetido soma à quantidade em vez de criar uma segunda linha', () => {
    let state = cartReducer(EMPTY_CART, {
      type: 'ADD_ITEM',
      product: makeProduct(),
      quantity: 1,
    })
    state = cartReducer(state, { type: 'ADD_ITEM', product: makeProduct(), quantity: 1 })

    assert.equal(state.items.length, 1)
    assert.equal(state.items[0]?.quantity, 2)
  })

  test('o limite de estoque é aplicado sobre a SOMA, não sobre a parcela', () => {
    let state = cartReducer(EMPTY_CART, {
      type: 'ADD_ITEM',
      product: makeProduct(),
      quantity: 2,
    })
    state = cartReducer(state, { type: 'ADD_ITEM', product: makeProduct(), quantity: 3 })

    assert.equal(state.items[0]?.quantity, 3, 'estoque é 3, então 2 + 3 deve resultar em 3')
  })

  test('produto esgotado nunca entra no carrinho', () => {
    const state = cartReducer(EMPTY_CART, {
      type: 'ADD_ITEM',
      product: makeProduct({ stock: 0 }),
      quantity: 1,
    })

    assert.equal(state.items.length, 0)
  })
})

describe('cartReducer — alteração e remoção', () => {
  const withOneItem = () =>
    cartReducer(EMPTY_CART, { type: 'ADD_ITEM', product: makeProduct(), quantity: 2 })

  test('quantidade zero remove o item', () => {
    const state = cartReducer(withOneItem(), {
      type: 'UPDATE_QUANTITY',
      productId: 'prd-001',
      quantity: 0,
    })

    assert.equal(state.items.length, 0)
  })

  test('quantidade negativa também remove', () => {
    const state = cartReducer(withOneItem(), {
      type: 'UPDATE_QUANTITY',
      productId: 'prd-001',
      quantity: -5,
    })

    assert.equal(state.items.length, 0)
  })

  test('quantidade acima do estoque é limitada ao estoque', () => {
    const state = cartReducer(withOneItem(), {
      type: 'UPDATE_QUANTITY',
      productId: 'prd-001',
      quantity: 99,
    })

    assert.equal(state.items[0]?.quantity, 3)
  })

  test('ação sobre produto inexistente não altera o estado', () => {
    const initial = withOneItem()
    const state = cartReducer(initial, {
      type: 'UPDATE_QUANTITY',
      productId: 'inexistente',
      quantity: 5,
    })

    assert.deepEqual(state, initial)
  })

  test('o redutor não muta o estado anterior', () => {
    const initial = withOneItem()
    const snapshot = structuredClone(initial)

    cartReducer(initial, { type: 'UPDATE_QUANTITY', productId: 'prd-001', quantity: 3 })

    assert.deepEqual(initial, snapshot, 'imutabilidade é o contrato de um redutor')
  })
})

describe('calculateTotals', () => {
  test('total = subtotal + frete, sempre em centavos inteiros', () => {
    const state = cartReducer(EMPTY_CART, {
      type: 'ADD_ITEM',
      product: makeProduct({ price: 10, stock: 10 }),
      quantity: 3,
    })
    const totals = calculateTotals(state)

    assert.equal(totals.subtotal, 30)
    assert.equal(totals.shipping, SHIPPING_COST)
    assert.equal(totals.total, 30 + SHIPPING_COST)
    assert.ok(Number.isInteger(totals.total), 'centavos jamais podem virar fracionários')
  })

  test('frete é gratuito a partir do limite', () => {
    const state = cartReducer(EMPTY_CART, {
      type: 'ADD_ITEM',
      product: makeProduct({ price: FREE_SHIPPING_THRESHOLD, stock: 10 }),
      quantity: 1,
    })

    assert.equal(calculateTotals(state).shipping, 0)
  })

  test('carrinho vazio não cobra frete', () => {
    const totals = calculateTotals(EMPTY_CART)

    assert.equal(totals.shipping, 0)
    assert.equal(totals.total, 0)
  })

  test('itemCount soma quantidades e lineCount conta produtos distintos', () => {
    let state = cartReducer(EMPTY_CART, {
      type: 'ADD_ITEM',
      product: makeProduct({ stock: 10 }),
      quantity: 3,
    })
    state = cartReducer(state, {
      type: 'ADD_ITEM',
      product: makeProduct({ id: 'prd-002', stock: 10 }),
      quantity: 2,
    })
    const totals = calculateTotals(state)

    assert.equal(totals.itemCount, 5)
    assert.equal(totals.lineCount, 2)
  })
})

describe('parseStoredItems', () => {
  test('descarta qualquer conteúdo inválido vindo do localStorage', () => {
    assert.deepEqual(parseStoredItems(null), [])
    assert.deepEqual(parseStoredItems('não é um array'), [])
    assert.deepEqual(parseStoredItems([{ product: null, quantity: 1 }]), [])
    assert.deepEqual(parseStoredItems([{ product: { id: 'x', price: 1 }, quantity: 0 }]), [])
  })

  test('mantém itens bem formados', () => {
    const items = parseStoredItems([{ product: { id: 'x', price: 100 }, quantity: 2 }])

    assert.equal(items.length, 1)
  })
})
