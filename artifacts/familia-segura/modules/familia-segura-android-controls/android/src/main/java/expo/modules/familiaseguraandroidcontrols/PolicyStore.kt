package expo.modules.familiaseguraandroidcontrols

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Estado local lido pelo serviço de acessibilidade mesmo com o JavaScript parado.
 * - policies: regras recebidas do servidor com prazo de validade (lease)
 * - guardianUnlockUntil: janela liberada pelo PIN do responsável
 * - localPending: apps instalados que ainda não foram avaliados pelo servidor
 * - events: fila de eventos (adulteração, instalação...) enviada pelo JS ao servidor
 */
internal object PolicyStore {
  private const val PREFS = "familia_segura_policies"
  private const val KEY = "policies"
  private const val KEY_UNLOCK = "guardian_unlock_until"
  private const val KEY_LOCAL_PENDING = "local_pending"
  private const val KEY_EVENTS = "events"
  private const val MAX_EVENTS = 100

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun save(context: Context, policy: JSONObject) {
    prefs(context).edit().putString(KEY, policy.toString()).apply()
    // Só sai da quarentena local o app que o servidor já recebeu no inventário (ele passa a decidir por
    // pendingPackages/blockedPackages). Se o envio do inventário falhar, o app continua bloqueado.
    val synced = policy.optJSONArray("inventorySyncedPackages") ?: return
    val known = (0 until synced.length()).map { synced.optString(it) }.toSet()
    val remaining = localPending(context) - known
    prefs(context).edit().putString(KEY_LOCAL_PENDING, JSONArray(remaining.toList()).toString()).apply()
  }

  fun read(context: Context): JSONObject? = try {
    prefs(context).getString(KEY, null)
      ?.let { JSONObject(it) }
      ?.takeIf { it.optLong("validUntilEpochMs", 0L) > System.currentTimeMillis() }
  } catch (_: Exception) { null }

  fun leaseActive(context: Context): Boolean = read(context) != null

  /**
   * Política sem checar o prazo offline. Usada só pela proteção contra desligar/desinstalar:
   * ela vale enquanto o aparelho estiver pareado (o PIN funciona offline); revogar ou desvincular zera tudo.
   */
  fun readIgnoringLease(context: Context): JSONObject? = try {
    prefs(context).getString(KEY, null)?.let { JSONObject(it) }
  } catch (_: Exception) { null }

  fun apps(policy: JSONObject?): JSONArray = policy?.optJSONArray("apps") ?: JSONArray()
  fun routines(policy: JSONObject?): JSONArray = policy?.optJSONArray("routines") ?: JSONArray()

  fun packageSet(policy: JSONObject?, key: String): Set<String> {
    val array = policy?.optJSONArray(key) ?: return emptySet()
    return (0 until array.length()).mapNotNull { array.optString(it).takeIf(String::isNotBlank) }.toSet()
  }

  /** Anti-desinstalação só vale com PIN definido: sem PIN o responsável não teria como destravar. */
  fun tamperProtectionEnabled(policy: JSONObject?): Boolean =
    policy?.optBoolean("tamperProtection", false) == true

  fun setGuardianUnlock(context: Context, untilEpochMs: Long) {
    prefs(context).edit().putLong(KEY_UNLOCK, untilEpochMs).apply()
  }

  fun guardianUnlocked(context: Context): Boolean =
    prefs(context).getLong(KEY_UNLOCK, 0L) > System.currentTimeMillis()

  fun guardianUnlockUntil(context: Context): Long = prefs(context).getLong(KEY_UNLOCK, 0L)

  fun addLocalPending(context: Context, packageName: String) {
    val current = localPending(context).toMutableSet()
    current.add(packageName)
    prefs(context).edit().putString(KEY_LOCAL_PENDING, JSONArray(current.toList()).toString()).apply()
  }

  fun removeLocalPending(context: Context, packageName: String) {
    val current = localPending(context).toMutableSet()
    if (current.remove(packageName)) {
      prefs(context).edit().putString(KEY_LOCAL_PENDING, JSONArray(current.toList()).toString()).apply()
    }
  }

  fun localPending(context: Context): Set<String> = try {
    val raw = prefs(context).getString(KEY_LOCAL_PENDING, null) ?: return emptySet()
    val array = JSONArray(raw)
    (0 until array.length()).map { array.optString(it) }.filter(String::isNotBlank).toSet()
  } catch (_: Exception) { emptySet() }

  @Synchronized
  fun appendEvent(context: Context, type: String, detail: String? = null) {
    val events = try { JSONArray(prefs(context).getString(KEY_EVENTS, "[]")) } catch (_: Exception) { JSONArray() }
    // Evita inundar a fila com o mesmo evento repetido em sequência (ex.: várias tentativas seguidas).
    val last = if (events.length() > 0) events.optJSONObject(events.length() - 1) else null
    val now = System.currentTimeMillis()
    if (last != null && last.optString("type") == type && last.optString("detail") == (detail ?: "") && now - last.optLong("at") < 60_000) return
    events.put(JSONObject().put("type", type).put("detail", detail ?: "").put("at", now))
    val trimmed = JSONArray()
    val start = maxOf(0, events.length() - MAX_EVENTS)
    for (i in start until events.length()) trimmed.put(events.get(i))
    prefs(context).edit().putString(KEY_EVENTS, trimmed.toString()).apply()
  }

  @Synchronized
  fun drainEvents(context: Context): JSONArray {
    val raw = prefs(context).getString(KEY_EVENTS, "[]")
    prefs(context).edit().putString(KEY_EVENTS, "[]").apply()
    return try { JSONArray(raw) } catch (_: Exception) { JSONArray() }
  }
}
