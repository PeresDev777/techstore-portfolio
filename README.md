# TechStore — Aplicação Web + Framework de QA Automation

[![CI](https://github.com/PeresDev777/techstore-portfolio/actions/workflows/ci.yml/badge.svg)](https://github.com/PeresDev777/techstore-portfolio/actions/workflows/ci.yml)

Projeto de portfólio que reúne, no mesmo repositório, **uma aplicação full-stack real** e
**o framework de testes que a valida** — demonstrando as duas metades do trabalho de um QA
Automation Engineer: entender/construir software e garantir sua qualidade.

**170 cenários automatizados em três níveis** — navegador, HTTP e contrato — rodando
contra a API real e um Postgres real · **28 testes unitários** (~130 ms, sem navegador) ·
**55 decisões arquiteturais documentadas** · CI em três jobs com recorte por gatilho.

---

## O que este projeto demonstra

A pergunta que organiza a suíte inteira:

> **O que este teste pega que os outros níveis não pegam?**
> Se a resposta for "nada", ele não deve existir.

| Nível | Cenários | Tempo | O que só ele prova |
| --- | --- | --- | --- |
| Unitário | 28 | ~130 ms | Regras puras do carrinho, sem navegador |
| **API** | 56 | ~27 s | Concorrência, rotação de token, autorização, mass assignment |
| **Contrato** | 21 | ~30 s | A resposta bate com a especificação publicada |
| **E2E** | 93 | ~2,7 min | O que o usuário vê e faz, incluindo acessibilidade |

A estratégia completa — o que cada nível alcança, onde cada um falha quando o outro passa,
e o que **não** é testado com o motivo — está em
**[docs/qa-strategy.md](docs/qa-strategy.md)**.

### Quatro defeitos reais encontrados pela suíte

Nenhum deles apareceu como teste vermelho óbvio:

| Defeito | Como apareceu |
| --- | --- |
| **O logout não encerrava a sessão local antes da chamada remota** — o usuário clicava em "sair" e continuava dentro | Um cenário que falhava isolado e passava na suíte. Reproduzido no commit verde da véspera antes de acusar o teste |
| **`click()` não espera a rede** — o `goto()` seguinte abortava o `POST` e o item nunca chegava ao servidor | 19 falhas que pareciam interferência entre suítes |
| **A grade era lida em transição** — a asserção passava por vacuidade em lista vazia | Um "flaky" que o retry escondeu |
| **O filtro sincronizava contra o estado anterior** | O mesmo "flaky", uma camada mais fundo |

Três vieram de levar a sério um sinal que era mais fácil ignorar. É o princípio que a
suíte adota: **não se marca um teste como instável antes de reproduzi-lo no commit
anterior.**

---

## Arquitetura

```
techstore-portfolio/
├── api/                   # Backend REST — NestJS + Prisma + PostgreSQL
│   └── src/
│       ├── modules/       # Um diretório por domínio (auth, products, cart, orders...)
│       ├── common/        # Envelope, erros, guards, decorators
│       ├── config/        # Ambiente validado no boot
│       └── database/      # Seed compartilhado com o endpoint de reset
│
├── frontend/              # Aplicação sob teste (SUT)
│   └── src/
│       ├── components/    # Componentes reutilizáveis (ui/ e layout/)
│       ├── pages/         # Telas ligadas às rotas
│       ├── contexts/      # Estado global por domínio (Auth, Cart)
│       ├── hooks/         # Hooks customizados
│       ├── services/      # Cliente HTTP com renovação automática de token
│       ├── types/         # Contratos de domínio
│       └── routes/        # Definição de rotas e rota protegida
│
├── automation/            # Framework de testes — três suítes
│   ├── tests/
│   │   ├── e2e/           # Navegador, por feature + jornada + acessibilidade
│   │   ├── api/           # HTTP, sem navegador
│   │   └── contract/      # Resposta real × especificação OpenAPI
│   ├── pages/             # Page Objects (POM) + components/
│   ├── services/          # ApiClient + um service por recurso
│   ├── factories/         # Dados únicos (Faker + gerador de CPF válido)
│   ├── schemas/           # Conversor da spec + baseline versionada
│   ├── fixtures/          # Preparação de estado por tipo de suíte
│   ├── data/              # Massa de CONTRATO, espelho do seed
│   └── utils/             # Dinheiro, rotas, ambiente, asserções
│
├── docs/                  # 55 ADRs + estratégia de QA + checklist de PR
└── .github/workflows/     # Pipeline de CI
```

| Documento | Conteúdo |
| --- | --- |
| **[docs/qa-strategy.md](docs/qa-strategy.md)** | **Estratégia de QA, pirâmide e o que não é testado** |
| [docs/pr-checklist.md](docs/pr-checklist.md) | Checklist de PR — todo item veio de um defeito real |
| [docs/architecture.md](docs/architecture.md) | Frontend e E2E original (ADR-001 a ADR-019) |
| [docs/api-architecture.md](docs/api-architecture.md) | API (ADR-020 a ADR-048) |
| [docs/automation-architecture.md](docs/automation-architecture.md) | Suíte de automação (ADR-049 a ADR-055) |
| [docs/database.md](docs/database.md) | Modelo, relações, índices e seed |
| [docs/authentication-flow.md](docs/authentication-flow.md) | Fluxo de sessão com diagramas |
| [docs/conventions.md](docs/conventions.md) | Convenções de código, commits e API |
| [automation/README.md](automation/README.md) | Como rodar, tags, armadilhas, como adicionar um teste |

---

## Tecnologias

**API** — NestJS 11 · TypeScript · Prisma · PostgreSQL 16 · Passport/JWT · bcrypt ·
class-validator · Swagger/OpenAPI · Pino · Docker

**Frontend** — React 19 · TypeScript · Vite · React Router · Context API · Tailwind CSS

**Automation** — Playwright · TypeScript · AJV (contrato) · Faker (dados únicos) ·
axe-core (acessibilidade) · Page Object Model · Service Layer

**CI** — GitHub Actions

---

## Como executar

Requisitos: **Node.js 20+**, **npm** e **Docker** (para o Postgres).

```bash
# 1. Banco, migrations e massa de contrato
cd api
npm install && cp .env.example .env
npm run db:up && npm run prisma:deploy && npm run db:seed

# 2. API (NODE_ENV != production, senão POST /test/reset não existe)
npm run build && node dist/main.js

# 3. Suíte de testes, em outro terminal
cd automation
npm install && cp .env.example .env
npm run install:browsers
npm test
```

**O frontend não tem passo próprio.** O Playwright o constrói e serve sozinho — e
**apenas** quando um projeto de navegador vai rodar, então `npm run test:api` não paga o
build de uma aplicação React que nenhum teste de API abre. O `.env` dele é opcional:
`src/services/http.ts` já cai em `http://localhost:3000/api/v1` por padrão. Copie
`frontend/.env.example` só para apontar a aplicação para outro host.

> **Verificado a partir de um clone limpo:** os comandos acima levam de zero a
> `171 passed` — os 170 cenários mais o projeto de setup, que o Playwright conta junto.
> Com um volume de Postgres novo, `prisma:deploy` aplica as migrations em vez de reportar
> "no pending migrations".

```bash
npm test                  # tudo (170 cenários + setup, ~2,4 min)
npm run test:e2e          # só navegador
npm run test:api          # só HTTP
npm run test:contract     # só contrato
npm run test:smoke        # o sistema está de pé
npm run test:ui           # modo interativo do Playwright
npm run contract:baseline # regrava a baseline do contrato
```

### Credenciais do seed

| E-mail | Senha | Cenário |
| --- | --- | --- |
| `qa@techstore.com` | `Test@1234` | Usuário padrão |
| `ana.souza@techstore.com` | `Ana@2024` | Segundo usuário — isolamento entre contas |
| `inativo@techstore.com` | `Test@1234` | Conta desativada → 403 `ACCOUNT_DISABLED` |
| `admin@techstore.com` | `Admin@1234` | Administrador — rotas sem tela no frontend |

Estes dados são um **contrato**: ids, e-mails e preços fixos, espelhados em
`automation/data/`. Alterar um exige alterar o outro.

---

## Pipeline

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) — três jobs, e o recorte da suíte
escolhido pelo **gatilho**:

| Gatilho | Script | Cenários | Tempo |
| --- | --- | --- | --- |
| `pull_request` | `test:pr` | 44 | ~1m45s |
| `push` na `main` | `test:regression` | 170 | ~2m50s |
| `schedule` 03:00 | `test:nightly` | 171 | ~3m25s |

Cada recorte é um **npm script que qualquer pessoa roda igual na própria máquina** — o
pipeline não tem um comando secreto que só existe no YAML.

**Por que o PR não roda tudo.** Medido: 85 s contra 2,4 min. Mas o ganho maior não é
tempo — é a **autoridade do gate**. Todo teste no caminho do merge multiplica a chance de
vermelho sem relação com a mudança, e um gate que erra é um gate que as pessoas aprendem a
ignorar. O cenário `@slow` de concorrência só roda de madrugada: merece existir e não
merece bloquear um merge.

Os três gatilhos têm execução real verificada, incluindo o `schedule`.

### Evidências

| Suíte | Moeda de evidência |
| --- | --- |
| E2E | Screenshot e vídeo só em falha; trace no primeiro retry |
| API | Requisição, resposta e **`x-request-id`** anexados na falha |
| Contrato | Erros do AJV com o caminho do campo que divergiu |

Screenshot e vídeo não existem sem navegador. O `x-request-id` é ecoado pela API e liga um
teste vermelho no CI à linha exata do log daquela requisição.

**Retry é ZERO nas suítes de API e contrato**, inclusive no CI. No E2E o retry compra
estabilidade contra a rede; num teste de concorrência, um teste que falha e passa na
segunda tentativa é exatamente o defeito que se está caçando.

---

## Roadmap

- [x] **Etapa 1–5** — Arquitetura, aplicação, framework E2E e CI
- [x] **API** — NestJS + Prisma + PostgreSQL, com Swagger e endpoint de apoio a testes
- [x] **Integração** — o frontend passou a consumir a API real
- [x] **Framework de QA** — suítes de API e de contrato, auditoria dos E2E, acessibilidade,
      pipeline por gatilho

Detalhes e o que ficou de fora, com o motivo de cada item, em
[docs/roadmap.md](docs/roadmap.md).

---

## Organização do trabalho

Desenvolvido em sprints sequenciais com revisão entre elas, simulando o fluxo de um time
real. Cada decisão com alternativa razoável descartada virou um ADR — o objetivo é que o
repositório responda **por que**, e não só **o quê**.
