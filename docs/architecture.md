# Arquitetura — TechStore Portfolio

Documento vivo. Cada decisão técnica relevante é registrada aqui com o **contexto**, a
**decisão** e a **consequência** — no espírito de um ADR (Architecture Decision Record)
enxuto, formato usado para dar rastreabilidade às escolhas de um time.

---

## Visão geral

O repositório contém dois projetos independentes:

| Projeto       | Papel                                                          |
| ------------- | -------------------------------------------------------------- |
| `frontend/`   | Aplicação sob teste (SUT) — loja virtual React + TypeScript     |
| `automation/` | Framework de testes E2E — Playwright + TypeScript               |

Eles se comunicam por **um único contrato**: a URL da aplicação (`BASE_URL`) e os
atributos `data-testid` expostos pelo frontend. Nenhum import cruzado entre os projetos.

---

## ADR-001 — Dois projetos independentes em vez de workspaces

**Contexto.** O repositório precisa hospedar app e suíte de testes. Havia a opção de usar
npm workspaces com um `package.json` raiz orquestrando ambos.

**Decisão.** Manter `frontend/` e `automation/` como projetos totalmente autocontidos, cada
um com seu `package.json`, `tsconfig.json` e configuração de lint.

**Consequência.** Quem avalia o portfólio consegue rodar qualquer um dos dois isoladamente
sem entender a raiz. As dependências de teste (Playwright, ~200 MB de browsers) nunca
poluem o build da aplicação. O custo é não ter um comando único na raiz — aceitável nesta
escala.

---

## ADR-002 — Dados mockados atrás de uma camada de serviços

**Contexto.** O projeto não terá backend real, mas precisa parecer uma aplicação real.

**Decisão.** Os dados ficam em `frontend/src/data/` (JSON/TS) e são consumidos
**exclusivamente** por funções assíncronas em `frontend/src/services/`, que simulam
latência e cenários de erro.

**Consequência.** Componentes e páginas nunca importam mocks diretamente — eles chamam
serviços que retornam `Promise`. Trocar o mock por `fetch` contra uma API real no futuro
não exige tocar em nenhum componente. Além disso, a latência simulada torna os estados de
`loading` e `error` reais, o que dá cenários de teste legítimos para a automação.

---

## ADR-003 — `data-testid` como estratégia de localização

**Contexto.** Locators baseados em classe CSS quebram a cada refactor de estilo; locators
baseados em texto quebram a cada mudança de copy ou tradução.

**Decisão.** Todo elemento interativo ou relevante para asserção expõe `data-testid` com
nomenclatura `contexto-elemento` (ex.: `login-submit`, `cart-item-total`). Os testes
priorizam, nesta ordem: (1) roles acessíveis (`getByRole`) quando a semântica for estável e
significativa, (2) `data-testid` para o restante.

**Consequência.** O contrato entre app e teste fica explícito e versionado. Um `data-testid`
removido é uma mudança consciente de contrato, não um acidente de CSS.

---

## ADR-004 — Contextos separados por domínio

**Contexto.** A aplicação tem dois estados globais: sessão do usuário e carrinho.

**Decisão.** `AuthContext` e `CartContext` separados. O carrinho usa `useReducer` (ações
`ADD_ITEM`, `REMOVE_ITEM`, `UPDATE_QUANTITY`, `CLEAR`) em vez de múltiplos `useState`.

**Consequência.** Um componente que só lê a sessão não re-renderiza quando o carrinho muda.
As transições do carrinho ficam centralizadas e testáveis em isolamento. Cada contexto
expõe um hook (`useAuth`, `useCart`) que lança erro se usado fora do provider — falha alta e
cedo em vez de `undefined` silencioso.

---

## ADR-005 — Page Object Model com `BasePage`

**Contexto.** Sem estrutura, specs de E2E viram scripts longos com seletores duplicados.

**Decisão.** Cada página da aplicação tem uma classe em `automation/pages/`, herdando de
`BasePage` (navegação, esperas e helpers comuns). Page objects expõem **ações de negócio**
(`login(user)`, `addToCart(product)`), nunca seletores crus para os specs.

**Consequência.** Uma mudança de UI se resolve em um único arquivo. Os specs ficam legíveis
como especificação de comportamento, o que é o principal argumento do POM.

---

## ADR-006 — Fixtures para preparar estado, não para testar

**Contexto.** Quase todo teste exige um usuário logado. Repetir o fluxo de login em cada
spec é lento e cria falsos negativos (uma quebra no login derruba a suíte inteira).

