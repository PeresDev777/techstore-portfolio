# TechStore API

Backend REST da TechStore em **NestJS + TypeScript + Prisma + PostgreSQL**. Serve o
frontend React deste repositorio e e o alvo da suite de QA Automation.

| Documento                                                        | Conteudo                                      |
| ---------------------------------------------------------------- | --------------------------------------------- |
| [../docs/api-architecture.md](../docs/api-architecture.md)       | 29 decisoes arquiteturais (ADR-020 a ADR-048) |
| [../docs/database.md](../docs/database.md)                       | Modelo, relacoes, indices e seed              |
| [../docs/authentication-flow.md](../docs/authentication-flow.md) | Fluxo de sessao com diagramas de sequencia    |
| [../docs/conventions.md](../docs/conventions.md)                 | Convencoes de codigo, commits e API           |
| [../docs/roadmap.md](../docs/roadmap.md)                         | O que vem depois                              |

---

## Stack

| Camada       | Escolha                            | Por que                                                                                                                         |
| ------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Framework    | NestJS 11                          | Modularidade, DI e ciclo de vida prontos; guards, interceptors e filters cobrem as preocupacoes transversais sem codigo de cola |
| Banco        | PostgreSQL 16 + Prisma             | Migrations versionadas e tipos derivados do schema — o tipo do banco vira tipo do TypeScript sem duplicacao                     |
| Validacao    | class-validator + ValidationPipe   | O DTO e uma unica fonte para validacao, tipo e documentacao                                                                     |
| Documentacao | Swagger / OpenAPI                  | Gerada dos DTOs pelo plugin do Nest CLI; nao existe doc desatualizada por esquecimento                                          |
| Log          | Pino (nestjs-pino)                 | JSON estruturado com correlacao por `x-request-id`. Log e dado consultavel, nao prosa                                           |
| Seguranca    | Helmet, CORS por lista, rate limit | Headers seguros por padrao, origem controlada, forca bruta contida                                                              |
| Container    | Docker multi-estagio               | A imagem final nao carrega compilador nem devDependencies                                                                       |

---

## Estrutura

```
api/
├── prisma/
│   └── schema.prisma          # modelos, migrations e seed (Sprint 2)
└── src/
    ├── main.ts                # bootstrap: helmet, cors, prefixo, versao, pipe, swagger
    ├── app.module.ts          # modulo raiz: config, log, throttle, providers globais
    ├── config/                # leitura e VALIDACAO das variaveis de ambiente
    ├── common/                # o que atravessa todos os modulos
    │   ├── constants/         # codigos de erro da API
    │   ├── decorators/        # @ResponseMessage
    │   ├── dto/               # paginacao (query e resultado)
    │   ├── filters/           # tratamento global de erros
    │   ├── interceptors/      # envelope de resposta
    │   └── pipes/             # traducao dos erros de validacao
    ├── prisma/                # PrismaService (ciclo de vida da conexao)
    └── modules/               # um diretorio por dominio
        └── health/            # liveness e readiness
```

Modulos de dominio (`auth`, `users`, `products`, `cart`, `orders`) seguem sempre o mesmo
desenho: `module` · `controller` · `service` · `repository` · `dto/` · `entities/`.

**Imports sao relativos, sem alias `@/`.** Alias de caminho exige `tsconfig-paths` em
runtime; sem ele o codigo roda em desenvolvimento e quebra no container com
`MODULE_NOT_FOUND`. Nao vale o risco pela estetica do import.

---

## Instalacao

Requisitos: **Node.js 20+**, **npm** e **Docker** (para o Postgres).

```bash
cd api
npm install          # instala e gera o Prisma Client
cp .env.example .env
```

## Execucao

**Desenvolvimento** — banco em container, API na maquina (recarrega ao salvar):

```bash
npm run db:up        # sobe so o Postgres
npm run start:dev
```

**Tudo em container** — um comando, do zero ao catalogo populado:

