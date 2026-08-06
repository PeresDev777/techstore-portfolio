import { SetMetadata } from '@nestjs/common'

export const RESPONSE_MESSAGE_KEY = 'response:message'

/**
 * Define a `message` do envelope de sucesso da rota.
 *
 *   @ResponseMessage('Produto encontrado com sucesso.')
 *   @Get(':id')
 *   findOne() { ... }
 *
 * A alternativa seria cada controller montar o envelope na mao (`return { success: true,
 * message: '...', data }`). Isso funciona ate o dia em que alguem esquece — e ai existem
 * duas formas de resposta na mesma API. Com o decorator, o controller devolve o DADO e o
 * formato e responsabilidade exclusiva do interceptor.
 */
export const ResponseMessage = (message: string) => SetMetadata(RESPONSE_MESSAGE_KEY, message)
