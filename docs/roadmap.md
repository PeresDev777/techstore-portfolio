# Roadmap — TechStore

O ecossistema tem três projetos no mesmo repositório, comunicando-se apenas por HTTP:

```
frontend/   React + TypeScript          aplicação sob teste
api/        NestJS + Prisma + Postgres  fonte da verdade
automation/ Playwright + TypeScript     suíte E2E (e, em breve, de API)
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

## Depois — TechStore QA Automation

Terceiro projeto do portfólio: suíte de **testes de API** em Playwright, somada à suíte E2E
existente.

O que a API já oferece para isso:

| Recurso | Uso no teste |
| --- | --- |
| `POST /api/v1/test/reset` | Estado conhecido entre cenários |
| `/api/docs-json` | Teste de contrato contra a especificação |
| `code` em todo erro | Asserção imune a mudança de copy |
| `errors[].field` | Asseverar qual campo falhou |
| `x-request-id` | Correlacionar teste vermelho com o log |
| `/api/health/ready` | `webServer` espera prontidão real |
| Massa fixa | `usr-001`, `prd-001`, preços exatos |

Cenários que a API foi construída para tornar testáveis: detecção de reuso de refresh
token, limite de estoque sobre a soma no carrinho, concorrência no fechamento de pedido
(dois pedidos simultâneos para a última unidade), imutabilidade do snapshot após reajuste
de preço, e isolamento entre contas em carrinho e pedidos.

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
