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
