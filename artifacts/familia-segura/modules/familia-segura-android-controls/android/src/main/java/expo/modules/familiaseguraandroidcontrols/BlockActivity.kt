package expo.modules.familiaseguraandroidcontrols

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class BlockActivity : Activity() {
  companion object {
    const val EXTRA_REASON = "reason"
    const val EXTRA_APP_NAME = "appName"
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

  private fun render() {
    val padding = (24 * resources.displayMetrics.density).toInt()
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER
      setPadding(padding, padding, padding, padding); setBackgroundColor(Color.WHITE)
    }
    root.addView(TextView(this).apply {
      text = getString(R.string.block_title); textSize = 26f; gravity = Gravity.CENTER
    })
    root.addView(TextView(this).apply {
      text = intent.getStringExtra(EXTRA_APP_NAME).orEmpty(); textSize = 20f
      gravity = Gravity.CENTER; setPadding(0, padding / 3, 0, 0)
    })
    root.addView(TextView(this).apply {
      text = intent.getStringExtra(EXTRA_REASON).orEmpty(); textSize = 17f
      gravity = Gravity.CENTER; setPadding(0, padding / 2, 0, padding)
    })
    root.addView(Button(this).apply {
      text = getString(R.string.block_return_home)
      setOnClickListener { goHome() }
    })
    root.addView(Button(this).apply {
      text = getString(R.string.block_request_time)
      setOnClickListener {
        startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse("familia-segura://")))
        finish()
      }
    })
    setContentView(root)
  }
}