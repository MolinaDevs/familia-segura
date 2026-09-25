package expo.modules.familiaseguraandroidcontrols

import android.accessibilityservice.AccessibilityService
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONObject
import java.util.Calendar

/**
 * Aplica as regras da família no Android:
 * - bloqueia apps por regra, limite diário, rotina, bloqueio do responsável e quarentena de apps novos;
 * - reavalia o app em primeiro plano a cada 30 s (o limite vence mesmo sem trocar de app);
 * - com PIN definido, impede abrir as telas que desligariam a proteção ou desinstalariam o app.
 * Telefone e emergência nunca são bloqueados.
 */
class FamiliaSeguraAccessibilityService : AccessibilityService() {
  companion object {
    @Volatile var running = false
    private const val TICK_MS = 30_000L

    private val SETTINGS_PACKAGES = setOf(
      "com.android.settings", "com.google.android.settings", "com.samsung.android.settings",
      "com.miui.securitycenter", "com.coloros.safecenter", "com.oplus.safecenter",
      "com.android.permissioncontroller", "com.google.android.permissioncontroller",
    )
    private val INSTALLER_PACKAGES = setOf(
      "com.android.packageinstaller", "com.google.android.packageinstaller", "com.samsung.android.packageinstaller",
      "com.miui.packageinstaller",
    )
    private const val PLAY_STORE = "com.android.vending"

    /** Nunca bloquear: ligações e emergência (inclusive durante rotinas). */
    private val ALWAYS_ALLOWED = setOf(
      "com.android.dialer", "com.google.android.dialer", "com.samsung.android.dialer", "com.android.phone",
      "com.android.server.telecom", "com.android.emergency", "com.google.android.apps.safetyhub",
      "com.samsung.android.emergency", "com.android.incallui", "com.samsung.android.incallui",
    )
    private val TAMPER_WORDS = listOf(
      "desinstalar", "uninstall", "forçar parada", "forcar parada", "force stop", "desativar", "deactivate", "disable",
      "limpar dados", "limpar armazenamento", "clear data", "clear storage", "remover", "turn off", "usar ",
      "acesso ao uso", "usage access", "permitir", "allow ", "otimização de bateria", "battery optimization",
    )
  }

  private val handler = Handler(Looper.getMainLooper())
  private var foregroundPackage: String? = null
  private var lastBlockAt = 0L
  private var lastBlockedPackage: String? = null
  private var appLabelLower = "família segura"

  private val ticker = object : Runnable {
    override fun run() {
      try {
        val pkg = foregroundPackage
        val power = getSystemService(Context.POWER_SERVICE) as PowerManager
        if (pkg != null && power.isInteractive) evaluate(pkg)
      } finally {
        handler.postDelayed(this, TICK_MS)
      }
    }
  }

