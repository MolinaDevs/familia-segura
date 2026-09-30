package expo.modules.familiaseguraandroidcontrols

import android.accessibilityservice.AccessibilityService
import android.app.admin.DevicePolicyManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioManager
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
 * - com PIN definido, impede abrir as telas que desligariam a proteção ou desinstalariam o app;
 * - rotina com "travar a tela" (hora de dormir): trava o aparelho sempre que a criança o desbloquear.
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
      // Relógio/despertador: o alarme da manhã toca dentro da rotina de sono e precisa ser desligado.
      "com.google.android.deskclock", "com.android.deskclock", "com.sec.android.app.clockpackage",
      "com.android.alarmclock", "com.miui.clock", "com.coloros.alarmclock", "com.oneplus.deskclock",
      "com.motorola.timeweatherwidget", "com.huawei.deskclock",
    )
    private const val CONTENT_CHECK_MS = 700L
    private const val SYSTEM_PACKAGES_TTL_MS = 60_000L
    /** Tempo para ler o aviso (e o responsável abrir o app) antes de a tela travar. */
    private const val BEDTIME_LOCK_GRACE_MS = 5_000L
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
  private var lastContentCheck = 0L
  private var systemPackagesAt = 0L
  private var homePackage: String? = null
  private var keyboardPackage: String? = null
  private var bedtimeLockPending = false
  /** O Família Segura (não a tela de pausa) está aberto: é onde o responsável digita o PIN. */
  private var ownAppForeground = false

  private val bedtimeLock = Runnable {
    bedtimeLockPending = false
    // Reconfere na hora: a rotina pode ter acabado, o responsável pode ter liberado ou a criança atendido uma ligação.
    if (shouldLockForBedtime()) {
      try {
        getSystemService(DevicePolicyManager::class.java).lockNow()
      } catch (_: SecurityException) {}
    }
  }

  private val screenReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      when (intent.action) {
        // Espera a janela do app em primeiro plano ser informada antes de decidir.
        Intent.ACTION_USER_PRESENT -> handler.postDelayed({ scheduleBedtimeLock() }, 1_500L)
        Intent.ACTION_SCREEN_OFF -> { handler.removeCallbacks(bedtimeLock); bedtimeLockPending = false }
      }
    }
  }

  private val ticker = object : Runnable {
    override fun run() {
      try {
        val pkg = foregroundPackage
        val power = getSystemService(Context.POWER_SERVICE) as PowerManager
        if (power.isInteractive) {
          if (pkg != null) evaluate(pkg)
          scheduleBedtimeLock()
        }
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
          if (policy?.optBoolean("quarantineNewApps", false) == true && !PolicyStore.guardianUnlocked(context) && !PolicyStore.installUnlocked(policy)) {
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
    registerReceiver(screenReceiver, IntentFilter().apply {
      addAction(Intent.ACTION_USER_PRESENT)
      addAction(Intent.ACTION_SCREEN_OFF)
    })
    handler.postDelayed(ticker, TICK_MS)
    PolicyStore.appendEvent(this, "protection_enabled", "Serviço de proteção ligado")
  }

  override fun onDestroy() {
    running = false
    handler.removeCallbacks(ticker)
    handler.removeCallbacks(bedtimeLock)
    try { unregisterReceiver(packageReceiver) } catch (_: Exception) {}
    try { unregisterReceiver(screenReceiver) } catch (_: Exception) {}
    PolicyStore.appendEvent(this, "protection_disabled", "Serviço de proteção desligado")
    super.onDestroy()
  }

  override fun onInterrupt() = Unit

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event == null) return
    val pkg = event.packageName?.toString() ?: return
    when (event.eventType) {
      AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
        if (pkg == packageName) ownAppForeground = event.className?.toString() != BlockActivity::class.java.name
        else if (pkg != "com.android.systemui") { foregroundPackage = pkg; ownAppForeground = false }
        if (isTamperScreen(pkg)) return
        evaluate(pkg)
      }
      AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> {
        // Conteúdo muda sem trocar de janela (ex.: rolar até o app em Configurações). Limitado a ~1,4x/s:
        // ler a árvore da tela a cada evento de rolagem gasta bateria à toa.
        if (pkg in SETTINGS_PACKAGES || pkg in INSTALLER_PACKAGES || pkg == PLAY_STORE) {
          val now = System.currentTimeMillis()
          if (now - lastContentCheck >= CONTENT_CHECK_MS) {
            lastContentCheck = now
            isTamperScreen(pkg)
          }
        }
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
    // Só a janela de escolha do DNS (tem a opção de nome do host); a tela de rede em si continua livre (trocar Wi-Fi).
    val dnsText = (text.contains("dns privado") || text.contains("private dns")) &&
      (text.contains("nome do host") || text.contains("hostname") || text.contains("host name"))
    val (type, reason) = when {
      mentionsUs && (pkg in INSTALLER_PACKAGES || TAMPER_WORDS.any { text.contains(it) }) ->
        (if (uninstallText || pkg in INSTALLER_PACKAGES) "uninstall_attempt" else "tamper_attempt") to getString(R.string.block_reason_tamper)
      policy.optBoolean("blockAppRemoval", false) && uninstallText ->
        "uninstall_attempt" to getString(R.string.block_reason_removal)
      policy.optBoolean("blockAppInstalls", false) && !PolicyStore.installUnlocked(policy) && pkg in INSTALLER_PACKAGES && installText ->
        "tamper_attempt" to getString(R.string.block_reason_install)
      // Filtro de conteúdo adulto no Android = DNS privado familiar; a criança não pode trocar sem o PIN.
      policy.optString("webFilter") == "adult" && pkg in SETTINGS_PACKAGES && dnsText ->
        "tamper_attempt" to getString(R.string.block_reason_dns)
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
      pkg == PLAY_STORE && policy.optBoolean("blockAppInstalls", false) && !PolicyStore.guardianUnlocked(this) && !PolicyStore.installUnlocked(policy) ->
        getString(R.string.block_reason_store)
      pauseActive(policy) -> pauseReason(policy)
      routineActive(policy) -> {
        if (scheduleBedtimeLock()) return
        getString(R.string.block_reason_routine)
      }
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
    refreshSystemPackages()
    return pkg == homePackage || pkg == keyboardPackage
  }

  /** Tela inicial e teclado mudam raramente: consulta no máximo 1x por minuto (evita IPC a cada troca de app). */
  private fun refreshSystemPackages() {
    val now = System.currentTimeMillis()
    if (now - systemPackagesAt < SYSTEM_PACKAGES_TTL_MS) return
    systemPackagesAt = now
    homePackage = packageManager.resolveActivity(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME), 0)?.activityInfo?.packageName
    keyboardPackage = android.provider.Settings.Secure.getString(contentResolver, android.provider.Settings.Secure.DEFAULT_INPUT_METHOD)
      ?.substringBefore("/")
  }

  /**
   * Agenda o travamento da tela se uma rotina com "travar a tela" estiver valendo. Mostra o aviso antes.
   * Retorna true se o travamento está agendado.
   */
  private fun scheduleBedtimeLock(): Boolean {
    if (!shouldLockForBedtime()) return false
    if (bedtimeLockPending) return true
    bedtimeLockPending = true
    showBlock(getString(R.string.block_reason_bedtime), getString(R.string.block_app_generic_device), packageName, force = true)
    handler.postDelayed(bedtimeLock, BEDTIME_LOCK_GRACE_MS)
    return true
  }

  private fun shouldLockForBedtime(): Boolean {
    val power = getSystemService(Context.POWER_SERVICE) as PowerManager
    if (!power.isInteractive || PolicyStore.guardianUnlocked(this)) return false
    val policy = PolicyStore.read(this) ?: return false
    if (!activeRoutines(policy).any { it.optBoolean("lockScreen", false) }) return false
    // Ligação, despertador e o próprio Família Segura (onde o responsável digita o PIN) nunca são interrompidos.
    val pkg = foregroundPackage
    if (ownAppForeground || (pkg != null && pkg in ALWAYS_ALLOWED)) return false
    val audio = getSystemService(Context.AUDIO_SERVICE) as AudioManager
    if (audio.mode == AudioManager.MODE_IN_CALL || audio.mode == AudioManager.MODE_IN_COMMUNICATION || audio.mode == AudioManager.MODE_RINGTONE) return false
    val dpm = getSystemService(DevicePolicyManager::class.java)
    val admin = ComponentName(this, FamiliaSeguraDeviceAdminReceiver::class.java)
    return dpm.isAdminActive(admin) && try {
      dpm.hasGrantedPolicy(admin, PolicyStore.USES_POLICY_FORCE_LOCK)
    } catch (_: SecurityException) { false }
  }

  private fun routineActive(policy: JSONObject): Boolean = activeRoutines(policy).isNotEmpty()

  /** "Pausar agora" do responsável: vale até o horário, mesmo sem internet (o horário já está na política). */
  private fun pauseActive(policy: JSONObject): Boolean = policy.optLong("pausedUntilEpochMs", 0L) > System.currentTimeMillis()

  private fun pauseReason(policy: JSONObject): String {
    val until = policy.optLong("pausedUntilEpochMs", 0L)
    // Mais de um dia = "até liberar" (o servidor usa 30 dias como rede de segurança).
    if (until - System.currentTimeMillis() > 24 * 3600_000L) return getString(R.string.block_reason_pause_open)
    val time = java.text.SimpleDateFormat("HH:mm", java.util.Locale("pt", "BR")).format(java.util.Date(until))
    return getString(R.string.block_reason_pause, time)
  }

  private fun activeRoutines(policy: JSONObject): List<JSONObject> {
    val active = mutableListOf<JSONObject>()
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
        if (dayMatches(routine.opt("days"), day) && minute >= start && minute < end) active.add(routine)
      } else {
        val previousDay = if (day == Calendar.SUNDAY) Calendar.SATURDAY else day - 1
        if ((minute >= start && dayMatches(routine.opt("days"), day)) ||
          (minute < end && dayMatches(routine.opt("days"), previousDay))) active.add(routine)
      }
    }
    return active
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
