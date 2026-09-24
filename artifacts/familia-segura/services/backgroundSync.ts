import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import '@/lib/apiConfig';
import { runChildSync } from '@/services/childSync';

/**
 * Tarefas do aparelho da criança, definidas no escopo global (exigência do TaskManager):
 * - periódica (~15 min, mínimo do sistema): renova regras, envia uso, inventário e eventos;
 * - push silencioso "policy_changed": aplica a mudança do responsável na hora.
 */
export const CHILD_SYNC_TASK = 'familia-segura-child-sync';
export const CHILD_PUSH_TASK = 'familia-segura-child-push';

if (Platform.OS !== 'web') {
  TaskManager.defineTask(CHILD_SYNC_TASK, async () => {
    try {
      const result = await runChildSync();
      return result.status === 'ok' ? BackgroundTask.BackgroundTaskResult.Success : BackgroundTask.BackgroundTaskResult.Failed;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });

  TaskManager.defineTask(CHILD_PUSH_TASK, async () => {
    await runChildSync().catch(() => undefined);
  });
}

export async function registerChildBackgroundSync() {
  if (Platform.OS === 'web') return;
  try {
    if (!(await TaskManager.isTaskRegisteredAsync(CHILD_SYNC_TASK))) {
      await BackgroundTask.registerTaskAsync(CHILD_SYNC_TASK, { minimumInterval: 15 });
    }
    await Notifications.registerTaskAsync(CHILD_PUSH_TASK);
  } catch {
    // Expo Go / build sem o módulo: a sincronização continua ao abrir o app.
  }
}

export async function unregisterChildBackgroundSync() {
  if (Platform.OS === 'web') return;
  await BackgroundTask.unregisterTaskAsync(CHILD_SYNC_TASK).catch(() => undefined);
  await Notifications.unregisterTaskAsync(CHILD_PUSH_TASK).catch(() => undefined);
}
