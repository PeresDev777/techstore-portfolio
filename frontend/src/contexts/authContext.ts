import { createContext } from 'react'

import type { Credentials, User } from '@/types/user'

/**
 * O objeto de contexto vive em um arquivo `.ts` separado do provider `.tsx` de propósito:
 * um módulo que exporta componentes deve exportar SOMENTE componentes, senão o Fast Refresh
 * do Vite perde a capacidade de atualizar o módulo sem recarregar a página inteira
 * (regra `react-refresh/only-export-components` do ESLint).
 */
export interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  /** `true` enquanto a sessão persistida esta sendo restaurada no boot da aplicação. */
  isRestoringSession: boolean
  login: (credentials: Credentials) => Promise<void>
  logout: () => Promise<void>
}

/**
 * `undefined` como valor inicial é intencional: permite ao hook `useAuth` detectar uso
 * fora do provider e falhar alto, em vez de devolver um objeto vazio que causaria um bug
 * silencioso e difícil de rastrear.
 */
export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
