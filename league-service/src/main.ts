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
    .setTitle('League Service')
    .setDescription(
      'SportsLeague — Administra ligas, temporadas y categorias, incluyendo el ' +
        'reglamento de cada competicion (puntos por victoria/empate y criterio de ' +
        'desempate). Es consultado de forma SINCRONA (REST): el Team Service lee ' +
        'el age_range de una categoria para validar la elegibilidad de los jugadores.',
    )
    .setVersion('1.0.0')
    .addTag('leagues', 'Ligas y sus temporadas')
    .addTag('seasons', 'Categorias de una temporada')
    .addTag('categories', 'Consulta de categorias y reglamento')
    .addTag('health', 'Estado del servicio')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  app.use('/openapi.json', (_req: any, res: any) => res.json(document));
  app.use('/docs', apiReference({ spec: { content: document } }));

  const port = process.env.PORT || 3003;
  await app.listen(port);
  console.log(`[League Service] escuchando en el puerto ${port}`);
  console.log(`[League Service] documentacion disponible en /docs`);
}
bootstrap();
