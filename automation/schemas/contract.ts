import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv'
import addFormats from 'ajv-formats'

import { toJsonSchema, toRegistrableSchemas } from '@schemas/toJsonSchema'
import { ENV } from '@utils/env'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

/** Baseline versionada. Um contrato so muda quando ALGUEM decide mudar. */
export const BASELINE_FILE = path.resolve(currentDir, 'openapi.baseline.json')

export interface OpenApiSpec {
  openapi: string
  paths: Record<string, Record<string, OperationObject>>
  components?: { schemas?: Record<string, unknown> }
}

interface OperationObject {
  responses?: Record<string, { content?: Record<string, { schema?: unknown }> } | undefined>
}

export interface ResponseRef {
  /** Caminho COM template, como aparece na spec: `/api/v1/products/{identifier}`. */
  path: string
  method: 'get' | 'post' | 'patch' | 'delete'
  status: number
}

/**
 * Teste de contrato: a resposta real bate com a especificacao publicada.
 *
 * **O schema e DERIVADO da spec, nunca escrito a mao.** Um schema manual seria uma segunda
 * fonte de verdade, e a Sprint 3 provou o custo disso de forma cara: os tipos de
 * `services/types.ts` foram deduzidos dos DTOs de entrada e erraram quase todo campo de
 * saida — `price` virou `priceInCents`, os totais viraram planos, o `id` do pedido ganhou
 * um campo `number` que nao existe. Um schema escrito com o mesmo cuidado teria os mesmos
 * erros, e um teste de contrato que valida contra a crenca errada aprova a API errada.
 *
 * **O que este teste pega que os outros nao pegam.** O ADR-044 registra o limite conhecido
 * com todas as letras: "os DTOs de envelope sao declarativos — descrevem o interceptor, nao
 * sao usados por ele. Se alguem mudar o interceptor sem mexer neles, a spec volta a mentir.
 * A mitigacao seria um teste de contrato que compara resposta real contra a spec." E este
 * arquivo.
 *
 * Vale lembrar por que isso importa: a spec ja esteve errada uma vez. As 64 respostas
 * declaravam a forma SEM envelope enquanto toda resposta em runtime vinha COM. Nenhum teste
 * falhava — quem gerasse um cliente a partir de `/api/docs-json` e que descobriria, em
 * producao.
 *
 * **O ponto cego, dito em voz alta.** Este teste compara a resposta com a spec. Se as duas
 * mudarem JUNTAS — alguem remove um campo do DTO, e spec e resposta mudam no mesmo commit —
 * ele continua verde. Quem fecha essa porta e a BASELINE versionada: a spec vira arquivo no
 * repositorio, e mudar o contrato passa a exigir um diff que alguem aprova.
 */
export class Contract {
  private readonly ajv: Ajv
  private readonly compiled = new Map<string, ValidateFunction>()

  private constructor(readonly spec: OpenApiSpec) {
    this.ajv = new Ajv({
      /*
       * `allErrors` porque um contrato quebrado costuma quebrar em varios campos ao mesmo
       * tempo. Parar no primeiro daria uma correcao por execucao — e cada execucao custa
       * subir a pilha inteira.
       */
      allErrors: true,
      /*
       * Modo estrito LIGADO. E ele que transforma um `requred` digitado errado em erro de
       * compilacao em vez de um schema que valida nada e passa sempre. E a razao de a
       * conversao precisar remover `example`: em modo estrito, chave desconhecida e erro.
       */
      strict: true,
      /*
       * `strictTypes` desligado, e so ele.
       *
       * Os decorators de envelope (ADR-044) compoem a resposta como
       * `allOf: [SuccessEnvelopeDto, { properties: { data }, required: ['data'] }]`. O
       * segundo ramo nao declara `type: 'object'`, e o AJV recusa a compilar por isso.
       *
       * A distincao importa: `strictTypes` e uma regra de ESTILO sobre declarar o tipo que
       * as palavras-chave ja implicam — `properties` e `required` so se aplicam a objetos de
       * qualquer forma, entao a validacao continua identica. O que NAO se abre mao e o
       * `strict`, que protege contra a chave escrita errada.
       *
       * Injetar `type: 'object'` na conversao seria a alternativa; foi descartada porque
       * conversor que ADICIONA semantica ao contrato deixa de ser conversor.
       */
      strictTypes: false,
    })

    addFormats(this.ajv)

    /* Cada entidade entra com o seu proprio `$id`; os `$ref` ja foram reescritos para ele. */
    for (const schema of toRegistrableSchemas(spec.components?.schemas ?? {})) {
      this.ajv.addSchema(schema)
    }
  }

  /** Baixa a especificacao publicada em runtime — a fonte da verdade. */
  static async fromLiveApi(): Promise<Contract> {
    const response = await fetch(ENV.openApiUrl)

    if (!response.ok) {
      throw new Error(
        `Nao foi possivel baixar a especificacao em ${ENV.openApiUrl} ` +
          `(status ${response.status}). A API esta no ar?`,
      )
    }

    return new Contract((await response.json()) as OpenApiSpec)
  }

  /** Le a baseline versionada, para comparar com a spec viva. */
  static fromBaseline(): Contract {
    return new Contract(JSON.parse(readFileSync(BASELINE_FILE, 'utf8')) as OpenApiSpec)
  }

  /**
   * Valida um corpo de resposta contra o schema que a spec declara para aquela operacao.
   *
   * Valida a resposta INTEIRA, e nao so `data`. E o envelope que o ADR-044 errou, entao
   * validar apenas o dado deixaria de fora exatamente o campo que ja mentiu uma vez.
   */
  validate(ref: ResponseRef, body: unknown): ErrorObject[] {
    const validator = this.validatorFor(ref)

    return validator(body) ? [] : (validator.errors ?? [])
  }

  /** Schema declarado para a operacao, ou erro alto se a spec nao a documenta. */
  private validatorFor(ref: ResponseRef): ValidateFunction {
    const key = `${ref.method} ${ref.path} ${ref.status}`
    const cached = this.compiled.get(key)

    if (cached) return cached

    const schema =
      this.spec.paths[ref.path]?.[ref.method]?.responses?.[String(ref.status)]?.content?.[
        'application/json'
      ]?.schema

    if (!schema) {
      /*
       * Falhar alto aqui e proposital. Um teste que pulasse silenciosamente a operacao nao
       * documentada passaria a verde para uma rota SEM contrato — o oposto do que a suite
       * existe para garantir.
       */
      throw new Error(
        `A especificacao nao declara resposta ${ref.status} para ${ref.method.toUpperCase()} ` +
          `${ref.path}. Rotas documentadas: ${Object.keys(this.spec.paths).length}.`,
      )
    }

    const validator = this.ajv.compile(toJsonSchema(schema) as object)
    this.compiled.set(key, validator)

    return validator
  }

  /** Nomes dos schemas de entidade declarados na spec. */
  entityNames(): string[] {
    return Object.keys(this.spec.components?.schemas ?? {})
  }

  /** Propriedades que a spec declara para uma entidade. */
  declaredProperties(entity: string): string[] {
    const schema = this.spec.components?.schemas?.[entity] as
      { properties?: Record<string, unknown> } | undefined

    if (!schema?.properties) {
      throw new Error(`A especificacao nao declara o schema "${entity}".`)
    }

    return Object.keys(schema.properties)
  }
}

/** Erros do AJV em uma linha legivel cada, com o caminho do campo. */
export function describeErrors(errors: ErrorObject[]): string {
  return errors
    .map((error) => `  ${error.instancePath || '(raiz)'} ${error.message ?? ''}`.trimEnd())
    .join('\n')
}
