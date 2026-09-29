package expo.modules.familiaseguraandroidcontrols

import android.app.AppOpsManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.os.BatteryManager
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.objects.ReadableArguments
import org.json.JSONObject

class FamiliaSeguraAndroidControlsModule : Module() {
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
        "deviceAdminActive" to isAdminActive(),
        "guardianUnlockedUntil" to PolicyStore.guardianUnlockUntil(context).toDouble(),
        "model" to "${Build.MANUFACTURER} ${Build.MODEL}".trim(),
        "osVersion" to Build.VERSION.RELEASE,
        "batteryLevel" to batteryLevel(),
        // Filtro web no Android: DNS privado (Android 9+). "hostname" + servidor familiar = filtro ativo.
        "privateDnsMode" to (Settings.Global.getString(context.contentResolver, "private_dns_mode") ?: ""),
        "privateDnsHost" to (Settings.Global.getString(context.contentResolver, "private_dns_specifier") ?: ""),
      )
    }

    Function("openUsageAccessSettings") { context.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    Function("openAccessibilitySettings") { context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
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

    Function("savePolicies") { policy: ReadableArguments ->
      PolicyStore.save(context, JSONObject(policy.toMap()))
    }

    Function("setGuardianUnlock") { minutes: Int ->
      val until = if (minutes <= 0) 0L else System.currentTimeMillis() + minutes.coerceAtMost(60) * 60_000L
      PolicyStore.setGuardianUnlock(context, until)
      if (minutes > 0) PolicyStore.appendEvent(context, "protection_disabled", "Proteção liberada pelo responsável por $minutes min")
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

  private fun isAdminActive(): Boolean =
    context.getSystemService(DevicePolicyManager::class.java).isAdminActive(adminComponent)

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
