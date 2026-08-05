/** Faixa Unicode dos diacríticos combinantes (acentos separados pela normalização NFD). */
const COMBINING_MARKS = /[̀-ͯ]/g

/**
 * Normaliza texto para comparação de busca: minúsculas e sem acentos.
 *
 * Sem isso, procurar por "audio" não encontraria "Áudio" e "periferico" não encontraria
 * "Periféricos" — uma frustração real para o usuário brasileiro. `NFD` separa a letra do
 * acento e o regex remove os diacríticos resultantes.
 */
export function normalizeForSearch(value: string): string {
  return value.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase().trim()
}
