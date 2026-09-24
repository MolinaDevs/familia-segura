package expo.modules.familiaseguraandroidcontrols

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Registra reinícios: o serviço de acessibilidade volta sozinho, mas o responsável vê o evento. */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_LOCKED_BOOT_COMPLETED) {
      PolicyStore.appendEvent(context, "device_reboot", null)
    }
  }
}
