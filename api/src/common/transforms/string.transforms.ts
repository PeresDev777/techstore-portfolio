import type { TransformFnParams } from 'class-transformer'

/**
 * Transformacoes de entrada reutilizaveis pelos DTOs.
 *
 * Existem como funcoes nomeadas, e nao como arrow inline em cada `@Transform`, por dois
 * motivos. O pratico: a regra de normalizacao de e-mail estava repetida em tres DTOs, e
 * regra repetida diverge. O de tipagem: `TransformFnParams.value` e `any`, entao cada
 * arrow inline reintroduzia um `any` no fluxo — aqui o `any` e contido em um lugar so e
 * o restante do codigo trabalha com `unknown`.
 *
 * A guarda `typeof value === 'string'` nao e defensividade excessiva: o corpo da
 * requisicao e entrada nao confiavel, e `{"email": 123}` chega aqui antes de qualquer
 * validacao — `@Transform` roda ANTES dos validadores.
 */

/** Remove espacos nas pontas. */
export function trim({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : (value as unknown)
}

/**
 * Remove espacos e normaliza para minusculas.
 *
 * Aplicado a e-mail em toda a API: na pratica endereco nao diferencia maiuscula, e
 * guardar "QA@Techstore.com" criaria uma segunda conta para o mesmo destinatario — alem
 * de fazer o login falhar dependendo de como a pessoa digitou.
 */
export function trimLower({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : (value as unknown)
}

/**
 * Remove espacos e normaliza para MAIUSCULAS.
 *
 * Usado em sigla de unidade federativa: `sp`, `Sp` e `SP` sao o mesmo estado, e recusar
 * dois deles por causa da tecla shift seria atrito sem proposito.
 */
export function trimUpper({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : (value as unknown)
}
