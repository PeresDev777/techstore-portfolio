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
  /** Presente no catálogo completo; a API resolve `/products/:idOrSlug` pelos dois. */
  slug?: string
}

/**
 * Catálogo COMPLETO do seed, na ordem dos ids.
 *
 * Os 79 cenários E2E precisavam de cinco produtos escolhidos a dedo (`PRODUCTS`, abaixo) —
 * a UI é navegada, não enumerada. Os testes de API precisam do conjunto inteiro: paginação
 * assevera `total: 12`, o filtro de estoque conta quantos têm `stock > 0`, e a ordenação
 * por preço precisa saber qual é de fato o mais barato.
 *
 * Contrato com `api/src/database/seed-data.ts`. Alterar um exige alterar o outro.
 */
export const CATALOG = [
  {
    id: 'prd-001',
    slug: 'fone-aurora-pro',
    name: 'Fone Aurora Pro',
    brand: 'Aurora',
    category: 'Áudio',
    price: 129990,
    rating: 4.8,
    stock: 24,
  },
  {
    id: 'prd-002',
    slug: 'earbuds-nova-air',
    name: 'Earbuds Nova Air',
    brand: 'Nova',
    category: 'Áudio',
    price: 49990,
    rating: 4.4,
    stock: 61,
  },
  {
    id: 'prd-003',
    slug: 'notebook-vertex-14',
    name: 'Notebook Vertex 14',
    brand: 'Vertex',
    category: 'Notebooks',
    price: 649900,
    rating: 4.7,
    stock: 8,
  },
  {
    id: 'prd-004',
    slug: 'notebook-vertex-pro-16',
    name: 'Notebook Vertex Pro 16',
    brand: 'Vertex',
    category: 'Notebooks',
    price: 1189900,
    rating: 4.9,
    stock: 3,
  },
  {
    id: 'prd-005',
    slug: 'smartphone-lumen-x',
    name: 'Smartphone Lumen X',
    brand: 'Lumen',
    category: 'Smartphones',
    price: 389900,
    rating: 4.6,
    stock: 17,
  },
  {
    id: 'prd-006',
    slug: 'smartphone-lumen-lite',
    name: 'Smartphone Lumen Lite',
    brand: 'Lumen',
    category: 'Smartphones',
    price: 159900,
    rating: 4.2,
    stock: 0,
  },
  {
    id: 'prd-007',
    slug: 'teclado-mecanico-forge-75',
    name: 'Teclado Mecânico Forge 75',
    brand: 'Forge',
    category: 'Periféricos',
    price: 89990,
    rating: 4.7,
    stock: 42,
  },
  {
    id: 'prd-008',
    slug: 'mouse-forge-light',
    name: 'Mouse Forge Light',
    brand: 'Forge',
    category: 'Periféricos',
    price: 44990,
    rating: 4.5,
    stock: 55,
  },
  {
    id: 'prd-009',
    slug: 'monitor-clarity-27',
    name: 'Monitor Clarity 27',
    brand: 'Clarity',
    category: 'Monitores',
    price: 279900,
    rating: 4.8,
    stock: 12,
  },
  {
    id: 'prd-010',
    slug: 'monitor-clarity-ultrawide-34',
    name: 'Monitor Clarity Ultrawide 34',
    brand: 'Clarity',
    category: 'Monitores',
    price: 429900,
    rating: 4.6,
    stock: 0,
  },
  {
    id: 'prd-011',
    slug: 'smartwatch-pulse-fit',
    name: 'Smartwatch Pulse Fit',
    brand: 'Pulse',
    category: 'Wearables',
    price: 119900,
    rating: 4.3,
    stock: 33,
  },
  {
    id: 'prd-012',
    slug: 'smartwatch-pulse-elite',
    name: 'Smartwatch Pulse Elite',
    brand: 'Pulse',
    category: 'Wearables',
    price: 249900,
    rating: 4.9,
    stock: 6,
  },
] as const satisfies readonly TestProduct[]

/** Produtos com `stock > 0` — base da asserção do filtro `?inStock=true`. */
export const IN_STOCK_COUNT = CATALOG.filter((p) => p.stock > 0).length

/**
 * Apelidos por CENÁRIO, derivados do catálogo.
 *
 * Nomear pelo papel no teste — e não pelo dado — é o que faz `PRODUCTS.outOfStock` dizer
 * o que está sendo testado onde `PRODUCTS.prd006` não diria nada.
 *
 * São DERIVADOS de `CATALOG` de propósito: duplicar preço e estoque aqui criaria duas
 * cópias do mesmo contrato, e a segunda divergiria na primeira alteração do seed.
 */
export const PRODUCTS = {
  /** Estoque alto: seguro para testes que adicionam várias unidades. */
  headphone: CATALOG[0],

  /** Mais barato do catálogo — usado para asseverar ordenação por menor preço. */
  mouse: CATALOG[7],

  /** Mais caro do catálogo — ordenação por maior preço. */
  premiumLaptop: CATALOG[3],

  /** Estoque zerado: cenário de produto indisponível. */
  outOfStock: CATALOG[5],

  /** Único resultado para a busca "teclado" — útil em asserções de contagem. */
  keyboard: CATALOG[6],

  /**
   * Estoque BAIXO (6 unidades) e diferente do `premiumLaptop`.
   *
   * Existe para os testes de concorrência e de limite sobre a soma poderem trabalhar sem
   * disputar o mesmo produto que os cenários E2E de estoque já usam.
   */
  lowStock: CATALOG[11],
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
