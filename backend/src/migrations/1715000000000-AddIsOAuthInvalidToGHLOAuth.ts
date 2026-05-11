import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Agrega la columna `is_oauth_invalid` a las tablas `ghl_oauth_companies`
 * y `ghl_oauth_locations`.
 *
 * Esta columna persiste el estado de invalidación de OAuth:
 * - Antes era sólo un Set<string> en memoria (invalidCompanies) que se
 *   perdía al reiniciar el servidor.
 * - Permite marcar locations individuales como inválidas (no sólo companies)
 *   cuando reciben 401 sostenido de GHL pese a tener token "vigente" en BD.
 *
 * - `default: false` → todas las filas existentes quedan como válidas (estado
 *   actual del sistema antes de este cambio).
 * - `nullable: false` → no admite valores ambiguos.
 *
 * Backwards compatible: las companies/locations actuales arrancan con
 * is_oauth_invalid = false, equivalente al comportamiento anterior.
 */
export class AddIsOAuthInvalidToGHLOAuth1715000000000 implements MigrationInterface {
  name = 'AddIsOAuthInvalidToGHLOAuth1715000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasCompanyColumn = await queryRunner.hasColumn('ghl_oauth_companies', 'is_oauth_invalid');

    if (!hasCompanyColumn) {
      await queryRunner.addColumn(
        'ghl_oauth_companies',
        new TableColumn({
          name: 'is_oauth_invalid',
          type: 'boolean',
          isNullable: false,
          default: false,
        }),
      );
    }

    const hasLocationColumn = await queryRunner.hasColumn(
      'ghl_oauth_locations',
      'is_oauth_invalid',
    );

    if (!hasLocationColumn) {
      await queryRunner.addColumn(
        'ghl_oauth_locations',
        new TableColumn({
          name: 'is_oauth_invalid',
          type: 'boolean',
          isNullable: false,
          default: false,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasLocationColumn = await queryRunner.hasColumn(
      'ghl_oauth_locations',
      'is_oauth_invalid',
    );
    if (hasLocationColumn) {
      await queryRunner.dropColumn('ghl_oauth_locations', 'is_oauth_invalid');
    }

    const hasCompanyColumn = await queryRunner.hasColumn('ghl_oauth_companies', 'is_oauth_invalid');
    if (hasCompanyColumn) {
      await queryRunner.dropColumn('ghl_oauth_companies', 'is_oauth_invalid');
    }
  }
}
