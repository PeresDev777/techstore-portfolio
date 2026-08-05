import type { Locator } from '@playwright/test'

/**
 * Leitura de valores monetários.
 *
 * A aplicação expõe `data-price-cents` (inteiro) ao lado do texto formatado. Asseverar o
 * inteiro em vez de `"R$ 1.299,90"` deixa o teste imune a mudanças de formatação, ao
 * locale do runner no CI e ao separador decimal — e ainda permite fazer aritmética.
 */
export async function readCents(locator: Locator): Promise<number> {
  const raw = await locator.getAttribute('data-price-cents')

  if (raw === null) {
    throw new Error(
      `O elemento não expõe "data-price-cents". Sem ele, o teste dependeria do texto formatado.`,
    )
  }

  return Number(raw)
}

/** Soma os valores em centavos de todos os elementos casados por um locator. */
export async function sumCents(locator: Locator): Promise<number> {
  const values = await locator.evaluateAll((nodes) =>
    nodes.map((node) => Number(node.getAttribute('data-price-cents'))),
  )

  return values.reduce((total, value) => total + value, 0)
}

/** Converte centavos para o texto exibido, útil para asserções de formatação. */
export function formatCents(valueInCents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    valueInCents / 100,
  )
}
