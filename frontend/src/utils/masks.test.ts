import assert from 'node:assert/strict'
import test, { describe } from 'node:test'

import { maskCep, maskCpf, maskPhone, onlyDigits } from './masks.ts'

describe('onlyDigits', () => {
  test('remove qualquer caractere que não seja dígito', () => {
    assert.equal(onlyDigits('123.456.789-09'), '12345678909')
    assert.equal(onlyDigits('(11) 98765-4321'), '11987654321')
    assert.equal(onlyDigits('abc'), '')
  })

  test('respeita o comprimento máximo', () => {
    // Impede que colar um texto longo estoure o campo.
    assert.equal(onlyDigits('123456789012345', 11), '12345678901')
  })
})

describe('maskCpf', () => {
  test('formata o CPF completo', () => {
    assert.equal(maskCpf('12345678909'), '123.456.789-09')
  })

  test('formata parcialmente enquanto o usuário digita', () => {
    assert.equal(maskCpf(''), '')
    assert.equal(maskCpf('123'), '123')
    assert.equal(maskCpf('1234'), '123.4')
    assert.equal(maskCpf('1234567'), '123.456.7')
  })
})

describe('maskCep', () => {
  test('formata o CEP completo e o parcial', () => {
    assert.equal(maskCep('01310100'), '01310-100')
    assert.equal(maskCep('013'), '013')
  })
})

describe('maskPhone', () => {
  test('celular com 11 dígitos usa 5 dígitos antes do hífen', () => {
    assert.equal(maskPhone('11987654321'), '(11) 98765-4321')
  })

  test('fixo com 10 dígitos usa 4 dígitos antes do hífen', () => {
    assert.equal(maskPhone('1133334444'), '(11) 3333-4444')
  })

  test('formata parcialmente enquanto o usuário digita', () => {
    assert.equal(maskPhone('11'), '11')
    assert.equal(maskPhone('119'), '(11) 9')
  })
})
