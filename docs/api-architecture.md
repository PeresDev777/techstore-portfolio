# Arquitetura — TechStore API

Documento vivo, no mesmo formato de ADR usado em [architecture.md](architecture.md). A
numeracao continua de onde aquele documento parou (ADR-019), porque as decisoes do backend
convivem com as do frontend e da automacao no mesmo sistema.

---

## Visao geral

A API e o terceiro projeto do repositorio. Ela substitui a camada de dados mockada do
frontend (ADR-002) e passa a ser a **fonte da verdade** de catalogo, sessao, carrinho e
pedidos.

```
frontend/  --HTTP-->  api/  --SQL-->  postgres
     ^                  ^
     |                  |
  Playwright E2E    Playwright API
     (projeto automation/)
```

---

## ADR-020 — API como terceiro projeto autocontido

**Contexto.** A API poderia viver em um repositorio proprio ou como workspace da raiz.

**Decisao.** `api/` no mesmo repositorio, autocontido: `package.json`, `tsconfig.json`,
lint, Dockerfile e compose proprios. Mesmo principio do ADR-001.

**Consequencia.** O contrato entre os tres projetos continua sendo apenas HTTP — nenhum
import cruzado. Quem avalia o portfolio consegue rodar qualquer um dos tres isoladamente.
O custo e nao ter um comando unico na raiz, aceitavel nesta escala.

---

## ADR-021 — NestJS modular no lugar de camadas soltas

**Contexto.** O plano inicial previa Express com pastas por camada (`controllers/`,
`services/`, `repositories/`). Migramos para NestJS.

**Decisao.** Organizacao **por dominio**, nao por tipo de arquivo. Cada modulo carrega suas
proprias camadas:

```
src/modules/products/
├── products.module.ts       # fronteira: o que entra e o que sai
├── products.controller.ts   # HTTP: le request, escolhe status
├── products.service.ts      # regra de negocio
├── products.repository.ts   # unico ponto com prisma.*
├── dto/                     # contratos de entrada + fonte do Swagger
└── entities/                # forma da resposta
```

**Consequencia.** As camadas do plano original continuam existindo — mudou o eixo do
agrupamento. Uma alteracao em produtos toca um diretorio, nao cinco. E o `@Module` torna
explicito o que cada dominio expoe: um service so e visivel para outro modulo se estiver
em `exports`, o que impede o acoplamento acidental que pastas globais de `services/`
sempre acabam produzindo.

As duas regras que sustentam a separacao:

1. **`req` e `res` param no controller.** Um service que recebe `Request` nao e testavel
   sem HTTP nem reusavel por um job.
2. **`prisma` so existe no repositorio.** Vale mesmo com `PrismaModule` sendo `@Global` —
   e disciplina de revisao, nao restricao do framework.

---

## ADR-022 — Envelope unico em toda resposta

**Contexto.** Cada endpoint poderia devolver o recurso cru e deixar o formato implicito.

**Decisao.** Um `ResponseInterceptor` global envelopa **toda** resposta de sucesso:

```jsonc
{ "success": true, "message": "...", "data": {...} }
{ "success": true, "message": "...", "data": [...], "pagination": { "page": 1, "limit": 10, "total": 50, "totalPages": 5 } }
```

A mensagem vem do decorator `@ResponseMessage('...')` na rota. Listas paginadas sao
reconhecidas por `instanceof PaginatedResult` — nao por inspecao de chaves, que seria
adivinhacao.

**Consequencia.** O custo e um nivel de aninhamento no cliente. O ganho: um unico
desempacotador no frontend, paginacao identica em toda listagem, e um helper unico de
assercao na suite de automacao. Ser um **interceptor** e nao um helper e o que torna isso
garantia estrutural — nao ha como escrever uma rota fora do padrao por esquecimento.

---

## ADR-023 — Erro carrega `code`, nao apenas `message`

**Contexto.** O formato de erro acordado e `{ success, message, errors }`.

**Decisao.** Adicionamos `code`:

```jsonc
{ "success": false, "message": "Falha na validacao dos dados enviados.",
  "code": "VALIDATION_ERROR", "errors": [{ "field": "email", "message": "..." }] }
```

**Consequencia.** `message` e texto para humano: muda com revisao de copy e com traducao.
O frontend **ja** decide comportamento por codigo (`services/apiError.ts`), entao a API
devolver apenas texto obrigaria a UI a voltar a comparar strings. Para a automacao, e a
diferenca entre uma assercao estavel e um teste que quebra quando alguem melhora uma frase.

Um `AllExceptionsFilter` com `@Catch()` sem argumento garante o formato **inclusive** para
o que ninguem previu — sem ele, um `TypeError` vira HTML de stack trace e quebra o parser
do cliente. Erros 5xx nunca vazam detalhe interno na resposta: o detalhe vai para o log,
correlacionado por `x-request-id`.

