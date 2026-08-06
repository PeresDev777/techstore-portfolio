/** Faixa Unicode dos diacriticos combinantes, separados pela normalizacao NFD. */
const COMBINING_MARKS = /[̀-ͯ]/g

/**
 * Normaliza texto para comparacao de busca: minusculas, sem acento.
 *
 * Replica exata de `frontend/src/utils/text.ts`. A duplicacao entre os projetos e
 * deliberada — eles nao compartilham codigo (ADR-001/ADR-020) e o contrato entre eles e o
 * COMPORTAMENTO. Dentro da API, porem, ha um unico lugar: o seed e o service de produtos
 * importam esta funcao, para que o indice gravado e o termo consultado nao possam divergir.
 *
 * `NFD` separa a letra do acento e o regex remove os diacriticos resultantes, entao
 * "Áudio" e "audio" convergem para a mesma string.
 */
export function normalizeForSearch(value: string): string {
  return value.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase().trim()
}

/**
 * Converte um texto em slug de URL: "Teclado Mecânico Forge 75" -> "teclado-mecanico-forge-75".
 *
 * Usado quando um produto e criado sem slug explicito. O resultado passa pela mesma
 * normalizacao da busca, entao acento nunca chega a uma URL.
 */
export function slugify(value: string): string {
  return normalizeForSearch(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
