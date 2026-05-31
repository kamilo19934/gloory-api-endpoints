import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

/**
 * Crea las tablas del sistema de confirmaciones de Sacmed:
 *   - `sacmed_confirmation_configs`   (config por cliente, hasta 3)
 *   - `sacmed_pending_confirmations`  (cola de confirmaciones con execution log)
 *
 * Independiente de los sistemas de confirmación de Dentalink y Reservo.
 * La integración Sacmed en sí no requiere migración: su config vive como JSON
 * en `client_integrations.config` (validado por el IntegrationRegistry).
 *
 * Idempotente: usa `hasTable` para no fallar si las tablas ya fueron creadas
 * por un bootstrap con `DB_SYNC=true`.
 */
export class AddSacmedIntegration1716000000000 implements MigrationInterface {
  name = 'AddSacmedIntegration1716000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasConfigs = await queryRunner.hasTable('sacmed_confirmation_configs');
    if (!hasConfigs) {
      await queryRunner.createTable(
        new Table({
          name: 'sacmed_confirmation_configs',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            { name: 'clientId', type: 'uuid', isNullable: false },
            { name: 'name', type: 'varchar', isNullable: false },
            { name: 'daysBeforeAppointment', type: 'int', isNullable: false },
            { name: 'timeToSend', type: 'varchar', isNullable: false },
            { name: 'ghlCalendarId', type: 'varchar', isNullable: false },
            { name: 'isEnabled', type: 'boolean', default: true },
            { name: 'order', type: 'int', isNullable: false },
            { name: 'createdAt', type: 'timestamp', default: 'now()' },
            { name: 'updatedAt', type: 'timestamp', default: 'now()' },
          ],
        }),
        true,
      );

      await queryRunner.createForeignKey(
        'sacmed_confirmation_configs',
        new TableForeignKey({
          columnNames: ['clientId'],
          referencedTableName: 'clients',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }

    const hasPending = await queryRunner.hasTable('sacmed_pending_confirmations');
    if (!hasPending) {
      await queryRunner.createTable(
        new Table({
          name: 'sacmed_pending_confirmations',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            { name: 'clientId', type: 'uuid', isNullable: false },
            { name: 'configId', type: 'uuid', isNullable: false },
            { name: 'sacmedEventId', type: 'varchar', isNullable: false },
            { name: 'appointmentData', type: 'json', isNullable: false },
            { name: 'status', type: 'text', default: `'pending'` },
            { name: 'scheduledFor', type: 'timestamp', isNullable: false },
            { name: 'ghlContactId', type: 'varchar', isNullable: true },
            { name: 'errorMessage', type: 'text', isNullable: true },
            { name: 'attempts', type: 'int', default: 0 },
            { name: 'executionLog', type: 'json', isNullable: true },
            { name: 'processedAt', type: 'timestamp', isNullable: true },
            { name: 'createdAt', type: 'timestamp', default: 'now()' },
            { name: 'updatedAt', type: 'timestamp', default: 'now()' },
          ],
        }),
        true,
      );

      await queryRunner.createForeignKey(
        'sacmed_pending_confirmations',
        new TableForeignKey({
          columnNames: ['clientId'],
          referencedTableName: 'clients',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );

      await queryRunner.createForeignKey(
        'sacmed_pending_confirmations',
        new TableForeignKey({
          columnNames: ['configId'],
          referencedTableName: 'sacmed_confirmation_configs',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );

      await queryRunner.createIndex(
        'sacmed_pending_confirmations',
        new TableIndex({
          name: 'IDX_sacmed_pending_scheduled_status',
          columnNames: ['scheduledFor', 'status'],
        }),
      );

      await queryRunner.createIndex(
        'sacmed_pending_confirmations',
        new TableIndex({
          name: 'IDX_sacmed_pending_client_config_event',
          columnNames: ['clientId', 'configId', 'sacmedEventId'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasPending = await queryRunner.hasTable('sacmed_pending_confirmations');
    if (hasPending) {
      await queryRunner.dropTable('sacmed_pending_confirmations', true, true, true);
    }

    const hasConfigs = await queryRunner.hasTable('sacmed_confirmation_configs');
    if (hasConfigs) {
      await queryRunner.dropTable('sacmed_confirmation_configs', true, true, true);
    }
  }
}
