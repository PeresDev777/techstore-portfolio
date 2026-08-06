import { normalizeForSearch } from '../../common/utils/text'

export interface DerivableProduct {
  name: string
  brand: string
  description: string
  rating: number
  reviewCount: number
}

export interface DerivedProductFields {
  searchIndex: string
  relevanceScore: number
  nameSort: string
}

/**
 * Campos derivados de um produto, calculados na ESCRITA.
 *
 * Existem porque duas operacoes de leitura nao podem ser expressas diretamente em uma
 * consulta do Prisma sem custo:
 *
 * - `searchIndex`: busca sem acento exigiria a extensao `unaccent` (privilegio de
 *   superusuario) ou normalizar a tabela inteira a cada consulta.
 * - `relevanceScore`: `ORDER BY rating * review_count` e uma expressao, e o `orderBy` do
 *   Prisma so aceita colunas.
 * - `nameSort`: ordenar pela coluna `name` depende da collation do banco, que muda entre
 *   Windows, Linux e CI — a mesma consulta devolveria ordens diferentes por ambiente.
 *
 * O risco conhecido de coluna derivada e a DERIVA: alguem atualiza `rating` e esquece de
 * recalcular o score. A mitigacao e esta funcao ser o unico caminho — o service de
 * produtos e o seed a chamam, e nenhum deles monta os campos na mao.
 *
 * A alternativa mais robusta seria uma coluna GENERATED do Postgres, que tornaria a deriva
 * impossivel. Foi descartada porque o Prisma nao modela colunas geradas: toda migration
 * seguinte acusaria drift entre schema e banco, trocando um risco controlado por atrito
 * permanente na ferramenta.
 */
export function deriveProductFields(
  product: DerivableProduct,
  categoryName: string,
): DerivedProductFields {
  return {
    /*
     * A categoria entra no indice: e o que faz a busca por "audio" devolver os produtos
     * da categoria "Áudio" mesmo quando a palavra nao aparece no nome nem na descricao.
     * Comportamento que a suite ja assevera (SEARCH_TERMS.unaccented).
     */
    searchIndex: normalizeForSearch(
      [product.name, product.brand, categoryName, product.description].join(' '),
    ),

    /*
     * Relevancia = nota x volume de avaliacoes.
     *
     * Formula copiada do frontend (`productService.ts`), e a intuicao por tras dela e boa:
     * um produto 5,0 com 3 avaliacoes nao deve superar um 4,8 com 1200. Nota sozinha
     * premia o pouco avaliado; volume sozinho premia o popular ruim.
     */
    relevanceScore: product.rating * product.reviewCount,

    /*
     * So o nome, sem os demais campos: e chave de ORDENACAO, nao de busca. Reaproveitar o
     * searchIndex aqui ordenaria por "nome + marca + categoria + descricao" concatenados.
     */
    nameSort: normalizeForSearch(product.name),
  }
}
