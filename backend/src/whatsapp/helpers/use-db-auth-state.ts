import { Repository } from 'typeorm';
import {
  AuthenticationCreds,
  AuthenticationState,
  SignalDataTypeMap,
  initAuthCreds,
  BufferJSON,
  proto,
} from '@whiskeysockets/baileys';
import { WhatsAppAuthState } from '../entities/whatsapp-auth-state.entity';

/**
 * Adaptador de auth state de Baileys que persiste en base de datos via TypeORM.
 *
 * Reemplaza `useMultiFileAuthState` (filesystem) para permitir ejecución en
 * containers efímeros. Implementa la misma interfaz que espera Baileys.
 *
 * Basado en la implementación oficial de Baileys:
 * node_modules/@whiskeysockets/baileys/lib/Utils/use-multi-file-auth-state.js
 */
export const useDbAuthState = async (
  repo: Repository<WhatsAppAuthState>,
): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  clearAll: () => Promise<void>;
}> => {
  // Sanitiza el nombre de la key igual que lo hace Baileys con los archivos
  const fixKeyName = (key: string) => key?.replace(/\//g, '__')?.replace(/:/g, '-');

  const writeData = async (data: any, key: string): Promise<void> => {
    const sanitizedKey = fixKeyName(key);
    const serialized = JSON.stringify(data, BufferJSON.replacer);

    const existing = await repo.findOne({ where: { key: sanitizedKey } });
    if (existing) {
      existing.value = serialized;
      await repo.save(existing);
    } else {
      await repo.save(repo.create({ key: sanitizedKey, value: serialized }));
    }
  };

  const readData = async (key: string): Promise<any | null> => {
    try {
      const sanitizedKey = fixKeyName(key);
      const row = await repo.findOne({ where: { key: sanitizedKey } });
      if (!row) return null;
      return JSON.parse(row.value, BufferJSON.reviver);
    } catch {
      return null;
    }
  };

  const removeData = async (key: string): Promise<void> => {
    try {
      const sanitizedKey = fixKeyName(key);
      await repo.delete({ key: sanitizedKey });
    } catch {
      // ignorar errores de eliminación
    }
  };

  // Cargar credenciales o crear nuevas
  const creds: AuthenticationCreds = (await readData('creds')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(
          type: T,
          ids: string[],
        ): Promise<{ [id: string]: SignalDataTypeMap[T] }> => {
          const data: { [id: string]: SignalDataTypeMap[T] } = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`);
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            }),
          );
          return data;
        },
        set: async (data) => {
          const tasks: Promise<void>[] = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              tasks.push(value ? writeData(value, key) : removeData(key));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: async (): Promise<void> => {
      await writeData(creds, 'creds');
    },
    /**
     * Elimina todo el auth state (usado en logout/disconnect).
     */
    clearAll: async (): Promise<void> => {
      await repo.clear();
    },
  };
};
