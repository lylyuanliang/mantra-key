package com.mantrakey.app.core

import java.nio.charset.StandardCharsets
import java.security.MessageDigest

/**
 * 密诀确定性派生与标识归一化引擎
 *
 * 遵循无状态纯数学函数设计，保证跨平台 (PC / Web / Android) 派生结果比特级一致。
 */
object MantraDerivationEngine {

    /** 金丝雀防手抖基准专属盐值 */
    private const val CANARY_SALT = "mantra_canary_salt_2026"

    /** 银行与主流应用包名到主域名的智能别名映射字典 */
    private val APP_DOMAIN_MAPPINGS = mapOf(
        "com.cmbchina.ccd.pluto" to "cmbchina.com",
        "com.cmb.android" to "cmbchina.com",
        "com.icbc" to "icbc.com.cn",
        "com.chinamworld.bocmbci" to "boc.cn",
        "com.ccb.core" to "ccb.com",
        "com.alipay.android.app" to "alipay.com",
        "com.tencent.mm" to "weixin.qq.com"
    )

    /** 标准强密码字符集 (大写 + 小写 + 数字 + 常用符号) */
    private val DEFAULT_CHARSET = (
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
        "abcdefghijklmnopqrstuvwxyz" +
        "0123456789" +
        "!@#$%^&*()-_=+"
    ).toCharArray()

    /**
     * 将前台应用包名归一化映射为主域名
     */
    fun resolveAppDomain(packageName: String): String {
        return APP_DOMAIN_MAPPINGS[packageName] ?: packageName
    }

    /**
     * 计算主口令的金丝雀哈希基准
     */
    fun computeCanaryHash(mantra: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        digest.update(CANARY_SALT.toByteArray(StandardCharsets.UTF_8))
        val hashBytes = digest.digest(mantra.toByteArray(StandardCharsets.UTF_8))
        return bytesToHex(hashBytes)
    }

    /**
     * 校验当前输入的主口令是否通过金丝雀哈希比对 (防手抖拦截)
     */
    fun verifyCanary(inputMantra: String, canaryBaseline: String): Boolean {
        val computed = computeCanaryHash(inputMantra)
        return computed.equals(canaryBaseline, ignoreCase = true)
    }

    /**
     * 确定性推导站点密码 (采用严格拒绝采样消除模偏差)
     */
    fun deriveSitePassword(
        masterSecret: String,
        domain: String,
        username: String,
        version: Int,
        length: Int = 16
    ): String {
        val salt = "$domain:$username:v$version"
        val digest = MessageDigest.getInstance("SHA-256")
        digest.update(salt.toByteArray(StandardCharsets.UTF_8))
        val entropy = digest.digest(masterSecret.toByteArray(StandardCharsets.UTF_8))

        val charsetLen = DEFAULT_CHARSET.size
        // 256 取模阈值，防止模偏差 (Rejection Sampling)
        val maxUnbiasedByte = 256 - (256 % charsetLen)

        val result = StringBuilder(length)
        var entropyIndex = 0
        var counter = 0

        while (result.length < length) {
            if (entropyIndex >= entropy.size) {
                // 熵池耗尽，迭代扩展下一轮熵
                digest.reset()
                digest.update(entropy)
                digest.update(counter.toByte())
                val nextEntropy = digest.digest()
                System.arraycopy(nextEntropy, 0, entropy, 0, entropy.size)
                entropyIndex = 0
                counter++
            }

            val b = entropy[entropyIndex].toInt() and 0xFF
            entropyIndex++

            if (b < maxUnbiasedByte) {
                val charIndex = b % charsetLen
                result.append(DEFAULT_CHARSET[charIndex])
            }
        }

        return result.toString()
    }

    private fun bytesToHex(bytes: ByteArray): String {
        val sb = StringBuilder(bytes.size * 2)
        for (b in bytes) {
            sb.append(String.format("%02x", b.toInt() and 0xFF))
        }
        return sb.toString()
    }
}
