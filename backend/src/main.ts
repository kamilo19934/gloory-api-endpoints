import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS - allow configured origins + auto-detect Vercel domains
  const corsOrigin = process.env.CORS_ORIGIN;
  
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) {
        console.log('CORS: Allowing request with no origin');
        return callback(null, true);
      }
      
      console.log(`CORS: Checking origin: ${origin}`);
      
      // Always allow localhost for development
      if (origin.includes('localhost')) {
        console.log('CORS: Allowing localhost');
        return callback(null, true);
      }
      
      // Allow Vercel preview and production domains
      if (origin.includes('vercel.app')) {
        console.log('CORS: Allowing Vercel domain');
        return callback(null, true);
      }
      
      // Allow configured CORS_ORIGIN
      if (corsOrigin) {
        const allowedOrigins = corsOrigin.split(',').map(o => o.trim());
        if (allowedOrigins.includes(origin)) {
          console.log(`CORS: Allowing configured origin: ${origin}`);
          return callback(null, true);
        }
      }
      
      // Reject other origins - but return false instead of error to avoid breaking CORS headers
      console.warn(`CORS: Origin NOT allowed: ${origin}`);
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Content-Type', 'Authorization'],
  });

  // Enable validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // API prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3001;
  await app.listen(port);
  
  console.log(`🚀 Backend running on http://localhost:${port}`);
  console.log(`📚 API available at http://localhost:${port}/api`);
}

bootstrap();
