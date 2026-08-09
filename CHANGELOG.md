# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/);
versionamento segundo [Semantic Versioning](https://semver.org/lang/pt-BR/).

Para uma API, `MAJOR.MINOR.PATCH` tem um significado concreto e verificável:

- **MAJOR** — quebra de contrato. Rota removida, campo de resposta removido ou renomeado,
  validação mais restritiva, status HTTP diferente para o mesmo caso.
- **MINOR** — capacidade nova, compatível com quem já consome. Rota nova, campo novo na
  resposta, parâmetro opcional novo.
- **PATCH** — correção sem mudança de contrato.

A regra prática: **se um cliente escrito ontem parar de funcionar, é MAJOR.** Adicionar um
campo à resposta não quebra ninguém; remover um sim.

---

## [Não publicado]

### Adicionado — framework de QA Automation

- `automation/` deixou de ser uma suíte E2E e virou um framework com **três níveis**:
  navegador (93), HTTP (56) e contrato contra a especificação (21). Critério aplicado a
  cada teste novo: *o que ele pega que os outros níveis não pegam?*
- **Camada de services** sobre um `ApiClient` que gera e propaga o `x-request-id`, e
  registra cada chamada para virar evidência na falha — screenshot e vídeo não existem sem
  navegador.
- **Teste de contrato** com schema derivado de `/api/docs-json` em runtime, mais uma
  baseline versionada que transforma mudança de contrato em diff revisável. Fecha o limite
  que o ADR-044 registrou por escrito.
- **Acessibilidade** (WCAG 2.1 AA) em 11 estados de tela, com alvo zero violações.
- **Pipeline por gatilho**: PR roda 44 cenários, `main` roda 170, a noturna roda 171 —
  cada recorte é um npm script que roda igual na máquina de quem desenvolve.

### Corrigido

- **O logout não encerrava a sessão local antes da chamada remota**, apesar de o ADR-012
  afirmar que sim. `setUser(null)` mudava só o estado do React; o `clearSession()` real
  rodava num `finally` depois do `await`. Na janela entre o clique em "sair" e a resposta
  do servidor, o `localStorage` guardava uma sessão válida — e qualquer navegação (F5,
  link, reabrir a aba) a restaurava com o access token ainda bom por até 15 minutos.
  Encontrado por um cenário E2E que falhava de forma intermitente. Agora
  `authService.logout(refreshToken)` recebe o token pronto e não toca no armazenamento.
- **Contraste insuficiente** em `ink-400` (3,64:1) e `success-600` (4,28:1), abaixo dos
  4,5:1 de WCAG AA. Corrigido com valores calculados a partir do OKLCH contra o fundo mais
  escuro em que o texto aparece — contraste depende do par, não da cor sozinha.
- **Três corridas na suíte**, todas da mesma família: esperar por um efeito em vez da
  causa. `click()` não espera a rede e o `goto()` seguinte abortava o `POST`; a grade era
  lida com o container montado e ainda vazio; o filtro sincronizava contra o estado
  anterior. O ADR-018 ganhou o enunciado que faltava: **espere por algo que só passa a
  existir por causa da ação.**

### Desempenho

- **`POST /test/reset`: 1260 ms → 410 ms.** O seed executava `bcrypt.hash` para os 4
  usuários a cada reinício e **descartava** o hash no caminho do `update`. Memoizado por
  processo. A suíte completa caiu de 276 s para 143 s.


### Adicionado — integração frontend ↔ API

- O frontend consome a API real. `services/http.ts` deixou de simular rede e virou cliente
  `fetch` com desembrulho de envelope, tradução de códigos de erro e **renovação
  automática de token** (com renovação em voo compartilhada, para não disparar o detector
  de reuso da própria API).
- Carrinho no servidor com **cache otimista**: o redutor puro segue respondendo na hora, a
  API decide de verdade, e o estado converge para a resposta.
- Suíte E2E passou a rodar contra a pilha completa no CI: Postgres + API + frontend.
  Fixture automática chama `POST /test/reset` antes de cada teste.

### Corrigido

- **O logout não encerrava a sessão local antes da chamada remota**, apesar de o ADR-012
  afirmar que sim. `setUser(null)` mudava só o estado do React; o `clearSession()` real
  rodava num `finally` depois do `await`. Na janela entre o clique em "sair" e a resposta
  do servidor, o `localStorage` guardava uma sessão válida — e qualquer navegação (F5,
  link, reabrir a aba) a restaurava com o access token ainda bom por até 15 minutos.
  Encontrado por um cenário E2E que falhava de forma intermitente. Agora
  `authService.logout(refreshToken)` recebe o token pronto e não toca no armazenamento.
- **A especificação OpenAPI descrevia o formato errado das respostas.** As anotações
  declaravam o tipo do dado (`type: OrderEntity`), mas o `ResponseInterceptor` envolve tudo
  em `{ success, message, data }`. Quem gerasse um cliente a partir de `/api/docs-json`
  receberia a forma sem o envelope. Corrigido com decorators próprios
  (`@ApiSuccessResponse`, `@ApiPaginatedResponse`, `@ApiErrorResponse`) aplicados às 64
  respostas — incluindo as de health, cujo schema vinha do Terminus e também estava errado.
- Erros passam a documentar `code` e `errors[]` no schema, não apenas uma descrição em
  texto.

### Adicionado

- Documentação técnica: [`docs/authentication-flow.md`](docs/authentication-flow.md),
  [`docs/conventions.md`](docs/conventions.md) e [`docs/roadmap.md`](docs/roadmap.md).
- `POST /api/v1/test/reset` — apaga todos os dados e reaplica o seed. Disponível apenas
  fora de produção; o módulo não é registrado quando `NODE_ENV=production`.

### Alterado

- Seed extraído para `src/database/seed.runner.ts`, compartilhado entre o script de linha
  de comando e o endpoint de reset.
- Exceções de domínio centralizadas em `common/exceptions/domain.exceptions.ts` — 32
  chamadas convertidas. `code` e `errors` passam a ser garantidos por construção.
- `PATCH /api/v1/products/:id` aceita `isActive`, permitindo recolocar em catálogo um
  produto retirado. Antes, `DELETE` era irreversível pela API.

---

## [0.1.0] — 2026-08-06

Primeira versão funcional da API. Não publicada: a numeração começa em `0.x` justamente
porque o contrato ainda pode mudar sem aviso — é o que `0.` comunica em SemVer.

### Adicionado

**Plataforma**

- NestJS 11 + TypeScript, arquitetura modular com controller / service / repository.
- PostgreSQL 16 com Prisma; migrations versionadas e seed determinístico.
- Envelope único em toda resposta: `{ success, message, data }` e, em listas, `pagination`.
- Tratamento global de erros com `code` estável; 5xx nunca vaza detalhe interno.
- Validação por DTO com `whitelist` (bloqueia mass assignment) e status 422.
- Log estruturado (Pino) com correlação por `x-request-id`.
- Helmet, CORS por lista, rate limiting configurável.
- Swagger em `/api/docs` e OpenAPI JSON em `/api/docs-json`.
- Liveness e readiness separados, fora do versionamento.
- Docker multi-estágio e Docker Compose com Postgres.

**Autenticação**

- Cadastro, login, renovação e logout com revogação real de sessão.
- Access token JWT de 15 min + refresh token opaco de 7 dias, guardado como hash SHA-256,
  rotacionado a cada uso, com detecção de reuso que revoga a família inteira.
- `JwtAuthGuard` global (fechado por padrão) e `RolesGuard` por papel.
- Mesma mensagem para e-mail inexistente e senha errada, com tempo de resposta equalizado.

**Domínio**

- Usuários: perfil, atualização, troca de senha e exclusão lógica com revogação de sessões.
- Categorias e produtos: CRUD administrativo, busca sem acento, filtros, cinco ordenações
  e paginação.
- Carrinho no servidor: soma de item repetido, limite de estoque sobre a soma, frete
  grátis acima de R$ 500,00, itens indisponíveis sinalizados fora dos totais.
- Pedidos: fechamento transacional com baixa de estoque sob guarda condicional, snapshot
  de comprador, endereço e preços, histórico paginado, cancelamento com devolução de
  estoque e confirmação de pagamento simulada.
