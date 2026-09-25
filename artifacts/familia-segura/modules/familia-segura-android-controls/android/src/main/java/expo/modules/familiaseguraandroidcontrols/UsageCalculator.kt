package expo.modules.familiaseguraandroidcontrols

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import java.util.Calendar

/**
 * Minutos em primeiro plano HOJE por pacote, calculados a partir dos eventos (abrir/fechar tela).
 * `queryAndAggregateUsageStats` agrega baldes que podem começar antes da meia-noite e superestimar o uso.
 * Cache curto para o serviço poder reavaliar a cada 30 s sem custo alto.
 */
internal object UsageCalculator {
  private const val RESUMED = 1 // ACTIVITY_RESUMED / MOVE_TO_FOREGROUND
  private const val PAUSED = 2 // ACTIVITY_PAUSED / MOVE_TO_BACKGROUND
  private const val SCREEN_NON_INTERACTIVE = 16
  private const val DEVICE_SHUTDOWN = 26
  private const val CACHE_MS = 15_000L

  @Volatile private var cachedAt = 0L
  @Volatile private var cached: Map<String, Long> = emptyMap()

  fun todayMinutes(context: Context): Map<String, Long> {
    val now = System.currentTimeMillis()
    if (now - cachedAt < CACHE_MS) return cached
    val start = Calendar.getInstance().apply {
      set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
    }.timeInMillis
    val manager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val events = manager.queryEvents(start, now)
    val openSince = HashMap<String, Long>()
    val closedOnce = HashSet<String>()
    val totals = HashMap<String, Long>()
    val event = UsageEvents.Event()
    fun close(pkg: String, at: Long) {
      val since = openSince.remove(pkg) ?: if (pkg !in closedOnce) start else return // aberto antes da meia-noite
      totals[pkg] = (totals[pkg] ?: 0L) + (at - since).coerceAtLeast(0L)
      closedOnce.add(pkg)
    }
    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      val pkg = event.packageName ?: continue
      when (event.eventType) {
        RESUMED -> openSince.putIfAbsent(pkg, event.timeStamp)
        PAUSED -> close(pkg, event.timeStamp)
        SCREEN_NON_INTERACTIVE, DEVICE_SHUTDOWN -> openSince.keys.toList().forEach { close(it, event.timeStamp) }
      }
    }
    openSince.forEach { (pkg, since) -> totals[pkg] = (totals[pkg] ?: 0L) + (now - since).coerceAtLeast(0L) }
    val minutes = totals.mapValues { (_, ms) -> ms / 60_000L }
    cached = minutes
    cachedAt = now
    return minutes
  }

  fun minutes(context: Context, packageName: String): Long = todayMinutes(context)[packageName] ?: 0L
}