---

## ADR-024 — Validacao com DTOs, 422 e whitelist

**Contexto.** O plano inicial previa Zod. O NestJS resolve validacao com
`ValidationPipe` + `class-validator` sobre classes DTO.

**Decisao.** DTOs com `class-validator`, `ValidationPipe` global com
`whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` e status **422**.

**Consequencia.** O DTO passa a ser uma unica fonte para tres coisas: validacao, tipo do
TypeScript e documentacao Swagger (via plugin do Nest CLI, que le os tipos em tempo de
compilacao). Com Zod seria preciso um adaptador para o Swagger enxergar o schema.

`whitelist` nao e conforto: sem ele, um `POST /users { "role": "ADMIN" }` carrega um campo
extra ate a camada de dados — **mass assignment**, uma das escaladas de privilegio mais
comuns em API REST.

422 e nao 400 porque 400 significa "requisicao malformada" (JSON quebrado) e 422 significa
"entendi o corpo, mas o conteudo nao passa nas regras". O cliente consegue separar bug de
integracao de erro de preenchimento.

Os erros saem como `{ field, message }`, com caminho pontilhado para campos aninhados
(`address.zipCode`). O padrao do Nest devolveria `["email must be an email"]`, obrigando o
cliente a adivinhar por substring a qual campo cada frase pertence.

---

## ADR-025 — Autenticacao: access curto + refresh rotacionado

**Contexto.** O briefing pedia "JWT e logout". JWT e stateless: um token assinado vale ate
expirar e o servidor nao tem como invalida-lo. Um `POST /logout` que so responde 204 e
manda o cliente apagar o token e **teatro de seguranca** — quem copiou o token continua
autenticado.

**Decisao.** Access token JWT de 15 minutos + refresh token de 7 dias **persistido como
hash** e rotacionado a cada uso. Logout revoga o refresh no banco. Reuso de um refresh ja
rotacionado revoga a familia inteira — deteccao de roubo.

**Consequencia.** Janela de exposicao de 15 minutos sem depender de Redis. Guardamos o
**hash** do refresh token pelo mesmo motivo de guardar hash de senha: se o banco vazar,
ninguem autentica com o conteudo da tabela.

Alternativas: token unico de longa duracao (simples, logout ficticio); denylist em Redis
(revogacao imediata, custo de mais uma dependencia de infra).

**Detalhes decididos na implementacao (Sprint 3):**

- **O refresh token nao e um JWT** — e uma string de 32 bytes aleatorios, opaca. Um JWT
  carrega claims legiveis por quem o tiver e vale enquanto a assinatura valer; aqui quem
  decide a validade e o banco, entao nao ha nada que o token precise carregar nem possa
  vazar. Consequencia pratica: **nao existe `JWT_REFRESH_SECRET`** — um segredo a menos
  para gerenciar e rotacionar.

- **O hash e SHA-256, nao bcrypt.** bcrypt e lento por design para resistir a dicionario
  sobre senhas humanas, que tem pouca entropia; 256 bits aleatorios nao tem dicionario que
  os alcance, entao a lentidao nao compra nada. E o salt do bcrypt, novo a cada chamada,
  impossibilitaria a busca por hash — seria preciso varrer a tabela linha a linha em toda
  renovacao.

- **O refresh token viaja no corpo, nao em cookie httpOnly.** Cookie seria mais seguro
  contra XSS. A escolha foi pelo corpo porque a SPA esta em outro dominio (CORS com
  credenciais) e porque a suite de testes de API manipula tokens explicitamente. A
  mitigacao e o desenho inteiro — TTL curto, rotacao, revogacao de familia — e migrar e
  uma mudanca contida ao controller.

---

## ADR-032 — Fechado por padrao

**Contexto.** Duas formas de proteger rotas: guard global com excecoes declaradas, ou
`@UseGuards()` rota a rota.

**Decisao.** `JwtAuthGuard` global via `APP_GUARD`. `@Public()` e a unica forma de escapar.

**Consequencia.** As duas abordagens parecem equivalentes e nao sao — o que muda e o LADO
da falha. Esquecer `@Public()` numa rota publica gera um 401 obvio, reportado no primeiro
teste. Esquecer `@UseGuards()` numa rota privada gera um endpoint aberto que ninguem
percebe, ate alguem de fora perceber.

A ordem dos guards globais tambem e significativa: `ThrottlerGuard` → `JwtAuthGuard` →
`RolesGuard`. O rate limit vem primeiro para que forca bruta nao pague consulta ao banco
por tentativa; o RolesGuard vem por ultimo porque depende de `request.user`.

---

## ADR-033 — O papel vem do banco, nao do token

**Contexto.** O access token ja carrega `sub`, `email` e `role`. Confiar apenas neles
tornaria a autenticacao verdadeiramente stateless, sem nenhuma consulta.

