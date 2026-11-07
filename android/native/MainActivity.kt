package eu.usini.bete2.android.proto

import android.os.Bundle
import android.view.View
import android.graphics.Color
import androidx.activity.enableEdgeToEdge
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  val driveAuthorization = DriveAuthorization(this)
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    val content = findViewById<View>(android.R.id.content)
    content.setBackgroundColor(Color.rgb(11, 14, 17))
    // Reserve native space outside the WebView, including landscape cutouts.
    // Keep IME insets intact so Android can still resize for the keyboard.
    val systemTypes = WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
    ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
      val safe = insets.getInsets(systemTypes)
      view.setPadding(safe.left, safe.top, safe.right, safe.bottom)
      WindowInsetsCompat.Builder(insets).setInsets(systemTypes, Insets.NONE).build()
    }
    content.post { ViewCompat.requestApplyInsets(content) }
  }
}
