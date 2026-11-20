package com.mantrakey.app

import android.content.Intent
import android.inputmethodservice.InputMethodService
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.ResultReceiver
import android.view.View
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import com.mantrakey.app.core.MantraDerivationEngine
import com.mantrakey.app.core.SessionManager
import com.mantrakey.app.model.CredentialCard
import java.util.Arrays

/**
 * 密诀 (MantraKey) 辅助穿透键盘服务 (PenetrationIME)
 *
 * 【100% 击穿银行防填充】：
 * 传统自动填充被银行应用 (如招行、工行等声明 importantForAutofill="no" 或自定义安全键盘) 阻断时，
 * 用户切出密诀辅助键盘，直接依托操作系统唯一的 InputConnection.commitText() 强行注入派生密码；
 * 注入成功后延迟 150ms 自动秒级切回用户原本的日常打字输入法 (Seamless Revert)，完成极致体验闭环。
 */
open class PenetrationIME : InputMethodService() {

    /** 单元测试专用 mock 连接桩 */
    var testInputConnection: InputConnection? = null

    /** 15 分钟会话与硬件安全密钥管理器 */
    val sessionManager = SessionManager(ttlSeconds = 900L)

    /** 当前前台目标应用包名 */
    var currentPackageName: String = "com.cmbchina.ccd.pluto"

    /** 归一化后的主域名 */
    var currentDomain: String = "cmbchina.com"

    /** 当前派生版本号 (初始为 1) */
    var currentVersion: Int = 1

    /** 是否明文预览派生密码 */
    private var isPasswordRevealed: Boolean = false

    /** 模拟当前持有卡片数据 */
    private var activeCard = CredentialCard(
        accountId = "6214-8899-****-1024",
        domain = "cmbchina.com",
        presetDescription = "Preset-3: Alphanumeric No-Symbols 16-char (v1)",
        version = 1,
        saltSignature = "Salt: cmbchina.com:621488991024:v1",
        isActive = true
    )

    private val mainHandler = Handler(Looper.getMainLooper())

    override fun onCreateInputView(): View {
        val rootView = layoutInflater.inflate(R.layout.view_penetration_ime, null)
        bindKeyboardViews(rootView)
        return rootView
    }

    override fun onStartInputView(info: EditorInfo?, restarting: Boolean) {
        super.onStartInputView(info, restarting)

        // 提取前台宿主包名并归一化
        info?.packageName?.let { pkg ->
            currentPackageName = pkg
            currentDomain = MantraDerivationEngine.resolveAppDomain(pkg)
        }
    }

    /**
     * 获取当前有效输入连接 (优先复用测试桩)
     */
    fun getActiveInputConnection(): InputConnection? {
        return testInputConnection ?: currentInputConnection
    }

    /**
     * 强行穿透注入密码到目标输入框
     *
     * @param password 待注入的确定性派生强密码
     * @return 是否注入成功
     */
    fun commitDerivedPassword(password: String): Boolean {
        val ic = getActiveInputConnection() ?: return false

        ic.beginBatchEdit()
        try {
            // 直接键入派生文本，绕过任何 Autofill 阻断与剪贴板监控
            ic.commitText(password, 1)
        } finally {
            ic.endBatchEdit()
        }

        // 注入完成后秒级自动切回原系统输入法
        scheduleSwitchBackToPreviousIme()

        return true
    }

    /**
     * 步进版本号 (+1)
     */
    fun stepVersionUp() {
        currentVersion++
        updateCardVersion()
    }

    /**
     * 步退版本号 (-1，锁死下限为 1)
     */
    fun stepVersionDown() {
        if (currentVersion > 1) {
            currentVersion--
            updateCardVersion()
        }
    }

    /**
     * 延迟 150ms 自动切回前一个输入法
     */
    fun scheduleSwitchBackToPreviousIme() {
        mainHandler.postDelayed({
            try {
                // Android 框架标准方法，切回切入前的输入法
                switchToPreviousInputMethod()
            } catch (ignored: Exception) {
                // 运行环境无切回历史时安静忽略
            }
        }, 150L)
    }

