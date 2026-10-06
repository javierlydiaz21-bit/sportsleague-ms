import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { AppModule } from './app.module';
import { serviceUrl } from './config/services';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Detras del balanceador de Render: la IP real del cliente llega en X-Forwarded-For
  app.set('trust proxy', true);

  // WebSocket del marcador en vivo (/live-scores, Socket.IO): el gateway lo reenvia
  // al Live Score Service, asi los clientes solo conocen la URL del gateway.
  const liveScoreSocket = createProxyMiddleware({
    target: serviceUrl('liveScore'),
    changeOrigin: true,
    ws: true,
    pathFilter: '/socket.io',
  });
  app.use(liveScoreSocket);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS (documento 10.7): en produccion solo los dominios autorizados (CORS_ORIGINS,
  // separados por coma, por ejemplo la URL de Vercel). Sin la variable, se acepta todo (desarrollo local).
  const corsOrigins = (process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({ origin: corsOrigins.length ? corsOrigins : true, credentials: true });
  app.setGlobalPrefix('api/v1');

  const config = new DocumentBuilder()
    .setTitle('API Gateway')
    .setDescription(
      'SportsLeague — Punto de entrada unico para el panel de organizadores, la app de ' +
        'arbitros y la app de espectadores. Valida el JWT, aplica permisos por rol, rate ' +
        'limiting y logging, y enruta cada /api/v1/* al microservicio correspondiente. ' +
        'Aqui se documentan los endpoints propios del gateway; los de cada servicio estan ' +
        'en su propia documentacion.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('auth', 'Inicio de sesion, refresh tokens y cuentas')
    .addTag('health', 'Estado del gateway y de los microservicios')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  app.use('/openapi.json', (_req: any, res: any) => res.json(document));
  app.use('/docs', apiReference({ spec: { content: document } }));

  const port = process.env.PORT || 8080;
  const server = await app.listen(port);
  server.on('upgrade', liveScoreSocket.upgrade);
  console.log(`[API Gateway] escuchando en el puerto ${port}`);
  console.log(`[API Gateway] documentacion disponible en /docs`);
}
bootstrap();
