package expo.modules.familiaseguraandroidcontrols

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

internal object PolicyStore {
  private const val PREFS = "familia_segura_policies"
  private const val KEY = "policies"

  fun save(context: Context, policy: JSONObject) {
    // Store only valid JSON; the service can safely read this while JS is offline.
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putString(KEY, policy.toString()).apply()
  }

  fun read(context: Context): JSONObject? = try {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)
      ?.let { JSONObject(it) }
      ?.takeIf { it.optLong("validUntilEpochMs", 0L) > System.currentTimeMillis() }
  } catch (_: Exception) { null }

  fun leaseActive(context: Context): Boolean = read(context) != null

  fun apps(policy: JSONObject?): JSONArray = policy?.optJSONArray("apps") ?: JSONArray()
  fun routines(policy: JSONObject?): JSONArray = policy?.optJSONArray("routines") ?: JSONArray()
}