  private val packageReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      val pkg = intent.data?.schemeSpecificPart ?: return
      if (pkg == packageName) return
      val replacing = intent.getBooleanExtra(Intent.EXTRA_REPLACING, false)
      when (intent.action) {
        Intent.ACTION_PACKAGE_ADDED -> if (!replacing) {
          val label = labelOf(pkg)
          val policy = PolicyStore.read(context)
          if (policy?.optBoolean("quarantineNewApps", false) == true && !PolicyStore.guardianUnlocked(context)) {
            PolicyStore.addLocalPending(context, pkg)
          }
          PolicyStore.appendEvent(context, "app_installed", label)
        }
        Intent.ACTION_PACKAGE_FULLY_REMOVED -> {
          PolicyStore.removeLocalPending(context, pkg)
          PolicyStore.appendEvent(context, "app_removed", pkg)
        }
      }
    }
  }

  override fun onServiceConnected() {
    running = true
    appLabelLower = applicationInfo.loadLabel(packageManager).toString().lowercase()
    val filter = IntentFilter().apply {
      addAction(Intent.ACTION_PACKAGE_ADDED)
      addAction(Intent.ACTION_PACKAGE_FULLY_REMOVED)
      addDataScheme("package")
    }
    if (Build.VERSION.SDK_INT >= 33) registerReceiver(packageReceiver, filter, Context.RECEIVER_EXPORTED)
    else registerReceiver(packageReceiver, filter)
    handler.postDelayed(ticker, TICK_MS)
    PolicyStore.appendEvent(this, "protection_enabled", "Serviço de proteção ligado")
  }

  override fun onDestroy() {
    running = false
    handler.removeCallbacks(ticker)
    try { unregisterReceiver(packageReceiver) } catch (_: Exception) {}
    PolicyStore.appendEvent(this, "protection_disabled", "Serviço de proteção desligado")
    super.onDestroy()
  }

  override fun onInterrupt() = Unit

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event == null) return
    val pkg = event.packageName?.toString() ?: return
    when (event.eventType) {
      AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
        if (pkg != packageName && pkg != "com.android.systemui") foregroundPackage = pkg
        if (isTamperScreen(pkg)) return
        evaluate(pkg)
      }
      AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> {
        // Conteúdo muda sem trocar de janela (ex.: rolar até o app em Configurações).
        if (pkg in SETTINGS_PACKAGES || pkg in INSTALLER_PACKAGES || pkg == PLAY_STORE) isTamperScreen(pkg)
      }
    }
  }

  /**
   * Detecta telas de Configurações/instalador/loja que:
   * - desligariam a proteção ou desinstalariam o Família Segura (sempre, com PIN definido);
   * - desinstalariam qualquer app (se a família bloqueou remoção de apps);
   * - instalariam um APK fora da loja (se a família bloqueou instalações).
   * Tudo é liberável por 15 min com o PIN do responsável. Retorna true se bloqueou.
   */
  private fun isTamperScreen(pkg: String): Boolean {
    if (pkg !in SETTINGS_PACKAGES && pkg !in INSTALLER_PACKAGES && pkg != PLAY_STORE) return false
    val policy = PolicyStore.readIgnoringLease(this) ?: return false
    if (!PolicyStore.tamperProtectionEnabled(policy) || PolicyStore.guardianUnlocked(this)) return false
    val text = windowText() ?: return false
    val mentionsUs = text.contains(appLabelLower) || text.contains(getString(R.string.accessibility_service_label).lowercase())
    val uninstallText = text.contains("desinstalar") || text.contains("uninstall")
    val installText = !uninstallText && (text.contains("instalar") || text.contains("install"))
    val (type, reason) = when {
      mentionsUs && (pkg in INSTALLER_PACKAGES || TAMPER_WORDS.any { text.contains(it) }) ->
        (if (uninstallText || pkg in INSTALLER_PACKAGES) "uninstall_attempt" else "tamper_attempt") to getString(R.string.block_reason_tamper)
      policy.optBoolean("blockAppRemoval", false) && uninstallText ->
        "uninstall_attempt" to getString(R.string.block_reason_removal)
      policy.optBoolean("blockAppInstalls", false) && pkg in INSTALLER_PACKAGES && installText ->
        "tamper_attempt" to getString(R.string.block_reason_install)
      else -> return false
    }
    PolicyStore.appendEvent(this, type, if (pkg == PLAY_STORE) "Loja de apps" else if (pkg in INSTALLER_PACKAGES) "Instalador de apps" else "Configurações do aparelho")
    performGlobalAction(GLOBAL_ACTION_HOME)
    showBlock(reason, getString(R.string.block_app_protection), pkg, force = true)
    return true
  }

  private fun windowText(): String? {
    val root = try { rootInActiveWindow } catch (_: Exception) { null } ?: return null
    val builder = StringBuilder()
    var visited = 0
    fun walk(node: AccessibilityNodeInfo?) {
      if (node == null || visited > 400 || builder.length > 8000) return
      visited++
      node.text?.let { builder.append(it).append(' ') }
      node.contentDescription?.let { builder.append(it).append(' ') }
      for (i in 0 until node.childCount) walk(node.getChild(i))
    }
    walk(root)
    return builder.toString().lowercase()
  }

  private fun evaluate(pkg: String) {
    if (shouldIgnore(pkg)) return
    val policy = PolicyStore.read(this) ?: return
    val app = findApp(policy, pkg)
    val appName = app?.optString("appName")?.ifBlank { null } ?: labelOf(pkg)
    val blockedPackages = PolicyStore.packageSet(policy, "blockedPackages")
    val pendingPackages = PolicyStore.packageSet(policy, "pendingPackages") + PolicyStore.localPending(this)
    val reason = when {
      pkg == PLAY_STORE && policy.optBoolean("blockAppInstalls", false) && !PolicyStore.guardianUnlocked(this) ->
        getString(R.string.block_reason_store)
      routineActive(policy) -> getString(R.string.block_reason_routine)
      pkg in pendingPackages -> getString(R.string.block_reason_pending)
      pkg in blockedPackages -> getString(R.string.block_reason_permanent)
      app == null -> return
      app.optString("status").equals("blocked", true) -> getString(R.string.block_reason_permanent)
      else -> {
        // O limite é da criança: soma todos os pacotes da mesma regra neste aparelho + o uso nos outros aparelhos.
        val limit = app.optInt("dailyLimitMinutes", -1)
        val used = rulePackages(policy, app).sumOf { UsageCalculator.minutes(this, it) } + app.optLong("otherDevicesMinutes", 0L)
        if (limit < 0 || used < limit) return
        PolicyStore.appendEvent(this, "limit_reached", appName)
        getString(R.string.block_reason_limit, limit, appName)
      }
    }
    performGlobalAction(GLOBAL_ACTION_HOME)
    showBlock(reason, appName, pkg)
  }

  private fun showBlock(reason: String, appName: String, pkg: String, force: Boolean = false) {
    val now = System.currentTimeMillis()
    if (!force && pkg == lastBlockedPackage && now - lastBlockAt < 1500) return
    lastBlockAt = now
    lastBlockedPackage = pkg
    val intent = Intent(this, BlockActivity::class.java)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      .putExtra(BlockActivity.EXTRA_REASON, reason)
      .putExtra(BlockActivity.EXTRA_APP_NAME, appName)
    startActivity(intent)
  }

  private fun labelOf(pkg: String): String = try {
    packageManager.getApplicationLabel(packageManager.getApplicationInfo(pkg, 0)).toString()
  } catch (_: Exception) { pkg }

  private fun rulePackages(policy: JSONObject, app: JSONObject): List<String> {
    val ruleId = app.optString("ruleId")
    if (ruleId.isBlank()) return listOf(app.optString("packageName"))
    val apps = PolicyStore.apps(policy)
    return (0 until apps.length()).mapNotNull { apps.optJSONObject(it) }
      .filter { it.optString("ruleId") == ruleId }
      .map { it.optString("packageName") }
      .distinct()
  }

  private fun findApp(policy: JSONObject, pkg: String): JSONObject? {
    val apps = PolicyStore.apps(policy)
    for (i in 0 until apps.length()) {
      val item = apps.optJSONObject(i) ?: continue
      if (item.optString("packageName") == pkg) return item
    }
    return null
  }

  private fun shouldIgnore(pkg: String): Boolean {
    if (pkg == packageName || pkg == "android" || pkg == "com.android.systemui" || pkg in ALWAYS_ALLOWED) return true
    if (pkg in SETTINGS_PACKAGES || pkg in INSTALLER_PACKAGES) return true
    val home = packageManager.resolveActivity(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME), 0)?.activityInfo?.packageName
    val keyboard = android.provider.Settings.Secure.getString(contentResolver, android.provider.Settings.Secure.DEFAULT_INPUT_METHOD)
    return pkg == home || (keyboard != null && keyboard.startsWith("$pkg/"))
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
