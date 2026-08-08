# Arquitetura — TechStore Portfolio

Documento vivo. Cada decisão técnica relevante é registrada aqui com o **contexto**, a
**decisão** e a **consequência** — no espírito de um ADR (Architecture Decision Record)
enxuto, formato usado para dar rastreabilidade às escolhas de um time.

---

## Visão geral

O repositório contém três projetos independentes:

| Projeto       | Papel                                                          |
| ------------- | -------------------------------------------------------------- |
| `frontend/`   | Aplicação sob teste (SUT) — loja virtual React + TypeScript     |
| `automation/` | Framework de testes E2E — Playwright + TypeScript               |
| `api/`        | Backend REST — NestJS + Prisma + PostgreSQL                     |

Eles se comunicam por **contratos explícitos**: a URL da aplicação (`BASE_URL`) e os
atributos `data-testid` expostos pelo frontend; a URL da API e o formato das respostas
entre frontend e backend. Nenhum import cruzado entre os projetos.

As decisões do backend estão em **[api-architecture.md](api-architecture.md)** (ADR-020 em
diante) — este documento cobre frontend e automação.

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

**Correção posterior — o item 3 estava escrito, não implementado.**

A auditoria da suíte de automação encontrou um cenário E2E que falhava de forma
intermitente (4 de 4 execuções isoladas, mas verde dentro da suíte completa). A causa não
era o teste:

`logout()` chamava `setUser(null)` e só depois `await authService.logout()` — e o
`clearSession()` real morava num `finally` DENTRO dessa chamada, ou seja, **depois** da ida
e volta de rede. `setUser(null)` muda apenas o estado do React: bastava para a tela
redirecionar para `/login`, mas o `localStorage` seguia com uma sessão válida durante toda
a requisição.

Medido com o storage instrumentado:

| Momento | `localStorage` |
| --- | --- |
| Antes do logout | `techstore:session` presente |
| Logo após redirecionar para `/login` | **ainda presente, com a sessão inteira** |
| ~3 s depois | vazio |

Qualquer navegação nessa janela — F5, um link, fechar e reabrir a aba — restaurava a sessão
por `GET /auth/me`, com o access token válido por até 15 minutos. O usuário clicava em
"sair", via a tela de login e continuava autenticado: exatamente o modo de falha que este
ADR foi escrito para impedir.

A correção move a captura do refresh token para antes da limpeza e torna
`authService.logout(refreshToken)` uma função sem opinião sobre armazenamento — ela só
revoga no servidor. A rota é pública (a identidade é o próprio refresh token no corpo), por
isso funciona com a sessão local já apagada.

Duas lições que valem além deste caso:

1. **Comentário não é garantia.** Os dois arquivos afirmavam a invariante por escrito, e
   nenhum dos dois a implementava. O comentário envelheceu junto com o código, sem alarme.
2. **Falha intermitente com causa determinística.** A janela dependia da latência da rede,
   então o cenário passava na suíte completa e falhava isolado — o padrão que faz um time
   marcar o teste como *flaky* e perder o defeito. Antes de quarentenar, reproduza no
   código original: aqui foi isso que separou "teste instável" de "bug real".

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

## ADR-016 — Autenticação uma única vez, via `storageState`

**Contexto.** Quase todo cenário exige um usuário logado. Fazer login pela UI em cada
teste custa ~1 s por teste e acopla a suíte inteira a uma única funcionalidade.

**Decisão.** Um **projeto de setup** (`fixtures/auth.setup.ts`) autentica uma vez e grava
o estado do navegador em `.auth/user.json`. O projeto `chromium` declara
`dependencies: ['setup']` e `storageState`, então todo teste começa autenticado.

Os cenários que precisam do oposto — login, rota protegida, logout — importam
`fixtures/anonymous.ts`, que sobrescreve `storageState` com um estado vazio.

**Consequência.** Dois ganhos, sendo o segundo o mais importante:

1. **Velocidade**: o login deixa de ser repetido em ~70 testes.
2. **Isolamento de falha**: se o login quebrar, falham os testes de login — não a suíte
   inteira. Uma suíte toda vermelha esconde qual é o defeito real.

O estado gravado contém um token de sessão: `.auth/` está no `.gitignore`.

---

## ADR-017 — Page Objects expõem ações, não seletores

**Contexto.** Sem disciplina, page objects viram sacos de locators públicos e os specs
voltam a manipular seletores.

