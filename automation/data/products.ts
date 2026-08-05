/**
 * Massa de produtos.
 *
 * Contrato com `frontend/src/data/products.ts`. Preços em CENTAVOS, como na aplicação —
 * assim os testes fazem aritmética exata sem converter nada.
 */
export interface TestProduct {
  id: string
  name: string
  brand: string
  category: string
  /** Em centavos. */
  price: number
  rating: number
  stock: number
}

export const PRODUCTS = {
  /** Estoque alto: seguro para testes que adicionam várias unidades. */
  headphone: {
    id: 'prd-001',
    name: 'Fone Aurora Pro',
    brand: 'Aurora',
    category: 'Áudio',
    price: 129990,
    rating: 4.8,
    stock: 24,
  },

  /** Mais barato do catálogo — usado para asseverar ordenação por menor preço. */
  mouse: {
    id: 'prd-008',
    name: 'Mouse Forge Light',
    brand: 'Forge',
    category: 'Periféricos',
    price: 44990,
    rating: 4.5,
    stock: 55,
  },

  /** Mais caro do catálogo — ordenação por maior preço. */
  premiumLaptop: {
    id: 'prd-004',
    name: 'Notebook Vertex Pro 16',
    brand: 'Vertex',
    category: 'Notebooks',
    price: 1189900,
    rating: 4.9,
    stock: 3,
  },

  /** Estoque zerado: cenário de produto indisponível. */
  outOfStock: {
    id: 'prd-006',
    name: 'Smartphone Lumen Lite',
    brand: 'Lumen',
    category: 'Smartphones',
    price: 159900,
    rating: 4.2,
    stock: 0,
  },

  /** Único resultado para a busca "teclado" — útil em asserções de contagem. */
  keyboard: {
    id: 'prd-007',
    name: 'Teclado Mecânico Forge 75',
    brand: 'Forge',
    category: 'Periféricos',
    price: 89990,
    rating: 4.7,
    stock: 42,
  },
} as const satisfies Record<string, TestProduct>

/** Total de produtos no catálogo, sem nenhum filtro. */
export const CATALOG_SIZE = 12

/** Quantidade de produtos por categoria — base das asserções de filtro. */
export const PRODUCTS_BY_CATEGORY = {
  Áudio: 2,
  Notebooks: 2,
  Smartphones: 2,
  Periféricos: 2,
  Monitores: 2,
  Wearables: 2,
} as const

/** Regras de frete replicadas de `frontend/src/contexts/cartReducer.ts`. */
export const SHIPPING = {
  cost: 2990,
  freeFrom: 50000,
} as const

/** Valores aceitos pelo seletor de ordenação — espelham `PRODUCT_SORT` na aplicação. */
export const SORT = {
  relevance: 'relevance',
  priceAsc: 'price-asc',
  priceDesc: 'price-desc',
  ratingDesc: 'rating-desc',
  nameAsc: 'name-asc',
} as const

/** Termos de busca com resultado conhecido. */
export const SEARCH_TERMS = {
  /** Sem acento, encontra a categoria "Áudio" — prova a normalização de acentos. */
  unaccented: { term: 'audio', expectedCount: 2 },
  /** Termos fora de ordem devem devolver o mesmo que na ordem natural. */
  multiWord: { term: 'vertex notebook', expectedCount: 2 },
  /** Casa com nome de um produto e descrição de outro. */
  partial: { term: 'fone', expectedCount: 2 },
  /** Um único resultado. */
  single: { term: 'teclado', expectedCount: 1 },
  /** Nenhum resultado. */
  none: { term: 'xyzabc', expectedCount: 0 },
} as const