**Decisao.** A `JwtStrategy` busca o usuario por id a cada requisicao autenticada e devolve
o papel lido do banco.

**Consequencia.** Custa uma leitura indexada por requisicao. Em troca, desativar uma conta,
rebaixar um administrador ou excluir um usuario tem efeito **imediato** — sem isso, o
token antigo continuaria valendo com o papel ANTIGO por ate 15 minutos. Um administrador
rebaixado que segue administrador por 15 minutos e uma janela que nao vale o ganho de
performance.

Se o volume um dia justificar, o caminho e cache curto com invalidacao na mudanca de
papel — nao remover a verificacao.

---

## ADR-034 — 200 com envelope no lugar de 204

**Contexto.** Logout, troca de senha e exclusao de conta nao tem dado para devolver. O
verbo correto seria 204 No Content.

**Decisao.** Responder 200 com o envelope padrao e `data: null`.

**Consequencia.** 204 significa literalmente "sem conteudo", e `{ success, message, data }`
e conteudo — as duas coisas nao coexistem. Entre abrir uma excecao no formato de resposta
e usar 200 num caso sem dados, a consistencia vale mais: o cliente e a suite tratam toda
resposta pelo mesmo caminho, e `message` ainda comunica o que aconteceu.

---

## ADR-026 — Snapshot no pedido, referencia no carrinho

**Contexto.** Tanto `CartItem` quanto `OrderItem` apontam para um produto.

**Decisao.** `CartItem` guarda `productId` e le o preco atual. `OrderItem` guarda um
**snapshot**: nome, slug e preco unitario no momento da compra.

**Consequencia.** O carrinho e uma projecao viva — mudou o preco, o usuario ve o novo. O
pedido e um fato imutavel: o que foi cobrado e o que esta escrito. Sem o snapshot,
reajustar um preco em 2027 reescreveria o historico de 2026 — problema contabil, nao bug
de software. Pelo mesmo motivo os totais sao **persistidos** no pedido e **calculados** no
carrinho.

Detalhamento completo das relacoes em `docs/database.md` (Sprint 2).

---

## ADR-027 — Liveness e readiness sao endpoints diferentes

**Contexto.** O padrao seria um unico `/health` que verifica tudo.

**Decisao.** Dois endpoints, ambos fora do versionamento (`VERSION_NEUTRAL`):

| Endpoint | Verifica | Responde |
| --- | --- | --- |
| `GET /api/health` | so o processo | 200 sempre que a API estiver de pe |
| `GET /api/health/ready` | Postgres via Terminus | 503 quando uma dependencia esta fora |

Alem disso, **falha de conexao com o banco no boot nao derruba o processo**.

**Consequencia.** Se o liveness dependesse do banco, uma indisponibilidade momentanea do
Postgres faria o orquestrador matar e recriar a API — reacao errada para um problema que
nao esta na aplicacao. Subindo mesmo assim, o readiness reporta indisponivel, o balanceador
tira a instancia de rotacao e ela volta sozinha quando o banco voltar.

Isso convive com o "falhe alto e cedo" da validacao de ambiente, e a distincao importa:
variavel ausente e defeito de deploy que nunca se resolve sozinho; banco fora do ar e
condicao transitoria.

Health checks ficam fora do versionamento porque sao contrato com a **infraestrutura**, nao
com o cliente da API — versionar obrigaria a mexer em configuracao de deploy a cada versao.

---

## ADR-028 — Seed deterministico como contrato com a automacao

**Contexto.** `frontend/src/data/` diz explicitamente que ids, e-mails e precos sao um
contrato com a suite de testes. Existem 79 cenarios E2E verdes que asseveram `prd-001` e
`R$ 1.299,90`.

**Decisao.** O seed do Postgres **reproduz os ids atuais** (`usr-001`, `prd-001`) com
`String @id`, e o seed e idempotente (`upsert`). Registros criados via API usam `cuid()`.

**Consequencia.** A migracao do mock para a API real nao quebra um unico teste existente.
`cuid()` seria a escolha "correta" em producao, mas aqui custaria reescrever uma suite
verde para ganhar nada. Os dois formatos convivem, e a transicao para ids dinamicos e
natural conforme a aplicacao cria dados.

Ordenacoes sempre levam **desempate por `id`**: sem tiebreaker, o Postgres pode devolver
ordem diferente entre execucoes — teste que passa nove vezes e falha na decima.

---

## ADR-029 — Versionamento de URI desde a primeira rota

**Contexto.** `/api/products` e mais curto e ninguem precisa de versao no dia 1.

**Decisao.** `app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })`.
Rotas de negocio nascem em `/api/v1/...`.

**Consequencia.** Versionar cedo e barato. Introduzir versao depois que existem um frontend
e uma suite de testes consumindo `/api/products` significa quebrar os dois ou manter um
alias para sempre.

