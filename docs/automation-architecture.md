# Arquitetura — TechStore Automation

Documento vivo, no mesmo formato de ADR usado em [architecture.md](architecture.md) e
[api-architecture.md](api-architecture.md). A numeração continua de onde a da API parou
(ADR-048), porque as decisões dos três projetos convivem no mesmo sistema.

Este arquivo cobre a **suíte de automação**. Frontend e as decisões originais de E2E estão
em ADR-001 a ADR-019; a API, em ADR-020 a ADR-048.

---

## Visão geral

```
            navegador          HTTP            especificação
frontend/ ◄──── e2e/     api/ ◄─── api/    /docs-json ◄─── contract/
                          │                      │
                          └── services/ ─────────┘
```

Três suítes, três runtimes, um único aparato de dados e asserção.

---

## ADR-049 — Asserção de teste mora no spec; invariante mora no Page Object

**Contexto.** O ADR-017 decidiu que page objects expõem **ações de negócio e asserções de
domínio**, e o ESLint precisou enumerar 22 nomes em `assertFunctionNames` para que a regra
`playwright/expect-expect` não acusasse todo teste de não ter asserção.

A regra de projeto adotada para a evolução da suíte é a oposta: **Page Object sem
asserção**. As duas não podem coexistir sem escolha explícita.

**Decisão.** A regra vale, com uma exceção nomeada — e a exceção é a distinção que faltava
no ADR-017. Existem dois tipos de `expectX` misturados:

| Tipo | Exemplo | Onde passa a morar |
| --- | --- | --- |
| **Expectativa de um teste** | `expectProductDetails(produto)`, `expectResultCount(12)`, `expectFieldError('cpf', msg)` | **No spec.** O page object expõe o `Locator` |
| **Invariante da página** | `expectTotalsAreConsistent()` — `total = subtotal + frete` | **Fica no page object** |

`expectTotalsAreConsistent` é verdade em todo estado, para toda massa, em todo cenário. Não
é a afirmação de um teste: é uma propriedade da tela. Movê-la para o spec duplicaria a
aritmética em cada cenário que a usa.

Sobreviveram sete: `waitUntilReady`, `expectToBeCurrentPage`, `expectTotalsAreConsistent`,
`expectSubtotalMatchesLines`, `expectImageLoaded`, `expectOrderNumberFormat` e
`expectOrderMatches`.

**Consequência.** Medido: **28 métodos de asserção viraram 7**, 80 chamadas foram reescritas
em 9 arquivos de spec, e a lista do ESLint caiu de 22 nomes de POM para 7. Os 79 cenários
seguiram verdes.

Duas coisas que só apareceram na implementação, e que mudam a forma da solução:

**1. Expor `Locator` não é expor seletor.** A leitura ingênua do ADR-005 — "page objects
nunca expõem locators" — levaria a substituir cada asserção por um *leitor* (`isDisabled()`,
`resultCount()`). Isso seria pior: os matchers do Playwright sobre `Locator` **reexecutam
até estabilizar**, e um leitor faz uma leitura única. A troca introduziria flakiness em
troca de pureza.

A string do seletor continua dentro do page object. O que o spec recebe é um objeto já
resolvido, e trocar `data-testid` por outra estratégia segue sendo mudança em um arquivo só
— que é o que o ADR-003 protege. Vale notar que os page objects **já** expunham locators
públicos (`cards`, `emptyState`, `subtotal`); a refatoração tornou o padrão intencional em
vez de acidental.

**2. Formato de apresentação é conhecimento da página.** `displayedProduct()` devolve o
dado exibido; `ProductDetailPage.expected(produto)` devolve a forma esperada — com o preço
formatado e a nota com vírgula decimal. O spec decide **qual** produto espera; a página sabe
**como** ela apresenta. Sem essa separação, cada spec repetiria
`.replace('.', ',')` e a regra de locale vazaria para o teste.

**Custo aceito.** Um spec ficou mais verboso: onde havia `await page.expectEmpty()` agora há
duas asserções. É o preço de o teste declarar o que espera — e o ganho é que a expectativa
fica legível sem abrir o page object.

**Alternativa descartada.** Manter o ADR-017 como está. Seria defensável — a suíte estava
verde e a lista do ESLint funcionava. Perdeu porque a lista **crescia a cada método novo**,
e uma regra de lint que exige manutenção manual acaba desligada. A lista atual é fechada por
construção: invariantes de página são poucos e não se multiplicam.

---

## ADR-050 — Testes de sessão expirada por interceptação, não por relógio

