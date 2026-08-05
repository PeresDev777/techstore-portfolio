import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

/**
 * Onde o estado autenticado é gravado pelo projeto de setup.
 *
 * Fica fora de `tests/` e é ignorado pelo git: é um artefato de execução com um token de
 * sessão, não código-fonte.
 */
export const AUTH_STATE_FILE = path.resolve(currentDir, '../.auth/user.json')

/** Estado explicitamente vazio, para testes que precisam começar deslogados. */
export const ANONYMOUS_STATE = { cookies: [], origins: [] }