---

## ADR-030 — `incremental: false` no TypeScript

**Contexto.** Descoberto durante a Sprint 1, com a API ja compilando: `node dist/main.js`
falhava com `MODULE_NOT_FOUND` apontando para um arquivo que existia no codigo-fonte.

**Decisao.** Desligar `incremental` no `tsconfig.json`.

**Consequencia.** Com `incremental: true`, o tsc grava um `.tsbuildinfo` registrando quais
saidas ja existem. O `nest build` apaga a pasta `dist` antes de compilar (`deleteOutDir`),
mas o `.tsbuildinfo` **sobrevive** — na compilacao seguinte o tsc conclui que os arquivos
nao alterados ja estao emitidos e pula a escrita deles. O resultado e um build
"bem-sucedido" com `dist` incompleto.

Vale registrar o modo de falha: o build passa, o lint passa, o typecheck passa, e a
aplicacao quebra em runtime — provavelmente dentro do container, nunca na maquina de quem
programou. Ganhar alguns segundos de compilacao nao paga um defeito que so aparece no
deploy.

---

## ADR-031 — Decisoes tomadas para a suite de automacao

Nenhuma delas e sobre teste; todas sao sobre **observabilidade e determinismo**, que e o
que torna uma API testavel.

| Decisao | Efeito na automacao |
| --- | --- |
| `x-request-id` reaproveitado do cliente e devolvido no header | Teste vermelho no CI carrega o id; o log daquela requisicao sai com um grep |
| Envelope identico em toda resposta | Um `expectSuccess(res)` serve a suite inteira |
| `code` em todo erro | Assercao imune a mudanca de copy e de idioma |
| `errors[].field` | O teste assevera qual campo falhou, nao a frase |
| `/api/health/ready` valida o banco | `webServer` do Playwright espera prontidao real, nao "a porta abriu" |
| OpenAPI publicado em `/api/docs-json` | Permite teste de contrato: falha quando a API muda de forma sem aviso |
| Limite de rate configuravel por ambiente | Um limite fixo baixo reprovaria a suite inteira no CI |
| `limit` maximo de 100 na paginacao | `?limit=1000000` seria negacao de servico gratuita |

---

## ADR-035 — Colunas derivadas para busca, relevancia e ordenacao

**Contexto.** Tres operacoes de leitura do catalogo nao se expressam bem em uma consulta do
Prisma: busca sem acento, ordenacao por relevancia (`rating * reviewCount`) e ordenacao por
nome.

**Decisao.** Tres colunas calculadas na ESCRITA, por uma unica funcao
(`deriveProductFields`) que o service e o seed compartilham:

| Coluna | Substitui | Por que a alternativa nao serve |
| --- | --- | --- |
| `search_index` | `unaccent(...) ILIKE` | A extensao `unaccent` exige superusuario, indisponivel em boa parte dos bancos gerenciados |
| `relevance_score` | `ORDER BY rating * review_count` | `orderBy` do Prisma aceita colunas, nao expressoes |
| `name_sort` | `ORDER BY name` | A ordem passaria a depender da COLLATION do banco |

**Consequencia.** O risco conhecido de coluna derivada e a deriva — alguem altera `rating`
e esquece de recalcular o score. A mitigacao e a funcao unica: nenhum caminho de escrita
monta esses campos na mao, e o seed usa exatamente o mesmo codigo do runtime.

A alternativa mais robusta seria uma coluna `GENERATED` do Postgres, que tornaria a deriva
impossivel. Foi descartada porque o Prisma nao modela colunas geradas: toda migration
seguinte acusaria drift entre schema e banco.

---

## ADR-036 — Encoding e collation nao podem ser herdados do ambiente

**Contexto.** Descoberto empiricamente durante a Sprint 4, com um Postgres de teste criado
sem parametros explicitos. Dois defeitos apareceram juntos:

1. O cluster nasceu em **WIN1252**, porque o `initdb` herda o locale do sistema. Gravar um
   caractere UTF-8 sem equivalente falhou com
   `has no equivalent in encoding "WIN1252"` — um erro 500 em tempo de escrita.
2. A **collation** era `Portuguese_Brazil.1252`. A ordenacao por nome coincidia com
   `localeCompare('pt-BR')` do frontend **por acidente do sistema operacional**. Em um
   container Linux com collation `C` ou `en_US.utf8`, a mesma consulta devolveria outra
   ordem.

**Decisao.**

- `POSTGRES_INITDB_ARGS: '--encoding=UTF8'` explicito no `docker-compose.yml`.
- Ordenacao por nome usa a coluna normalizada `name_sort`, nao `name`.

