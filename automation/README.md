# TechStore Automation

Framework de testes da TechStore em **Playwright + TypeScript**. Cobre a aplicação por
três caminhos diferentes: pelo **navegador** (E2E), por **HTTP** (API) e contra a
**especificação OpenAPI** (contrato).

| Documento                                                        | Conteudo                                     |
| ---------------------------------------------------------------- | -------------------------------------------- |
| [../docs/architecture.md](../docs/architecture.md)               | ADR-001 a ADR-019 — frontend e automação     |
| [../docs/api-architecture.md](../docs/api-architecture.md)       | ADR-020 a ADR-048 — API                      |
| [../api/README.md](../api/README.md)                             | Rotas, contrato de resposta, códigos de erro |
| [../docs/authentication-flow.md](../docs/authentication-flow.md) | Fluxo de sessão                              |
| [../docs/conventions.md](../docs/conventions.md)                 | Convenções de código e commits               |

---

## O que cada nível testa, e por quê

A pergunta que separa uma suíte útil de uma suíte inchada é **onde** cada verificação mora.
A regra adotada:

> Teste no nível mais baixo capaz de produzir a falha, e no nível mais alto em que um
> usuário a perceba.

| Nível        | Onde             | O que pertence                                           |
| ------------ | ---------------- | -------------------------------------------------------- |
| Unitário     | `frontend/`      | Regras puras do redutor do carrinho — 28 testes, ~130 ms |
| **API**      | `tests/api`      | O que **não tem manifestação visual**                    |
| **Contrato** | `tests/contract` | A resposta real bate com `/api/docs-json`                |
| **E2E**      | `tests/e2e`      | O que o usuário vê e faz                                 |

**O que só a API alcança** — e por isso justifica um teste novo em vez de duplicar cobertura:

| Cenário                              | Por que o navegador não alcança                                      |
| ------------------------------------ | -------------------------------------------------------------------- |
| Concorrência no fechamento do pedido | O navegador não emite duas requisições no mesmo milissegundo         |
| Reuso de refresh token rotacionado   | O cliente foi escrito para **nunca** reapresentar um token queimado  |
| Cliente em rota de administrador     | O frontend não tem nenhuma tela administrativa                       |
| Mass assignment (`role: ADMIN`)      | O formulário não tem esse campo                                      |
| Histórico e detalhe de pedido        | Não existe tela de pedidos                                           |
| Imutabilidade do snapshot de preço   | Exige `PATCH /products` e `GET /orders/:id` — nenhum dos dois tem UI |
| `?limit=1000000`, `sort` inválido    | A UI não tem paginação e nunca envia esses parâmetros                |

**Onde cada nível falha quando o outro passa:**

- **E2E passa, API falha** — a UI nunca envia a entrada ofensiva. Quebra para qualquer
  cliente que não seja aquele navegador.
- **API passa, E2E falha** — o contrato está certo e a ligação está errada. Foi o ADR-015:
  a API devolvia o carrinho e a tela redirecionava antes de ler.
- **Ambos passam, contrato falha** — a resposta está certa e a **documentação** mente.
  Foi o ADR-044: 64 respostas da spec declaravam a forma errada e nenhum teste falhava.
- **Contrato passa, API falha** — a forma está certa e o número está errado.

---

## Estrutura

```
automation/
├── tests/
│   ├── e2e/          cenários de navegador, por feature + a jornada completa
│   ├── api/          cenários por HTTP
│   └── contract/     resposta real x especificação OpenAPI
├── pages/            Page Objects (POM) + components/
├── services/         ApiClient + um service por recurso
├── factories/        geradores de dados únicos (Faker + CPF válido)
├── schemas/          carregador da spec e baseline versionada
├── fixtures/         test.ts (navegador) · api.ts (HTTP)
├── data/             massa de CONTRATO, espelho do seed da API
├── utils/            compartilhado: dinheiro, rotas, ambiente, asserções
└── playwright.config.ts
```

