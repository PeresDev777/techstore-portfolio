import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { LoggerModule } from 'nestjs-pino'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'
import { ResponseInterceptor } from './common/interceptors/response.interceptor'
import { configuration } from './config/configuration'
import { validateEnv } from './config/env.validation'
import { AuthModule } from './modules/auth/auth.module'
import { CartModule } from './modules/cart/cart.module'
import { CategoriesModule } from './modules/categories/categories.module'
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard'
import { RolesGuard } from './modules/auth/guards/roles.guard'
import { HealthModule } from './modules/health/health.module'
import { OrdersModule } from './modules/orders/orders.module'
import { ProductsModule } from './modules/products/products.module'
import { UsersModule } from './modules/users/users.module'
import { TestSupportModule } from './modules/test-support/test-support.module'
import { PrismaModule } from './prisma/prisma.module'

/**
 * Modulo raiz.
 *
 * Tres decisoes visiveis aqui:
 *
 * 1. Preocupacoes transversais (log, rate limit, envelope, erro) sao registradas UMA vez,
 *    globalmente. Nenhum modulo de dominio precisa lembrar de aplica-las.
 * 2. Sao registradas como PROVIDERS (APP_GUARD, APP_INTERCEPTOR, APP_FILTER) e nao via
 *    `app.useGlobalX()` no main.ts. A diferenca e injecao de dependencia: registrados
 *    assim, eles podem receber ConfigService, Reflector ou um repositorio pelo construtor.
 * 3. A ORDEM importa. Guard roda antes do handler; interceptor envolve o handler; filter
 *    captura o que escapar. Um erro lancado no guard tambem sai no envelope padrao.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      // Sem isto, uma variavel ausente so seria descoberta no momento do uso.
      validate: validateEnv,
      envFilePath: ['.env'],
    }),

    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.getOrThrow<string>('log.level'),

          /*
           * Correlacao de requisicao. Reaproveita o `x-request-id` que o cliente enviou
           * (ou cria um) e o devolve no header da resposta.
           *
           * Para a automacao isso e ouro: um teste que falha no CI carrega o id na
           * evidencia, e o log daquela requisicao exata sai com um grep — em vez de
           * caçar timestamps num log de execucao paralela.
           */
          genReqId: (req: IncomingMessage, res: ServerResponse) => {
            const header = req.headers['x-request-id']
            const id = (Array.isArray(header) ? header[0] : header) ?? randomUUID()
            res.setHeader('x-request-id', id)
            return id
          },

          // Log legivel no terminal do desenvolvedor; JSON de uma linha em producao.
          transport: config.getOrThrow<boolean>('log.pretty')
            ? {
                target: 'pino-pretty',
                options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' },
              }
            : undefined,

          /*
           * Segredo nunca vai para o log. `Authorization` num agregador de logs e
           * credencial em texto plano compartilhada com todo mundo que tem acesso ao
           * painel — vazamento por descuido, nao por ataque.
           */
          redact: {
            paths: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password'],
            remove: true,
          },

          // Health check bate a cada poucos segundos; logar isso afoga o sinal no ruido.
          autoLogging: {
            ignore: (req: IncomingMessage) => req.url?.includes('/health') ?? false,
          },

          // Severidade reflete o RESULTADO: 5xx e erro nosso, 4xx e aviso, resto e info.
          customLogLevel: (_req: IncomingMessage, res: ServerResponse, err?: Error) => {
            if (err || res.statusCode >= 500) return 'error'
            if (res.statusCode >= 400) return 'warn'
            return 'info'
          },
        },
      }),
    }),

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.getOrThrow<number>('throttle.ttl'),
            limit: config.getOrThrow<number>('throttle.limit'),
          },
        ],
      }),
    }),

    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    ProductsModule,
    CartModule,
    OrdersModule,

    /*
     * Registrado condicionalmente: em producao `register()` devolve um modulo vazio, e a
     * rota de reset do banco nao existe — nem no roteador, nem na especificacao OpenAPI.
     */
    TestSupportModule.register(),
  ],
  providers: [
    /*
     * A ORDEM destes tres guards e significativa — eles rodam nesta sequencia:
     *
     * 1. ThrottlerGuard  barra excesso de requisicoes ANTES de qualquer trabalho caro.
     *                    Depois do JWT, um ataque de forca bruta ainda pagaria uma
     *                    consulta ao banco por tentativa.
     * 2. JwtAuthGuard    autentica e preenche `request.user`.
     * 3. RolesGuard      autoriza. Depende do passo 2 — invertido, veria `user` indefinido
     *                    e recusaria todas as requisicoes.
     */
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },

    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
