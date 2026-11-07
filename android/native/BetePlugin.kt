package eu.usini.bete2.android.proto

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.net.Uri
import android.util.Base64
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Plugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.security.SecureRandom

@TauriPlugin
class BetePlugin(private val activity: Activity): Plugin(activity) {
    @Command fun driveLogin(invoke: Invoke) { (activity as MainActivity).driveAuthorization.authorize(invoke, true) }
    @Command fun driveToken(invoke: Invoke) { (activity as MainActivity).driveAuthorization.authorize(invoke, false) }
    @Command fun driveLogout(invoke: Invoke) { (activity as MainActivity).driveAuthorization.disconnect(invoke) }
    private val prefs = activity.getSharedPreferences("bete-local-launch", Activity.MODE_PRIVATE)
    private var blocks = mapOf<String,String>()
    private fun approvals() = JSONObject(prefs.getString("approvals", "{}") ?: "{}")
    private fun statusObject(): JSObject = JSObject().put("enabled", prefs.getBoolean("enabled", false)).put("approved", approvals()) as JSObject
    private fun foreground() = activity.hasWindowFocus() && !activity.isFinishing
    private fun saveApprovals(data: JSONObject) { prefs.edit().putString("approvals", data.toString()).apply() }
    @Command fun status(invoke: Invoke) { invoke.resolve(statusObject()) }
    @Command fun revokeAll(invoke: Invoke) { saveApprovals(JSONObject()); invoke.resolve(statusObject()) }
    @Command fun syncBlocks(invoke: Invoke) {
        val list=invoke.getArgs().optJSONArray("blocks")
        val next=mutableMapOf<String,String>()
        if(list!=null) for(i in 0 until minOf(list.length(),5000)) {
            val block=list.optJSONObject(i) ?: continue
            val id=block.optString("id"); val ref=block.optJSONObject("application")?.optString("reference") ?: continue
            if(id.length in 1..64 && Regex("^[a-f0-9]{64}$").matches(ref)) next[id]=ref
        }
        blocks=next
        val approved=approvals()
        for(id in approved.keys().asSequence().toList()) if(next[id]!=approved.optString(id)) approved.remove(id)
        saveApprovals(approved);invoke.resolve(statusObject())
    }
    @Command fun setEnabled(invoke: Invoke) {
        val enabled=invoke.getArgs().optBoolean("enabled")
        if(!enabled) { prefs.edit().putBoolean("enabled",false).apply(); invoke.resolve(statusObject()); return }
        activity.runOnUiThread {
            if(!foreground()) {invoke.reject("Ouvre Bête pour autoriser les applications.");return@runOnUiThread}
            AlertDialog.Builder(activity).setTitle("Autoriser le lancement local ?").setMessage("Chaque bloc devra ensuite être validé individuellement sur ce téléphone.")
                .setPositiveButton("Autoriser") {_,_-> prefs.edit().putBoolean("enabled",true).apply();invoke.resolve(statusObject())}
                .setNegativeButton("Annuler") {_,_->invoke.resolve(statusObject())}.setOnCancelListener {invoke.resolve(statusObject())}.show()
        }
    }
    @Command fun pickApp(invoke: Invoke) {
        activity.runOnUiThread {
            if(!foreground()){invoke.reject("Ouvre Bête pour choisir une application.");return@runOnUiThread}
            val pm=activity.packageManager
            val apps=pm.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER),0)
                .filter {it.activityInfo.packageName!=activity.packageName}.distinctBy {it.activityInfo.packageName}.sortedBy {it.loadLabel(pm).toString().lowercase()}
            if(apps.isEmpty()){invoke.reject("Aucune application disponible.");return@runOnUiThread}
            AlertDialog.Builder(activity).setTitle("Choisir une application")
                .setItems(apps.map {it.loadLabel(pm).toString()}.toTypedArray()) {_,index->
                    val info=apps[index]; val pkg=info.activityInfo.packageName
                    val ref=ByteArray(32).also {SecureRandom().nextBytes(it)}.joinToString("") {"%02x".format(it)}
                    prefs.edit().putString("target:"+ref,pkg).apply()
                    val result=JSObject().put("reference",ref).put("label",info.loadLabel(pm).toString().take(100)) as JSObject
                    try {
                        val icon=info.loadIcon(pm); val bitmap=Bitmap.createBitmap(96,96,Bitmap.Config.ARGB_8888)
                        icon.setBounds(0,0,96,96); icon.draw(Canvas(bitmap));val out=ByteArrayOutputStream();bitmap.compress(Bitmap.CompressFormat.PNG,100,out)
                        result.put("icon","data:image/png;base64,"+Base64.encodeToString(out.toByteArray(),Base64.NO_WRAP))
                    }catch(_:Exception){}
                    invoke.resolve(result)
                }.setNegativeButton("Annuler") {_,_->invoke.resolve()}.setOnCancelListener {invoke.resolve()}.show()
        }
    }
    @Command fun launchApp(invoke: Invoke) {
        val args=invoke.getArgs();val id=args.optString("blockId");val ref=args.optString("reference")
        activity.runOnUiThread {
            if(!foreground() || blocks[id]!=ref){invoke.reject("Bloc non présent ou application au second plan.");return@runOnUiThread}
            if(!prefs.getBoolean("enabled",false)){invoke.reject("Active d’abord l’ouverture d’applications dans le menu.");return@runOnUiThread}
            val pkg=prefs.getString("target:"+ref,null)
            if(pkg==null){invoke.reject("Choisis une application sur ce téléphone pour ce bloc.");return@runOnUiThread}
            val launch=activity.packageManager.getLaunchIntentForPackage(pkg)
            if(launch==null){invoke.reject("Cette application n’est plus disponible.");return@runOnUiThread}
            if(approvals().optString(id)!=ref) {
                val name=try {activity.packageManager.getApplicationLabel(activity.packageManager.getApplicationInfo(pkg,0)).toString()}catch(_:Exception){pkg}
                AlertDialog.Builder(activity).setTitle("Autoriser ce bloc ?").setMessage("Ce bloc pourra ouvrir « $name » sur ce téléphone. Valider ne lance pas l’application.")
                    .setPositiveButton("Autoriser") {_,_->
                        if(blocks[id]==ref){val a=approvals();a.put(id,ref);saveApprovals(a)}
                        invoke.resolve(JSObject().put("opened",false) as JSObject)
                    }.setNegativeButton("Annuler") {_,_->invoke.resolve(JSObject().put("opened",false) as JSObject)}.setOnCancelListener {invoke.resolve(JSObject().put("opened",false) as JSObject)}.show()
                return@runOnUiThread
            }
            try{activity.startActivity(launch);invoke.resolve(JSObject().put("opened",true) as JSObject)}catch(_:Exception){invoke.reject("Impossible d’ouvrir cette application.")}
        }
    }
    @Command fun openBrowser(invoke: Invoke) {
        val uri=Uri.parse(invoke.getArgs().optString("url"))
        if(uri.scheme !in listOf("https","http") || uri.host.isNullOrBlank() || uri.userInfo!=null){invoke.reject("Seuls les liens web sont autorisés.");return}
        activity.runOnUiThread {try{activity.startActivity(Intent(Intent.ACTION_VIEW,uri));invoke.resolve()}catch(_:Exception){invoke.reject("Aucune application pour ce lien.")}}
    }
}
