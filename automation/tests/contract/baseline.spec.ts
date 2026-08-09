import { expect, test } from '@fixtures/contract'
import { Contract } from '@schemas/contract'

/**
 * Deriva do contrato: a especificacao viva contra a baseline COMITADA.
 *
 * **Este arquivo responde a pergunta que `responses.spec.ts` nao responde.** Aquele compara
 * a resposta com a spec — e se as duas mudarem JUNTAS, continua verde. Alguem remove um
 * campo do DTO: a spec deixa de declara-lo, a resposta deixa de traze-lo, as duas fontes
 * concordam e o teste aprova. O cliente que consumia aquele campo e que descobre.
 *
 * A baseline fecha essa porta porque e uma TERCEIRA fonte, e ela nao muda sozinha: mudar o
 * contrato passa a exigir `npm run contract:baseline`, um diff no `git` e alguem que
 * aprove. E o que transforma um teste em processo — mudanca de contrato deixa de ser efeito
 * colateral e vira decisao registrada.
 *
 * Quando este teste falhar de forma legitima — uma rota nova, um campo novo — a correcao e
 * regravar a baseline **no mesmo PR** que muda a API. O diff e a revisao.
 */
test.describe('Contrato — deriva contra a baseline', () => {
  test('nenhuma rota apareceu ou sumiu sem registro', async ({ contract }) => {
    const baseline = Contract.fromBaseline()

    const vivas = Object.keys(contract.spec.paths).sort()
    const registradas = Object.keys(baseline.spec.paths).sort()

    const novas = vivas.filter((rota) => !registradas.includes(rota))
    const removidas = registradas.filter((rota) => !vivas.includes(rota))

    expect(
      novas,
      'rotas novas que a baseline nao conhece. Rode `npm run contract:baseline` e revise o diff',
    ).toEqual([])

    /*
     * Rota removida e quebra de contrato — MAJOR pelo versionamento do CHANGELOG. Merece
     * uma assercao propria para que a mensagem diga isso, em vez de um diff generico.
     */
    expect(removidas, 'rotas REMOVIDAS: quebra de contrato para quem ja consome').toEqual([])
  })

  test('nenhuma entidade mudou de forma sem registro', async ({ contract }) => {
    const baseline = Contract.fromBaseline()

    const vivas = contract.entityNames().sort()
    expect(vivas, 'o conjunto de schemas divergiu da baseline').toEqual(
      baseline.entityNames().sort(),
    )

    /*
     * Comparar as PROPRIEDADES de cada entidade, e nao apenas os nomes: renomear `price`
     * para `priceInCents` mantem a lista de entidades identica e quebra todo cliente.
     */
    for (const entidade of vivas) {
      expect(
        contract.declaredProperties(entidade).sort(),
        `as propriedades de ${entidade} divergiram da baseline`,
      ).toEqual(baseline.declaredProperties(entidade).sort())
    }
  })

  test('toda operacao declara pelo menos uma resposta com envelope', async ({ contract }) => {
    /*
     * A verificacao que o ADR-044 fez UMA VEZ, a mao, e registrou como "verificado
     * empiricamente: das 64 respostas da spec, 64 declaram envelope". A partir daqui e
     * automatica — uma rota nova anotada com `@ApiResponse` cru volta a produzir uma spec
     * que mente, e o defeito nao quebra nada visivelmente.
     */
    const respostasJson = Object.entries(contract.spec.paths).flatMap(([rota, operacoes]) =>
      Object.entries(operacoes).flatMap(([metodo, operacao]) =>
        Object.entries(operacao.responses ?? {}).map(([status, resposta]) => ({
          nome: `${metodo.toUpperCase()} ${rota} (${status})`,
          schema: resposta?.content?.['application/json']?.schema,
        })),
      ),
    )

    const declaradas = respostasJson.filter((resposta) => resposta.schema !== undefined)

    /* Rede de seguranca do proprio teste: se a leitura da spec quebrar, ele nao pode passar. */
    expect(declaradas.length, 'nenhuma resposta JSON encontrada na spec').toBeGreaterThan(50)

    const semEnvelope = declaradas
      .filter((resposta) => !JSON.stringify(resposta.schema).includes('Envelope'))
      .map((resposta) => resposta.nome)

    expect(
      semEnvelope,
      'respostas que nao compoem o envelope — provavelmente usaram @ApiResponse cru',
    ).toEqual([])
  })
})
