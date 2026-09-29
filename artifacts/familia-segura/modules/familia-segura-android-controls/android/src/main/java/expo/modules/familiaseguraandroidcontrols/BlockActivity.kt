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
 * Segue a marca (docs/DESIGN.md): fundo verde de bebê, texto tinta, ação lavanda, sem quinas.
 */
class BlockActivity : Activity() {
  companion object {
    const val EXTRA_REASON = "reason"
    const val EXTRA_APP_NAME = "appName"
  }

  /** Paleta da marca nos dois temas. Só tons "-deep" carregam texto (contraste AA medido). */
  private data class Palette(
    val background: Int,
    val surface: Int,
    val border: Int,
    val ink: Int,
    val inkMuted: Int,
    val primary: Int,
    val onPrimary: Int,
    val accent: Int,
  )

  private val palette: Palette by lazy {
    val night = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
    if (night) {
      Palette(
        background = Color.parseColor("#16121F"), surface = Color.parseColor("#201A2C"), border = Color.parseColor("#30283F"),
        ink = Color.parseColor("#EDE8F7"), inkMuted = Color.parseColor("#A99FBF"),
        primary = Color.parseColor("#B9A2FB"), onPrimary = Color.parseColor("#1B1030"), accent = Color.parseColor("#FF8FA9"),
      )
    } else {
      Palette(
        background = Color.parseColor("#EFF8F2"), surface = Color.parseColor("#FAFDFB"), border = Color.parseColor("#D8E7DD"),
        ink = Color.parseColor("#2E2545"), inkMuted = Color.parseColor("#675C80"),
        primary = Color.parseColor("#6D3FD1"), onPrimary = Color.WHITE, accent = Color.parseColor("#C2185B"),
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
      background = rounded(palette.primary, 16f)
    } else {
      setTextColor(palette.primary)
      background = rounded(Color.TRANSPARENT, 16f)
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
      background = rounded(p.surface, 28f, p.border)
      setPadding(dp(24f), dp(28f), dp(24f), dp(20f))
    }
    card.addView(ImageView(this).apply {
      setImageResource(R.drawable.fs_brand_mark)
      contentDescription = null
      importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
    }, LinearLayout.LayoutParams(dp(96f), dp(96f)))
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
