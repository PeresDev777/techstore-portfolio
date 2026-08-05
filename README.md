# TechStore — Aplicação Web + Framework de QA Automation

[![CI](https://github.com/PeresDev777/techstore-portfolio/actions/workflows/ci.yml/badge.svg)](https://github.com/PeresDev777/techstore-portfolio/actions/workflows/ci.yml)

Projeto de portfólio que reúne, no mesmo repositório, **uma aplicação real** e **a suíte de
testes automatizados que a valida** — demonstrando as duas metades do trabalho de um QA
Automation Engineer: entender/construir software e garantir sua qualidade.

**28 testes unitários** (~180 ms, sem navegador) · **79 cenários E2E** em Playwright ·
**19 decisões arquiteturais documentadas** · CI em dois jobs paralelos.

---

## Objetivo

- Construir uma loja virtual (TechStore) com React + TypeScript, com arquitetura limpa e
  componentização adequada.
- Construir uma suíte E2E profissional com Playwright + TypeScript, aplicando Page Object
  Model, fixtures, dados de teste isolados e evidências de execução.
- Documentar **por que** cada decisão foi tomada, não só o que foi feito.

---

## Arquitetura

```
techstore-portfolio/
├── frontend/              # Aplicação sob teste (SUT)
│   └── src/
│       ├── components/    # Componentes reutilizáveis (ui/ e layout/)
│       ├── pages/         # Telas ligadas às rotas
│       ├── contexts/      # Estado global por domínio (Auth, Cart)
│       ├── hooks/         # Hooks customizados
│       ├── services/      # Camada de acesso a dados (mock assíncrono)
│       ├── data/          # Massa de dados da aplicação
│       ├── types/         # Contratos de domínio
│       ├── utils/         # Formatadores e validadores
│       └── routes/        # Definição de rotas e rota protegida
│
├── automation/            # Framework de testes E2E
│   ├── tests/             # Specs organizados por feature
│   ├── pages/             # Page Objects (POM)
│   ├── fixtures/          # Fixtures customizadas do Playwright
│   ├── utils/             # Helpers de teste
│   └── data/              # Massa de teste
│
├── docs/                  # Decisões arquiteturais (ADRs)
└── .github/workflows/     # Pipeline de CI
```

As decisões de arquitetura estão documentadas em **[docs/architecture.md](docs/architecture.md)**.

---

## Tecnologias

**Frontend** — React 19 · TypeScript · Vite · React Router · Context API · Tailwind CSS ·
ESLint · Prettier

**Automation** — Playwright · TypeScript · Page Object Model · ESLint · Prettier

**CI** — GitHub Actions

---

## Como instalar

Requisitos: **Node.js 20+** e **npm**.

```bash
# Aplicação
cd frontend
npm install

# Suíte de testes (em outro terminal)
cd automation
npm install
npm run install:browsers   # baixa o Chromium usado pelo Playwright
```

## Como executar

**Aplicação em modo desenvolvimento** — http://localhost:5173

```bash
cd frontend
npm run dev
```

**Testes unitários** — regras de negócio puras, no runner nativo do Node (sem dependências
extras, sem navegador):

```bash
cd frontend
npm run test:unit
```

**Testes automatizados (E2E)** — o Playwright sobe o build de produção da aplicação
automaticamente (`vite preview` em http://localhost:4173); não é preciso iniciar nada antes.

```bash
cd automation
npm test              # suíte completa (headless)
npm run test:headed   # com navegador visível
npm run test:ui       # modo UI interativo do Playwright
npm run test:e2e      # apenas o fluxo end-to-end
```

### Como a suíte está organizada

```
automation/
├── pages/          Page Objects — expõem AÇÕES de negócio, nunca seletores
│   ├── BasePage.ts         abertura, espera de prontidão, localização por data-testid
│   └── components/         componentes reutilizados (ex.: HeaderComponent)
├── fixtures/       injeção dos page objects + autenticação via storageState
├── data/           massa de teste nomeada por CENÁRIO (USERS.disabled, CPF.invalidCheckDigit)
├── utils/          rotas espelhadas e leitura de valores monetários
└── tests/          cenários por feature + um fluxo E2E completo
```

**Autenticação acontece uma única vez.** Um projeto de setup faz login e grava o estado do
navegador; todos os testes partem autenticados. Os cenários de login, rota protegida e
logout importam `fixtures/anonymous.ts` e começam deslogados. Detalhes no
[ADR-016](docs/architecture.md).

### Cobertura de cenários

| Área | Arquivo | Cenários |
| --- | --- | --- |
| Login | `tests/login/login.spec.ts` | válido, e-mail inexistente, senha errada, conta desativada, campos obrigatórios, logout, sessão persistida |
| Rotas protegidas | `tests/login/protected-routes.spec.ts` | acesso sem sessão, retorno ao destino após login, logout sem vazamento entre contas |
| Listagem | `tests/products/product-listing.spec.ts` | catálogo, filtros, ordenações, estado na URL, parâmetro inválido |
| Produto | `tests/products/product-detail.spec.ts` | dados, imagem realmente carregada, esgotado, relacionados, limite de estoque |
| Pesquisa | `tests/search/search.spec.ts` | existente, sem acento, termos fora de ordem, sem resultado, limpar |
| Carrinho | `tests/cart/cart.spec.ts` | adicionar, remover, quantidade, totais, frete grátis, persistência, isolamento por usuário |
| Checkout | `tests/checkout/*.spec.ts` | obrigatórios, CPF por dígito verificador, máscaras, pedido, número único |
| E2E | `tests/e2e/purchase-flow.spec.ts` | jornada completa em passos nomeados |

### Credenciais de demonstração

| E-mail                     | Senha       | Cenário                          |
| -------------------------- | ----------- | -------------------------------- |
| `qa@techstore.com`         | `Test@1234` | Login válido                     |
| `ana.souza@techstore.com`  | `Ana@2024`  | Segundo usuário válido           |
| `inativo@techstore.com`    | `Test@1234` | Conta desativada (cenário de erro) |

Estes dados são um **contrato com a suíte de automação** — fixos e documentados para
manter os testes determinísticos. Definidos em `frontend/src/data/users.ts`.

## Como gerar relatórios

```bash
cd automation
npm test              # gera reports/html e reports/junit
npm run report        # abre o HTML Report no navegador
npm run trace <arquivo.zip>   # abre o Trace Viewer de uma execução
```

Evidências geradas por execução:

| Evidência       | Quando é capturada    | Onde fica         |
| --------------- | --------------------- | ----------------- |
| HTML Report     | sempre                | `reports/html/`   |
| JUnit XML       | sempre                | `reports/junit/`  |
| Screenshot      | apenas em falha       | `test-results/`   |
| Vídeo           | apenas em falha       | `test-results/`   |
| Trace Viewer    | no primeiro retry     | `test-results/`   |

## Pipeline

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) roda em push e pull request para `main`,
em **dois jobs paralelos**:

| Job | O que faz | Por quê |
| --- | --- | --- |
| `quality` | lint, formatação, tipos e testes unitários | Retorno em segundos — não faz sentido subir um navegador para descobrir um erro de tipo |
| `e2e` | build da aplicação + suíte Playwright | Valida o comportamento real no navegador |

Detalhes que valem notar:

- **Cache dos browsers** por versão do Playwright — sem ele, cada execução baixaria ~150 MB.
- **`concurrency` com `cancel-in-progress`** — um push novo cancela a execução anterior da
  mesma branch.
- **Artifacts com `if: always()`** — o relatório é mais útil quando a suíte falha; publicá-lo
  só no verde seria publicá-lo exatamente quando ninguém precisa.
- **Evidências de falha (`if: failure()`)** — traces, vídeos e screenshots só existem quando
  algo quebrou.
- O build roda como passo próprio, separado do `webServer`, para que uma falha de build não
  fique escondida dentro do log do servidor.

---

## Roadmap

- [x] **Etapa 1** — Arquitetura definida
- [x] **Etapa 2** — Estrutura inicial, configurações e tooling
- [x] **Etapa 3** — Aplicação, funcionalidade por funcionalidade
  - [x] Autenticação (login, logout, validação, mensagens de erro, rota protegida)
  - [x] Dashboard
  - [x] Produtos (listagem, pesquisa, filtros, ordenação)
  - [x] Página do produto
  - [x] Carrinho
  - [x] Checkout
  - [x] Página de sucesso
- [x] **Etapa 4** — Framework de automação e cenários
- [x] **Etapa 5** — Pipeline de CI

---

## Organização do trabalho

O projeto é desenvolvido em etapas sequenciais com revisão entre elas, simulando o fluxo de
um time real: arquitetura → estrutura → aplicação (feature a feature) → automação → CI.
Cada etapa é revisada antes da seguinte começar.
