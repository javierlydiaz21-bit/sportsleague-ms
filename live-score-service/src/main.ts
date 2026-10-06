import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
  // WebSockets (Socket.IO): canal /live-scores
  app.useWebSocketAdapter(new IoAdapter(app));

  const config = new DocumentBuilder()
    .setTitle('Live Score Service')
    .setDescription(
      'SportsLeague — Permite a arbitros o delegados registrar eventos en tiempo real ' +
        '(goles, tarjetas, sustituciones) y actualiza al instante el marcador de los ' +
        'espectadores conectados por WebSocket (namespace /live-scores, evento "subscribe" ' +
        'con { matchId }). Publica los eventos ASINCRONOS match.event y match.completed.',
    )
    .setVersion('1.0.0')
    .addTag('matches', 'Eventos en vivo, marcador, cierre y suspension')
    .addTag('health', 'Estado del servicio y metricas')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  app.use('/openapi.json', (_req: any, res: any) => res.json(document));
  app.use('/docs', apiReference({ spec: { content: document } }));

  const port = process.env.PORT || 3005;
  await app.listen(port);
  console.log(`[Live Score Service] escuchando en el puerto ${port}`);
  console.log(`[Live Score Service] documentacion disponible en /docs`);
}
bootstrap();
