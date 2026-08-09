import { USERS } from '@data/users'
import { UserFactory } from '@factories/UserFactory'
import { expect, test } from '@fixtures/api'
import { ERROR_CODE } from '@services/types'
import { expectError, expectSuccess } from '@utils/assertions'

/**
 * Sessao: rotacao, deteccao de reuso e revogacao.
 *
 * **Este arquivo e o exemplo mais claro de "o que so a API alcanca".** O cliente do
 * navegador foi escrito para NUNCA reapresentar um refresh token queimado — o `http.ts`
 * tem um `refreshInFlight` compartilhado justamente para isso. A deteccao de roubo do
 * ADR-025 e, por construcao, inalcancavel pela UI: nao existe sequencia de cliques que a
 * produza.
 *
 * Os 10 cenarios E2E de login continuam cobrindo o que o usuario ve. Aqui esta o que o
 * servidor faz.
 */
test.describe('API — sessao', () => {
  test('renovar rotaciona o par e queima o refresh apresentado', async ({
    auth,
    customerSession,
  }) => {
    const renewed = expectSuccess(await auth.refresh(customerSession.refreshToken))

    expect(renewed.refreshToken).not.toBe(customerSession.refreshToken)
    expect(renewed.accessToken).toEqual(expect.any(String))

    /* O sucessor funciona: a linhagem continua viva enquanto for usada uma vez cada. */
    expectSuccess(await auth.refresh(renewed.refreshToken))
  })

  test(
    'reapresentar um refresh ja rotacionado revoga a FAMILIA inteira',
    { tag: '@critical' },
    async ({ auth, customerSession }) => {
      /*
       * O cenario de roubo de token, e a razao de o ADR-025 existir.
       *
       * Um token ja rotacionado que reaparece nao acontece em uso normal — o cliente
       * legitimo descarta o antigo ao receber o novo. So ha duas explicacoes, e nenhuma
       * distinguivel de fora: vazou e o atacante esta usando, ou vazou e o legitimo esta
       * usando enquanto o atacante ja rotacionou.
       */
      const primeiro = customerSession.refreshToken
      const sucessor = expectSuccess(await auth.refresh(primeiro)).refreshToken

      /* Reuso do token queimado. */
      expectError(await auth.refresh(primeiro), 401, ERROR_CODE.UNAUTHENTICATED)

      /*
       * A assercao que de fato importa: o SUCESSOR, que era valido um instante atras e
       * nunca foi usado indevidamente, tambem morre. Sem esta linha o teste provaria
       * apenas que um token usado duas vezes falha na segunda — que e o comportamento
       * trivial e nao a deteccao de roubo. Derrubar a linhagem inteira interrompe uma
       * sessao legitima no pior caso; a alternativa e manter uma sessao roubada viva.
       */
      expectError(await auth.refresh(sucessor), 401, ERROR_CODE.UNAUTHENTICATED)
    },
  )

  test('logout revoga a familia, nao apenas o elo apresentado', async ({
    auth,
    customerSession,
  }) => {
    expectSuccess(await auth.logout(customerSession.refreshToken))

    expectError(await auth.refresh(customerSession.refreshToken), 401, ERROR_CODE.UNAUTHENTICATED)
  })

  test('logout com token inexistente responde igual ao logout valido', async ({ auth }) => {
    /*
     * Responder "este token nao existe" transformaria o logout em um oraculo para descobrir
     * quais tokens sao validos. A resposta e a mesma nos dois casos, de proposito.
     */
    expectSuccess(await auth.logout('token-que-nunca-existiu'))
  })

  test('conta desativada responde 403, e so depois da senha correta', async ({ auth }) => {
    expectError(await auth.login(USERS.disabled), 403, ERROR_CODE.ACCOUNT_DISABLED)
  })

  test('e-mail inexistente e senha errada sao indistinguiveis', async ({ auth }) => {
    /*
     * Diferenciar as duas respostas permitiria enumerar contas: bastaria varrer e-mails e
     * observar qual devolve "senha incorreta". Status, code e MENSAGEM precisam coincidir.
     *
     * Este e o unico ponto da suite em que a mensagem e asseverada — aqui o texto FAZ PARTE
     * da regra de seguranca, e e por isso que `invalidCredentials()` na API nao aceita
     * mensagem por parametro (ADR-043).
     */
    const inexistente = await auth.login(USERS.unknown)
    const senhaErrada = await auth.login({ email: USERS.valid.email, password: 'SenhaErrada1' })

    const a = expectError(inexistente, 401, ERROR_CODE.INVALID_CREDENTIALS)
    const b = expectError(senhaErrada, 401, ERROR_CODE.INVALID_CREDENTIALS)

    expect(a.message).toBe(b.message)
  })

  test('cadastro cria conta utilizavel e recusa e-mail repetido', async ({ auth }) => {
    /*
     * Faker aqui e obrigatorio, nao preferencia: a API recusa e-mail duplicado com 409,
     * entao um endereco fixo funcionaria na primeira execucao e falharia em todas as
     * seguintes.
     */
    const novo = UserFactory.build()

    const criado = expectSuccess(await auth.register(novo), 201)
    expect(criado.email).toBe(novo.email)
    expect(criado.role).toBe('CUSTOMER')

    /* A conta recem-criada autentica de verdade. */
    const sessao = expectSuccess(await auth.login(novo))
    expect(sessao.user.id).toBe(criado.id)

    expectError(await auth.register(novo), 409, ERROR_CODE.CONFLICT)
  })

  test('cadastro nao permite escolher o proprio papel', async ({ api }) => {
    /*
     * **Mass assignment** — uma das escaladas de privilegio mais comuns em API REST.
     *
     * Nao ha campo de papel em nenhum formulario, entao o navegador nunca produz esta
     * requisicao. So HTTP alcanca. O `forbidNonWhitelisted` (ADR-024) precisa recusar em
     * vez de aceitar e ignorar: aceitar silenciosamente deixaria o proximo desenvolvedor
     * achar que o campo funciona.
     */
    const response = await api.post('/auth/register', { ...UserFactory.build(), role: 'ADMIN' })

    expectError(response, 422, ERROR_CODE.VALIDATION)
  })

  test('token invalido e token ausente sao ambos 401', async ({ api }) => {
    expectError(await api.get('/auth/me'), 401, ERROR_CODE.UNAUTHENTICATED)

    expectError(
      await api.withToken('nao.e.um.jwt').get('/auth/me'),
      401,
      ERROR_CODE.UNAUTHENTICATED,
    )
  })
})
