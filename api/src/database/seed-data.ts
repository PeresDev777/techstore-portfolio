import { Role } from '@prisma/client'

/**
 * Massa do seed, separada da execucao.
 *
 * O motivo e testabilidade: importar este modulo nao abre conexao com banco nem executa
 * escrita, entao a massa pode ser verificada por um script ou por um teste — foi assim
 * que a semantica de busca abaixo foi conferida contra `automation/data/products.ts`.
 */

/**
 * Custo do bcrypt. 12 e o padrao de producao; a suite de API pode baixar para 10 via
 * ambiente, porque cada login custa hash e centenas de logins somam minutos no CI.
 *
 * O custo e o parametro de SEGURANCA do bcrypt: cada incremento dobra o trabalho de quem
 * tentar quebrar o hash offline. Baixar em teste e aceitavel; baixar em producao nao.
 */
export const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS ?? 12)

// ---------------------------------------------------------------------------
// Categorias — `name` espelha a uniao ProductCategory do frontend
// ---------------------------------------------------------------------------

export const CATEGORIES = [
  { id: 'cat-audio', name: 'Áudio', slug: 'audio' },
  { id: 'cat-notebooks', name: 'Notebooks', slug: 'notebooks' },
  { id: 'cat-smartphones', name: 'Smartphones', slug: 'smartphones' },
  { id: 'cat-perifericos', name: 'Periféricos', slug: 'perifericos' },
  { id: 'cat-monitores', name: 'Monitores', slug: 'monitores' },
  { id: 'cat-wearables', name: 'Wearables', slug: 'wearables' },
] as const

export type CategoryName = (typeof CATEGORIES)[number]['name']

// ---------------------------------------------------------------------------
// Usuarios — senhas em texto puro AQUI, hash no banco
// ---------------------------------------------------------------------------

export interface SeedUser {
  id: string
  name: string
  email: string
  password: string
  role: Role
  isActive: boolean
}

export const USERS: SeedUser[] = [
  {
    id: 'usr-001',
    name: 'Gabriel Peres',
    email: 'qa@techstore.com',
    password: 'Test@1234',
    role: Role.CUSTOMER,
    isActive: true,
  },
  {
    id: 'usr-002',
    name: 'Ana Souza',
    email: 'ana.souza@techstore.com',
    password: 'Ana@2024',
    role: Role.CUSTOMER,
    isActive: true,
  },
  {
    // Cenario negativo dedicado: credenciais CORRETAS, conta desativada. Sem um usuario
    // assim, testar 403 ACCOUNT_DISABLED exigiria mexer no banco no meio do teste.
    id: 'usr-003',
    name: 'Conta Desativada',
    email: 'inativo@techstore.com',
    password: 'Test@1234',
    role: Role.CUSTOMER,
    isActive: false,
  },
  {
    // Novo em relacao ao mock do frontend: a API tem rotas restritas a administrador
    // (criar, editar e excluir produto) e elas precisam de alguem que possa exercita-las.
    id: 'usr-004',
    name: 'Admin TechStore',
    email: 'admin@techstore.com',
    password: 'Admin@1234',
    role: Role.ADMIN,
    isActive: true,
  },
]

// ---------------------------------------------------------------------------
// Catalogo — copia fiel de frontend/src/data/products.ts
// ---------------------------------------------------------------------------

export interface SeedProduct {
  id: string
  slug: string
  name: string
  brand: string
  description: string
  priceInCents: number
  category: CategoryName
  rating: number
  reviewCount: number
  imageUrl: string
  stock: number
}