**Consequencia.** O segundo item e o mais importante para este projeto: era uma fonte de
teste intermitente que **passaria em desenvolvimento e falharia no CI**, com a causa
escondida em uma configuracao de infraestrutura que ninguem pensa em conferir. Normalizando
na escrita, a ordem depende so dos dados — e, de quebra, passa a casar com `localeCompare`
tambem para nomes acentuados, porque "Ábaco" vira "abaco" e vem antes de "Earbuds".

Generalizando: **nao herde do ambiente aquilo que o teste assevera.**

---

## ADR-037 — Carrinho no servidor: regras de estoque e totais

**Contexto.** O carrinho migrou do `localStorage` (ADR-011/012) para o servidor. As regras
ja existiam no redutor do frontend e precisavam ser reproduzidas — ou conscientemente
divergidas.

**Decisao.**

| Regra | Frontend (redutor) | API | Motivo da escolha |
| --- | --- | --- | --- |
| Produto repetido | Soma a quantidade | **Igual** | Contrato de negocio |
| Limite de estoque | Aplicado sobre a soma | **Igual** | Contrato de negocio |
| Excesso de estoque | `clamp` silencioso | **409** | Ver abaixo |
| Quantidade 0 no update | Remove o item | **422** | Existe `DELETE` para isso |
| Frete | R$ 29,90 / gratis acima de R$ 500 | **Igual** | Contrato asseverado pela suite |
| Totais | Calculados | **Igual** | Total guardado diverge dos itens |

**Consequencia.** As duas divergencias sao deliberadas e seguem o mesmo principio: **a UI
protege o usuario; a API informa o cliente.**

O `clamp` esta certo no frontend, onde o seletor de quantidade ja limita o que da para
pedir. Uma API que recebe "quero 5" e grava 3 sem avisar devolve um estado diferente do
solicitado, e o proximo passo do fluxo age sobre uma premissa falsa. O 409 diz o que ha
disponivel e quanto ja esta no carrinho, para o cliente decidir.

Aceitar quantidade 0 no `PATCH` criaria dois caminhos para remover e um verbo mentiroso —
um update que apaga o recurso que deveria atualizar.

**Item indisponivel.** Um carrinho fica parado por dias e o catalogo nao para: o produto
pode sair de linha ou o estoque cair abaixo do reservado. O item continua visivel com
`unavailable: true` e motivo, mas **fora dos totais** — somar o que nao da para comprar
produziria um valor que o checkout nunca cobraria, e o usuario veria numeros diferentes em
duas telas sem entender por que.

**Limite conhecido.** Duas requisicoes simultaneas de "adicionar" leem a mesma quantidade
inicial e a ultima escrita vence, podendo gravar acima do estoque. O carrinho e um
rascunho, entao o custo e baixo; a garantia real fica no fechamento do pedido (Sprint 6),
onde a baixa de estoque acontece em transacao com guarda condicional.

---

## ADR-038 — O fechamento do pedido e uma transacao com guarda no banco

**Contexto.** Fechar um pedido toca tres agregados: baixa estoque de N produtos, cria o
pedido com seus itens e esvazia o carrinho. Duas pessoas podem disputar a ultima unidade
no mesmo instante.

**Decisao.** Tudo em uma transacao interativa, e a baixa de estoque com **guarda
condicional no proprio UPDATE**:

```sql
UPDATE products SET stock = stock - 2 WHERE id = 'prd-004' AND stock >= 2
```

Se a atualizacao afeta zero linhas, nao havia saldo — e a transacao inteira e desfeita.

**Consequencia.** O Postgres adquire o lock da linha e **reavalia** a condicao depois de
esperar, mesmo em READ COMMITTED (o nivel padrao). Duas transacoes disputando a ultima
unidade sao serializadas pelo lock: a segunda encontra `stock = 0`, nao satisfaz o `where`
e afeta zero linhas.

A alternativa ingenua — ler o estoque, comparar em JavaScript, depois gravar — deixa uma
janela entre a leitura e a escrita. E o bug classico de e-commerce: o teste manual nunca
pega, porque exige duas requisicoes no mesmo milissegundo.

**Verificado empiricamente:** dois pedidos disparados em paralelo para um produto com
estoque 1 responderam 201 e 409, e o estoque terminou em 0 — nunca -1.

Tres decisoes menores decorrem da mesma ideia:

- **O corpo do pedido nao contem itens.** Eles vem do carrinho no servidor, e o preco e
  lido do banco dentro da transacao. Se o cliente enviasse a lista, enviaria tambem o
  preco — e um pedido de R$ 0,01 seria aceito.
- **Transicao de status tambem e condicional** (`updateMany` com o status atual no
  `where`). Dois cancelamentos simultaneos passariam juntos pela verificacao em memoria;
  so um altera a linha, e sem isso o estoque seria devolvido duas vezes.
- **Retry envolve a transacao inteira**, nao so a geracao do numero: quando a chave
  primaria colide, a transacao ja esta abortada e o Postgres recusa qualquer comando
  seguinte nela.

