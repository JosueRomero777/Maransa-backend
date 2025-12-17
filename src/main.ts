// Ensure Prisma uses the binary engine by setting the env var
process.env.PRISMA_CLIENT_ENGINE = process.env.PRISMA_CLIENT_ENGINE ?? 'binary';
import 'dotenv/config';

(async () => {
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('./app.module');

  async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    // Enable ValidationPipe and CORS for the frontend (Vite on 5173)
    const { ValidationPipe } = await import('@nestjs/common');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    // Enable CORS and allow common headers/methods
    app.enableCors({
      origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
      credentials: true,
    });

    await app.listen(process.env.PORT ?? 3000);
  }

  bootstrap();
})();
