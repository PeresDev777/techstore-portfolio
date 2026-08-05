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
}

export const USERS = {
  /** Usuário padrão da suíte. */
  valid: {
    email: 'qa@techstore.com',
    password: 'Test@1234',
    name: 'Gabriel Peres',
  },

  /** Segundo usuário válido — usado para provar isolamento de carrinho entre contas. */
  secondary: {
    email: 'ana.souza@techstore.com',
    password: 'Ana@2024',
    name: 'Ana Souza',
  },

  /** Credenciais corretas, conta desativada. */
  disabled: {
    email: 'inativo@techstore.com',
    password: 'Test@1234',
    name: 'Conta Desativada',
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
