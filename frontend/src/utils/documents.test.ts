import assert from 'node:assert/strict'
import test, { describe } from 'node:test'

import { isValidCpf } from './documents.ts'

/**
 * CPFs válidos usados nos testes.
 *
 * Gerados pelo próprio algoritmo de dígitos verificadores — são números sintaticamente
 * válidos, não pertencem a ninguém e existem apenas como massa de teste.
 */
const VALID_CPFS = ['11144477735', '52998224725', '15350946056']

describe('isValidCpf', () => {
  test('aceita CPFs com dígitos verificadores corretos', () => {
    for (const cpf of VALID_CPFS) {
      assert.equal(isValidCpf(cpf), true, `esperado válido: ${cpf}`)
    }
  })

  test('rejeita CPF com o último dígito trocado', () => {
    // Prova que a validação calcula os dígitos, em vez de só contar caracteres.
    assert.equal(isValidCpf('11144477736'), false)
  })

  test('rejeita CPF com o penúltimo dígito trocado', () => {
    assert.equal(isValidCpf('11144477745'), false)
  })

  test('rejeita sequências de dígitos repetidos', () => {
    for (let digit = 0; digit <= 9; digit++) {
      const repeated = String(digit).repeat(11)
      assert.equal(isValidCpf(repeated), false, `esperado inválido: ${repeated}`)
    }
  })

  test('rejeita comprimento diferente de 11', () => {
    assert.equal(isValidCpf(''), false)
    assert.equal(isValidCpf('1114447773'), false)
    assert.equal(isValidCpf('111444777351'), false)
  })
})
