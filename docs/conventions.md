# Convenções — TechStore

Convenções existem para que o código pareça escrito pela mesma pessoa, e para que a
discussão em revisão seja sobre a decisão e não sobre a vírgula.

---

## Commits — Conventional Commits

```
<tipo>(<escopo>): <descrição no imperativo, minúscula, sem ponto final>

[corpo opcional: POR QUE, não o que]

[rodapé opcional: BREAKING CHANGE, refs]
```

| Tipo | Quando |
| --- | --- |
| `feat` | funcionalidade nova para quem usa |
| `fix` | correção de defeito |
| `refactor` | muda a estrutura sem mudar o comportamento |
| `perf` | melhora desempenho |
| `docs` | só documentação |
| `test` | só testes |
| `build` | dependências, Docker, tooling de build |
| `ci` | pipeline |
| `chore` | manutenção sem efeito em produção |

Escopos deste repositório: `api`, `frontend`, `automation`, `db`, `auth`, `products`,
`cart`, `orders`, `docs`.

```bash
feat(orders): fecha pedido em transacao com baixa de estoque
fix(cart): aplica limite de estoque sobre a soma, nao sobre a parcela
refactor(api): centraliza excecoes de dominio em fabricas
docs(auth): documenta deteccao de reuso de refresh token
```

**Por que isto importa além da estética.** O tipo do commit determina o incremento de
versão (`feat` → MINOR, `fix` → PATCH, `BREAKING CHANGE` → MAJOR), o que permite gerar
CHANGELOG e versionar automaticamente. Sem convenção, alguém precisa ler 200 commits e
decidir na mão.

**A descrição diz o efeito, não o arquivo.** `fix(cart): corrige bug` não informa nada;
`fix(cart): aplica limite de estoque sobre a soma` diz o que mudou para quem usa. O corpo
é o lugar do **porquê** — o *o quê* já está no diff.

`BREAKING CHANGE:` no rodapé é obrigatório quando um cliente existente para de funcionar:
rota removida, campo removido da resposta, validação mais restritiva, status diferente
para o mesmo caso.

---

## Branches

```
main                    sempre estável
feat/<escopo>-<assunto>
fix/<escopo>-<assunto>
```

---

## Código

**Nomes** — arquivos em `kebab-case` com sufixo de papel (`orders.service.ts`,
`create-order.dto.ts`, `order.entity.ts`); classes em `PascalCase`; funções e variáveis em
`camelCase`; constantes de módulo em `SCREAMING_SNAKE_CASE`.

**Imports relativos, sem alias `@/`.** Alias exige `tsconfig-paths` em runtime; sem ele o
código roda em desenvolvimento e quebra no container com `MODULE_NOT_FOUND`.

**Sem ponto e vírgula, aspas simples, 100 colunas** — herdado do frontend, para que os três
projetos do repositório tenham a mesma cara.

### As três regras de camada

1. **`req` e `res` param no controller.** Um service que recebe `Request` não é testável
   sem HTTP nem reusável por um job.
2. **`prisma` só existe em repositórios.** Vale mesmo com `PrismaModule` sendo `@Global`.
   Transações atravessam repositórios via `TransactionService`.
3. **Regra de negócio no service.** Controller traduz HTTP; repositório traduz dados.

### Erros

Sempre pelas fábricas de `common/exceptions/domain.exceptions.ts`:

```ts
throw notFound('Produto não encontrado.')
throw conflict('Este e-mail já está cadastrado.', [{ field: 'email', message: '...' }])
```

Nunca `new NotFoundException('...')` cru — perde o `code`, e é por ele que o cliente decide
comportamento.

### Comentários

Comentário explica **por quê**, nunca **o quê**. Se o código precisa de comentário para
dizer o que faz, o problema é o código.

```ts
// ruim:  incrementa o contador
// bom:   a checagem vem DEPOIS da senha: invertida, qualquer pessoa
//        descobriria contas desativadas sem conhecê-las
```

Vale comentar: decisão com alternativa razoável descartada, armadilha não óbvia, regra de
negócio com origem externa, e o motivo de algo *não* ter sido feito.

---

## Respostas da API

Toda resposta passa pelo envelope — nenhum controller o monta à mão:

```jsonc
{ "success": true,  "message": "...", "data": {} }
{ "success": true,  "message": "...", "data": [], "pagination": {} }
{ "success": false, "message": "...", "code": "VALIDATION_ERROR", "errors": [] }
```

A rota declara a mensagem com `@ResponseMessage('...')` e o schema com
`@ApiSuccessResponse(Entity)` / `@ApiPaginatedResponse(Entity)` / `@ApiErrorResponse(...)`.
Usar `@ApiResponse` cru volta a produzir uma spec que **mente** sobre o envelope.

**Status** — 200 leitura e atualização; 201 criação; 200 (não 204) em operações sem dado,
porque o envelope é conteúdo; 401 não sei quem é; 403 sei e não pode; 404 inexistente *ou
de outra pessoa*; 409 conflito de estado; 422 validação.

---

## Banco

Nomes em TypeScript seguem a linguagem (`camelCase`, modelo singular); nomes no banco
seguem SQL (`snake_case`, tabela plural), ligados por `@map`/`@@map`. Identificador em
maiúscula no Postgres exige aspas em toda consulta manual, e mais cedo ou mais tarde alguém
abre um `psql` para investigar um incidente.

- Dinheiro em **centavos**, `Int`. Nunca ponto flutuante.
- Toda ordenação tem **desempate por `id`** — sem ele, o Postgres pode devolver ordem
  diferente entre execuções e um teste falha uma vez em dez.
- Regra de negócio que precisa sobreviver a concorrência vive como **restrição no banco**,
  não só no service.
- `migrate dev` só em desenvolvimento; `migrate deploy` em CI e produção.

---

## Testes

O que a API expõe para ser testável: envelope uniforme, `code` estável em todo erro,
`errors[].field` com caminho pontilhado, `x-request-id` ecoado, `/api/health/ready`,
`/api/docs-json` e `POST /api/v1/test/reset`.

A massa de `src/database/seed-data.ts` é **contrato**: ids, e-mails e preços fixos,
espelhados em `automation/data/`. Alterar um exige atualizar o outro.
