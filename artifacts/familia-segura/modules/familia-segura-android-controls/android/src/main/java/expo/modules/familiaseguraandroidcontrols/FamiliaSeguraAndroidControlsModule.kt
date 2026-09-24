package expo.modules.familiaseguraandroidcontrols

import android.app.AppOpsManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.objects.ReadableArguments
import org.json.JSONObject
import java.util.Calendar

class FamiliaSeguraAndroidControlsModule : Module() {
  private val context: Context get() = requireNotNull(appContext.reactContext)

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
        "policyLeaseActive" to PolicyStore.leaseActive(context)
      )
    }

    Function("openUsageAccessSettings") { context.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    Function("openAccessibilitySettings") { context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    Function("openBatteryOptimizationSettings") {
      context.startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    Function("savePolicies") { policy: ReadableArguments ->
      PolicyStore.save(context, JSONObject(policy.toMap()))
    }

    Function("getUsageToday") { packageNames: List<String> ->
      val manager = context.getSystemService(Context.USAGE_STATS_SERVICE) as android.app.usage.UsageStatsManager
      val start = Calendar.getInstance().apply { set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }.timeInMillis
      val end = System.currentTimeMillis()
      val result = packageNames.distinct().associateWith { pkg ->
        manager.queryAndAggregateUsageStats(start, end).get(pkg)?.totalTimeInForeground?.div(60000L) ?: 0L
      }
      result
    }
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