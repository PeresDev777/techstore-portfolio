/**
 * Massa de usuários.
 *
 * Contrato com `frontend/src/data/users.ts`. Cada entrada existe para cobrir um cenário
 * específico — nomear pelo CENÁRIO, e não pelo dado, deixa o teste legível:
 * `login(USERS.disabled)` diz o que está sendo testado, `login(USERS.user3)` não.
 */
export interface TestUser {
  email: string
  password: string
  name: string
  /** Id do seed. Ausente em `unknown`, que de propósito não existe na base. */
  id?: string
  role?: 'CUSTOMER' | 'ADMIN'
}

export const USERS = {
  /** Usuário padrão da suíte. */
  valid: {
    id: 'usr-001',
    email: 'qa@techstore.com',
    password: 'Test@1234',
    name: 'Gabriel Peres',
    role: 'CUSTOMER',
  },

  /** Segundo usuário válido — usado para provar isolamento de carrinho entre contas. */
  secondary: {
    id: 'usr-002',
    email: 'ana.souza@techstore.com',
    password: 'Ana@2024',
    name: 'Ana Souza',
    role: 'CUSTOMER',
  },

  /** Credenciais corretas, conta desativada. */
  disabled: {
    id: 'usr-003',
    email: 'inativo@techstore.com',
    password: 'Test@1234',
    name: 'Conta Desativada',
    role: 'CUSTOMER',
  },

  /**
   * Administrador.
   *
   * Não existia aqui porque o frontend NÃO TEM tela administrativa — nenhum dos 79
   * cenários E2E tinha como exercitá-lo. Ele entra agora porque as rotas restritas
   * (`POST /products`, `GET /users`) só são alcançáveis por HTTP, e provar que um cliente
   * recebe 403 nelas exige alguém que receba 200.
   */
  admin: {
    id: 'usr-004',
    email: 'admin@techstore.com',
    password: 'Admin@1234',
    name: 'Admin TechStore',
    role: 'ADMIN',
  },

  /** E-mail que não existe na base. */
  unknown: {
    email: 'naoexiste@techstore.com',
    password: 'Test@1234',
    name: '—',
  },
} as const satisfies Record<string, TestUser>

/** Senha incorreta para um e-mail existente. */
export const WRONG_PASSWORD = 'SenhaErrada1'

/** Mensagens exibidas pela aplicação, centralizadas para não repetir string em teste. */
export const AUTH_MESSAGES = {
  invalidCredentials: 'E-mail ou senha inválidos.',
  accountDisabled: 'Esta conta está desativada. Entre em contato com o suporte.',
  requiredEmail: 'Informe seu e-mail.',
  requiredPassword: 'Informe sua senha.',
  invalidEmail: 'Informe um e-mail válido.',
} as const
