import { ValidationPipe, VersioningType } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import helmet from 'helmet'
import { Logger } from 'nestjs-pino'
import { AppModule } from './app.module'
import { validationExceptionFactory } from './common/pipes/validation-exception.factory'

async function bootstrap(): Promise<void> {
  // `bufferLogs` segura as mensagens de boot ate o logger definitivo existir — sem isso,
  // tudo que acontece antes do primeiro `useLogger` sai no formato padrao do Nest.
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  app.useLogger(app.get(Logger))

  const config = app.get(ConfigService)
  const apiPrefix = config.getOrThrow<string>('http.apiPrefix')
  const port = config.getOrThrow<number>('http.port')
  const corsOrigins = config.getOrThrow<string[]>('http.corsOrigins')

  /*
   * Helmet define headers de seguranca por padrao (X-Content-Type-Options, HSTS,
   * X-Frame-Options e outros). Uma linha que fecha uma familia inteira de ataques —
   * e o tipo de configuracao que so e lembrada depois do pentest quando nao entra no dia 1.
   */
  app.use(helmet())

  /*
   * CORS por LISTA, nunca `origin: true`.
   *
   * `origin: '*'` combinado com credenciais permite que qualquer site aberto pelo usuario
   * chame esta API com a sessao dele. A lista vem do ambiente porque muda entre local
   * (5173 do Vite) e CI (4173 do preview usado pelo Playwright).
   */
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    // O cliente precisa ENXERGAR este header para correlacionar log com requisicao.
    exposedHeaders: ['x-request-id'],
  })

  app.setGlobalPrefix(apiPrefix)

  /*
   * Versionamento por URI: /api/v1/products.
   *
   * Versionar desde a primeira rota e barato; introduzir versao depois que existe um
   * frontend e uma suite de testes consumindo `/api/products` significa quebrar os dois
   * ou manter um alias para sempre.
   */
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })

  app.useGlobalPipes(
    new ValidationPipe({
      /*
       * `whitelist` remove campos nao declarados no DTO e `forbidNonWhitelisted` responde
       * erro quando eles aparecem. Sem isso, um `POST /users { "role": "ADMIN" }` levaria
       * um campo extra ate a camada de dados — mass assignment, uma das escaladas de
       * privilegio mais comuns em API REST.
       */
      whitelist: true,
      forbidNonWhitelisted: true,

      // Entrega ao controller uma INSTANCIA do DTO, nao um objeto literal: e isso que faz
      // `@Type(() => Number)` e os getters (ex.: `skip`) funcionarem.
      transform: true,
      transformOptions: { enableImplicitConversion: true },

      exceptionFactory: validationExceptionFactory,
    }),
  )

  // Fecha conexoes (Postgres) ao receber SIGTERM, em vez de morrer com o pool aberto.
  app.enableShutdownHooks()

  const swaggerConfig = new DocumentBuilder()
    .setTitle('TechStore API')
    .setDescription(
      'API REST da TechStore. Serve o frontend React e e o alvo da suite de QA Automation.\n\n' +
        'Todas as respostas seguem um envelope unico: `{ success, message, data }` no sucesso e ' +
        '`{ success, message, code, errors }` no erro.',
    )
    .setVersion('0.1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'access-token',
    )
    .build()

  const document = SwaggerModule.createDocument(app, swaggerConfig)

  SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
    swaggerOptions: { persistAuthorization: true },
    /*
     * Expor o JSON do OpenAPI nao e detalhe: e o artefato que permite gerar cliente
     * tipado, validar contrato no CI e, no projeto de automacao, escrever um teste que
     * falha quando a API muda de forma sem que ninguem avise.
     */
    jsonDocumentUrl: `${apiPrefix}/docs-json`,
  })

  await app.listen(port)

  const logger = app.get(Logger)
  logger.log(`TechStore API em http://localhost:${port}/${apiPrefix}`)
  logger.log(`Documentacao em http://localhost:${port}/${apiPrefix}/docs`)
}

void bootstrap()
