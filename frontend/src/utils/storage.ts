/**
 * Acesso tipado e tolerante a falhas ao localStorage.
 *
 * `localStorage` lança exceção em modo privativo de alguns navegadores e o conteúdo pode
 * estar corrompido por uma versão anterior da aplicação. Encapsular aqui evita espalhar
 * try/catch pela aplicação e garante que um dado inválido nunca derrube a tela.
 */

export function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Persistência é um "nice to have": a aplicação segue funcional na sessão atual.
  }
}

export function remove(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Silencioso pelo mesmo motivo acima.
  }
}