**Decisão.** Fixtures customizadas em `automation/fixtures/` — notadamente uma
`authenticatedPage` que estabelece a sessão programaticamente. Os testes de login
continuam exercitando o fluxo real pela UI.

**Consequência.** Testes de carrinho e checkout ficam mais rápidos e falham apenas pelo que
de fato testam. O fluxo de login segue coberto, mas em um único lugar.

---

## ADR-007 — Estado dos filtros na URL

**Contexto.** A listagem de produtos tem busca, filtro por categoria, filtro de estoque e
ordenação. O caminho natural seria guardar tudo em `useState`.

**Decisão.** O estado dos filtros vive na **query string**, via `useSearchParams`. Um hook
(`useProductFilters`) encapsula leitura, escrita e **validação** — a URL é entrada não
confiável, então `?ordenar=lixo` cai no padrão em vez de quebrar a tela.

**Consequência.** A busca vira link compartilhável e sobrevive ao refresh; o botão "voltar"
desfaz um filtro; e a automação monta estados complexos navegando direto para a URL, sem
precisar clicar em cada controle. O custo é ter de validar toda entrada — trabalho que o
`useState` não exigiria, mas que é o mesmo cuidado devido a qualquer parâmetro de API.

---

## ADR-008 — Preços em centavos

**Contexto.** Valores monetários em ponto flutuante acumulam erro: `0.1 + 0.2` resulta em
`0.30000000000000004`.

**Decisão.** `Product.price` é um inteiro em centavos. A conversão para reais acontece
apenas na formatação (`formatCurrency`), na borda da UI.

**Consequência.** Somas de carrinho e totais de pedido são exatas por construção. Os
elementos de preço também expõem `data-price-cents`, o que permite à automação asseverar o
valor numérico sem parsear `"R$ 1.299,90"` — um teste que não depende de formatação, locale
ou separador decimal.

---

## ADR-009 — Estados de carregamento, vazio e erro são distintos

**Contexto.** É comum uma tela tratar "sem dados" como um único caso e renderizar nada.

**Decisão.** Cada estado tem seu próprio componente e seu próprio `data-testid`:
`products-loading` (skeletons), `products-empty` (`EmptyState`) e `products-error`
(`Alert`).

**Consequência.** O usuário sempre sabe se deve esperar, corrigir a busca ou tentar de
novo. Para a automação, cada estado vira um cenário verificável — e um teste que espera
resultados nunca passa por engano contra uma tela em branco.

---

## ADR-010 — Race condition em busca assíncrona

**Contexto.** Digitar "note" e depois "notebook" deixa duas requisições em voo. Nada
garante que respondam na ordem em que saíram: a resposta antiga pode chegar por último e
sobrescrever a correta.

**Decisão.** O efeito de busca em `useProducts` mantém um flag `isCurrent` fechado sobre a
execução e desligado no cleanup. Respostas de queries superadas são descartadas.

**Consequência.** O resultado exibido sempre corresponde ao filtro atual. É um bug que
raramente aparece em desenvolvimento (rede local é rápida e consistente) e que se manifesta
em produção — por isso a latência simulada do ADR-002 existe.

---

## ADR-011 — Carrinho como redutor puro

**Contexto.** O carrinho concentra as regras de negócio mais densas da aplicação: mesclar
item repetido, respeitar estoque, remover ao zerar quantidade, calcular totais.

**Decisão.** Toda essa lógica vive em `cartReducer.ts` — funções **puras**, sem
`import` de React. O `CartProvider` apenas conecta o redutor ao React e cuida da
persistência.

**Consequência.** As regras são verificadas por testes unitários que rodam em ~130 ms no
runner nativo do Node (`npm run test:unit`), sem framework de teste, sem jsdom e sem
navegador. O Playwright fica reservado para o que só o navegador prova: navegação,
persistência real e integração entre telas. É a pirâmide de testes na prática — e o motivo
pelo qual "testar mais" não precisa significar "suíte mais lenta".

Casos cobertos no nível unitário que seriam caros no E2E: limite de estoque aplicado sobre
a **soma** (2 + 3 com estoque 3 resulta em 3, não 5), imutabilidade do estado anterior,
e descarte de dados corrompidos vindos do `localStorage`.

---

## ADR-012 — Carrinho isolado por usuário e logout à prova de falha

**Contexto.** Dois problemas apareceram ao testar troca de usuário no mesmo navegador.

**Decisão.**

