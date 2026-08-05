# TechStore — Aplicação Web + Framework de QA Automation

Projeto de portfólio que reúne, no mesmo repositório, **uma aplicação real** e **a suíte de
testes automatizados que a valida** — demonstrando as duas metades do trabalho de um QA
Automation Engineer: entender/construir software e garantir sua qualidade.

> 🚧 **Em construção.** Estrutura inicial concluída. Funcionalidades sendo desenvolvidas
> incrementalmente — veja [Roadmap](#roadmap).

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

O workflow em `.github/workflows/` instala as dependências dos dois projetos, faz o build da
aplicação, executa a suíte e publica o HTML Report e os traces como artifacts.

_(Será configurado na etapa de automação.)_

---

## Roadmap

- [x] **Etapa 1** — Arquitetura definida
- [x] **Etapa 2** — Estrutura inicial, configurações e tooling
- [ ] **Etapa 3** — Aplicação, funcionalidade por funcionalidade
  - [x] Autenticação (login, logout, validação, mensagens de erro, rota protegida)
  - [x] Dashboard
  - [x] Produtos (listagem, pesquisa, filtros, ordenação)
  - [x] Página do produto
  - [x] Carrinho
  - [ ] Checkout
  - [ ] Página de sucesso
- [ ] **Etapa 4** — Framework de automação e cenários
- [ ] **Etapa 5** — Pipeline de CI

---

## Organização do trabalho

O projeto é desenvolvido em etapas sequenciais com revisão entre elas, simulando o fluxo de
um time real: arquitetura → estrutura → aplicação (feature a feature) → automação → CI.
Cada etapa é revisada antes da seguinte começar.