### A camada de API

```
ApiClient      transporte: monta a URL, injeta o token, gera o x-request-id
               e registra cada chamada para virar evidência na falha
XxxService     conhece a ROTA e nada mais — devolve a resposta CRUA
utils/assertions   expectSuccess · expectError · expectPaginated · expectFieldErrors
```

**Services não asseveram, e isso não é purismo.** Metade do trabalho de uma suíte de API é
verificar 401, 403, 404, 409 e 422. Um service que só soubesse devolver o caminho feliz — ou
que lançasse exceção no erro — obrigaria cada teste negativo a contorná-lo, e a camada
deixaria de servir justamente aos testes que mais precisam dela.

A exceção é `AuthService.authenticate()`, que **estoura** se falhar: ele existe para
_preparar_ estado, e uma fixture que não consegue um token não tem teste para rodar. A
separação é explícita no nome — `login()` devolve para ser asseverado, `authenticate()`
devolve para ser usado.

O token é **imutável**: `withToken()` devolve um cliente novo. Um cliente mutável produziria
o pior tipo de teste de autorização — aquele em que a ordem das chamadas decide quem está
autenticado, e trocar duas linhas muda o resultado sem que o código pareça diferente.

**Pasta é COMO o teste roda; tag é QUANDO ele roda.** `e2e`, `api` e `contract` são pastas
porque têm runtime diferente — uma precisa de navegador e `storageState`, outra só de
`APIRequestContext`, a terceira da spec baixada. São projetos distintos do Playwright.

Não existem pastas `smoke/` nem `regression/`: um teste de checkout não deixa de ser E2E
por ser crítico. Uma pasta de regressão viraria uma segunda cópia da suíte, envelhecendo
sozinha.

---

## Execução

Requisitos: **Node.js 20+**, e a pilha da API no ar (Postgres migrado e semeado).

```bash
cd api
npm run db:up && npm run prisma:deploy && npm run db:seed
npm run build && node dist/main.js     # NODE_ENV != production
```

```bash
cd automation
npm install
cp .env.example .env
npx playwright install --with-deps chromium

npm test                  # tudo
npm run test:e2e          # só navegador
npm run test:api          # só HTTP  (não sobe o frontend)
npm run test:contract     # só contrato
npm run test:ui           # modo interativo
```

O frontend sobe sozinho pelo `webServer` do Playwright — **apenas** quando um projeto de
navegador vai rodar. `npm run test:api` não paga o build de uma aplicação React que nenhum
teste de API abre.

A API **não** é gerenciada pelo `webServer` de propósito: ela precisa de banco migrado e
semeado antes de subir, e embutir essa cadeia esconderia uma falha de banco dentro do log
do Playwright.

---

## Tags

| Tag         | Significado                                       | PR  | Main | Diário |
| ----------- | ------------------------------------------------- | --- | ---- | ------ |
| `@smoke`    | O sistema está de pé. 14 cenários (8 E2E + 6 API) | ✅  | ✅   | ✅     |
| `@critical` | Caminho de receita: 12 cenários (8 E2E + 4 API)   | ✅  | ✅   | ✅     |
| `@slow`     | Concorrência na última unidade                    | —   | —    | ✅     |

```bash
npm run test:smoke        # --grep @smoke
npm run test:pr           # --grep "@smoke|@critical"
npm run test:regression   # --grep-invert @slow   (tudo, menos o lento)
npm run test:nightly      # tudo
```

**Regressão não é uma tag.** Marcar os 79 cenários com `@regression` criaria um rótulo que
significa "isto é um teste" — ruído puro. Regressão é a **ausência de filtro**; as tags
existem para recortes _menores_ que o todo.

---

## Massa de teste: fixa ou gerada?

