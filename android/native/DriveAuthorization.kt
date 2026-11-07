package eu.usini.bete2.android.proto

import android.app.Activity
import android.os.Handler
import android.os.Looper
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.AuthorizationResult
import com.google.android.gms.auth.api.identity.ClearTokenRequest
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.Scope

// Google Play Services owns account credentials. Bête retains access tokens in memory only.
class DriveAuthorization(private val activity: MainActivity) {
    private val scope = "https://www.googleapis.com/auth/drive.appdata"
    private val prefs by lazy { activity.getSharedPreferences("bete-drive", Activity.MODE_PRIVATE) }
    private val client by lazy { Identity.getAuthorizationClient(activity) }
    private val handler = Handler(Looper.getMainLooper())
    private var pending: Invoke? = null
    private var lastToken: String? = null
    private var waitingResolution = false
    private val launcher = activity.registerForActivityResult(ActivityResultContracts.StartIntentSenderForResult()) { result ->
        waitingResolution = false
        val invoke = pending
        if (invoke != null) {
            if (result.resultCode != Activity.RESULT_OK) finishError(invoke, "Connexion Google annulée.")
            else try { finishToken(invoke, client.getAuthorizationResultFromIntent(result.data)) }
            catch (error: ApiException) { finishError(invoke, "Autorisation Google impossible (code ${error.statusCode}).") }
        }
    }
    fun authorize(invoke: Invoke, interactive: Boolean) {
        activity.runOnUiThread {
            if (waitingResolution) { invoke.reject("Termine ou ferme la fenêtre Google déjà ouverte."); return@runOnUiThread }
            if (pending != null) { invoke.reject("Une connexion Google est déjà en cours."); return@runOnUiThread }
            if (!interactive && !prefs.getBoolean("linked", false)) { invoke.resolve(); return@runOnUiThread }
            if (interactive && !activity.hasWindowFocus()) { invoke.reject("Ouvre Bête pour te connecter à Google."); return@runOnUiThread }
            pending = invoke
            handler.postDelayed({ if (pending === invoke) finishError(invoke, "Google ne répond pas. Le tableau reste disponible localement.") }, if (interactive) 180000L else 20000L)
            val request = AuthorizationRequest.builder().setRequestedScopes(listOf(Scope(scope))).build()
            val start = {
                client.authorize(request).addOnSuccessListener { result ->
                    if (pending === invoke) {
                        if (result.hasResolution()) {
                            if (interactive && result.pendingIntent != null) {
                                try { waitingResolution = true; launcher.launch(IntentSenderRequest.Builder(result.pendingIntent!!.intentSender).build()) }
                                catch (_: Exception) { waitingResolution = false; finishError(invoke, "Impossible d’ouvrir la connexion Google.") }
                            } else { pending = null; invoke.resolve() }
                        } else finishToken(invoke, result)
                    }
                }.addOnFailureListener { error ->
                    val code = (error as? ApiException)?.statusCode
                    finishError(invoke, if (code != null) "Connexion Google indisponible (code $code)." else "Connexion Google indisponible. Vérifie Internet et Google Play Services.")
                }
                Unit
            }
            // A rejected/expired token must never be returned by the SDK cache again.
            val previous = lastToken
            lastToken = null
            if (previous != null) client.clearToken(ClearTokenRequest.builder().setToken(previous).build()).addOnCompleteListener { if (pending === invoke) start() }
            else start()
        }
    }
    private fun finishToken(invoke: Invoke, result: AuthorizationResult) {
        if (pending !== invoke) return
        val token = result.accessToken
        if (token.isNullOrBlank() || !result.grantedScopes.contains(scope)) { finishError(invoke, "L’accès au dossier privé Bête n’a pas été accordé."); return }
        lastToken = token
        prefs.edit().putBoolean("linked", true).apply()
        pending = null
        invoke.resolve(JSObject().put("access_token", token).put("expires_in", 3300) as JSObject)
    }
    private fun finishError(invoke: Invoke, message: String) {
        if (pending !== invoke) return
        pending = null
        invoke.reject(message)
    }
    fun disconnect(invoke: Invoke) {
        activity.runOnUiThread {
            pending?.reject("Connexion Google annulée."); pending = null
            prefs.edit().putBoolean("linked", false).apply()
            lastToken?.let { client.clearToken(ClearTokenRequest.builder().setToken(it).build()) }
            lastToken = null
            invoke.resolve()
        }
    }
}