```bash
npm run docker:up    # build + Postgres + migrations + seed + API
npm run docker:down  # para (preserva os dados)
npm run docker:reset # para e APAGA o volume do banco
```

A subida acontece em ordem garantida, e nao "sobe junto e torce":

```
db  Started → Healthy          (pg_isready aprova)
        ↓  service_healthy
migrate  Started → Exited      (migrate deploy + seed)
        ↓  service_completed_successfully
api  Started → Healthy
```

O servico `migrate` e um container de vida curta que usa um estagio proprio do Dockerfile
(`migrator`), com as devDependencies preservadas — o seed roda via `tsx`. A imagem de
producao continua sem nenhuma ferramenta de desenvolvimento.

Se o `migrate` falhar, a **API nem inicia**: melhor nao subir do que subir e responder 500
em toda consulta.

**Comportamento a conhecer:** o `migrate` roda a cada `up` e o seed restaura o catalogo ao
estado de contrato. Pedidos e contas criados durante o uso sobrevivem; precos e estoques
voltam aos valores do seed. Deliberado para desenvolvimento e teste — em producao o passo
seria apenas `migrate deploy`, sem seed.

**Para rodar a suite E2E contra o compose**, suba com `NODE_ENV=test`: o padrao e
`production`, que nao registra `POST /test/reset` (ADR-041) e a suite precisa dele para
isolar os cenarios.

| Recurso      | URL                                    |
| ------------ | -------------------------------------- |
| API          | http://localhost:3000/api/v1           |
| Swagger UI   | http://localhost:3000/api/docs         |
| OpenAPI JSON | http://localhost:3000/api/docs-json    |
| Liveness     | http://localhost:3000/api/health       |
| Readiness    | http://localhost:3000/api/health/ready |

## Qualidade

```bash
npm run lint          # ESLint com regras que exigem informacao de tipo
npm run format:check  # Prettier
npm run typecheck     # tsc --noEmit
npm run build         # nest build
```

---

## Rotas

A API e **fechada por padrao**: toda rota exige `Authorization: Bearer <accessToken>`,
exceto as marcadas como publicas.

