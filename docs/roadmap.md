# Roadmap — TechStore

O ecossistema tem três projetos no mesmo repositório, comunicando-se apenas por HTTP:

```
frontend/   React + TypeScript          aplicação sob teste
api/        NestJS + Prisma + Postgres  fonte da verdade
automation/ Playwright + TypeScript     suíte E2E, de API e de contrato
```

---

## Concluído

### Frontend e automação (etapas 1–5)

Loja completa com autenticação, catálogo, busca, carrinho e checkout; 28 testes unitários,
79 cenários E2E em Playwright com Page Object Model, e pipeline de CI em dois jobs.
Decisões em [architecture.md](architecture.md) (ADR-001 a ADR-019).

### API (sprints 0–8)

| Sprint | Entrega |
| --- | --- |
| 0 | Planejamento, arquitetura, modelagem, contrato de resposta |
| 1 | Estrutura NestJS, config validada, envelope, erros, log, Docker |
| 2 | Schema, migrations, seed determinístico, tradução de erros do Prisma |
| 3 | Autenticação com rotação de refresh e detecção de reuso; usuários |
| 4 | Categorias e produtos: busca, filtros, ordenações, paginação, CRUD |
| 5 | Carrinho no servidor com regras de estoque e frete |
| 6 | Pedidos: transação com baixa de estoque, snapshot, cancelamento |
| 7 | Swagger com envelope real, CHANGELOG, documentação técnica |
| 8 | Refino, apoio à automação (`/test/reset`), CI da API |

Decisões em [api-architecture.md](api-architecture.md) (ADR-020 a ADR-048).

---

## Integração do frontend — CONCLUÍDA

O frontend consome a API. Os 79 cenários E2E passaram a validar o sistema inteiro:
navegador → React → HTTP → NestJS → Prisma → PostgreSQL.

Executada em quatro etapas:

| Etapa | Domínio | Resultado |
| --- | --- | --- |
| 1 | Transporte | `http.ts` deixou de simular rede e virou cliente `fetch` com renovação automática de token |
| 2 | Catálogo | `productService` chama `/products`. **Nenhum componente ou hook mudou** |
| 3 | Autenticação | `authService` usa `/auth/*`; sessão validada por `GET /auth/me` |
| 4 | Carrinho e checkout | `CartProvider` virou cache otimista; o pedido nasce do carrinho no servidor |

O redutor do carrinho **não foi descartado**: continua sendo a resposta imediata na tela,
antes de a requisição voltar. Os 28 testes unitários seguem verdes porque a regra local
não mudou — mudou quem tem a palavra final.

**O que a integração custou à suíte E2E.** Na primeira execução contra a API real, 19 dos
79 cenários falharam. Nenhum por bug de integração: o carrinho e os pedidos passaram a
viver no servidor, então o isolamento que o `localStorage` dava de graça (contexto de
navegador novo = carrinho vazio) desapareceu. Testes disputavam o mesmo carrinho, e um
teste que comprava baixava o estoque para todos os seguintes.

Resolvido com uma fixture automática que chama `POST /test/reset` antes de cada teste e
com execução serial. É o preço de testar o sistema de verdade — e a razão de o endpoint
de reset ter sido construído na Sprint 8.

---

## Suíte de QA Automation — CONCLUÍDA

`automation/` deixou de ser uma suíte E2E e virou um framework com **três níveis**.

| Nível | Cenários | Tempo | O que prova |
| --- | --- | --- | --- |
| E2E | 82 | ~2,7 min | O que o usuário vê e faz |
| API | 56 | ~75 s | O que não tem manifestação visual |
| Contrato | 21 | ~30 s | A resposta bate com `/api/docs-json` |

Executada em oito sprints:

| Sprint | Entrega |
| --- | --- |
| 0 | Auditoria do repositório, estratégia, pirâmide, decisões pendentes |
| 1 | Estrutura por tipo de suíte, três projetos do Playwright, tags, massa completa |
| 2 | `ApiClient`, services por recurso, factories, asserção única do envelope |
| 3 | 50 cenários de API para o que o navegador não alcança |
| 4 | Contrato com schema derivado da spec e baseline versionada |
| 5 | Auditoria dos E2E, sessão expirada, refatoração do POM |
| 6–7 | Recorte da suíte por gatilho, com execução noturna |
| 8 | Documentação, ADRs e otimização de fixtures |

Decisões em [automation-architecture.md](automation-architecture.md) (ADR-049 a ADR-054).
A estratégia que as conecta está em [qa-strategy.md](qa-strategy.md).

**O que a auditoria encontrou no caminho.** Dois defeitos reais, nenhum deles de teste:

1. **O logout não encerrava a sessão local antes da chamada remota**, apesar de o ADR-012
   afirmar que sim. Na janela da requisição, o `localStorage` guardava uma sessão válida —
   o usuário clicava em "sair" e continuava dentro.
2. **`click()` não espera a rede.** O `page.goto()` seguinte abortava o `POST /cart/items`
   em voo, e o item nunca chegava ao servidor. Corrigir deixou a suíte **mais rápida**:
   9,4 → 7,1 min, porque os timeouts desapareceram.

Os dois foram reproduzidos no commit verde da véspera antes de qualquer conclusão. Era o
que separava "flakiness" de bug real.

**Limite conhecido, medido e não corrigido.** `POST /test/reset` custa **1260 ms** e é pago
antes de cada um dos 160 cenários — o seed executa `bcrypt.hash` para os 4 usuários a cada
reinício, e 4 × 283 ms explica quase todo o tempo. A correção é do lado da API (memoizar o
hash por senha e rounds); fica registrada no ADR-054.

---

## Não planejado, e por quê

| Item | Por que ficou de fora |
| --- | --- |
| Gateway de pagamento | Fora do escopo de portfólio; `POST /orders/:id/pay` simula a transição |
| Upload de imagem | O catálogo usa SVGs versionados — massa estável vale mais que upload real |
| Recuperação de senha | Exige serviço de e-mail |
| Cookie httpOnly para refresh | Mais seguro contra XSS; trocaria testabilidade por segurança. Migração contida ao controller |
| Cache (Redis) | Sem volume que justifique. Entraria antes como cache do papel do usuário na `JwtStrategy` |
| Busca com `tsvector` | Com 12 produtos, `search_index` normalizado resolve. É o caminho natural em escala |