**Contexto.** A suíte não tinha cenário de sessão expirada. O caminho óbvio seria subir a
API com `JWT_ACCESS_TTL_SECONDS` baixo e esperar.

**Decisão.** Separar em dois níveis e não esperar em nenhum:

| Pergunta | Onde | Como |
| --- | --- | --- |
| O token expira e o refresh rotaciona? | `tests/api/auth.spec.ts` | HTTP direto |
| O que a aplicação faz ao receber 401? | `tests/e2e/login/session-expiry.spec.ts` | `page.route()` |

**Consequência.** Um TTL curto na instância compartilhada faria os outros 79 cenários
oscilarem, e uma segunda instância custaria complexidade no CI. Pior: o teste passaria a
**dormir**, e espera por relógio é a origem mais comum de suíte intermitente.

Interceptando, a pergunta do navegador fica exata — não é "o JWT expira?", é "o cliente
renova sozinho, e o que acontece quando nem isso funciona?". Três cenários: renovação
silenciosa, renovação recusada levando ao login, e rota protegida inacessível depois disso.

**Detalhe que a implementação impôs.** O login acontece **pela UI** no `beforeEach`, e não
pelo `storageState`: a fixture de reset trunca a tabela de sessões antes de cada teste,
então o refresh token gravado no estado do navegador já nasce inválido. Sem autenticar
dentro do teste, o cenário de renovação bem-sucedida seria impossível de montar — a
renovação precisa ser real para o teste provar alguma coisa.

---

## ADR-051 — Evidência é diferente por tipo de suíte

**Contexto.** O ADR-019 fixou a política de evidências: `screenshot: only-on-failure`,
`video: retain-on-failure`, `trace: on-first-retry`. Ela foi escrita quando só existia
suíte de navegador.

**Decisão.** A política do ADR-019 continua valendo para `e2e`. Para `api` e `contract`,
a moeda de evidência passa a ser o par requisição/resposta com o `x-request-id`, anexado ao
relatório na falha pela própria fixture do `ApiClient`.

| Suíte | Evidência |
| --- | --- |
| E2E | Screenshot, vídeo e trace |
| API | Método, URL, status, duração, corpo e **`x-request-id`** |
| Contrato | Erros do AJV com o caminho do campo que divergiu |

**Consequência.** Screenshot e vídeo não existem sem navegador — um teste de API que
falhasse no CI produziria **zero** evidência sob a política antiga. O `x-request-id` é
ecoado pela API desde o ADR-031, e essa promessa não tinha consumidor até aqui: agora um
teste vermelho no CI carrega o id que encontra a linha exata do log com um `grep`.

Isso se pagou antes mesmo de a suíte existir. A primeira execução dos testes de API falhou
6 de 6, e foi o `resumo-http.txt` anexado que mostrou a URL final sem o prefixo `/api/v1` —
o `baseURL` do Playwright resolve por `new URL(path, base)` e descartava o caminho. Sem o
anexo, seriam ciclos de tentativa e erro contra um 404 sem explicação.

**Retry é zero em `api` e `contract`, inclusive no CI.** No E2E o retry compra estabilidade
contra a rede. Num teste de concorrência, um teste que falha e passa na segunda tentativa é
exatamente o defeito que se está caçando — o retry transformaria a descoberta em verde.

---

## ADR-052 — Services conhecem a rota; quem assevera é o teste

**Contexto.** A camada de consumo da API podia devolver `data` já desembrulhado e lançar
exceção em status de erro, como um SDK faria.

**Decisão.** Os services devolvem a resposta **crua** — status, headers, `x-request-id`,
corpo — e nunca lançam. A asserção mora em `utils/assertions.ts`, sobre o envelope.

**Consequência.** Metade do trabalho de uma suíte de API é verificar 401, 403, 404, 409 e
422. Um service que só soubesse devolver o caminho feliz obrigaria cada teste negativo a
contorná-lo, e a camada deixaria de servir justamente aos testes que mais precisam dela.

A exceção é `AuthService.authenticate()`, que **estoura** de propósito: ele prepara estado,
e uma fixture sem token não tem teste para rodar. A separação está no nome, não em um
parâmetro booleano — `login()` devolve para ser asseverado, `authenticate()` devolve para
ser usado.

**O token é imutável.** `withToken()` devolve um cliente novo em vez de mudar o atual. Um
cliente mutável produziria o pior tipo de teste de autorização: aquele em que a ordem das
chamadas decide quem está autenticado, e trocar duas linhas muda o resultado sem que o
código pareça diferente.

