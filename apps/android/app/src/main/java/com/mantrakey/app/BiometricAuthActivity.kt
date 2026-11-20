package com.mantrakey.app

import android.os.Build
import android.os.Bundle
import android.os.ResultReceiver
import androidx.appcompat.app.AppCompatActivity
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat

/**
 * 生物识别透明跳板 Activity
 *
 * 专门解决 Android 架构中无法在 Service/InputMethodService 中直接调用 BiometricPrompt 的系统级限制。
 * 自身采用透明主题 (Theme.MantraKey.Transparent)，调起指纹后立即销毁并回调 ResultReceiver。
 */
class BiometricAuthActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_RESULT_RECEIVER = "extra_result_receiver"
        const val RESULT_SUCCESS = 1
        const val RESULT_FAILED = 0
    }

    private var resultReceiver: ResultReceiver? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        @Suppress("DEPRECATION")
        resultReceiver = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(EXTRA_RESULT_RECEIVER, ResultReceiver::class.java)
        } else {
            intent.getParcelableExtra(EXTRA_RESULT_RECEIVER)
        }

        authenticateWithBiometrics()
    }

    private fun authenticateWithBiometrics() {
        val executor = ContextCompat.getMainExecutor(this)

        val callback = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                super.onAuthenticationSucceeded(result)
                resultReceiver?.send(RESULT_SUCCESS, null)
                finish()
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                super.onAuthenticationError(errorCode, errString)
                resultReceiver?.send(RESULT_FAILED, null)
                finish()
            }

            override fun onAuthenticationFailed() {
                super.onAuthenticationFailed()
                // 单次手指匹配失败，等待用户重试或系统最终触发 Error
            }
        }

        val biometricPrompt = BiometricPrompt(this, executor, callback)

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(getString(R.string.biometric_auth_prompt_title))
            .setSubtitle(getString(R.string.biometric_auth_prompt_subtitle))
            .setAllowedAuthenticators(
                BiometricManager.Authenticators.BIOMETRIC_STRONG or
                BiometricManager.Authenticators.DEVICE_CREDENTIAL
            )
            .build()

        biometricPrompt.authenticate(promptInfo)
    }

    override fun finish() {
        super.finish()
        // 禁用进入和退出动画，确保透明无感
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            overrideActivityTransition(OVERRIDE_TRANSITION_CLOSE, 0, 0)
        } else {
            @Suppress("DEPRECATION")
            overridePendingTransition(0, 0)
        }
    }
}
