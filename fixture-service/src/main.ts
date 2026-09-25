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
    .setTitle('Fixture Service')
    .setDescription(
      'SportsLeague — Genera automaticamente el calendario completo de una temporada ' +
        'considerando las canchas disponibles, el descanso minimo entre partidos de un ' +
        'mismo equipo y el equilibrio local/visitante. Consulta de forma SINCRONA al ' +
        'League Service (reglamento) y al Team Service (equipos participantes), y publica ' +
        'el evento ASINCRONO fixture.published por cada jornada confirmada.',
    )
    .setVersion('1.0.0')
    .addTag('fixtures', 'Generacion y consulta del calendario')
    .addTag('matches', 'Consulta de partidos y cambio de sede')
    .addTag('health', 'Estado del servicio')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  app.use('/openapi.json', (_req: any, res: any) => res.json(document));
  app.use('/docs', apiReference({ spec: { content: document } }));

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`[Fixture Service] escuchando en el puerto ${port}`);
  console.log(`[Fixture Service] documentacion disponible en /docs`);
}
bootstrap();
