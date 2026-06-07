import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/**
 * Agrega columnas de trazabilidad del agente Gloory AI a `client_api_logs`.
 *
 * El swarm envía en cada tool call los headers `X-Gloory-*` y el
 * `ClientLoggingInterceptor` los persiste para poder conectar cada ejecución
 * con el thread/turno de la conversación que la originó (debugging).
 *
 * - threadId   ← X-Gloory-Thread-Id (id del thread de la conversación)
 * - turn       ← X-Gloory-Turn (turno del usuario o paso de LangGraph)
 * - agentUserId← X-Gloory-User-Id (contact_id del CRM)
 *
 * Todas nullable → los logs existentes quedan con NULL. Backwards compatible.
 * Se agrega índice (clientId, threadId) para listar rápido todos los logs de un hilo.
 */
export class AddGlooryTracingToClientApiLogs1717000000000 implements MigrationInterface {
  name = 'AddGlooryTracingToClientApiLogs1717000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = 'client_api_logs';

    if (!(await queryRunner.hasColumn(table, 'threadId'))) {
      await queryRunner.addColumn(
        table,
        new TableColumn({ name: 'threadId', type: 'varchar', length: '255', isNullable: true }),
      );
    }

    if (!(await queryRunner.hasColumn(table, 'turn'))) {
      await queryRunner.addColumn(
        table,
        new TableColumn({ name: 'turn', type: 'int', isNullable: true }),
      );
    }

    if (!(await queryRunner.hasColumn(table, 'agentUserId'))) {
      await queryRunner.addColumn(
        table,
        new TableColumn({ name: 'agentUserId', type: 'varchar', length: '255', isNullable: true }),
      );
    }

    const tableObj = await queryRunner.getTable(table);
    const hasIndex = tableObj?.indices.some(
      (idx) => idx.columnNames.length === 2 &&
        idx.columnNames.includes('clientId') &&
        idx.columnNames.includes('threadId'),
    );
    if (!hasIndex) {
      await queryRunner.createIndex(
        table,
        new TableIndex({
          name: 'IDX_client_api_logs_clientId_threadId',
          columnNames: ['clientId', 'threadId'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = 'client_api_logs';

    if (await queryRunner.hasColumn(table, 'agentUserId')) {
      await queryRunner.dropColumn(table, 'agentUserId');
    }
    if (await queryRunner.hasColumn(table, 'turn')) {
      await queryRunner.dropColumn(table, 'turn');
    }
    if (await queryRunner.hasColumn(table, 'threadId')) {
      await queryRunner.dropColumn(table, 'threadId');
    }

    const tableObj = await queryRunner.getTable(table);
    const idx = tableObj?.indices.find(
      (i) => i.name === 'IDX_client_api_logs_clientId_threadId',
    );
    if (idx) {
      await queryRunner.dropIndex(table, idx);
    }
  }
}
