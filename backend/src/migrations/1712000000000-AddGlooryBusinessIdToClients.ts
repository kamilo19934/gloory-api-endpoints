import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Agrega la columna `gloory_business_id` a la tabla `clients`.
 *
 * Esta columna es usada por el endpoint `POST /api/internal/clients/provision`
 * (consumido por gloory-ai-server) para garantizar idempotencia del
 * auto-provisioning: si llega una request con el mismo gloory_business_id
 * que ya existe, se retorna el Client existente en lugar de crear duplicados.
 *
 * - `nullable: true` → los 50 clientes existentes quedan con NULL
 * - `unique: true` → en PostgreSQL, múltiples NULLs NO violan el constraint
 *   (es el comportamiento SQL estándar)
 *
 * Backwards compatible: los endpoints existentes no cambian, nada se rompe.
 */
export class AddGlooryBusinessIdToClients1712000000000
  implements MigrationInterface
{
  name = 'AddGlooryBusinessIdToClients1712000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn(
      'clients',
      'gloory_business_id',
    );

    if (hasColumn) {
      // Ya existe (ej: corrida previa parcial o synchronize previo). No-op.
      return;
    }

    await queryRunner.addColumn(
      'clients',
      new TableColumn({
        name: 'gloory_business_id',
        type: 'varchar',
        isNullable: true,
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn(
      'clients',
      'gloory_business_id',
    );

    if (!hasColumn) {
      return;
    }

    await queryRunner.dropColumn('clients', 'gloory_business_id');
  }
}
