package expo.modules.familiaseguraandroidcontrols

import android.app.Activity
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Tela de pausa mostrada quando um app, uma rotina ou uma configuração está bloqueada.
 * Segue a marca (docs/DESIGN.md): fundo creme do logo, texto azul-marinho, ação azul do escudo.
 */
class BlockActivity : Activity() {
  companion object {
    const val EXTRA_REASON = "reason"
    const val EXTRA_APP_NAME = "appName"
  }

  /** Paleta da marca nos dois temas (contraste AA medido). No escuro o emblema fica sobre placa creme. */
  private data class Palette(
    val background: Int,
    val surface: Int,
    val border: Int,
    val ink: Int,
    val inkMuted: Int,
    val primary: Int,
    val onPrimary: Int,
    val accent: Int,
    val plate: Int,
  )

  private val palette: Palette by lazy {
    val night = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
    if (night) {
      Palette(
        background = Color.parseColor("#0C1A2E"), surface = Color.parseColor("#13243D"), border = Color.parseColor("#223A5C"),
        ink = Color.parseColor("#EAF1F9"), inkMuted = Color.parseColor("#9FB1C8"),
        primary = Color.parseColor("#7DB6EC"), onPrimary = Color.parseColor("#0A1B30"), accent = Color.parseColor("#F6A46E"),
        plate = Color.parseColor("#FCF8F0"),
      )
    } else {
      Palette(
        background = Color.parseColor("#FCF8F0"), surface = Color.WHITE, border = Color.parseColor("#E9E1D3"),
        ink = Color.parseColor("#142B4D"), inkMuted = Color.parseColor("#56657A"),
        primary = Color.parseColor("#1C5A96"), onPrimary = Color.WHITE, accent = Color.parseColor("#A14912"),
        plate = Color.parseColor("#FCF8F0"),
      )
    }
  }

  override fun onCreate(state: Bundle?) {
    super.onCreate(state)
    render()
  }

  override fun onNewIntent(nextIntent: Intent?) {
    super.onNewIntent(nextIntent)
    if (nextIntent != null) setIntent(nextIntent)
    render()
  }

  @Deprecated("Android back navigation is intentionally redirected to Home while a block is active.")
  override fun onBackPressed() {
    goHome()
  }

  private fun goHome() {
    startActivity(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    finish()
  }

  private fun dp(value: Float): Int = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, resources.displayMetrics).toInt()

  private fun rounded(fill: Int, radiusDp: Float, stroke: Int? = null): GradientDrawable = GradientDrawable().apply {
    setColor(fill)
    cornerRadius = dp(radiusDp).toFloat()
    stroke?.let { setStroke(dp(1f), it) }
  }

  private fun text(value: String, sizeSp: Float, color: Int, bold: Boolean = false, topDp: Float = 0f) = TextView(this).apply {
    text = value
    textSize = sizeSp
    setTextColor(color)
    gravity = Gravity.CENTER
    typeface = Typeface.create(if (bold) "sans-serif-medium" else "sans-serif", Typeface.NORMAL)
    setLineSpacing(0f, 1.2f)
    setPadding(0, dp(topDp), 0, 0)
  }

  private fun button(label: String, primary: Boolean, onClick: () -> Unit) = TextView(this).apply {
    text = label
    textSize = 16f
    gravity = Gravity.CENTER
    typeface = Typeface.create("sans-serif-medium", Typeface.BOLD)
    minHeight = dp(54f)
    setPadding(dp(18f), dp(14f), dp(18f), dp(14f))
    isClickable = true
    isFocusable = true
    if (primary) {
      setTextColor(palette.onPrimary)
      background = rounded(palette.primary, 14f)
    } else {
      setTextColor(palette.primary)
      background = rounded(Color.TRANSPARENT, 14f)
    }
    setOnClickListener { onClick() }
  }

  private fun render() {
    val p = palette
    window.statusBarColor = p.background
    window.navigationBarColor = p.background

    val card = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      background = rounded(p.surface, 24f, p.border)
      setPadding(dp(24f), dp(28f), dp(24f), dp(20f))
    }
    card.addView(ImageView(this).apply {
      setImageResource(R.drawable.fs_brand_emblem)
      adjustViewBounds = true
      background = rounded(p.plate, 22f)
      setPadding(dp(8f), dp(8f), dp(8f), dp(8f))
      contentDescription = null
      importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
    }, LinearLayout.LayoutParams(dp(104f), dp(112f)))
    card.addView(text(getString(R.string.block_title), 24f, p.ink, bold = true, topDp = 14f))
    intent.getStringExtra(EXTRA_APP_NAME)?.takeIf { it.isNotBlank() }?.let {
      card.addView(text(it.uppercase(), 12f, p.accent, bold = true, topDp = 6f).apply { letterSpacing = 0.14f })
    }
    card.addView(text(intent.getStringExtra(EXTRA_REASON).orEmpty(), 16f, p.inkMuted, topDp = 14f))

    val actions = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(0, dp(22f), 0, 0)
    }
    val full = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
    actions.addView(button(getString(R.string.block_return_home), primary = true) { goHome() }, full)
    actions.addView(button(getString(R.string.block_request_time), primary = false) {
      startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse("familia-segura://")))
      finish()
    }, LinearLayout.LayoutParams(full).apply { topMargin = dp(6f) })
    card.addView(actions, full)

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(p.background)
      setPadding(dp(20f), dp(24f), dp(20f), dp(24f))
    }
    root.addView(card, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
    setContentView(root)
  }
}