| Metodo                      | Rota                                 | Acesso      | O que faz                                          |
| --------------------------- | ------------------------------------ | ----------- | -------------------------------------------------- |
| `POST`                      | `/api/v1/auth/register`              | publica     | Cria conta de cliente                              |
| `POST`                      | `/api/v1/auth/login`                 | publica     | Autentica e abre sessao                            |
| `POST`                      | `/api/v1/auth/refresh`               | publica     | Troca o refresh token por um novo par              |
| `POST`                      | `/api/v1/auth/logout`                | publica     | Revoga a familia de refresh tokens                 |
| `GET`                       | `/api/v1/auth/me`                    | autenticada | Usuario da sessao atual                            |
| `GET`                       | `/api/v1/users/me`                   | autenticada | Perfil                                             |
| `PATCH`                     | `/api/v1/users/me`                   | autenticada | Atualiza nome e/ou e-mail                          |
| `PATCH`                     | `/api/v1/users/me/password`          | autenticada | Troca a senha (exige a atual)                      |
| `DELETE`                    | `/api/v1/users/me`                   | autenticada | Exclusao logica + revoga sessoes                   |
| `GET`                       | `/api/v1/users`                      | **admin**   | Lista usuarios (paginada)                          |
| `GET`                       | `/api/v1/users/:id`                  | **admin**   | Busca usuario por id                               |
| `GET`                       | `/api/v1/products`                   | publica     | Catalogo com busca, filtros, ordenacao e paginacao |
| `GET`                       | `/api/v1/products/:idOrSlug`         | publica     | Produto por id ou slug                             |
| `GET`                       | `/api/v1/products/:idOrSlug/related` | publica     | Relacionados (mesma categoria)                     |
| `POST`                      | `/api/v1/products`                   | **admin**   | Cria produto                                       |
| `PATCH`                     | `/api/v1/products/:id`               | **admin**   | Atualiza produto                                   |
| `DELETE`                    | `/api/v1/products/:id`               | **admin**   | Retira de catalogo (logico)                        |
| `GET`                       | `/api/v1/categories`                 | publica     | Categorias com contagem de produtos ativos         |
| `GET`                       | `/api/v1/categories/:idOrSlug`       | publica     | Categoria por id ou slug                           |
| `POST` · `PATCH` · `DELETE` | `/api/v1/categories[/:id]`           | **admin**   | CRUD de categorias                                 |
| `GET`                       | `/api/v1/cart`                       | autenticada | Carrinho do usuario, com totais calculados         |
| `POST`                      | `/api/v1/cart/items`                 | autenticada | Adiciona item (SOMA se ja existe)                  |
| `PATCH`                     | `/api/v1/cart/items/:productId`      | autenticada | Quantidade ABSOLUTA, minimo 1                      |
| `DELETE`                    | `/api/v1/cart/items/:productId`      | autenticada | Remove um item                                     |
| `DELETE`                    | `/api/v1/cart`                       | autenticada | Esvazia o carrinho                                 |
| `POST`                      | `/api/v1/orders`                     | autenticada | Fecha o pedido a partir do carrinho (transacional) |
| `GET`                       | `/api/v1/orders`                     | autenticada | Historico do usuario (paginado)                    |
| `GET`                       | `/api/v1/orders/:id`                 | autenticada | Pedido por id; de outro usuario responde **404**   |
| `POST`                      | `/api/v1/orders/:id/cancel`          | autenticada | Cancela `PENDING` e devolve o estoque              |
| `POST`                      | `/api/v1/orders/:id/pay`             | autenticada | Simula pagamento: `PENDING` -> `PAID` (ADR-040)    |
| `POST`                      | `/api/v1/test/reset`                 | publica\*   | Restaura o seed. **Nao existe em producao**        |
| `GET`                       | `/api/health` · `/api/health/ready`  | publica     | Liveness e readiness                               |

\* `/test/reset` so e montada quando `NODE_ENV !== production` (ADR-041). Nao ha guard —
o modulo inteiro deixa de ser registrado.

`/refresh` e `/logout` sao publicas de proposito: quem as chama esta justamente com o
access token vencido. A prova de identidade nelas e o proprio refresh token.

### Consulta ao catalogo

| Parametro        | Valores                                                                    | Observacao                                                                   |
| ---------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `search`         | texto livre                                                                | Ignora acento; TODOS os termos precisam aparecer, em qualquer ordem          |
| `category`       | nome ou slug                                                               | `Áudio` e `audio` funcionam igual; categoria inexistente devolve lista vazia |
| `inStock`        | `true` / `false`                                                           | Apenas produtos com `stock > 0`                                              |
| `sort`           | `relevance` (padrao), `price-asc`, `price-desc`, `rating-desc`, `name-asc` | Valor invalido responde **422**                                              |
| `page` / `limit` | inteiros; `limit` maximo 100                                               |                                                                              |

```
GET /api/v1/products?search=vertex%20notebook&sort=price-asc&page=1&limit=10
```

Toda ordenacao tem desempate por `id`, e `name-asc` usa uma coluna normalizada em vez da
coluna `name` — sem isso, a ordem dependeria da collation do banco e mudaria entre Windows,
Linux e CI.

### Regras do carrinho

O carrinho e sempre o do usuario autenticado — nenhuma rota recebe id de carrinho ou de
usuario. O isolamento entre contas e estrutural, nao uma verificacao que alguem pode
esquecer.

