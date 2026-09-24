package expo.modules.familiaseguraandroidcontrols

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent

/**
 * Administrador do dispositivo: enquanto ativo, o Android não permite desinstalar o Família Segura.
 * Desativar exige abrir a tela de administradores, que o serviço de proteção bloqueia sem o PIN.
 */
class FamiliaSeguraDeviceAdminReceiver : DeviceAdminReceiver() {
  override fun onDisableRequested(context: Context, intent: Intent): CharSequence {
    PolicyStore.appendEvent(context, "uninstall_attempt", "Pedido para desativar o administrador do dispositivo")
    return context.getString(R.string.device_admin_disable_warning)
  }

  override fun onDisabled(context: Context, intent: Intent) {
    PolicyStore.appendEvent(context, "protection_disabled", "Administrador do dispositivo desativado")
  }

  override fun onEnabled(context: Context, intent: Intent) {
    PolicyStore.appendEvent(context, "protection_enabled", "Administrador do dispositivo ativado")
  }
}