---

## ADR-039 — Camadas versus transacoes: o TransactionService

**Contexto.** A regra "consultas so existem em repositorios" entrou em conflito com a
necessidade de uma transacao que atravessa tres repositorios. Abrir a transacao no service
exigiria chamar `prisma.$transaction` — furando a regra. Colocar tudo em um metodo do
repositorio de pedidos moveria regra de negocio (validacao de estoque, calculo de totais)
para a camada de acesso a dados.

**Decisao.** Um `TransactionService` que expoe apenas `run(fn)`. Os repositorios recebem um
`TransactionClient` opcional e usam `tx ?? this.prisma`.

**Consequencia.** O service depende de uma **abstracao de transacao**, nao do Prisma: ele
orquestra, e os repositorios continuam donos das consultas. O custo e um parametro opcional
a mais em alguns metodos de repositorio — barato perto de qualquer das duas alternativas.

---

## ADR-040 — `PAID` precisa ser alcancavel

**Contexto.** O enum `OrderStatus` tem `PENDING`, `PAID` e `CANCELED`, mas nao ha gateway
de pagamento no projeto. Nenhuma operacao produzia `PAID`.

**Decisao.** `POST /orders/:id/pay`, explicitamente documentado como **simulacao**.

**Consequencia.** Contradizia o principio registrado no proprio schema na Sprint 2 —
"enum com estado inalcancavel e documentacao mentindo sobre o sistema". Com a transicao, o
ciclo fica completo e, mais util para o projeto de automacao, "cancelar pedido pago" passa
a ser um cenario de conflito **reproduzivel** em vez de hipotese.

Pedido pago nao pode ser cancelado: estorno envolve o meio de pagamento, que nao existe
aqui. Recusar e mais honesto que fingir que o dinheiro voltou.

---

## ADR-041 — Apoio a testes por modulo condicional, nao por guard

**Contexto.** A suite de automacao precisa devolver o banco a um estado conhecido entre
cenarios. Um endpoint que faz isso apaga todos os dados — e nunca pode existir em producao.

**Decisao.** `TestSupportModule.register()` devolve um modulo **vazio** quando
`NODE_ENV=production`. Sem controller, sem provider, sem rota — e sem entrada na
especificacao OpenAPI.

**Consequencia.** A alternativa natural seria um guard que verifica o ambiente. As duas
parecem equivalentes e nao sao: um guard depende de alguem ter escrito a verificacao certa,
de ela cobrir todos os metodos e de ninguem remove-la em um refactor. Um modulo ausente nao
tem como ser chamado.

Para uma rota cujo pior caso e "apagou o banco de producao", a diferenca entre *protegida
por uma condicao* e *inexistente* e o tamanho do estrago possivel.

E a mesma logica do ADR-032 (fechado por padrao) aplicada ao extremo: quando o custo do
erro e alto, prefira a garantia estrutural a verificacao em runtime.

---

## ADR-042 — Seed compartilhado entre o script e o endpoint de reset

**Contexto.** Com a chegada de `POST /test/reset`, a logica de semear passou a ter dois
consumidores: o script `npm run db:seed` e o endpoint.

**Decisao.** `src/database/seed.runner.ts` recebe o cliente Prisma por parametro. O script
passa um `PrismaClient` novo; o servico passa o `PrismaService` da aplicacao.

**Consequencia.** Duas copias do seed divergiriam na primeira alteracao de massa, e o
sintoma seria dos piores de diagnosticar: testes que passam local e falham no CI, ou o
contrario, porque cada ambiente semeou de um jeito.

O mesmo raciocinio levou o seed a usar `deriveProductFields` — a funcao que a rota de
criacao de produto ja usava — em vez de recalcular indice de busca e relevancia por conta
propria. Uma formula duplicada produziria busca funcionando para produto cadastrado pela
API e falhando para produto do seed.

`resetDatabase` usa `TRUNCATE` e nao `DELETE`: nao percorre linha a linha e libera espaco
imediatamente. E o `upsert` do seed sozinho nao bastaria — ele restaura a massa de
contrato, mas nao remove o que os testes criaram. Um cenario que conta "3 pedidos"
falharia na segunda execucao da suite.

---

## ADR-043 — Fabricas para as excecoes de dominio

**Contexto.** Trinta e duas chamadas espalhadas repetiam a mesma forma de cinco linhas,
com `code` e `errors` escritos a mao em cada uma.

**Decisao.** `common/exceptions/domain.exceptions.ts` com `notFound()`, `conflict()`,
`insufficientStock()`, `forbidden()`, `accountDisabled()`, `invalidCredentials()` e
`unauthenticated()`.

**Consequencia.** O ganho nao e a economia de linhas — e a garantia. Esquecer o `code`
fazia a excecao cair no codigo padrao do filtro global: a resposta continuava valida, so
que generica, e um cliente que decide comportamento por `code` (como o frontend faz)
trataria o caso errado. Um defeito que nao quebra nada visivelmente e por isso sobrevive a
revisao de codigo.

