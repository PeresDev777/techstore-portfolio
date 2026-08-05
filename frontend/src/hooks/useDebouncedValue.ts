import { useEffect, useState } from 'react'

/**
 * Atrasa a propagação de um valor que muda rápido.
 *
 * Usado na busca: sem debounce, cada tecla dispararia uma requisição — 15 chamadas para
 * digitar "notebook vertex". O `clearTimeout` no cleanup é o que faz funcionar: cada
 * tecla cancela o timer anterior, então só a pausa na digitação chega ao fim.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debouncedValue
}