1. **Chave de persistência por usuário** (`techstore:cart:<userId>`). Sem o id na chave,
   dois usuários no mesmo navegador compartilhariam o carrinho.

2. **`PrivateRoute` só grava `state.from` quando não houve sessão neste mount.** Antes,
   o logout gravava a última rota do usuário que saiu, e o **próximo** usuário a logar
   aterrissava nela — vazamento de contexto entre contas em um computador compartilhado.

3. **`logout()` encerra a sessão local ANTES da chamada remota.** Na ordem inversa,
   qualquer interrupção (reload, aba fechada, rede caindo) matava o JavaScript antes da
   limpeza e o usuário permanecia logado apesar de ter pedido para sair. Em autenticação,
   a falha precisa cair para o lado seguro.

**Consequência.** O `Header` deixou de navegar no logout: o redirecionamento é
responsabilidade única do `PrivateRoute`. Antes havia duas navegações concorrentes para
`/login` e a vencedora era imprevisível — origem do item 2.

---

## ADR-013 — Dado e formatação são coisas separadas

**Contexto.** CPF, CEP e telefone são exibidos com máscara. O caminho fácil é guardar a
string mascarada no estado.

**Decisão.** O estado guarda **apenas dígitos**; a máscara existe só na renderização
(`utils/masks.ts`). A validação e o envio recebem dígitos puros.

**Consequência.** Validar `"123.456.789-09"` exigiria limpar a string antes, e um CPF
colado de outra fonte com pontuação diferente falharia. Guardando dígitos, a validação
fica trivial e a apresentação é responsabilidade exclusiva da UI.

O CPF é validado pelo **algoritmo real de dígitos verificadores**, não por contagem de
caracteres — checar só o comprimento aceitaria `11111111111`, que é exatamente o que se
digita para furar um formulário.

---

## ADR-014 — `useForm` para o ciclo de formulário

**Contexto.** Login e Checkout repetiam o mesmo desenho: valores, erros por campo, erro
geral, estado de envio, validação no submit e limpeza do erro ao corrigir. Com 11 campos
no checkout, replicar isso à mão seria a maior fonte de inconsistência da aplicação.

**Decisão.** Extrair o ciclo para `hooks/useForm.ts`. O hook não conhece máscara, layout
nem regra de negócio: recebe `validate` e `onSubmit`. Quem decide o que é válido é a tela.

**Consequência.** As duas telas passaram a se comportar de forma idêntica. Uma armadilha
resolvida de uma vez só: o teste de "formulário válido" usa
`Object.values(errors).some(Boolean)` e não `Object.keys(errors).length`, porque corrigir
um campo grava `undefined` na chave em vez de removê-la — contar chaves daria "inválido"
para sempre depois do primeiro erro.

---

## ADR-015 — Estado assíncrono precisa de um sinal de carregamento

**Contexto.** Ao abrir `/checkout` com um load completo (refresh ou link direto), a
guarda "carrinho vazio → volte para o carrinho" disparava e expulsava quem **tinha**
itens: a hidratação do carrinho é assíncrona e o primeiro render vê a lista vazia.

**Decisão.** O `CartContext` expõe `isHydrating`, e toda tela que decide algo com base em
"carrinho vazio" espera esse sinal. O provider só conclui a hidratação depois que a sessão
foi restaurada — antes disso não se sabe *qual* carrinho carregar.

**Consequência.** É a **segunda ocorrência da mesma classe de bug** neste projeto; a
primeira foi `isRestoringSession` na autenticação (ADR-004). O padrão geral:

> Toda fonte de dados assíncrona precisa de três estados distinguíveis — carregando,
> vazia e preenchida. Colapsar "carregando" em "vazia" produz decisões tomadas cedo
> demais, e o sintoma é sempre um redirecionamento ou uma tela em branco indevida.

Vale notar como o bug apareceu: os testes que navegavam por link passavam, e só os que
faziam `page.goto()` falhavam. A diferença entre navegação client-side e load completo é
exatamente o que separa um teste E2E de um teste de componente.

---

## ADR-016 — Política de evidências

**Contexto.** Screenshot e vídeo de todos os testes geram artifacts enormes e sem valor
quando tudo passa.

**Decisão.** `screenshot: only-on-failure`, `video: retain-on-failure`,
`trace: on-first-retry`. Retries apenas no CI.

**Consequência.** Execução verde é leve; execução vermelha vem com screenshot, vídeo e trace
completo para depuração. Retry local desativado impede que flakiness real seja mascarada na
máquina do desenvolvedor.
