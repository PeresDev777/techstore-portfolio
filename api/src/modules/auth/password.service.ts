import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import bcrypt from 'bcrypt'

/**
 * Hash e verificacao de senha.
 *
 * Existe como servico proprio, e nao como duas chamadas soltas a `bcrypt`, por tres
 * razoes: o custo vem da configuracao validada (nao de um numero magico espalhado pelo
 * codigo), trocar bcrypt por argon2 no futuro toca um arquivo, e o truque de tempo
 * constante abaixo fica em um lugar so.
 */
@Injectable()
export class PasswordService {
  private readonly rounds: number

  /**
   * Hash descartavel de uma senha aleatoria, usado quando o e-mail nao existe.
   *
   * Sem ele, "e-mail inexistente" responde em ~1 ms (nao ha hash a comparar) e "senha
   * errada" responde em ~250 ms (bcrypt roda). A diferenca e mensuravel de fora e permite
   * enumerar contas validas cronometrando as respostas — anulando o cuidado de devolver a
   * MESMA mensagem para os dois casos.
   */
  private readonly dummyHash: string

  constructor(config: ConfigService) {
    this.rounds = config.getOrThrow<number>('security.bcryptRounds')
    this.dummyHash = bcrypt.hashSync('senha-que-nunca-sera-usada-por-ninguem', this.rounds)
  }

  hash(plainText: string): Promise<string> {
    return bcrypt.hash(plainText, this.rounds)
  }

  compare(plainText: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plainText, hash)
  }

  /**
   * Consome o mesmo tempo de uma verificacao real e sempre falha.
   * Chamado no caminho "usuario nao encontrado" para igualar a duracao das respostas.
   */
  async fakeCompare(): Promise<void> {
    await bcrypt.compare('qualquer-coisa', this.dummyHash)
  }
}