`accountDisabled()` e `invalidCredentials()` nao recebem mensagem de proposito: sao os dois
casos em que o TEXTO faz parte da regra de seguranca — variar a mensagem entre chamadas
reabriria a enumeracao de contas que o ADR-025 fechou.

---

## ADR-044 — A especificacao precisa descrever o envelope, nao so o dado

**Contexto.** Cada rota era anotada com `@ApiResponse({ status: 200, type: OrderEntity })`.
O que sai pela rede, porem, e `{ success, message, data: OrderEntity }` — o
`ResponseInterceptor` envolve toda resposta, e o Swagger nao tem como saber disso.

**Decisao.** Decorators proprios que compoem envelope e dado via `allOf`:
`@ApiSuccessResponse(Model)`, `@ApiListResponse(Model)`, `@ApiPaginatedResponse(Model)`,
`@ApiNoDataResponse(desc)` e `@ApiErrorResponse(status, desc, code)`.

**Consequencia.** A spec estava **errada**, e esse e o pior estado possivel para uma
documentacao: nao estava ausente — estava presente e plausivel. Quem gerasse um cliente
tipado a partir de `/api/docs-json` receberia a forma sem o envelope, e o teste de contrato
prometido no ADR-031 validaria contra um schema que nao corresponde a realidade.

Duas licoes que valem alem deste caso:

1. **Preocupacao transversal aplicada em runtime nao aparece na documentacao gerada.**
   Interceptor, filtro e pipe sao invisiveis para o gerador de spec. Toda vez que um deles
   muda a forma da resposta, a documentacao precisa ser ensinada sobre isso.

2. **Anotacao vinda de biblioteca descreve a biblioteca, nao a sua aplicacao.** As tres
   respostas de health tinham schema do Terminus (`{ status, info, error, details }`) — o
   formato cru dele, antes do nosso envelope. Como a anotacao vinha pronta do
   `@HealthCheck()`, ninguem tinha motivo para desconfiar.

Verificado empiricamente: das 64 respostas da spec, 64 declaram envelope. O CI ja baixa
`/api/docs-json` como artefato, o que permite comparar a spec de um PR com a da main e ver
qualquer mudanca de contrato.

**Limite conhecido.** Os DTOs de envelope sao declarativos — descrevem o interceptor, nao
sao usados por ele. Se alguem mudar o interceptor sem mexer neles, a spec volta a mentir.
A mitigacao seria um teste de contrato que compara resposta real contra a spec; fica
registrado como candidato natural para o projeto de QA Automation.

---

## ADR-045 — A camada de servicos era a fronteira certa

**Contexto.** O frontend consumia dados mockados. O ADR-002 previa a troca: "componentes e
paginas nunca importam mocks diretamente — eles chamam servicos que retornam `Promise`.
Trocar o mock por `fetch` contra uma API real no futuro nao exige tocar em nenhum
componente."

**Decisao.** Reescrever `services/http.ts` como cliente HTTP real e adaptar os quatro
servicos. Nenhum componente, hook ou pagina de catalogo foi alterado.

**Consequencia.** A previsao se confirmou onde havia fronteira e falhou onde nao havia:

| Camada | Mudou? | Por que |
| --- | --- | --- |
| Componentes de produto | Nao | Consomem `useProducts`, que consome `productService` |
| `useProducts` / `useProduct` | Nao | A assinatura do servico foi preservada |
| `productService` | Sim | Interior trocado, contrato mantido |
| `AuthProvider` | Pouco | So a forma da sessao (dois tokens no lugar de um) |
| `CartProvider` | **Muito** | O carrinho deixou de ser local — nao havia servico entre ele e o `localStorage` |

A licao esta na ultima linha. O catalogo tinha um servico entre a UI e os dados; o carrinho
falava direto com o `localStorage` atraves do provider. Onde existia a indirecao, a troca
custou um arquivo. Onde nao existia, custou uma reescrita.

**Uma decisao de contrato tomada aqui.** `getProducts` continua devolvendo `Product[]`,
descartando a paginacao — a UI nao tem paginacao e forcar `{ data, pagination }` nos
componentes seria vazar uma preocupacao do transporte para a tela sem nenhum ganho. O
`requestList` expoe o `total` para quando a UI existir.

---

## ADR-046 — Carrinho remoto com cache otimista

**Contexto.** O carrinho migrou para o servidor. A opcao ingenua seria chamar a API e
esperar a resposta antes de atualizar a tela — cada clique em "adicionar" congelaria a
interface por uma ida e volta de rede.

**Decisao.** Manter o redutor puro (`cartReducer`) como cache otimista:

