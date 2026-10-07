package expo.modules.familiaseguraandroidcontrols

import android.app.AppOpsManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.net.ConnectivityManager
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

class FamiliaSeguraAndroidControlsModule : Module() {
  companion object {
    /** Lojas: apps instalados por elas não caem em "configuração restrita". */
    private val STORE_INSTALLERS = setOf(
      "com.android.vending", "com.sec.android.app.samsungapps", "com.xiaomi.mipicks", "com.xiaomi.market",
      "com.huawei.appmarket", "com.amazon.venezia", "com.oppo.market", "com.heytap.market", "com.vivo.appstore",
    )
    private val AUTOSTART_SCREENS = listOf(
      "com.miui.securitycenter" to "com.miui.permcenter.autostart.AutoStartManagementActivity",
      "com.coloros.safecenter" to "com.coloros.safecenter.permission.startup.StartupAppListActivity",
      "com.oppo.safe" to "com.oppo.safe.permission.startup.StartupAppListActivity",
      "com.vivo.permissionmanager" to "com.vivo.permissionmanager.activity.BgStartUpManagerActivity",
      "com.huawei.systemmanager" to "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity",
      "com.samsung.android.lool" to "com.samsung.android.sm.battery.ui.BatteryActivity",
    )
  }

  private val context: Context get() = requireNotNull(appContext.reactContext)
  private val adminComponent: ComponentName get() = ComponentName(context, FamiliaSeguraDeviceAdminReceiver::class.java)

