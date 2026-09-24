package expo.modules.familiaseguraandroidcontrols

import android.accessibilityservice.AccessibilityService
import android.app.usage.UsageStatsManager
import android.content.Intent
import android.os.Build
import android.view.accessibility.AccessibilityEvent
import org.json.JSONObject
import java.util.Calendar

class FamiliaSeguraAccessibilityService : AccessibilityService() {
  companion object { @Volatile var running = false }

  override fun onServiceConnected() { running = true }
  override fun onDestroy() { running = false; super.onDestroy() }
  override fun onInterrupt() = Unit

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
    val packageName = event.packageName?.toString() ?: return
    if (shouldIgnore(packageName)) return
    val policy = PolicyStore.read(this) ?: return
    val app = findApp(policy, packageName)
    val appName = app?.optString("appName")?.ifBlank { packageName } ?: getString(R.string.block_app_generic)
    val reason = when {
      routineActive(policy) ->
        getString(R.string.block_reason_routine)
      app == null -> return
      app.optString("status").equals("blocked", true) ->
        getString(R.string.block_reason_permanent)
      else -> {
        val limit = app.optInt("dailyLimitMinutes", -1)
        if (limit < 0 || usageToday(packageName) < limit) return
        getString(R.string.block_reason_limit, limit, appName)
      }
    }
    val intent = Intent(this, BlockActivity::class.java)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      .putExtra(BlockActivity.EXTRA_REASON, reason)
      .putExtra(BlockActivity.EXTRA_APP_NAME, appName)
    startActivity(intent)
  }

  private fun findApp(policy: JSONObject, packageName: String): JSONObject? {
    val apps = PolicyStore.apps(policy)
    for (i in 0 until apps.length()) {
      val item = apps.optJSONObject(i) ?: continue
      if (item.optString("packageName") == packageName) return item
    }
    return null
  }

  private fun shouldIgnore(pkg: String): Boolean {
    if (pkg == packageName || pkg == "android" || pkg == "com.android.systemui" ||
      pkg == "com.android.settings" || pkg == "com.google.android.settings") return true
    val home = packageManager.resolveActivity(
      Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME), 0
    )?.activityInfo?.packageName
    return pkg == home
  }

  private fun usageToday(pkg: String): Long {
    val manager = getSystemService(USAGE_STATS_SERVICE) as UsageStatsManager
    val start = Calendar.getInstance().apply {
      set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
    }.timeInMillis
    return manager.queryAndAggregateUsageStats(start, System.currentTimeMillis())[pkg]?.totalTimeInForeground?.div(60000L) ?: 0L
  }

  private fun routineActive(policy: JSONObject): Boolean {
    val now = Calendar.getInstance()
    val minute = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)
    val day = now.get(Calendar.DAY_OF_WEEK)
    val routines = PolicyStore.routines(policy)
    for (i in 0 until routines.length()) {
      val routine = routines.optJSONObject(i) ?: continue
      if (!routine.optBoolean("enabled", false)) continue
      val start = parseTime(routine.optString("startTime"))
      val end = parseTime(routine.optString("endTime"))
      if (end > start) {
        if (dayMatches(routine.opt("days"), day) && minute >= start && minute < end) return true
      } else {
        val previousDay = if (day == Calendar.SUNDAY) Calendar.SATURDAY else day - 1
        if ((minute >= start && dayMatches(routine.opt("days"), day)) ||
          (minute < end && dayMatches(routine.opt("days"), previousDay))) return true
      }
    }
    return false
  }

  private fun dayMatches(value: Any?, day: Int): Boolean {
    val names = mapOf(1 to setOf("dom", "domingo", "sun"), 2 to setOf("seg", "segunda", "mon"), 3 to setOf("ter", "terça", "terca", "tue"), 4 to setOf("qua", "quarta", "wed"), 5 to setOf("qui", "quinta", "thu"), 6 to setOf("sex", "sexta", "fri"), 7 to setOf("sab", "sáb", "sábado", "sabado", "sat"))
    val wanted = names[day] ?: return false
    val text = when (value) {
      is String -> value
      is org.json.JSONArray -> (0 until value.length()).joinToString(",") { value.optString(it) }
      else -> ""
    }.lowercase()
    return text.split(',').map { it.trim() }.any { it in wanted }
  }

  private fun parseTime(value: String): Int = try {
    val parts = value.split(":")
    parts[0].toInt().coerceIn(0, 23) * 60 + parts.getOrElse(1) { "0" }.toInt().coerceIn(0, 59)
  } catch (_: Exception) { 0 }
}