```
1. aplica a acao localmente pelo redutor  → a UI responde na hora
2. envia para a API                       → o servidor decide de verdade
3. substitui o estado pela resposta       → converge para a fonte da verdade
4. em caso de erro, ressincroniza         → o otimismo e desfeito
```

**Consequencia.** Preserva a instantaneidade da versao local E a autoridade do servidor
sobre estoque e preco. Preserva tambem os 28 testes unitarios do redutor, que continuam
descrevendo o comportamento local — o que mudou nao foi a regra, foi quem tem a palavra
final.

O `error` no contexto do carrinho e novo e existe por causa disso: a API pode recusar o que
a UI ja aplicou (o estoque acabou entre o clique e a requisicao). Sem ele, a mudanca seria
revertida na tela sem explicacao nenhuma.

**Os totais tem duas fontes, e o servidor vence.** O calculo local cobre a janela otimista;
a resposta da API o substitui. As regras sao identicas, mas o servidor sabe algo que o
cliente nao sabe: itens indisponiveis ficam fora do total.

---

## ADR-047 — Testar o sistema real custa o isolamento gratuito

**Contexto.** Na primeira execucao da suite E2E contra a API real, **19 dos 79 cenarios
falharam**. Nenhum por defeito de integracao.

**Decisao.** Uma fixture automatica (`auto: true`) que chama `POST /test/reset` antes de
cada teste, e `fullyParallel: false` com um unico worker.

**Consequencia.** A causa das 19 falhas foi uma so: enquanto o carrinho vivia no
`localStorage`, cada teste ganhava um contexto de navegador novo e, com ele, um carrinho
vazio **de graca** — o isolamento era efeito colateral da arquitetura, nao uma decisao.

Com carrinho e pedidos no servidor, o estado virou compartilhado. Dois testes do mesmo
usuario disputavam o mesmo carrinho, e um teste que comprava dois notebooks baixava o
estoque para todos os seguintes (verificado: `prd-004` terminou a suite com estoque 0, em
vez dos 3 do seed).

`auto: true` e proposital: um teste que esquecesse de pedir o reset falharia de forma
intermitente conforme a ordem de execucao — o pior tipo de falha, porque parece flakiness e
consome horas de investigacao.

O paralelismo foi o preco. O caminho para recupera-lo, quando o tempo da suite justificar,
e dar a cada worker o seu proprio usuario (`POST /auth/register`) e reservar massa de
estoque por worker. Hoje a suite roda em ~1,3 min com um worker; a complexidade nao se paga.

**Vale registrar o que isso significa.** Os 79 cenarios deixaram de testar uma UI com dados
de mentira e passaram a exercitar navegador → React → HTTP → NestJS → Prisma → PostgreSQL.
O mesmo numero de testes, cobrindo incomparavelmente mais.

---

## ADR-048 — Quem aplica migrations e seed em containers

**Contexto.** Descoberto ao rodar `docker compose up` pela primeira vez, depois de o
ambiente Docker ficar disponivel: a pilha subia, a API respondia, o healthcheck ficava
verde — e o catalogo vinha **vazio**. Pior, `npm run db:seed` dentro do container falhava
com `spawn tsx ENOENT`.

**Decisao.** Um estagio `migrator` no Dockerfile e um servico `migrate` de vida curta no
compose, com a API dependendo dele por `service_completed_successfully`.

**Consequencia.** O diagnostico e mais interessante que a correcao. O Dockerfile estava
CERTO ao podar as devDependencies — `tsx` e ferramenta de desenvolvimento e nao pertence a
uma imagem de producao. O erro foi de omissao: decidi com cuidado o que a imagem de
producao NAO deveria carregar, e nao decidi quem faria o trabalho que sobrou.

O estagio `migrator` reaproveita o `node_modules` completo do estagio `deps` (antes do
prune) e acrescenta o `src`, de onde o seed importa a massa de contrato. A imagem de
producao segue com apenas `dist`, `node_modules` podado, `prisma` e `package.json`.

`service_completed_successfully` transforma "sobe junto e torce" em ordem garantida:

```
db Started → Healthy → migrate Started → Exited(0) → api Started
```

Se o migrate falhar, a API nao inicia. Uma API no ar respondendo 500 em toda consulta e
pior que uma API que nao subiu: a primeira parece funcionar para o orquestrador.

**Comportamento colateral, verificado e aceito.** O `migrate` roda a cada `up`, e o seed e
um `upsert` que restaura os campos do produto — inclusive `stock`. Medido: comprei 2
unidades de `prd-008`, dei `down` e `up`, e o estoque voltou de 53 para 55 enquanto o
pedido permaneceu no historico.

E deliberado para desenvolvimento e teste, onde um catalogo deterministico vale mais que a
continuidade do estoque — e e o que permite a suite de automacao contar com precos e
quantidades fixos. Em producao o passo seria apenas `migrate deploy`.