| Regra                  | Comportamento                                                                  |
| ---------------------- | ------------------------------------------------------------------------------ |
| Produto repetido       | SOMA a quantidade; nunca cria uma segunda linha                                |
| Limite de estoque      | Aplicado sobre a SOMA: 2 no carrinho + 3 com estoque 3 responde **409**        |
| Produto esgotado       | **409** `INSUFFICIENT_STOCK`                                                   |
| `PATCH` com quantidade | Valor ABSOLUTO, nao incremento. Minimo 1 — para remover, use `DELETE`          |
| Frete                  | R$ 29,90; **gratis** a partir de R$ 500,00 de subtotal; zero no carrinho vazio |
| Totais                 | Sempre calculados, nunca persistidos                                           |
| Item indisponivel      | Continua visivel com `unavailable: true` e motivo, mas **fora dos totais**     |

Estoque insuficiente responde 409 em vez de ajustar a quantidade em silencio — uma API que
recebe "quero 5" e grava 3 sem avisar entrega um estado diferente do pedido. O `clamp` do
frontend continua valendo como conveniencia da UI.

### Apoio a automacao

`POST /api/v1/test/reset` devolve o banco ao estado de contrato: 6 categorias, 4 usuarios e
12 produtos com ids fixos. Existe para que a suite de QA comece cada cenario de um ponto
conhecido, sem depender da ordem de execucao.

**A rota nao existe em producao.** O modulo inteiro so e registrado quando
`NODE_ENV !== production` — nao ha guard a ser esquecido nem condicao a ser contornada, o
endpoint simplesmente nao e montado. Para uma rota que apaga o banco, "inexistente" e uma
garantia melhor que "protegida".

Um detalhe que a suite precisa conhecer: como os ids do seed sao FIXOS, um **access token
emitido antes do reset continua valido depois dele** — `usr-001` volta a existir com o
mesmo id. Ja o **refresh token e invalidado**, porque a tabela de sessoes e truncada.

| Depois de `POST /test/reset` | Resultado                                          |
| ---------------------------- | -------------------------------------------------- |
| Access token antigo          | **200** — segue valido (mesmo `usr-001`)           |
| Refresh token antigo         | **401** `UNAUTHENTICATED` — sessoes foram apagadas |

Na pratica: um `storageState` do Playwright gravado antes do reset continua servindo para
requisicoes autenticadas ate o access token expirar, mas nao sobrevive a uma renovacao.

Outras decisoes pensadas para a automacao:

| Recurso                                 | Para que serve no teste                                              |
| --------------------------------------- | -------------------------------------------------------------------- |
| `x-request-id` ecoado no header         | Correlacionar um teste vermelho com o log daquela requisicao         |
| Envelope identico em toda resposta      | Um unico helper de assercao para a suite inteira                     |
| `code` em todo erro                     | Assercao imune a mudanca de copy e de idioma                         |
| `errors[].field` com caminho pontilhado | Asseverar QUAL campo falhou (`customer.cpf`)                         |
| `/api/docs-json`                        | Teste de contrato: falha quando a API muda de forma sem aviso        |
| `/api/health/ready`                     | `webServer` do Playwright espera prontidao real, nao "a porta abriu" |
| `THROTTLE_LIMIT` por ambiente           | Um limite apertado reprovaria a suite inteira no CI                  |

### Ciclo de vida do pedido

```
carrinho ──POST /orders──> PENDING ──POST /:id/pay────> PAID
                              │                          │
                              └──POST /:id/cancel──> CANCELED   (pago nao cancela:
                                 (devolve o estoque)             exige estorno)
```

`POST /orders` roda em UMA transacao: baixa o estoque com guarda condicional, grava o
pedido com snapshot de comprador, endereco, itens e precos, e esvazia o carrinho. Falhou
qualquer etapa, nada acontece.

O corpo traz **apenas comprador e endereco** — os itens vem do carrinho no servidor. Se o
cliente enviasse a lista, enviaria tambem os precos, e um pedido de R$ 0,01 seria aceito.