    /**
     * 拉起透明中转 Activity 进行生物识别解锁
     */
    fun launchBiometricPrompt() {
        val intent = Intent(this, BiometricAuthActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            putExtra(
                BiometricAuthActivity.EXTRA_RESULT_RECEIVER,
                object : ResultReceiver(mainHandler) {
                    override fun onReceiveResult(resultCode: Int, resultData: Bundle?) {
                        if (resultCode == BiometricAuthActivity.RESULT_SUCCESS) {
                            // 模拟 TEE 解密注入的主种子
                            val mockTeeSeed = "TEE_ENCLAVE_MASTER_SEED_2026".toByteArray(Charsets.UTF_8)
                            sessionManager.unlockWithBiometric(mockTeeSeed)
                        }
                    }
                }
            )
        }
        startActivity(intent)
    }

    private fun updateCardVersion() {
        activeCard = activeCard.copy(
            version = currentVersion,
            saltSignature = "Salt: $currentDomain:${activeCard.accountId}:v$currentVersion"
        )
    }

    /**
     * 绑定 Screen 03 布局视图控件与用户交互
     */
    private fun bindKeyboardViews(view: View) {
        val tvTargetPackage = view.findViewById<TextView>(R.id.tv_target_package)
        val tvTargetDomain = view.findViewById<TextView>(R.id.tv_target_domain)
        val tvBiometricSession = view.findViewById<TextView>(R.id.tv_biometric_session)
        val btnSwitchNative = view.findViewById<Button>(R.id.btn_switch_native)

        val tvActiveAccount = view.findViewById<TextView>(R.id.tv_active_account)
        val tvActivePreset = view.findViewById<TextView>(R.id.tv_active_preset)
        val tvMaskedPassword = view.findViewById<TextView>(R.id.tv_masked_password)
        val tvActiveSalt = view.findViewById<TextView>(R.id.tv_active_salt)
        val btnPeekPassword = view.findViewById<ImageView>(R.id.btn_peek_password)

        val tvStepperVersion = view.findViewById<TextView>(R.id.tv_stepper_version)
        val btnToolStepper = view.findViewById<View>(R.id.btn_tool_stepper)
        val btnPenetrateCommit = view.findViewById<Button>(R.id.btn_penetrate_commit)
        val chipBiometricStatus = view.findViewById<View>(R.id.chip_biometric_status)

        // 渲染初始状态
        tvTargetPackage?.text = currentPackageName
        tvTargetDomain?.text = currentDomain
        tvActiveAccount?.text = activeCard.accountId
        tvActivePreset?.text = activeCard.presetDescription
        tvActiveSalt?.text = activeCard.saltSignature
        tvStepperVersion?.text = "± v$currentVersion"

        // 强行穿透注入按钮点击
        btnPenetrateCommit?.setOnClickListener {
            // 计算当前派生密码
            val derived = MantraDerivationEngine.deriveSitePassword(
                masterSecret = "MasterMantraCoreSecret#2026",
                domain = currentDomain,
                username = activeCard.accountId,
                version = currentVersion,
                length = 16
            )
            commitDerivedPassword(derived)
        }

        // 版本步进器点击
        btnToolStepper?.setOnClickListener {
            stepVersionUp()
            tvStepperVersion?.text = "± v$currentVersion"
            tvActiveSalt?.text = activeCard.saltSignature
        }

        // 长按版本步退
        btnToolStepper?.setOnLongClickListener {
            stepVersionDown()
            tvStepperVersion?.text = "± v$currentVersion"
            tvActiveSalt?.text = activeCard.saltSignature
            true
        }

        // 切换明密文预览
        btnPeekPassword?.setOnClickListener {
            isPasswordRevealed = !isPasswordRevealed
            if (isPasswordRevealed) {
                val derived = MantraDerivationEngine.deriveSitePassword(
                    masterSecret = "MasterMantraCoreSecret#2026",
                    domain = currentDomain,
                    username = activeCard.accountId,
                    version = currentVersion,
                    length = 16
                )
                tvMaskedPassword?.text = derived
            } else {
                tvMaskedPassword?.text = "••••••••••••••••"
            }
        }

        // 切回原键盘
        btnSwitchNative?.setOnClickListener {
            scheduleSwitchBackToPreviousIme()
        }

        // 点击生物状态栏拉起验证
        chipBiometricStatus?.setOnClickListener {
            launchBiometricPrompt()
        }
    }
}