  override fun definition() = ModuleDefinition {
    Name("FamiliaSeguraAndroidControls")

    Function("isAvailable") { Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP }

    Function("getProtectionStatus") {
      val accessibility = Settings.Secure.getString(
        context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
      ) ?: ""
      val component = ComponentName(context, FamiliaSeguraAccessibilityService::class.java)
      val accessibilityEnabled = accessibility
        .split(':')
        .mapNotNull(ComponentName::unflattenFromString)
        .any { it == component }
      val power = context.getSystemService(PowerManager::class.java)
      mapOf(
        "androidApiLevel" to Build.VERSION.SDK_INT,
        "usageAccessGranted" to hasUsageAccess(),
        "accessibilityEnabled" to accessibilityEnabled,
        "batteryOptimizationExempt" to (Build.VERSION.SDK_INT < 23 || power.isIgnoringBatteryOptimizations(context.packageName)),
        "serviceRunning" to FamiliaSeguraAccessibilityService.running,
        "policyLeaseActive" to PolicyStore.leaseActive(context),
        "deviceAdminActive" to isAdminFullyActive(),
        "guardianUnlockedUntil" to PolicyStore.guardianUnlockUntil(context).toDouble(),
        "model" to "${Build.MANUFACTURER} ${Build.MODEL}".trim(),
        "osVersion" to Build.VERSION.RELEASE,
        "batteryLevel" to batteryLevel(),
        // Filtro web no Android: DNS privado (Android 9+), lido pela API pública da rede ativa.
        "privateDnsMode" to privateDns().first,
        "privateDnsHost" to privateDns().second,
      )
    }

    /**
     * Dados para o assistente de configuração: fabricante (os caminhos mudam), de onde o app foi instalado
     * (fora da loja o Android 13+ restringe acessibilidade) e o que o serviço tem guardado.
     */
    Function("getSetupInfo") {
      val installer = installerPackage()
      val policy = PolicyStore.readIgnoringLease(context)
      mapOf(
        "manufacturer" to Build.MANUFACTURER.lowercase(),
        "brand" to Build.BRAND.lowercase(),
        "androidApiLevel" to Build.VERSION.SDK_INT,
        "installer" to (installer ?: ""),
        "fromStore" to (installer != null && STORE_INSTALLERS.contains(installer)),
        "policyPresent" to (policy != null),
        "rulesCount" to PolicyStore.apps(policy).length(),
        "routinesCount" to PolicyStore.routines(policy).length(),
        "tamperProtection" to PolicyStore.tamperProtectionEnabled(policy),
        "lastBlockShownAt" to BlockActivity.lastShownAt.toDouble(),
      )
    }

    /** Tenta abrir direto a tela do Família Segura em "Acesso ao uso"; alguns aparelhos só têm a lista. */
    Function("openUsageAccessSettings") {
      val direct = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS, Uri.parse("package:${context.packageName}"))
      tryStart(direct) || tryStart(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
    }

    /** Abre Acessibilidade pedindo para destacar o nosso serviço na lista (funciona na maioria dos aparelhos). */
    Function("openAccessibilitySettings") {
      val component = ComponentName(context, FamiliaSeguraAccessibilityService::class.java).flattenToString()
      val args = Bundle().apply { putString(":settings:fragment_args_key", component) }
      val highlighted = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
        .putExtra(":settings:fragment_args_key", component)
        .putExtra(":settings:show_fragment_args", args)
      tryStart(highlighted) || tryStart(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
    }

    /** "Informações do app": onde fica "Permitir configurações restritas" (menu de três pontos) em apps de fora da loja. */
    Function("openAppDetails") {
      tryStart(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}")))
    }

    /** Tela de "início automático" do fabricante (Xiaomi, Oppo, Vivo, Huawei, Samsung). false = não existe. */
    Function("openAutostartSettings") {
      AUTOSTART_SCREENS.any { (pkg, cls) -> tryStart(Intent().setComponent(ComponentName(pkg, cls))) }
    }

    /** Xiaomi/Redmi/POCO: "Outras permissões" do app, onde fica "Exibir janelas pop-up em segundo plano". */
    Function("openPopupPermissionSettings") {
      val editor = Intent("miui.intent.action.APP_PERM_EDITOR").putExtra("extra_pkgname", context.packageName)
      tryStart(Intent(editor).setClassName("com.miui.securitycenter", "com.miui.permcenter.permissions.PermissionsEditorActivity")) ||
        tryStart(editor)
    }

    /**
     * Teste real: vai para a tela inicial e mostra a tela de pausa com o app em segundo plano (é assim que o
     * bloqueio acontece no dia a dia). false = serviço de proteção desligado.
     */
    Function("testBlock") { FamiliaSeguraAccessibilityService.showTestBlock() }

    /** Configurações de rede, onde fica "DNS privado" (o caminho exato varia por fabricante). */
    Function("openNetworkSettings") {
      context.startActivity(Intent(Settings.ACTION_WIRELESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    Function("openBatteryOptimizationSettings") {
      context.startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    /** Abre a tela oficial do Android pedindo para ativar o administrador (proteção contra desinstalação). */
    Function("requestDeviceAdmin") { explanation: String ->
      val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN)
        .putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent)
        .putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, explanation)
      val activity = appContext.currentActivity
      if (activity != null) activity.startActivity(intent) else context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    /** Só é chamado depois do PIN do responsável (desvincular o aparelho). */
    Function("removeDeviceAdmin") {
      val dpm = context.getSystemService(DevicePolicyManager::class.java)
      if (isAdminActive()) dpm.removeActiveAdmin(adminComponent)
    }

    // O Expo converte o objeto JS em Map (listas viram List); JSONObject(Map) converte o aninhamento em JSONArray.
    Function("savePolicies") { policy: Map<String, Any?> ->
      PolicyStore.save(context, JSONObject(policy))
    }

    Function("setGuardianUnlock") { minutes: Int ->
      val until = if (minutes <= 0) 0L else System.currentTimeMillis() + minutes.coerceAtMost(60) * 60_000L
      PolicyStore.setGuardianUnlock(context, until)
      // Só avisa a família se havia proteção ligada (na primeira configuração ainda não há o que liberar).
      if (minutes > 0 && FamiliaSeguraAccessibilityService.running) {
        PolicyStore.appendEvent(context, "protection_disabled", "Proteção liberada pelo responsável por $minutes min")
      }
    }

    Function("drainEvents") {
      val events = PolicyStore.drainEvents(context)
      (0 until events.length()).mapNotNull { index ->
        val event = events.optJSONObject(index) ?: return@mapNotNull null
        mapOf("type" to event.optString("type"), "detail" to event.optString("detail"), "at" to event.optLong("at").toDouble())
      }
    }

    /** Apps com ícone na tela inicial (o que a criança consegue abrir). */
    Function("getInstalledApps") {
      val pm = context.packageManager
      val launcher = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      pm.queryIntentActivities(launcher, 0)
        .map { it.activityInfo.applicationInfo }
        .distinctBy { it.packageName }
        .filter { it.packageName != context.packageName }
        .map { info ->
          val installed = try { pm.getPackageInfo(info.packageName, 0).firstInstallTime } catch (_: Exception) { 0L }
          mapOf(
            "packageName" to info.packageName,
            "label" to pm.getApplicationLabel(info).toString(),
            "system" to ((info.flags and ApplicationInfo.FLAG_SYSTEM) != 0 && (info.flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) == 0),
            "installedAt" to installed.toDouble(),
          )
        }
    }

    Function("getUsageToday") { packageNames: List<String> ->
      val today = UsageCalculator.todayMinutes(context)
      packageNames.distinct().associateWith { pkg -> today[pkg] ?: 0L }
    }

    /** Uso de hoje de todos os apps (para relatórios dos apps sem regra). */
    Function("getAllUsageToday") {
      UsageCalculator.todayMinutes(context).filter { (pkg, minutes) -> minutes > 0 && pkg != context.packageName }
    }
  }

  /**
   * ("hostname" | "opportunistic" | "off" | "unknown", servidor). "unknown" = sem rede ativa para conferir.
   * Usa LinkProperties (API pública); não lê a chave interna private_dns_mode, bloqueada no Android 12+.
   */
  private fun privateDns(): Pair<String, String> {
    if (Build.VERSION.SDK_INT < 28) return "off" to ""
    return try {
      val cm = context.getSystemService(ConnectivityManager::class.java)
      val props = cm.getLinkProperties(cm.activeNetwork) ?: return "unknown" to ""
      val host = props.privateDnsServerName ?: ""
      when {
        host.isNotBlank() -> "hostname" to host
        props.isPrivateDnsActive -> "opportunistic" to ""
        else -> "off" to ""
      }
    } catch (_: Exception) { "unknown" to "" }
  }

  private fun tryStart(intent: Intent): Boolean = try {
    context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    true
  } catch (_: Exception) { false }

  private fun installerPackage(): String? = try {
    if (Build.VERSION.SDK_INT >= 30) context.packageManager.getInstallSourceInfo(context.packageName).installingPackageName
    else @Suppress("DEPRECATION") context.packageManager.getInstallerPackageName(context.packageName)
  } catch (_: Exception) { null }

  private fun isAdminActive(): Boolean =
    context.getSystemService(DevicePolicyManager::class.java).isAdminActive(adminComponent)

  /** Administrador ativo E com a política de travar a tela (admins de versões antigas precisam reativar). */
  private fun isAdminFullyActive(): Boolean = isAdminActive() && try {
    context.getSystemService(DevicePolicyManager::class.java).hasGrantedPolicy(adminComponent, PolicyStore.USES_POLICY_FORCE_LOCK)
  } catch (_: SecurityException) { false }

  private fun batteryLevel(): Int {
    val manager = context.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
    return manager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
  }

  private fun hasUsageAccess(): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = if (Build.VERSION.SDK_INT >= 29) {
      appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), context.packageName)
    } else {
      @Suppress("DEPRECATION")
      appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), context.packageName)
    }
    return mode == AppOpsManager.MODE_ALLOWED
  }
}
