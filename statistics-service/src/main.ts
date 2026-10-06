import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
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

  const config = new DocumentBuilder()
    .setTitle('Statistics Service')
    .setDescription(
      'SportsLeague — Consolida los resultados y eventos de cada partido finalizado para ' +
        'calcular la tabla de posiciones, el ranking de goleadores y las tarjetas acumuladas ' +
        'por jugador. Consume el evento ASINCRONO match.completed y consulta de forma ' +
        'SINCRONA el reglamento de puntuacion al League Service.',
    )
    .setVersion('1.0.0')
    .addTag('statistics', 'Posiciones, goleadores y tarjetas')
    .addTag('health', 'Estado del servicio')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  app.use('/openapi.json', (_req: any, res: any) => res.json(document));
  app.use('/docs', apiReference({ spec: { content: document } }));

  const port = process.env.PORT || 3006;
  await app.listen(port);
  console.log(`[Statistics Service] escuchando en el puerto ${port}`);
  console.log(`[Statistics Service] documentacion disponible en /docs`);
}
bootstrap();
