/**
 * Conversao de OpenAPI 3.0 para JSON Schema.
 *
 * **Por que existe.** A API publica `openapi: 3.0.0` (verificado em `/api/docs-json`), e a
 * 3.0 nao e JSON Schema: e um DIALETO derivado do rascunho 5, com divergencias proprias. A
 * 3.1 resolveu isso alinhando-se ao 2020-12, mas a spec desta API e 3.0.
 *
 * **Por que a mao, e nao uma biblioteca.** Existe
 * `@openapi-contrib/openapi-schema-to-json-schema` para isto. Medido nesta spec: das nove
 * divergencias possiveis entre os dois dialetos, apenas DUAS aparecem — `nullable` (4
 * ocorrencias) e `example` (117). Uma dependencia a mais para trinta linhas nao se paga, e
 * o custo real de uma dependencia nao e instalar: e a atualizacao que muda um
 * comportamento sutil num lugar que ninguem revisa.
 *
 * Se a spec um dia usar `discriminator` ou `exclusiveMinimum` booleano, a conta muda e a
 * biblioteca entra. O modo estrito do AJV e o alarme: dialeto nao convertido falha na
 * compilacao em vez de validar frouxo.
 */

/**
 * Prefixo dos `$id`, e ele precisa ser uma URI ABSOLUTA.
 *
 * Com um prefixo relativo (`techstore-openapi/X`), o AJV aplica resolucao de URI relativa:
 * uma referencia a `techstore-openapi/FieldErrorDto` a partir de um schema cujo `$id` e
 * `techstore-openapi/ErrorEnvelopeDto` resolve para
 * `techstore-openapi/techstore-openapi/FieldErrorDto` — e falha com "can't resolve
 * reference". O erro so aparece nos schemas que referenciam OUTROS, entao metade da suite
 * passava e a outra metade quebrava.
 *
 * O dominio nao precisa existir: e um identificador, nao um endereco. `.test` e reservado
 * pela RFC 2606 exatamente para isso — ninguem vai tentar resolver na rede por engano.
 */
export const SCHEMA_ID_PREFIX = 'https://techstore.test/schema'

/** Chaves da 3.0 que o JSON Schema nao conhece — e que o modo estrito do AJV recusa. */
const OPENAPI_ONLY_KEYWORDS = ['example', 'externalDocs', 'xml', 'discriminator'] as const

const INTERNAL_REF_PREFIX = '#/components/schemas/'

/**
 * Converte um no da spec e reescreve as referencias internas.
 *
 * A reescrita de `$ref` e o que permite compilar o schema de UMA resposta isoladamente.
 * `#/components/schemas/ProductEntity` significa "a raiz DESTE documento" — e o documento,
 * na hora da compilacao, e o fragmento da resposta, onde `components` nao existe. Apontando
 * para `techstore-openapi/ProductEntity`, a referencia resolve contra o schema que o AJV ja
 * tem registrado.
 */
export function toJsonSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toJsonSchema)

  if (node === null || typeof node !== 'object') return node

  const source = node as Record<string, unknown>
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(source)) {
    if ((OPENAPI_ONLY_KEYWORDS as readonly string[]).includes(key)) continue

    /*
     * `nullable: true` da 3.0 vira uniao de tipos. Ignorar seria pior que nao converter: o
     * campo continuaria declarado como `string` e um `null` legitimo — o `canceledAt` de um
     * pedido que nao foi cancelado — reprovaria o contrato. O teste acusaria a API de
     * quebrar um contrato que ela cumpre.
     */
    if (key === 'nullable') continue

    if (key === '$ref' && typeof value === 'string' && value.startsWith(INTERNAL_REF_PREFIX)) {
      result.$ref = `${SCHEMA_ID_PREFIX}/${value.slice(INTERNAL_REF_PREFIX.length)}`
      continue
    }

    result[key] = toJsonSchema(value)
  }

  if (source.nullable === true && typeof source.type === 'string') {
    result.type = [source.type, 'null']
  }

  return result
}

/** Schemas de entidade convertidos e prontos para `addSchema`, cada um com o seu `$id`. */
export function toRegistrableSchemas(schemas: Record<string, unknown>): object[] {
  return Object.entries(schemas).map(([name, schema]) => ({
    ...(toJsonSchema(schema) as object),
    $id: `${SCHEMA_ID_PREFIX}/${name}`,
  }))
}