| Bucket            | Origem       | Exemplos                                                |
| ----------------- | ------------ | ------------------------------------------------------- |
| **Contrato**      | `data/`      | `prd-001`, preço 129990, `qa@techstore.com`             |
| **Efêmero único** | `factories/` | e-mail de cadastro novo, endereço, telefone             |
| **Adversarial**   | `data/`      | CPF com dígito errado, `{ role: 'ADMIN' }`, `limit=1e6` |

Faker entra onde o valor precisa ser **único e nunca é comparado com uma constante**. Massa
fixa onde a asserção precisa de um valor conhecido.

O terceiro bucket é escrito à mão porque **dado aleatório não acerta uma fronteira de
propósito** — nenhum Faker vai gerar `111.111.111-11`, que é exatamente o CPF que se digita
para furar um formulário.

**Faker com seed fixo não é determinismo**, é reprodutibilidade da sequência — e ela quebra
no instante em que alguém insere um teste no meio do arquivo. A regra não é semear o Faker:
é **não asseverar sobre valor gerado**.

---

## Evidências

| Suíte    | Política                                                          |
| -------- | ----------------------------------------------------------------- |
| E2E      | Screenshot e vídeo só em falha; trace no primeiro retry (ADR-019) |
| API      | Requisição, resposta e **`x-request-id`** anexados na falha       |
| Contrato | Erros do AJV com o caminho do campo que divergiu                  |

Screenshot e vídeo não existem sem navegador — a suíte de API precisa de outra moeda. O
`x-request-id` é ecoado pela API (ADR-031) e correlaciona um teste vermelho no CI com a
linha exata do log daquela requisição.

**Retry é ZERO na suíte de API, inclusive no CI.** No E2E o retry compra estabilidade
contra a rede. Num teste de concorrência, um teste que falha e passa na segunda tentativa é
exatamente o defeito que se está caçando — o retry transformaria a descoberta em verde.

---

## Armadilhas de contrato

Encontradas escrevendo os testes de API, todas por execução vermelha. Ficam registradas
porque cada uma custou um ciclo de investigação:

| Armadilha                          | O que acontece                                                                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `baseURL` do Playwright            | Resolve por `new URL(path, base)`: `/products` sobre `.../api/v1` **descarta** o prefixo. O `ApiClient` monta a URL explicitamente           |
| Entrada ≠ saída                    | O produto entra como `priceInCents` e sai como `price`. Os totais entram planos e saem em `totals: {}`                                       |
| `id` do pedido                     | **É** o número `TS-4F2A9C`. Não existe campo `number`                                                                                        |
| `category` na leitura ≠ na escrita | `GET /products?category=` aceita nome ou slug; `POST /products` aceita id ou slug. `Áudio` filtra e **não** cria                             |
| Massa como corpo                   | Passar `USERS.valid` inteiro no login dá **422** — `forbidNonWhitelisted` recusa `id`, `name` e `role`                                       |
| `click()` não espera a rede        | Resolve quando o clique é despachado. O `goto()` seguinte **aborta** o `POST` em voo e o item nunca chega ao servidor — use `mutatingCart()` |

A segunda e a terceira linhas são o argumento prático para os testes de contrato da
Sprint 4: os tipos em `services/types.ts` foram escritos à mão a partir dos DTOs de
entrada e **erraram quase todo campo de saída**. Um tipo escrito à mão é uma segunda fonte
de verdade, e ela diverge da primeira no dia em que é escrita.

---

## Como adicionar um teste

1. **Escolha o nível.** Se a falha não tem manifestação visual, é teste de API. Se depende
   de navegação, hidratação ou de duas telas conversando, é E2E.
2. **Não recubra o nível de baixo.** Antes de escrever, pergunte o que este teste pega que
   os outros não pegam. Se a resposta for "nada", ele não deve existir.
3. **E2E:** se precisar de um seletor cru, falta um método no Page Object.
4. **API:** consuma pelos `services/`, nunca `request.post` solto no spec.
5. **Marque com tag** só se o cenário for smoke, crítico ou lento. Sem tag é o padrão.
6. **Asserção por `code`, nunca por mensagem** — copy muda, código não.
