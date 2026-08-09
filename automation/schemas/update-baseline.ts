import { writeFileSync } from 'node:fs'

import { BASELINE_FILE } from '@schemas/contract'
import { ENV } from '@utils/env'

/**
 * Regrava a baseline do contrato: `npm run contract:baseline`.
 *
 * A baseline e a especificacao COMITADA. O teste de contrato compara a resposta real com a
 * spec viva; a baseline responde a outra pergunta, que nenhum teste responde sozinho:
 * **alguem decidiu mudar o contrato, ou ele mudou sozinho?**
 *
 * Sem ela existe um ponto cego real: se a spec e a resposta mudarem JUNTAS — alguem remove
 * um campo do DTO, e as duas mudam no mesmo commit — o teste de contrato continua verde,
 * porque as duas fontes que ele compara concordam. Com a baseline, a mesma alteracao vira
 * um diff no `git`, e passar exige que alguem regrave o arquivo conscientemente.
 *
 * E o que transforma um teste em um PROCESSO: mudar contrato deixa de ser um efeito
 * colateral e passa a ser uma linha vermelha na revisao.
 *
 * Rode com a API no ar e **fora de producao**: `POST /test/reset` so e registrado quando
 * `NODE_ENV != production` (ADR-041), e a baseline precisa refletir o mesmo ambiente do CI,
 * que roda com `NODE_ENV=test`.
 */
const response = await fetch(ENV.openApiUrl)

if (!response.ok) {
  throw new Error(`Falha ao baixar ${ENV.openApiUrl} (status ${response.status}).`)
}

const spec = (await response.json()) as { paths: Record<string, unknown> }

/* Duas espacos e quebra final: o diff precisa ser LEGIVEL, senao ninguem revisa. */
writeFileSync(BASELINE_FILE, `${JSON.stringify(spec, null, 2)}\n`, 'utf8')

console.log(`Baseline regravada: ${Object.keys(spec.paths).length} rotas.`)
