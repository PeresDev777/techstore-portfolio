import type { User } from '@/types/user'

/**
 * Registro interno da "base de dados". Estende `User` com os campos que jamais
 * podem vazar para a aplicação — o serviço é responsável por removê-los.
 */
interface UserRecord extends User {
  password: string
  isActive: boolean
}

/**
 * Massa de usuários da aplicação.
 *
 * IMPORTANTE: estes dados são um contrato com a suíte de automação. São fixos e
 * documentados justamente para que os testes sejam determinísticos — dados aleatórios
 * aqui produziriam testes que falham sem motivo. Qualquer alteração deve ser refletida
 * em `automation/data/`.
 */
export const USER_RECORDS: readonly UserRecord[] = [
  {
    id: 'usr-001',
    name: 'Gabriel Peres',
    email: 'qa@techstore.com',
    password: 'Test@1234',
    isActive: true,
  },
  {
    id: 'usr-002',
    name: 'Ana Souza',
    email: 'ana.souza@techstore.com',
    password: 'Ana@2024',
    isActive: true,
  },
  {
    // Cenário negativo dedicado: credenciais corretas, mas conta desativada.
    id: 'usr-003',
    name: 'Conta Desativada',
    email: 'inativo@techstore.com',
    password: 'Test@1234',
    isActive: false,
  },
]
