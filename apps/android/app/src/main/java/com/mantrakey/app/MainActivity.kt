package com.mantrakey.app

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import android.view.autofill.AutofillManager
import android.view.inputmethod.InputMethodManager
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.JsPromptResult
import android.webkit.JsResult
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import androidx.webkit.WebViewAssetLoader
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicBoolean

/**
 * 密诀 MantraKey - 主门户与自愈交互宿主 (MainActivity)
 *
 * 承载 Obsidian 暗黑主控台 Web 资产，向 WebView 注入双向安全 JavaScript Bridge，
 * 支持开发机直连 APK 下载、在线更新包断点续传与 SHA-256 防篡改校验。
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    // WebView 文件选择器回调引用 (支持反馈悬浮窗上传本地截图/录屏附件)
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    // 注册系统文件选择器 Activity 结果监听器
    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val cb = filePathCallback
        filePathCallback = null
        if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            val intent = result.data
            val urisList = mutableListOf<Uri>()

            // 1. 优先提取 clipData 多选结果
            intent?.clipData?.let { clip ->
                for (i in 0 until clip.itemCount) {
                    val u = clip.getItemAt(i).uri
                    if (u != null) urisList.add(u)
                }
            }

            // 2. 提取 single data 结果
            if (urisList.isEmpty() && intent?.data != null) {
                urisList.add(intent.data!!)
            }

            // 3. Fallback: 系统 FileChooserParams.parseResult 解析
            if (urisList.isEmpty()) {
                val parsed = WebChromeClient.FileChooserParams.parseResult(result.resultCode, intent)
                if (parsed != null) {
                    urisList.addAll(parsed)
                }
            }

            // 赋予读取权限，保障 WebView Chromium 内核在读取 content:// 时不发生权限违例
            urisList.forEach { uri ->
                try {
                    grantUriPermission(packageName, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
                } catch (_: Exception) {}
            }

            Log.d("MantraWeb", "FileChooser 返回 ${urisList.size} 个有效 URI: $urisList")
            cb?.onReceiveValue(if (urisList.isNotEmpty()) urisList.toTypedArray() else null)
        } else {
            Log.d("MantraWeb", "FileChooser 取消或未选择文件 (resultCode=${result.resultCode})")
            cb?.onReceiveValue(null)
        }
    }

    companion object {
        private const val TAG = "MantraKeyMain"

        // 全局待安装 APK 引用 (权限授予切回时自动免重下继续安装)
        @Volatile
        private var pendingInstallApk: File? = null

        // 标记是否正处于前往系统设置授予安装权限流程中
        @Volatile
        private var waitingForInstallPermission: Boolean = false

        // 标记是否有进行中的下载任务
        private val isDownloading = AtomicBoolean(false)

        // 最新下载进度快照
        @Volatile
        private var lastPercent: Int = 0

        @Volatile
        private var lastReceived: Long = 0L

        @Volatile
        private var lastTotal: Long = 0L

        @Volatile
        private var lastStatus: String = "idle"

        @Volatile
        private var lastMessage: String = ""

        @Volatile
        private var lastChannel: String = ""

        /**
         * 将候选下载 URL 格式化为直观易读的渠道标签
         */
        @JvmStatic
        fun formatDownloadChannel(url: String?): String {
            if (url.isNullOrBlank()) return "未知渠道"
            return when {
                url.contains("ghproxy.net") -> "ghproxy.net 加速镜像"
                url.contains("gh-proxy.com") -> "gh-proxy.com 加速镜像"
                url.contains("mirror.ghproxy.com") -> "mirror.ghproxy.com 加速镜像"
                url.contains("github.com") -> "GitHub 官方直连"
                url.contains("trycloudflare.com") || url.contains("cpolar") -> "内网穿透直连通道"
                url.contains("192.168.") || url.contains("10.") || url.contains("127.0.0.1") -> "开发机局域网直连"
                else -> try {
                    URL(url).host.ifBlank { "云端高速节点" }
                } catch (_: Exception) {
                    "云端节点"
                }
            }
        }

        /**
         * 计算本地文件的 SHA-256 校验和 (小写 64 位十六进制)
         */
        @JvmStatic
        fun calculateFileSha256(file: File?): String {
            if (file == null || !file.exists() || !file.isFile) {
                return ""
            }
            return try {
                FileInputStream(file).use { input ->
                    val digest = MessageDigest.getInstance("SHA-256")
                    val buffer = ByteArray(8192)
                    var read: Int
                    while (input.read(buffer).also { read = it } > 0) {
                        digest.update(buffer, 0, read)
                    }
                    val hash = digest.digest()
                    val sb = StringBuilder()
                    for (b in hash) {
                        sb.append(String.format("%02x", b))
                    }
                    sb.toString()
                }
            } catch (e: Exception) {
                Log.e(TAG, "计算文件 SHA-256 异常: ${file.absolutePath}", e)
                ""
            }
        }

        /**
         * 安全清理缓存目录下的旧更新安装包
         */
        @JvmStatic
        fun cleanUpdateApkCache(context: Context?, forceAll: Boolean = false) {
            if (context == null) return
            Thread {
                try {
                    val updatesDir = File(context.cacheDir, "updates")
                    if (updatesDir.exists() && updatesDir.isDirectory) {
                        val files = updatesDir.listFiles() ?: return@Thread
                        val now = System.currentTimeMillis()
                        for (f in files) {
                            if (!f.isFile) continue
                            val name = f.name.lowercase()
                            if (!forceAll) {
                                if (pendingInstallApk != null && f.absolutePath == pendingInstallApk?.absolutePath) {
                                    continue
                                }
                                if (name.endsWith(".download")) {
                                    val ageMs = now - f.lastModified()
                                    if (isDownloading.get() || ageMs < 24 * 60 * 60 * 1000L) {
                                        continue
                                    }
                                }
                            }
                            if (name.endsWith(".apk") || name.endsWith(".download") || name.endsWith(".tmp")) {
                                f.delete()
                            }
                        }
                    }
                } catch (ignored: Exception) {
                }
            }.start()
        }
    }

    /**
     * 原生交互桥梁 (@JavascriptInterface)
     */
    inner class MantraNativeBridge(private val context: Context) {

        @JavascriptInterface
        fun isNativeApp(): Boolean {
            return true
        }

        /**
         * 检测系统自动填充服务是否已由密诀激活接管
         */
        @JavascriptInterface
        fun isAutofillEnabled(): Boolean {
            return try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val autofillManager = context.getSystemService(AutofillManager::class.java)
                    autofillManager != null && autofillManager.hasEnabledAutofillServices()
                } else {
                    false
                }
            } catch (e: Exception) {
                Log.w(TAG, "检测自动填充服务状态失败: ${e.message}")
                false
            }
        }

        /**
         * 检测辅助穿透输入法是否已在系统中勾选激活
         */
        @JavascriptInterface
        fun isImeEnabled(): Boolean {
            return try {
                val imeManager = context.getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
                val enabledList = imeManager?.enabledInputMethodList ?: return false
                enabledList.any { it.packageName == context.packageName }
            } catch (e: Exception) {
                Log.w(TAG, "检测输入法激活状态失败: ${e.message}")
                false
            }
        }

        /**
         * 首次启动状态感知
         */
        @JavascriptInterface
        fun isFirstLaunch(): Boolean {
            val sp = context.getSharedPreferences("mantra_prefs", Context.MODE_PRIVATE)
            return sp.getBoolean("is_first_launch", true)
        }

        /**
         * 标记首次启动引导已完成
         */
        @JavascriptInterface
        fun setFirstLaunchCompleted() {
            val sp = context.getSharedPreferences("mantra_prefs", Context.MODE_PRIVATE)
            sp.edit().putBoolean("is_first_launch", false).apply()
        }

        /**
         * 打开系统自动填充服务设置页
         */
        @JavascriptInterface
        fun openAutofillSettings() {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val intent = Intent(Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE)
                    intent.data = Uri.parse("package:${context.packageName}")
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(intent)
                    return
                }
            } catch (e: Exception) {
                Log.w(TAG, "无法直接跳转应用自动填充服务设置，回退系统全局设置: ${e.message}")
            }

            try {
                val fallbackIntent = Intent(Settings.ACTION_SETTINGS)
                fallbackIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(fallbackIntent)
            } catch (e: Exception) {
                Log.e(TAG, "打开设置失败", e)
            }
        }

        /**
         * 打开系统输入法管理设置页
         */
        @JavascriptInterface
        fun openImeSettings() {
            try {
                val intent = Intent(Settings.ACTION_INPUT_METHOD_SETTINGS)
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
            } catch (e: Exception) {
                Log.e(TAG, "打开输入法设置失败", e)
            }
        }

        /**
         * 检测当前是否具备安装未知来源应用权限 (Android 8.0+)
         */
        @JavascriptInterface
        fun canRequestPackageInstalls(): Boolean {
            return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.packageManager.canRequestPackageInstalls()
            } else {
                true
            }
        }

        /**
         * 引导跳转至系统未知来源安装权限设置页面
         */
        @JavascriptInterface
        fun openInstallPermissionSettings() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                try {
                    waitingForInstallPermission = true
                    val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES)
                    intent.data = Uri.parse("package:${context.packageName}")
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(intent)
                } catch (e: Exception) {
                    Log.e(TAG, "打开未知应用安装权限失败", e)
                }
            }
        }

        /**
         * 检查指定版本的安装包是否已经在本地完整就绪
         */
        @JavascriptInterface
        fun hasDownloadedApk(targetVersion: String?): Boolean {
            val verStr = if (!targetVersion.isNullOrBlank()) {
                targetVersion.trim().replace("v", "")
            } else {
                "latest"
            }
            val updatesDir = File(context.cacheDir, "updates")
            val targetFile = File(updatesDir, "mantra-key-v$verStr.apk")
            return targetFile.exists() && targetFile.length() > 1024 * 1024
        }

        /**
         * 直接调起已就绪的安装包
         */
        @JavascriptInterface
        fun installDownloadedApk() {
            val apk = pendingInstallApk
            if (apk != null && apk.exists() && apk.length() > 0) {
                runOnUiThread { triggerApkInstall(apk) }
            }
        }

        /**
         * 主动清理安装包缓存
         */
        @JavascriptInterface
        fun cleanApkCache(): Boolean {
            cleanUpdateApkCache(context, true)
            return true
        }

        /**
         * 取消当前进行中的下载任务
         */
        @JavascriptInterface
        fun cancelDownload() {
            isDownloading.set(false)
            lastStatus = "cancelled"
            notifyJsUpdateStatus("cancelled", 0, 0, 0, "用户已取消下载")
        }

        @JavascriptInterface
        fun downloadAndInstallApk(downloadUrl: String?, targetVersion: String?) {
            downloadAndInstallApkWithSha256(downloadUrl, targetVersion, null)
        }

        @JavascriptInterface
        fun downloadAndInstallApk(downloadUrl: String?, targetVersion: String?, expectedSha256: String?) {
            downloadAndInstallApkWithSha256(downloadUrl, targetVersion, expectedSha256)
        }

        /**
         * 流式下载 APK 并唤起系统 PackageInstaller 安装
         */
        @JavascriptInterface
        fun downloadAndInstallApkWithSha256(
            downloadUrl: String?,
            targetVersion: String?,
            expectedSha256: String?
        ) {
            if (downloadUrl.isNullOrBlank()) {
                notifyJsUpdateStatus("error", 0, 0, 0, "下载地址为空")
                return
            }

            val updatesDir = File(context.cacheDir, "updates")
            if (!updatesDir.exists()) {
                updatesDir.mkdirs()
            }

            val verStr = if (!targetVersion.isNullOrBlank()) {
                targetVersion.trim().replace("v", "")
            } else {
                "latest"
            }
            val targetFile = File(updatesDir, "mantra-key-v$verStr.apk")

            // 1. 若本地已有完整安装包，验证哈希后直接调起安装
            if (targetFile.exists() && targetFile.length() > 1024 * 1024 && !isDownloading.get()) {
                var isValid = true
                if (!expectedSha256.isNullOrBlank()) {
                    val cachedSha256 = calculateFileSha256(targetFile)
                    if (!cachedSha256.equals(expectedSha256.trim(), ignoreCase = true)) {
                        Log.w(TAG, "缓存 APK 哈希不匹配，准备重新下载: 期望=$expectedSha256, 实际=$cachedSha256")
                        targetFile.delete()
                        isValid = false
                    }
                }
                if (isValid) {
                    pendingInstallApk = targetFile
                    lastStatus = "installing"
                    lastPercent = 100
                    lastReceived = targetFile.length()
                    lastTotal = targetFile.length()
                    lastChannel = "本地安装包缓存"
                    lastMessage = "已检测到完整安装包（SHA-256 校验通过），正在调起安装..."
                    notifyJsUpdateStatus("installing", 100, targetFile.length(), targetFile.length(), lastMessage)
                    runOnUiThread { triggerApkInstall(targetFile) }
                    return
                }
            }

            // 2. 若任务正在执行中，不重复开启，回传最新进度
            if (isDownloading.get()) {
                notifyJsUpdateStatus(lastStatus, lastPercent, lastReceived, lastTotal, lastMessage)
                return
            }

            cleanUpdateApkCache(context, false)

            isDownloading.set(true)
            lastStatus = "downloading"
            lastPercent = 0
            lastReceived = 0
            lastTotal = 0
            lastChannel = "节点探测中..."
            lastMessage = "正在连接更新节点..."
            notifyJsUpdateStatus("downloading", 0, 0, 0, "正在连接更新节点...")

            Thread {
                var input: InputStream? = null
                var output: OutputStream? = null
                var connection: HttpURLConnection? = null
                var wakeLock: PowerManager.WakeLock? = null
                val tempFile = File(updatesDir, "mantra-key-v$verStr.apk.download")

                try {
                    val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
                    if (pm != null) {
                        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MantraKey:DownloadWakeLock")
                        wakeLock.acquire(15 * 60 * 1000L)
                    }

                    val rawUrl = if (downloadUrl.contains("https://github.com/")) {
                        "https://github.com/" + downloadUrl.substringAfter("https://github.com/")
                    } else {
                        downloadUrl
                    }

                    // 构建高可用多节点候选列表 (优先健康高速镜像，自动故障转移)
                    val candidateUrls = mutableListOf<String>()
                    if (rawUrl.startsWith("https://github.com/")) {
                        candidateUrls.add("https://ghproxy.net/$rawUrl")
                        candidateUrls.add("https://gh-proxy.com/$rawUrl")
                        candidateUrls.add("https://mirror.ghproxy.com/$rawUrl")
                        candidateUrls.add(rawUrl) // GitHub 官方直连
                    }
                    if (!downloadUrl.isNullOrBlank() && !candidateUrls.contains(downloadUrl)) {
                        candidateUrls.add(downloadUrl)
                    }
                    val uniqueCandidates = candidateUrls.distinct()

                    var connected = false
                    var lastErrorMsg = ""
                    var isRange = false
                    var existingLength = if (tempFile.exists() && tempFile.isFile) tempFile.length() else 0L

                    for ((idx, candidate) in uniqueCandidates.withIndex()) {
                        if (!isDownloading.get()) return@Thread
                        val channelLabel = formatDownloadChannel(candidate)
                        lastChannel = channelLabel
                        val probeMsg = if (idx == 0) {
                            "正在连接 ($channelLabel)..."
                        } else {
                            "正在切换备用节点 (${idx + 1}/${uniqueCandidates.size})..."
                        }
                        lastMessage = probeMsg
                        notifyJsUpdateStatus("downloading", lastPercent, lastReceived, lastTotal, probeMsg)

                        try {
                            var currentUrl = URL(candidate)
                            var conn = (currentUrl.openConnection() as HttpURLConnection).apply {
                                instanceFollowRedirects = true
                                connectTimeout = 7000
                                readTimeout = 20000
                                setRequestProperty("User-Agent", "Mozilla/5.0 MantraKey-Android-Update")
                                if (existingLength > 0) {
                                    setRequestProperty("Range", "bytes=$existingLength-")
                                }
                            }
                            conn.connect()

                            var responseCode = conn.responseCode
                            var redirectCount = 0
                            while ((responseCode == HttpURLConnection.HTTP_MOVED_PERM ||
                                    responseCode == HttpURLConnection.HTTP_MOVED_TEMP ||
                                    responseCode == 307 ||
                                    responseCode == 308) && redirectCount < 5) {
                                val newUrl = conn.getHeaderField("Location")
                                conn.disconnect()
                                if (newUrl.isNullOrBlank()) break
                                currentUrl = URL(newUrl)
                                conn = (currentUrl.openConnection() as HttpURLConnection).apply {
                                    instanceFollowRedirects = true
                                    connectTimeout = 7000
                                    readTimeout = 20000
                                    setRequestProperty("User-Agent", "Mozilla/5.0 MantraKey-Android-Update")
                                    if (existingLength > 0) {
                                        setRequestProperty("Range", "bytes=$existingLength-")
                                    }
                                }
                                conn.connect()
                                responseCode = conn.responseCode
                                redirectCount++
                            }

                            if (responseCode == 416) {
                                conn.disconnect()
                                tempFile.delete()
                                existingLength = 0L
                                currentUrl = URL(candidate)
                                conn = (currentUrl.openConnection() as HttpURLConnection).apply {
                                    instanceFollowRedirects = true
                                    connectTimeout = 7000
                                    readTimeout = 20000
                                    setRequestProperty("User-Agent", "Mozilla/5.0 MantraKey-Android-Update")
                                }
                                conn.connect()
                                responseCode = conn.responseCode
                            }

                            if (responseCode == HttpURLConnection.HTTP_OK || responseCode == 206) {
                                connection = conn
                                isRange = (responseCode == 206)
                                connected = true
                                lastChannel = channelLabel
                                lastMessage = "已连通，准备接收数据..."
                                notifyJsUpdateStatus("downloading", lastPercent, lastReceived, lastTotal, lastMessage)
                                Log.i(TAG, "已成功连通更新节点: $candidate ($channelLabel, HTTP $responseCode)")
                                break
                            } else {
                                conn.disconnect()
                                lastErrorMsg = "HTTP $responseCode"
                            }
                        } catch (e: Exception) {
                            Log.w(TAG, "更新节点 $candidate 连接失败: ${e.message}")
                            lastErrorMsg = e.message ?: "连接超时"
                        }
                    }

                    if (!connected || connection == null) {
                        throw Exception("所有加速镜像与直连节点均连接失败 ($lastErrorMsg)")
                    }

                    val serverContentLength = connection.contentLength.toLong()
                    val totalFileLength = if (isRange) existingLength + serverContentLength else serverContentLength

                    input = connection.inputStream
                    output = FileOutputStream(tempFile, isRange)

                    val data = ByteArray(8192)
                    var total = if (isRange) existingLength else 0L
                    var count: Int
                    var lastUpdateTime = System.currentTimeMillis()
                    var lastBytes = total

                    while (input.read(data).also { count = it } != -1) {
                        if (!isDownloading.get()) {
                            return@Thread
                        }
                        total += count
                        output.write(data, 0, count)

                        val now = System.currentTimeMillis()
                        if (now - lastUpdateTime >= 250) {
                            val durationMs = now - lastUpdateTime
                            val speedKb = if (durationMs > 0) {
                                (total - lastBytes).toDouble() / (durationMs / 1000.0) / 1024.0
                            } else {
                                0.0
                            }
                            lastUpdateTime = now
                            lastBytes = total

                            val percent = if (totalFileLength > 0) (total * 100 / totalFileLength).toInt() else 0
                            val speedText = if (speedKb >= 1024.0) {
                                String.format("%.2f MB/s", speedKb / 1024.0)
                            } else {
                                String.format("%.1f KB/s", speedKb)
                            }

                            lastPercent = percent
                            lastReceived = total
                            lastTotal = totalFileLength
                            lastStatus = "downloading"
                            lastMessage = speedText
                            notifyJsUpdateStatus("downloading", percent, total, totalFileLength, speedText)
                        }
                    }

                    output.flush()

                    // SHA-256 完整性校验
                    if (!expectedSha256.isNullOrBlank()) {
                        notifyJsUpdateStatus("downloading", 100, total, total, "正在校验安装包 SHA-256 防篡改完整性...")
                        val actualSha256 = calculateFileSha256(tempFile)
                        if (!actualSha256.equals(expectedSha256.trim(), ignoreCase = true)) {
                            tempFile.delete()
                            throw SecurityException("安装包哈希校验失败 (SHA-256 不匹配)")
                        }
                        Log.i(TAG, "SHA-256 完整性校验成功: $actualSha256")
                    }

                    // 原子更名为正规 .apk
                    if (targetFile.exists()) {
                        targetFile.delete()
                    }
                    val renamed = tempFile.renameTo(targetFile)
                    val finalApk = if (renamed) targetFile else tempFile

                    pendingInstallApk = finalApk
                    lastStatus = "installing"
                    lastPercent = 100
                    lastReceived = total
                    lastTotal = total
                    lastMessage = "SHA-256 校验通过，正在调起安装..."
                    notifyJsUpdateStatus("installing", 100, total, total, lastMessage)

                    runOnUiThread { triggerApkInstall(finalApk) }

                } catch (e: Exception) {
                    Log.e(TAG, "下载更新失败: ${e.message}", e)
                    lastStatus = "error"
                    lastMessage = "下载中断: ${e.message} (进度已暂存，可继续断点续传)"
                    notifyJsUpdateStatus("error", lastPercent, lastReceived, lastTotal, lastMessage)
                } finally {
                    isDownloading.set(false)
                    if (wakeLock != null && wakeLock.isHeld) {
                        try {
                            wakeLock.release()
                        } catch (ignored: Exception) {
                        }
                    }
                    try {
                        output?.close()
                        input?.close()
                        connection?.disconnect()
                    } catch (ignored: Exception) {
                    }
                }
            }.start()
        }

        private fun setRequestMethodSafely(conn: HttpURLConnection, method: String) {
            try {
                conn.requestMethod = method
            } catch (e: java.net.ProtocolException) {
                try {
                    var current: Class<*>? = conn.javaClass
                    while (current != null && current != Any::class.java) {
                        try {
                            val methodField = current.getDeclaredField("method")
                            methodField.isAccessible = true
                            methodField.set(conn, method)
                            break
                        } catch (_: NoSuchFieldException) {
                            current = current.superclass
                        }
                    }
                    val delegateField = conn.javaClass.declaredFields.find { it.name == "delegate" }
                    if (delegateField != null) {
                        delegateField.isAccessible = true
                        val delegate = delegateField.get(conn)
                        if (delegate != null) {
                            var delClass: Class<*>? = delegate.javaClass
                            while (delClass != null && delClass != Any::class.java) {
                                try {
                                    val methodField = delClass.getDeclaredField("method")
                                    methodField.isAccessible = true
                                    methodField.set(delegate, method)
                                    break
                                } catch (_: NoSuchFieldException) {
                                    delClass = delClass.superclass
                                }
                            }
                        }
                    }
                } catch (ignored: Exception) {
                    Log.w(TAG, "设置自定义 HTTP 方法 $method 失败: ${ignored.message}")
                }
            }
        }

        /**
         * 原生网络请求穿透网关：彻底解决 WebView 内访问 WebDAV (如坚果云/NAS) 的 CORS 跨域限制
         * 在 JavaBridge 后台线程中执行阻塞式 I/O，不阻塞 UI 线程
         */
        @JavascriptInterface
        fun nativeHttpRequest(requestJson: String): String {
            val respObj = org.json.JSONObject()
            var conn: HttpURLConnection? = null
            try {
                val req = org.json.JSONObject(requestJson)
                val urlStr = req.getString("url")
                val method = req.optString("method", "GET").uppercase()
                val headers = req.optJSONObject("headers")
                val bodyBase64 = if (req.has("bodyBase64") && !req.isNull("bodyBase64")) req.getString("bodyBase64") else ""
                val timeoutMs = req.optInt("timeoutMs", 15000)

                val url = URL(urlStr)
                conn = (url.openConnection() as HttpURLConnection).apply {
                    connectTimeout = timeoutMs
                    readTimeout = timeoutMs
                    instanceFollowRedirects = true
                    useCaches = false
                }

                setRequestMethodSafely(conn, method)

                // 写入自定义请求头
                if (headers != null) {
                    val keys = headers.keys()
                    while (keys.hasNext()) {
                        val key = keys.next()
                        conn.setRequestProperty(key, headers.getString(key))
                    }
                }

                // 写入请求体 (PUT/POST)
                if (!bodyBase64.isNullOrEmpty()) {
                    conn.doOutput = true
                    val bodyBytes = android.util.Base64.decode(bodyBase64, android.util.Base64.NO_WRAP)
                    conn.outputStream.use { os ->
                        os.write(bodyBytes)
                        os.flush()
                    }
                }

                val statusCode = conn.responseCode
                val statusMessage = conn.responseMessage ?: ""

                val inputStream = if (statusCode in 200..399) {
                    conn.inputStream
                } else {
                    conn.errorStream ?: conn.inputStream
                }

                val respBytes = inputStream?.use { it.readBytes() } ?: ByteArray(0)
                val respBase64 = android.util.Base64.encodeToString(respBytes, android.util.Base64.NO_WRAP)

                respObj.put("status", statusCode)
                respObj.put("statusText", statusMessage)
                respObj.put("ok", statusCode in 200..299 || statusCode == 207)
                respObj.put("bodyBase64", respBase64)

                val respHeaders = org.json.JSONObject()
                for ((k, v) in conn.headerFields) {
                    if (k != null && v.isNotEmpty()) {
                        respHeaders.put(k.lowercase(), v.joinToString(", "))
                    }
                }
                respObj.put("headers", respHeaders)
            } catch (e: Exception) {
                Log.w(TAG, "Native HTTP request failed: ${e.message}", e)
                respObj.put("status", 0)
                respObj.put("statusText", "Error")
                respObj.put("ok", false)
                respObj.put("error", e.message ?: "网络请求失败")
                respObj.put("bodyBase64", "")
            } finally {
                conn?.disconnect()
            }
            return respObj.toString()
        }
    }

    private lateinit var assetLoader: WebViewAssetLoader

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        cleanUpdateApkCache(this, false)

        // 仅在 DEBUG 编译模式开启 WebView 远程调试
        if ((applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true)
        }

        // 初始化安全本地资产加载器 (提供 HTTPS 虚拟安全域，完美支持 ES Module 与动态 import，彻底根除 file:// 协议跨域拦截白屏)
        assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        val container = FrameLayout(this).apply {
            setBackgroundColor(Color.parseColor("#0B0F17"))
        }

        webView = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#0B0F17"))
        }
        container.addView(
            webView,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        )
        setContentView(container)

        initWebViewSettings()

        // 注入双向 Bridge
        val bridge = MantraNativeBridge(this)
        webView.addJavascriptInterface(bridge, "MantraNative")
        webView.addJavascriptInterface(bridge, "AlpineNative") // 兼容引用

        // 加载本地打包 Web 资产 (使用 HTTPS 安全域映射本地 assets/web/index.html)
        webView.loadUrl("https://appassets.androidplatform.net/assets/web/index.html")
    }

    private fun initWebViewSettings() {
        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.allowFileAccessFromFileURLs = true
        settings.allowUniversalAccessFromFileURLs = true
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                return assetLoader.shouldInterceptRequest(request.url)
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback
                try {
                    val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "*/*"
                        val rawTypes = fileChooserParams?.acceptTypes?.filter { it.isNotBlank() }
                        if (!rawTypes.isNullOrEmpty()) {
                            putExtra(Intent.EXTRA_MIME_TYPES, rawTypes.toTypedArray())
                            if (rawTypes.all { it.startsWith("image/") }) {
                                type = "image/*"
                            } else if (rawTypes.all { it.startsWith("video/") }) {
                                type = "video/*"
                            }
                        }
                        if (fileChooserParams?.mode == FileChooserParams.MODE_OPEN_MULTIPLE) {
                            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                        }
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    val chooser = Intent.createChooser(intent, "选择截图或录屏")
                    fileChooserLauncher.launch(chooser)
                    return true
                } catch (e: Exception) {
                    Log.e("MantraWeb", "调起系统文件选择器异常", e)
                    this@MainActivity.filePathCallback?.onReceiveValue(null)
                    this@MainActivity.filePathCallback = null
                    return false
                }
            }

            override fun onJsAlert(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
                if (isFinishing || isDestroyed) {
                    result?.cancel()
                    return false
                }
                AlertDialog.Builder(this@MainActivity)
                    .setTitle("密诀提示")
                    .setMessage(message ?: "")
                    .setPositiveButton("确定") { _, _ -> result?.confirm() }
                    .setOnCancelListener { result?.cancel() }
                    .show()
                return true
            }

            override fun onJsConfirm(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
                if (isFinishing || isDestroyed) {
                    result?.cancel()
                    return false
                }
                AlertDialog.Builder(this@MainActivity)
                    .setTitle("操作确认")
                    .setMessage(message ?: "")
                    .setPositiveButton("确定") { _, _ -> result?.confirm() }
                    .setNegativeButton("取消") { _, _ -> result?.cancel() }
                    .setOnCancelListener { result?.cancel() }
                    .show()
                return true
            }

            override fun onJsPrompt(view: WebView?, url: String?, message: String?, defaultValue: String?, result: JsPromptResult?): Boolean {
                if (isFinishing || isDestroyed) {
                    result?.cancel()
                    return false
                }
                val input = EditText(this@MainActivity).apply {
                    setText(defaultValue ?: "")
                    setSelection(text?.length ?: 0)
                }
                val container = FrameLayout(this@MainActivity).apply {
                    val pad = (18 * resources.displayMetrics.density).toInt()
                    setPadding(pad, pad / 2, pad, pad / 2)
                    addView(input)
                }
                AlertDialog.Builder(this@MainActivity)
                    .setTitle(message ?: "请输入")
                    .setView(container)
                    .setPositiveButton("确定") { _, _ -> result?.confirm(input.text.toString()) }
                    .setNegativeButton("取消") { _, _ -> result?.cancel() }
                    .setOnCancelListener { result?.cancel() }
                    .show()
                return true
            }

            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                if (consoleMessage != null) {
                    Log.d("MantraWeb", "${consoleMessage.sourceId()}:${consoleMessage.lineNumber()} [${consoleMessage.messageLevel()}] ${consoleMessage.message()}")
                }
                return super.onConsoleMessage(consoleMessage)
            }
        }
    }

    /**
     * 唤起系统安装器
     */
    fun triggerApkInstall(apkFile: File?) {
        try {
            if (apkFile == null || !apkFile.exists() || apkFile.length() <= 0) {
                Toast.makeText(this, "安装包不存在或已损坏", Toast.LENGTH_SHORT).show()
                notifyJsUpdateStatus("error", 0, 0, 0, "安装包不存在或已损坏")
                return
            }

            pendingInstallApk = apkFile

            // Android 8.0+ 权限检查
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (!packageManager.canRequestPackageInstalls()) {
                    waitingForInstallPermission = true
                    Toast.makeText(this, "请在设置中开启「允许安装未知应用」，开启后将自动继续安装", Toast.LENGTH_LONG).show()
                    val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES)
                    intent.data = Uri.parse("package:$packageName")
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    startActivity(intent)
                    lastStatus = "permission_required"
                    lastMessage = "等待授予未知应用安装权限"
                    notifyJsUpdateStatus("permission_required", 100, apkFile.length(), apkFile.length(), lastMessage)
                    return
                }
            }

            waitingForInstallPermission = false
            val apkUri = FileProvider.getUriForFile(this, "$packageName.fileprovider", apkFile)
            val installIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(apkUri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            startActivity(installIntent)
            lastStatus = "completed"
            lastMessage = "已成功唤起系统安装"
            notifyJsUpdateStatus("completed", 100, apkFile.length(), apkFile.length(), lastMessage)
        } catch (e: Exception) {
            Log.e(TAG, "调起安装失败", e)
            Toast.makeText(this, "调起安装失败: ${e.message}", Toast.LENGTH_LONG).show()
            lastStatus = "error"
            lastMessage = "调起安装失败: ${e.message}"
            notifyJsUpdateStatus("error", 0, 0, 0, lastMessage)
        }
    }

    /**
     * 统一向 WebView 前端注入进度与状态事件
     */
    fun notifyJsUpdateStatus(
        status: String,
        percent: Int,
        received: Long,
        total: Long,
        msg: String?
    ) {
        runOnUiThread {
            if (::webView.isInitialized) {
                val payloadJson = org.json.JSONObject().apply {
                    put("status", status)
                    put("percent", percent)
                    put("receivedBytes", received)
                    put("totalBytes", total)
                    put("message", msg ?: "")
                    put("channel", lastChannel)
                }.toString()
                val js = """
                    (function() {
                        var payload = $payloadJson;
                        if (window.onMantraDownloadProgress) { window.onMantraDownloadProgress(payload); }
                        if (window.onAlpineDownloadProgress) { window.onAlpineDownloadProgress(payload); }
                    })();
                """.trimIndent()
                webView.evaluateJavascript(js, null)
            }
        }
    }

    override fun onResume() {
        super.onResume()

        // 若从系统权限设置页返回且权限已授予，自动续接安装
        if (waitingForInstallPermission && pendingInstallApk?.exists() == true) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (packageManager.canRequestPackageInstalls()) {
                    waitingForInstallPermission = false
                    val toInstall = pendingInstallApk
                    runOnUiThread { triggerApkInstall(toInstall) }
                    return
                }
            }
        }

        // 补发当前最新下载进度快照
        if (::webView.isInitialized && (isDownloading.get() || lastStatus == "error")) {
            notifyJsUpdateStatus(lastStatus, lastPercent, lastReceived, lastTotal, lastMessage)
        }

        // 通知 WebView 前端刷新系统服务注入与权限激活状态
        if (::webView.isInitialized) {
            webView.evaluateJavascript("window.onMantraResume && window.onMantraResume()", null)
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.destroy()
        }
        super.onDestroy()
    }
}
