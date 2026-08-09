# Checklist de PR — TechStore

Uma lista só serve se cada item já pegou alguma coisa. **Todos os itens aqui vieram de um
defeito real deste repositório** — o ADR ou o commit está citado ao lado.

O CI verifica o que dá para automatizar. Esta lista é para o que ele **não** consegue ver.

---

## Antes de abrir

- [ ] `npm run lint`, `format:check` e `typecheck` passam nos projetos tocados
- [ ] A suíte roda verde localmente no recorte relevante (`test:pr` no mínimo)
- [ ] Commits seguem [Conventional Commits](conventions.md), com o **porquê** no corpo
- [ ] Nenhum segredo, token ou `.env` no diff

---

## Para qualquer mudança

- [ ] **O comentário explica por quê, não o quê.** Se o código precisa de comentário para
      dizer o que faz, o problema é o código
- [ ] **Nenhum comentário afirma algo que o código não faz.** O ADR-012 dizia que o logout
      limpava a sessão antes da chamada remota; os dois arquivos afirmavam isso por escrito
      e nenhum implementava. Comentário envelhece sem alarme
- [ ] **Justificativa técnica foi verificada, não inventada.** Um commit deste repositório
      alegou que `actions/cache@v5` mudava o comportamento de `restore-keys` — era falso, e
      passou porque *soava* certo. Duas requisições desfizeram em trinta segundos

---

## API

- [ ] Erro lançado pelas **fábricas** de `domain.exceptions.ts`, nunca `new XException()`
      cru — senão perde o `code`, e é por ele que o cliente decide comportamento (ADR-043)
- [ ] Resposta anotada com `@ApiSuccessResponse` / `@ApiPaginatedResponse` / `@ApiErrorResponse`.
      **`@ApiResponse` cru produz uma spec que mente** (ADR-044)
- [ ] Rota nova: `@Public()` só quando ela é mesmo pública. Esquecer gera 401 óbvio;
      esquecer `@UseGuards()` no desenho oposto geraria um endpoint aberto (ADR-032)
- [ ] Ordenação nova tem **desempate por `id`** — sem ele o Postgres devolve ordem
      diferente entre execuções e o teste falha uma vez em dez (ADR-028)
- [ ] Dinheiro é `Int` em centavos. Nunca ponto flutuante (ADR-008)
- [ ] Mudou o contrato? **`npm run contract:baseline` no MESMO PR**, e o diff é a revisão
- [ ] Massa do seed alterada? `automation/data/` foi atualizado junto — é contrato entre os
      dois projetos (conventions.md)

---

## Frontend

- [ ] Elemento novo relevante para asserção expõe `data-testid` no padrão
      `contexto-elemento` (ADR-003)
- [ ] Fonte de dados assíncrona tem **três estados distinguíveis**: carregando, vazio e
      preenchido. Colapsar "carregando" em "vazio" já produziu dois bugs aqui — o
      `isRestoringSession` e o `isHydrating` (ADR-015)
- [ ] Em autenticação, a falha cai para o lado **seguro**: encerra a sessão local primeiro,
      trata a chamada remota como best-effort (ADR-012)
- [ ] Valor monetário exposto também como `data-price-cents`, para o teste asseverar número
      em vez de `"R$ 1.299,90"` (ADR-008)

---

## Automação

- [ ] **O teste pega algo que os outros níveis não pegam.** Se a resposta for "nada", ele
      não deve existir ([qa-strategy.md](qa-strategy.md))
- [ ] Asserção que expressa a expectativa do teste está **no spec**; só invariante de página
      fica no page object (ADR-049)
- [ ] Nenhum `getByTestId` ou `page.locator` no spec — se precisou, falta uma propriedade no
      page object
- [ ] Ação que **muta estado no servidor** usa `mutatingCart()` ou equivalente. `click()`
      resolve quando o clique é despachado, não quando a requisição termina — e o `goto()`
      seguinte a aborta (ADR-018)
- [ ] Espera é pela **causa observável**, nunca por `waitForTimeout` nem por relógio
      (ADR-018, ADR-050)
- [ ] Erro de API asseverado por **`code`**, jamais por `message` — copy muda, código não
      (ADR-023)
- [ ] Dado gerado não é comparado com constante; dado de fronteira é escrito à mão
- [ ] Tag só se for `@smoke`, `@critical` ou `@slow`. Sem tag é o padrão
- [ ] Método novo de asserção **invariante** entrou em `assertFunctionNames` do ESLint

---

## Antes de aprovar (para quem revisa)

- [ ] **O teste sabe falhar?** Um teste de contrato que nunca reprova é placebo. Se houver
      dúvida, mute a expectativa e veja ficar vermelho — foi assim que a baseline do
      contrato foi validada
- [ ] Um teste marcado como instável foi **reproduzido no commit anterior** antes de receber
      esse rótulo. Nesta suíte, duas "flakiness" eram bugs de produção
- [ ] Retry novo não está escondendo uma corrida. Em concorrência, passar no retry é
      exatamente o defeito
- [ ] O CI está verde **e** rodou o recorte certo para o gatilho
