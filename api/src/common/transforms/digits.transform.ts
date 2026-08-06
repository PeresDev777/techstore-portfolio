import type { TransformFnParams } from 'class-transformer'

/**
 * Remove tudo que nao for digito.
 *
 * Aplicado a CPF, CEP e telefone na ENTRADA, pelo mesmo motivo que o frontend guarda
 * apenas digitos (ADR-013): dado e formatacao sao coisas separadas.
 *
 * O ganho pratico e aceitar `"111.444.777-35"` e `"11144477735"` como a mesma coisa. Sem
 * isso, a API precisaria escolher um formato e recusar o outro — e o cliente que colasse
 * um CPF de outra fonte, com pontuacao diferente, levaria erro de validacao por um detalhe
 * de apresentacao.
 *
 * A mascara volta a existir apenas na renderizacao, na borda da UI.
 */
export function onlyDigits({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.replace(/\D/g, '') : (value as unknown)
}
