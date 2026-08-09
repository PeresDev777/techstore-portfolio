# Estratégia de QA — TechStore

Como este sistema é testado, e **por quê em cada nível**. Decisões com alternativa
descartada estão nos ADRs; aqui está o raciocínio que as conecta.

---

## A pergunta que organiza tudo

Uma suíte cresce sozinha. Sem um critério, ela vira uma pilha de testes que se repetem em
níveis diferentes, demoram cada vez mais e ninguém tem coragem de apagar. O critério
adotado:

> **Teste no nível mais baixo capaz de produzir a falha, e no nível mais alto em que um
> usuário a perceba.**

E o filtro aplicado a cada teste novo, antes de escrevê-lo:

> **O que este teste pega que os outros níveis não pegam?**
> Se a resposta for "nada", ele não deve existir.

Foi assim que 56 cenários de API entraram sem recobrir os de navegador — e o resultado
foi verificado depois, na auditoria da Sprint 5: **não há duplicação real entre os níveis.**

---

## A pirâmide, com números reais

| Nível | Onde | Cenários | Tempo | O que prova |
| --- | --- | --- | --- | --- |
| Unitário | `frontend/` | 28 | ~130 ms | Regras puras do redutor do carrinho |
| **API** | `automation/tests/api` | 56 | ~27 s | O que não tem manifestação visual |
| **Contrato** | `automation/tests/contract` | 21 | ~30 s | A resposta bate com a especificação |
| **E2E** | `automation/tests/e2e` | 93 | ~2,7 min | O que o usuário vê e faz, incluindo 11 de acessibilidade |

A base é estreita porque a aplicação é pequena — o único domínio com lógica pura densa é o
carrinho, e ele tem 28 testes que rodam em 130 ms sem navegador, sem jsdom e sem framework.
O ADR-011 registra a decisão.

**O E2E é largo de propósito, e isso não contradiz a pirâmide.** Estes cenários não
testam uma UI com dados de mentira: eles atravessam navegador → React → HTTP → NestJS →
Prisma → PostgreSQL. São testes de integração de sistema com um navegador na ponta.

---

## O que cada nível pega que os outros não pegam

### Só a API alcança

| Cenário | Por que o navegador não chega lá |
| --- | --- |
| Concorrência no fechamento do pedido | Um navegador não emite duas requisições no mesmo milissegundo |
| Reuso de refresh token rotacionado | O cliente foi escrito para **nunca** reapresentar um token queimado |
| Cliente em rota de administrador | O frontend não tem nenhuma tela administrativa |
| Mass assignment (`role: ADMIN`) | O formulário não tem esse campo |
| Histórico e detalhe de pedido | Não existe tela de pedidos |
| Imutabilidade do snapshot de preço | Exige `PATCH /products` **e** `GET /orders/:id` — nenhum tem UI |
| `?limit=1000000`, `sort` inválido | A UI não tem paginação e nunca envia esses parâmetros |
| `errors[].field` com caminho pontilhado | A tela mostra a mensagem dela; o contrato é invisível |

### O contraexemplo que ensina melhor que a regra

O limite de estoque sobre a soma está coberto **no unitário** e **no E2E**. Testá-lo por
API parece a duplicação exata que se quer evitar — e não é. O ADR-037 registra que a API
**diverge do frontend de propósito**: a UI faz `clamp` silencioso, a API responde **409**.

Não é o mesmo caso três vezes. É o mesmo input com três contratos diferentes.

### Onde cada nível falha quando o outro passa

| Passa | Falha | O que aconteceu |
| --- | --- | --- |
| E2E | **API** | A UI nunca envia a entrada ofensiva. Quebra para qualquer cliente que não seja aquele navegador |
| API | **E2E** | O contrato está certo, a ligação está errada. Foi o ADR-015 |
| E2E + API | **Contrato** | A resposta está certa e a documentação mente. Foi o ADR-044: 64 respostas erradas, nenhum teste vermelho |
| Contrato | **API** | A forma está certa e o número está errado |

---

## Massa de teste: três buckets, não dois

| Bucket | Origem | Exemplos |
| --- | --- | --- |
| **Contrato** | `data/` | `prd-001`, preço 129990, `qa@techstore.com` |
| **Efêmero único** | `factories/` | e-mail de cadastro, endereço, telefone |
| **Adversarial** | `data/` | CPF com dígito errado, `{ role: 'ADMIN' }`, `limit=1e6` |

Faker entra onde o valor precisa ser **único e nunca é comparado com uma constante**. Massa
fixa onde a asserção precisa de um valor conhecido.

O terceiro bucket é escrito à mão porque **dado aleatório não acerta uma fronteira de
propósito** — nenhum gerador vai produzir `111.111.111-11`, que é exatamente o CPF que se
digita para furar um formulário.

