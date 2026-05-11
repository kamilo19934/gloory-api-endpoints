import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Agrega la columna `execution_log` (JSON nullable) a las tablas
 * `pending_confirmations` y `reservo_pending_confirmations`.
 *
 * Esta columna almacena el log paso-a-paso de cada intento de procesamiento
 * (resolve creds, find/create contact, update custom fields, update platform
 * status). Hace que los reintentos sean diagnosticables sin tener que cruzar
 * logs por timestamp.
 *
 * - `nullable: true` → las filas existentes quedan con NULL (no había log antes).
 * - JSON: cada celda guarda un array de `ExecutionStepEntry`.
 *
 * Backwards compatible: el código viejo que no escribe esta columna no se ve
 * afectado; el código nuevo lee `executionLog ?? []` si está null.
 */
export class AddExecutionLogToPendingConfirmations1715100000000 implements MigrationInterface {
  name = 'AddExecutionLogToPendingConfirmations1715100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasDentalinkColumn = await queryRunner.hasColumn(
      'pending_confirmations',
      'execution_log',
    );

    if (!hasDentalinkColumn) {
      await queryRunner.addColumn(
        'pending_confirmations',
        new TableColumn({
          name: 'execution_log',
          type: 'json',
          isNullable: true,
        }),
      );
    }

    const hasReservoColumn = await queryRunner.hasColumn(
      'reservo_pending_confirmations',
      'execution_log',
    );

    if (!hasReservoColumn) {
      await queryRunner.addColumn(
        'reservo_pending_confirmations',
        new TableColumn({
          name: 'execution_log',
          type: 'json',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasReservoColumn = await queryRunner.hasColumn(
      'reservo_pending_confirmations',
      'execution_log',
    );
    if (hasReservoColumn) {
      await queryRunner.dropColumn('reservo_pending_confirmations', 'execution_log');
    }

    const hasDentalinkColumn = await queryRunner.hasColumn(
      'pending_confirmations',
      'execution_log',
    );
    if (hasDentalinkColumn) {
      await queryRunner.dropColumn('pending_confirmations', 'execution_log');
    }
  }
}
