import 'reflect-metadata';
import { DataSource } from 'typeorm';

/**
 * DataSource para el CLI de TypeORM (generar y correr migrations).
 *
 * Uso:
 *   # Generar migración a partir del diff entre entities y DB actual
 *   npm run migration:generate -- src/migrations/NombreMigracion
 *
 *   # Correr migraciones pendientes
 *   npm run migration:run
 *
 *   # Revertir la última migración
 *   npm run migration:revert
 *
 * NOTA IMPORTANTE:
 * Este archivo es independiente del `app.module.ts` — es SOLO para el CLI.
 * El runtime de la app sigue usando la config en `app.module.ts` con
 * `synchronize: false` en producción.
 *
 * Variables de entorno (deben venir del shell o del entorno del proceso):
 *   - DATABASE_URL (prioritario si existe, formato: postgres://user:pass@host:port/db)
 *   - O DATABASE_HOST / DATABASE_PORT / DATABASE_USERNAME / DATABASE_PASSWORD / DATABASE_NAME
 *   - DATABASE_SSL=true si la DB requiere SSL (Railway/Render ya usan SSL con DATABASE_URL)
 *
 * Para local, puedes usar: `DATABASE_URL=postgres://... npm run migration:run`
 */

const useUrl = !!process.env.DATABASE_URL;

export const AppDataSource = new DataSource({
  type: 'postgres',
  ...(useUrl
    ? { url: process.env.DATABASE_URL }
    : {
        host: process.env.DATABASE_HOST,
        port: parseInt(process.env.DATABASE_PORT || '5432'),
        username: process.env.DATABASE_USERNAME,
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_NAME,
      }),
  // SSL: por defecto activo cuando hay DATABASE_URL (Railway/Render),
  // pero se puede desactivar con DATABASE_SSL=false (útil para tests locales).
  ssl:
    process.env.DATABASE_SSL === 'false'
      ? false
      : process.env.DATABASE_SSL === 'true' || useUrl
        ? { rejectUnauthorized: false }
        : false,
  // Entities se cargan desde los archivos compilados o desde los .ts según donde se ejecute
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  // CRÍTICO: synchronize SIEMPRE false aquí. Solo migraciones explícitas.
  synchronize: false,
  logging: true,
});