**Um efeito colateral que virou teste.** `AuthService.login()` envia **apenas** `email` e
`password`. Repassar `USERS.valid` inteiro — que carrega `id`, `name` e `role` para os
testes asseverarem — faz o `forbidNonWhitelisted` responder 422. A proteção contra mass
assignment do ADR-024 pegou a própria suíte, e o cenário virou teste.

---

## ADR-053 — O recorte da suíte é escolhido pelo gatilho, via npm script

**Contexto.** Rodar a suíte inteira em todo push é simples e caro. Rodar só o smoke é
barato e deixa passar regressão.

**Decisão.** Três recortes, cada um um `npm script` que qualquer pessoa executa igual na
própria máquina:

| Gatilho | Script | Cenários | Tempo no CI |
| --- | --- | --- | --- |
| `pull_request` | `test:pr` | 44 | ~1m40s |
| `push` na `main` | `test:regression` | 159 | ~3m20s |
| `schedule` 03:00 | `test:nightly` | 160 | — |

**Consequência.** O pipeline não tem um comando secreto que só existe no YAML: reproduzir
a falha do CI é copiar uma linha.

**A justificativa do recorte mudou com a medição.** A análise inicial afirmava que o
preparo do ambiente dominaria e que o recorte economizaria pouco mais de um minuto.
Medido: **85 s contra 4,5 min** localmente. A estimativa estava errada — o recorte se paga
em tempo.

O argumento principal continua sendo outro, e ele não depende de medição: **autoridade do
gate**. Todo teste no caminho do merge multiplica a chance de vermelho sem relação com a
mudança, e um gate que erra é um gate que as pessoas aprendem a ignorar.

`@slow` só roda de madrugada porque concorrência é barulhenta por natureza: o cenário
merece existir e não merece bloquear um merge.

**Uma pilha, três suítes.** Um job por suíte parecia mais limpo e sairia mais caro: cada
job repetiria `npm ci` de três projetos, migrations, seed e o boot da API. O preparo custa
tanto quanto os testes; triplicá-lo para paralelizar 4,5 min não se paga nesta escala. Se a
suíte chegar a 20 min, a conta inverte.

---

## ADR-054 — Credencial tem escopo de worker; sessão tem escopo de teste

**Contexto.** As fixtures autenticavam a cada cenário — até três logins por teste, para
cliente, segundo cliente e administrador.

**Decisão.** Os **access tokens** são emitidos uma vez por worker. A **sessão completa**
(com refresh token) continua sendo emitida por teste.

A distinção vem de um comportamento que a API documenta: depois de `POST /test/reset`, um
access token emitido antes **continua válido**, porque os ids do seed são fixos e `usr-001`
volta a existir com o mesmo id (ADR-028). O refresh token, esse morre — a tabela de sessões
é truncada. Os testes de rotação e revogação precisam de uma linhagem viva e própria;
reaproveitá-la seria o contrário do que eles verificam.

**Consequência.** O isolamento não enfraquece: o banco continua reiniciado antes de cada
cenário. O que passa a ser compartilhado é a **credencial**, que é imutável e não carrega
estado de teste.

**O ganho medido foi menor que o previsto, e a medição revelou o gargalo real.**

| | Antes | Depois |
| --- | --- | --- |
| Suíte de API (56 cenários) | 84 s | **75 s** |

Onze por cento. A expectativa era muito maior, e investigar a diferença deu o número que
importa:

```
POST /test/reset : 1260 ms     ← pago antes de CADA um dos 160 cenários
POST /auth/login :  283 ms
```

56 × 1,26 s = 70 s, e a suíte inteira leva 75 s. **O reset é a suíte.** A causa é
aritmética: o seed executa `bcrypt.hash` para os 4 usuários a cada reinício, e
4 × 283 ms ≈ 1130 ms dos 1260 ms.

Fica registrado como **limite conhecido**, não como decisão: a correção é do lado da API —
memoizar o hash por (senha, rounds) no processo, já que a massa é determinística e o próprio
`seed.runner.ts` documenta que o hash não entra no `update`. No CI o impacto é menor porque
`BCRYPT_ROUNDS` é 10 em vez de 12.

**Limite da decisão em si.** O access token vale 900 s. Um worker que rodasse mais de 15
minutos veria os tokens expirarem no meio. As suítes levam ~1,4 min e ~30 s — uma ordem de
grandeza de margem. O sintoma, se um dia chegar lá, será 401 nos últimos cenários, e a
correção é reemitir por tempo, não voltar a autenticar por teste.
