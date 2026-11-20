package com.mantrakey.app

import android.app.assist.AssistStructure
import android.os.Build
import android.os.CancellationSignal
import android.service.autofill.AutofillService
import android.service.autofill.Dataset
import android.service.autofill.FillCallback
import android.service.autofill.FillRequest
import android.service.autofill.FillResponse
import android.service.autofill.SaveCallback
import android.service.autofill.SaveRequest
import android.view.autofill.AutofillId
import android.view.autofill.AutofillValue
import android.widget.RemoteViews
import com.mantrakey.app.core.MantraDerivationEngine

/**
 * 密诀 (MantraKey) 系统级自动填充服务
 *
 * 针对遵循 Android 规范的常规应用和浏览器 (Chrome/Edge/Firefox) 提供无感内联芯片与气泡填充建议。
 */
class AutofillAuthService : AutofillService() {

    override fun onFillRequest(
        request: FillRequest,
        cancellationSignal: CancellationSignal,
        callback: FillCallback
    ) {
        val structure = request.fillContexts.lastOrNull()?.structure
        if (structure == null) {
            callback.onSuccess(null)
            return
        }

        val parseResult = parseAssistStructure(structure)
        if (parseResult.passwordId == null) {
            // 未嗅探到密码输入框，不激活填充响应
            callback.onSuccess(null)
            return
        }

        val domain = parseResult.webDomain ?: MantraDerivationEngine.resolveAppDomain(parseResult.packageName)
        val defaultUsername = "primary_account"
        val derivedPassword = MantraDerivationEngine.deriveSitePassword(
            masterSecret = "MasterMantraCoreSecret#2026",
            domain = domain,
            username = defaultUsername,
            version = 1,
            length = 16
        )

        val responseBuilder = FillResponse.Builder()

        // 构造密码框 RemoteViews 呈现
        val passwordPresentation = RemoteViews(packageName, android.R.layout.simple_list_item_1).apply {
            setTextViewText(android.R.id.text1, "⚡ 密诀填充 ($domain)")
        }

        val datasetBuilder = Dataset.Builder(passwordPresentation)
            .setValue(
                parseResult.passwordId,
                AutofillValue.forText(derivedPassword)
            )

        parseResult.usernameId?.let { userNodeId ->
            val usernamePresentation = RemoteViews(packageName, android.R.layout.simple_list_item_1).apply {
                setTextViewText(android.R.id.text1, defaultUsername)
            }
            datasetBuilder.setValue(
                userNodeId,
                AutofillValue.forText(defaultUsername),
                usernamePresentation
            )
        }

        responseBuilder.addDataset(datasetBuilder.build())
        callback.onSuccess(responseBuilder.build())
    }

    override fun onSaveRequest(request: SaveRequest, callback: SaveCallback) {
        // 保存与改密捕获回调
        callback.onSuccess()
    }

    /**
     * 遍历 AssistStructure 视图树，提取包名、WebView 域名及输入框 AutofillId
     */
    private fun parseAssistStructure(structure: AssistStructure): ParsedStructure {
        val packageName = structure.activityComponent.packageName ?: ""
        var webDomain: String? = null
        var usernameId: AutofillId? = null
        var passwordId: AutofillId? = null

        val nodeQueue = ArrayDeque<AssistStructure.ViewNode>()
        for (i in 0 until structure.windowNodeCount) {
            val windowNode = structure.getWindowNodeAt(i)
            nodeQueue.add(windowNode.rootViewNode)
        }

        while (nodeQueue.isNotEmpty()) {
            val node = nodeQueue.removeFirst()

            // 提取 WebView 真实域名 (Android 8.0+)
            if (webDomain == null && node.webDomain != null) {
                webDomain = node.webDomain
            }

            // 嗅探用户名输入框
            if (usernameId == null && isUsernameNode(node)) {
                usernameId = node.autofillId
            }

            // 嗅探密码输入框
            if (passwordId == null && isPasswordNode(node)) {
                passwordId = node.autofillId
            }

            for (i in 0 until node.childCount) {
                nodeQueue.add(node.getChildAt(i))
            }
        }

        return ParsedStructure(
            packageName = packageName,
            webDomain = webDomain,
            usernameId = usernameId,
            passwordId = passwordId
        )
    }

    private fun isUsernameNode(node: AssistStructure.ViewNode): Boolean {
        val hints = node.autofillHints ?: emptyArray()
        if (hints.any { it.contains("username", ignoreCase = true) || it.contains("email", ignoreCase = true) }) {
            return true
        }

        val hint = node.hint?.toString() ?: ""
        val idEntry = node.idEntry ?: ""
        return hint.contains("用户名", ignoreCase = true) ||
               idEntry.contains("username", ignoreCase = true) ||
               idEntry.contains("account", ignoreCase = true)
    }

    private fun isPasswordNode(node: AssistStructure.ViewNode): Boolean {
        val hints = node.autofillHints ?: emptyArray()
        if (hints.any { it.contains("password", ignoreCase = true) }) {
            return true
        }

        val inputType = node.inputType
        val isPasswordType = (inputType and 0x00000080) != 0 || // TYPE_TEXT_VARIATION_PASSWORD
                             (inputType and 0x00000090) != 0 || // TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
                             (inputType and 0x000000E0) != 0    // TYPE_TEXT_VARIATION_WEB_PASSWORD

        if (isPasswordType) {
            return true
        }

        val hint = node.hint?.toString() ?: ""
        val idEntry = node.idEntry ?: ""
        return hint.contains("密码", ignoreCase = true) || idEntry.contains("password", ignoreCase = true)
    }

    private data class ParsedStructure(
        val packageName: String,
        val webDomain: String?,
        val usernameId: AutofillId?,
        val passwordId: AutofillId?
    )
}