**Faker com seed fixo não é determinismo**, é reprodutibilidade da sequência — e ela quebra
no instante em que alguém insere um teste no meio do arquivo. A regra não é semear o Faker:
é **não asseverar sobre valor gerado**.

---

## Isolamento entre cenários

`POST /api/v1/test/reset` roda antes de **cada** teste, por fixture automática. O ADR-047
registra o que motivou: na primeira execução contra a API real, 19 dos 79 cenários
falharam, nenhum por defeito de integração. Enquanto o carrinho vivia no `localStorage`, o
isolamento era efeito colateral da arquitetura — um contexto de navegador novo vinha com
carrinho vazio de graça. Com estado no servidor, isolamento virou trabalho explícito.

`auto: true` é proposital: um teste que esquecesse de pedir o reset falharia conforme a
ordem de execução — o pior tipo de falha, porque parece flakiness e não é.

**O preço é o paralelismo.** A suíte roda com um worker. O caminho para recuperá-lo, quando
o tempo justificar, é dar a cada worker o seu próprio usuário e reservar massa de estoque
por worker.

---

## Confiabilidade: como esta suíte trata flakiness

**Não se marca um teste como instável antes de reproduzi-lo no commit anterior.** Foi essa
disciplina que separou dois defeitos reais de "flakiness" nesta suíte:

| Sintoma | Diagnóstico real |
| --- | --- |
| Um cenário de logout falhava 4 de 4 vezes isolado, passava na suíte | Bug de produção: o `localStorage` sobrevivia ao logout (ADR-012) |
| 19 falhas de carrinho na suíte, verde isolado | Corrida: `click()` não espera a rede e o `goto()` abortava o POST (ADR-018) |

Nos dois casos, o passo decisivo foi o mesmo: `git checkout` no commit verde da véspera e
rodar de novo. Se falha lá também, o teste não é o problema.

**Retry é ZERO na suíte de API, inclusive no CI.** No E2E o retry compra estabilidade
contra a rede. Num teste de concorrência, um teste que falha e passa na segunda tentativa é
exatamente o defeito que se está caçando — o retry transformaria a descoberta em verde.

---

## Evidências

| Suíte | Moeda de evidência |
| --- | --- |
| E2E | Screenshot e vídeo só em falha; trace no primeiro retry (ADR-019) |
| API | Requisição, resposta e **`x-request-id`** anexados na falha |
| Contrato | Erros do AJV com o caminho do campo que divergiu |

Screenshot e vídeo não existem sem navegador. O `x-request-id` é ecoado pela API (ADR-031) e
liga um teste vermelho no CI à linha exata do log daquela requisição.

---

## Quando rodar o quê

| Gatilho | Recorte | Cenários | Tempo no CI |
| --- | --- | --- | --- |
| `pull_request` | `@smoke` + `@critical` | 44 | ~1m40s |
| `push` na `main` | tudo menos `@slow` | 170 | — |
| `schedule` 03:00 | tudo | 171 | — |

**Por que o PR não roda tudo.** Medido: 85 s contra 2,4 min localmente. Mas o ganho maior
não é tempo — é a **autoridade do gate**. Todo teste no caminho do merge multiplica a chance
de vermelho sem relação com a mudança, e um gate que erra é um gate que as pessoas aprendem
a ignorar.

**Regressão não é uma tag.** Marcar os 171 cenários com `@regression` criaria um rótulo que
significa "isto é um teste". Regressão é a **ausência de filtro**.

---

## O que NÃO é testado, e por quê

| Item | Motivo |
| --- | --- |
| Firefox e WebKit | Ativar antes de a suíte estar estável em Chromium multiplica manutenção sem ganho de cobertura |
| Responsividade / mobile | Mesma razão; o projeto de mobile viewport está declarado e comentado na config |
| Leitor de tela / ordem de tabulação completa | O axe cobre ~1/3 dos critérios de WCAG. O resto exige verificação manual — lacuna conhecida |
| Carga e performance | Fora do escopo. `expectFasterThan` existe para pegar regressão grosseira, não para medir |
| Gateway de pagamento | Não existe no sistema; `POST /orders/:id/pay` é simulação declarada (ADR-040) |
| Histórico de pedidos no navegador | **A tela não existe.** Coberto por API. Construir a tela é uma decisão de produto em aberto |

---

## Documentos relacionados

| Documento | Conteúdo |
| --- | --- |
| [automation-architecture.md](automation-architecture.md) | ADR-049 em diante — decisões desta suíte |
| [architecture.md](architecture.md) | ADR-001 a ADR-019 — frontend e E2E original |
| [api-architecture.md](api-architecture.md) | ADR-020 a ADR-048 — API |
| [pr-checklist.md](pr-checklist.md) | O que conferir antes de pedir revisão |
| [../automation/README.md](../automation/README.md) | Como rodar, tags, como adicionar um teste |