| Regra                   | Comportamento                                                           |
| ----------------------- | ----------------------------------------------------------------------- |
| Numero do pedido        | `TS-4F2A9C` — 6 hex maiusculos, com retry em caso de colisao            |
| Preco                   | Lido do banco DENTRO da transacao, nunca do corpo                       |
| Estoque                 | `UPDATE ... WHERE stock >= quantity` — o banco decide, nao o JavaScript |
| Snapshot                | Nome, slug e preco unitario congelados no fechamento                    |
| Cancelamento            | So a partir de `PENDING`; devolve o estoque                             |
| Pedido de outro usuario | **404**, nunca 403 — um 403 confirmaria que o numero existe             |
| CPF                     | Validado pelo algoritmo de digitos verificadores, com ou sem mascara    |

### Fluxo de sessao

```
POST /auth/login          -> accessToken (15 min) + refreshToken (7 dias)
   ... 15 minutos depois, o access token expira ...
POST /auth/refresh        -> novo par; o refresh anterior e QUEIMADO
   ... refresh antigo reapresentado ...
                          -> 401 + toda a familia de tokens revogada
POST /auth/logout         -> familia revogada; refresh nao renova mais
```

O access token e um JWT assinado; o refresh token e uma string aleatoria opaca, guardada
como hash SHA-256. Detalhes e razoes em
[../docs/api-architecture.md](../docs/api-architecture.md) (ADR-025).

## Contrato de resposta

Toda resposta de sucesso:

```jsonc
{ "success": true, "message": "Produto encontrado com sucesso.", "data": {} }
```

Listas paginadas acrescentam `pagination`:

```jsonc
{
  "success": true,
  "message": "Produtos listados com sucesso.",
  "data": [],
  "pagination": { "page": 1, "limit": 10, "total": 50, "totalPages": 5 },
}
```

Erros:

```jsonc
{
  "success": false,
  "message": "Falha na validacao dos dados enviados.",
  "code": "VALIDATION_ERROR",
  "errors": [{ "field": "email", "message": "E-mail invalido." }],
}
```

| Situacao                    | Status | `code`                |
| --------------------------- | ------ | --------------------- |
| Validacao falhou            | 422    | `VALIDATION_ERROR`    |
| Sem token ou token invalido | 401    | `UNAUTHENTICATED`     |
| Credenciais incorretas      | 401    | `INVALID_CREDENTIALS` |
| Conta desativada            | 403    | `ACCOUNT_DISABLED`    |
| Autenticado, sem permissao  | 403    | `FORBIDDEN`           |
| Recurso inexistente         | 404    | `NOT_FOUND`           |
| Conflito de estado          | 409    | `CONFLICT`            |
| Estoque insuficiente        | 409    | `INSUFFICIENT_STOCK`  |
| Limite de requisicoes       | 429    | `RATE_LIMITED`        |
| Dependencia fora do ar      | 503    | `SERVICE_UNAVAILABLE` |

**401 x 403** e a confusao mais comum em API REST: 401 significa _nao sei quem voce e_;
403 significa _sei, e voce nao pode_. Um cliente que trata 401 renovando o token entra em
loop infinito se a API responder 401 para falta de permissao.

---

## Variaveis de ambiente

Todas descritas em [.env.example](.env.example). Sao **validadas no boot**: variavel
ausente ou invalida derruba o processo com o nome da variavel na mensagem, em vez de
produzir um erro obscuro na terceira requisicao.

`.env` nunca e versionado. Nenhum segredo mora no codigo.

---

## Roadmap

- [x] **Sprint 0** — Planejamento, arquitetura, modelagem
- [x] **Sprint 1** — Estrutura, TypeScript, NestJS, Docker, Prisma, tooling
- [ ] **Sprint 2** — Schema, migrations, seeds, repositorios
- [x] **Sprint 3** — Autenticacao (register, login, refresh, logout, guards)
- [x] **Sprint 4** — Produtos e categorias
- [x] **Sprint 5** — Carrinho
- [x] **Sprint 6** — Pedidos
- [x] **Sprint 7** — Swagger com envelope real, CHANGELOG e documentacao tecnica
- [x] **Sprint 8** — Refino, apoio a automacao e CI