export const PRODUCTS: SeedProduct[] = [
  {
    id: 'prd-001',
    slug: 'fone-aurora-pro',
    name: 'Fone Aurora Pro',
    brand: 'Aurora',
    description:
      'Headphone over-ear com cancelamento ativo de ruído híbrido, 40 h de bateria e drivers de 40 mm. Espuma com memória e estrutura dobrável para transporte.',
    priceInCents: 129990,
    category: 'Áudio',
    rating: 4.8,
    reviewCount: 1243,
    imageUrl: '/products/fone-aurora-pro.svg',
    stock: 24,
  },
  {
    id: 'prd-002',
    slug: 'earbuds-nova-air',
    name: 'Earbuds Nova Air',
    brand: 'Nova',
    description:
      'Fones intra-auriculares sem fio com Bluetooth 5.3, resistência IPX5 e estojo com carregamento por indução. Modo transparência para uso na rua.',
    priceInCents: 49990,
    category: 'Áudio',
    rating: 4.4,
    reviewCount: 856,
    imageUrl: '/products/earbuds-nova-air.svg',
    stock: 61,
  },
  {
    id: 'prd-003',
    slug: 'notebook-vertex-14',
    name: 'Notebook Vertex 14',
    brand: 'Vertex',
    description:
      'Ultrabook de 14" com tela IPS 2.8K, 16 GB de RAM, SSD NVMe de 512 GB e chassi de alumínio com 1,2 kg. Autonomia de até 12 horas.',
    priceInCents: 649900,
    category: 'Notebooks',
    rating: 4.7,
    reviewCount: 412,
    imageUrl: '/products/notebook-vertex-14.svg',
    stock: 8,
  },
  {
    id: 'prd-004',
    slug: 'notebook-vertex-pro-16',
    name: 'Notebook Vertex Pro 16',
    brand: 'Vertex',
    description:
      'Estação de trabalho portátil de 16" com tela mini-LED 120 Hz, 32 GB de RAM e GPU dedicada. Voltado a edição de vídeo e desenvolvimento.',
    priceInCents: 1189900,
    category: 'Notebooks',
    rating: 4.9,
    reviewCount: 187,
    imageUrl: '/products/notebook-vertex-pro-16.svg',
    stock: 3,
  },
  {
    id: 'prd-005',
    slug: 'smartphone-lumen-x',
    name: 'Smartphone Lumen X',
    brand: 'Lumen',
    description:
      'Tela AMOLED de 6,7" a 120 Hz, câmera tripla de 50 MP com estabilização óptica e bateria de 5000 mAh com carga rápida de 68 W.',
    priceInCents: 389900,
    category: 'Smartphones',
    rating: 4.6,
    reviewCount: 2310,
    imageUrl: '/products/smartphone-lumen-x.svg',
    stock: 17,
  },
  {
    id: 'prd-006',
    slug: 'smartphone-lumen-lite',
    name: 'Smartphone Lumen Lite',
    brand: 'Lumen',
    description:
      'Intermediário com tela de 6,4", bateria de 5000 mAh e câmera dupla de 48 MP. Foco em autonomia e custo-benefício.',
    priceInCents: 159900,
    category: 'Smartphones',
    rating: 4.2,
    reviewCount: 1876,
    imageUrl: '/products/smartphone-lumen-lite.svg',
    stock: 0,
  },
  {
    id: 'prd-007',
    slug: 'teclado-mecanico-forge-75',
    name: 'Teclado Mecânico Forge 75',
    brand: 'Forge',
    description:
      'Layout 75% com switches lineares hot-swap, estrutura em alumínio, espuma acústica e conexão tripla (USB-C, Bluetooth e 2.4 GHz).',
    priceInCents: 89990,
    category: 'Periféricos',
    rating: 4.7,
    reviewCount: 634,
    imageUrl: '/products/teclado-mecanico-forge-75.svg',
    stock: 42,
  },
  {
    id: 'prd-008',
    slug: 'mouse-forge-light',
    name: 'Mouse Forge Light',
    brand: 'Forge',
    description:
      'Mouse sem fio de 58 g com sensor óptico de 26.000 DPI, switches ópticos e até 90 horas de bateria. Projetado para jogos competitivos.',
    priceInCents: 44990,
    category: 'Periféricos',
    rating: 4.5,
    reviewCount: 921,
    imageUrl: '/products/mouse-forge-light.svg',
    stock: 55,
  },
  {
    id: 'prd-009',
    slug: 'monitor-clarity-27',
    name: 'Monitor Clarity 27',
    brand: 'Clarity',
    description:
      'Monitor IPS de 27" com resolução 4K, 144 Hz, cobertura de 98% DCI-P3 e entrada USB-C com 90 W de energia. Suporte com ajuste de altura.',
    priceInCents: 279900,
    category: 'Monitores',
    rating: 4.8,
    reviewCount: 508,
    imageUrl: '/products/monitor-clarity-27.svg',
    stock: 12,
  },
  {
    id: 'prd-010',
    slug: 'monitor-clarity-ultrawide-34',
    name: 'Monitor Clarity Ultrawide 34',
    brand: 'Clarity',
    description:
      'Ultrawide curvo de 34" na proporção 21:9, 165 Hz e HDR400. Ideal para multitarefa sem precisar de dois monitores.',
    priceInCents: 429900,
    category: 'Monitores',
    rating: 4.6,
    reviewCount: 233,
    imageUrl: '/products/monitor-clarity-ultrawide-34.svg',
    stock: 0,
  },
  {
    id: 'prd-011',
    slug: 'smartwatch-pulse-fit',
    name: 'Smartwatch Pulse Fit',
    brand: 'Pulse',
    description:
      'Relógio com GPS integrado, monitoramento contínuo de frequência cardíaca e oxigenação, 14 dias de bateria e resistência 5 ATM.',
    priceInCents: 119900,
    category: 'Wearables',
    rating: 4.3,
    reviewCount: 1104,
    imageUrl: '/products/smartwatch-pulse-fit.svg',
    stock: 33,
  },
  {
    id: 'prd-012',
    slug: 'smartwatch-pulse-elite',
    name: 'Smartwatch Pulse Elite',
    brand: 'Pulse',
    description:
      'Caixa em titânio, tela AMOLED sempre ativa, GPS de dupla frequência e mais de 100 modos esportivos. Voltado a corrida e trail.',
    priceInCents: 249900,
    category: 'Wearables',
    rating: 4.9,
    reviewCount: 397,
    imageUrl: '/products/smartwatch-pulse-elite.svg',
    stock: 6,
  },
]