**Decisão.** `BasePage` concentra abertura, espera de prontidão e localização por
`data-testid`. As subclasses expõem **ações de negócio** (`loginAs`, `addToCartWithQuantity`,
`placeOrder`) e **asserções de domínio** (`expectProductDetails`, `expectTotalsAreConsistent`).

Regra prática adotada: se um spec precisa alcançar um seletor cru, falta um método no page
object.

**Consequência.** Os specs leem como especificação de comportamento. Uma mudança de UI se
resolve em um arquivo. E os page objects ficam compostos como a aplicação — `HeaderComponent`
é um componente reutilizado por todas as páginas autenticadas, não uma página.

Efeito colateral no lint: a regra `playwright/expect-expect` procura `expect(...)` no corpo
do teste e não enxerga asserções encapsuladas. A configuração enumera os métodos de
asserção do POM (`assertFunctionNames`) — o matcher do plugin compara por igualdade exata e
não aceita curinga. Assim a regra continua pegando o caso que importa: um teste que executa
passos e não verifica nada.

---

## ADR-018 — Sincronizar pela URL, não pelo indicador de carregamento

**Contexto.** O teste de ordenação lia a grade de produtos **vazia** e falhava de forma
intermitente.

**Decisão.** Os métodos de filtro do `ProductsPage` esperam a **query string** refletir a
mudança antes de prosseguir, e só então aguardam a grade estabilizar.

**Consequência.** Esperar apenas "o skeleton sumiu" é uma corrida: logo após o clique o
skeleton ainda **não apareceu**, a asserção passa contra o resultado anterior e a leitura
seguinte pega a grade no meio da troca. A URL, por outro lado, muda de forma determinística
e é um ponto de sincronização confiável.

O `waitForResults` também ficou com **duas** condições: o skeleton saiu **e** a tela está em
um estado terminal (grade com produtos ou estado vazio). Só a primeira deixaria passar o
instante em que a grade foi desmontada e ainda não voltou.

Generalizando: **espere pela causa observável, não pelo sintoma transitório.**

**Extensão — a mesma regra vale para MUTAÇÕES, e não valia.**

Encontrado durante a Sprint 3 da automação. Os page objects faziam
`await locator.click()` e seguiam adiante. `click()` resolve quando o clique é
**despachado**, não quando a requisição que ele dispara termina — e com o carrinho no
servidor sob cache otimista (ADR-046), a tela e o badge reagem imediatamente pela via
local enquanto o `POST /cart/items` ainda está em voo. O `page.goto('/cart')` da linha
seguinte **abortava** essa requisição, e o item nunca chegava ao servidor.

O sintoma:

| Execução | Resultado |
| --- | --- |
| Um cenário isolado | passa |
| O arquivo de carrinho inteiro | 10 de 15 |
| A suíte completa | 19 falhas |

Confirmado no log da API: nos cenários vermelhos **não existe `POST /cart/items`** — só os
dois `GET /cart`. E confirmado no commit anterior, verde na véspera, que passou a falhar
igual sem nenhuma alteração de código: a janela depende da carga da máquina.

O item chegava ao servidor por sorte, e a sorte acabou quando o ambiente ficou mais lento.

A correção é `BasePage.mutatingCart(action)`, que registra o `waitForResponse` **antes** de
agir e só devolve o controle quando a resposta chega. Esperar pelo badge não serviria: ele
sobe pelo redutor local antes de qualquer resposta, então subiria com a requisição ainda em
voo — é exatamente o "sintoma transitório" contra o qual este ADR foi escrito.

Efeito colateral medido: o arquivo de carrinho caiu de 1,9 min para 1,0 min, porque os
timeouts de 10 s desapareceram. **Corrigir a corrida deixou a suíte mais rápida, não mais
lenta** — a espera explícita custa milissegundos, e a implícita custava o timeout inteiro.

---

## ADR-019 — Política de evidências

**Contexto.** Screenshot e vídeo de todos os testes geram artifacts enormes e sem valor
quando tudo passa.

**Decisão.** `screenshot: only-on-failure`, `video: retain-on-failure`,
`trace: on-first-retry`. Retries apenas no CI.

**Consequência.** Execução verde é leve; execução vermelha vem com screenshot, vídeo e trace
completo para depuração. Retry local desativado impede que flakiness real seja mascarada na
máquina do desenvolvedor.
