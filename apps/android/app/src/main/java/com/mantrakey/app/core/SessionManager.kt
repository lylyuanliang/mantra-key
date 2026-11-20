package com.mantrakey.app.core

import java.util.Arrays

/**
 * 移动端会话与生物识别管理器 (SessionManager)
 *
 * 负责维护 15 分钟免密窗口生命周期、TEE 硬件主种子内存暂存与主动零化抹除 (Zeroize)。
 */
class SessionManager(
    /** 会话存活最大时效 (默认 900 秒，即 15 分钟) */
    private val ttlSeconds: Long = 900L
) {

    /** 内存中受保护的派生主种子 (锁定或超时后自动擦除) */
    private var cachedMasterSeed: ByteArray? = null

    /** 会话解锁时的基准物理时间戳 (毫秒) */
    private var unlockTimestampMillis: Long = 0L

    /** 模拟快进时间偏差 (专门用于单元测试) */
    private var simulatedTimeOffsetSeconds: Long = 0L

    /**
     * 判断当前会话是否处于解锁且未超时的有效状态
     */
    @Synchronized
    fun isUnlocked(): Boolean {
        if (cachedMasterSeed == null) {
            return false
        }

        val elapsedSeconds = getCurrentElapsedSeconds()
        if (elapsedSeconds >= ttlSeconds) {
            // 超出 15 分钟窗口，强制物理锁定并擦除内存
            lockAndZeroize()
            return false
        }

        return true
    }

    /**
     * 通过生物识别 (指纹/面容) 解锁成功，注入 TEE 硬件解密的主种子
     */
    @Synchronized
    fun unlockWithBiometric(seed: ByteArray) {
        // 先擦除可能残留的老种子
        lockAndZeroize()

        cachedMasterSeed = seed.copyOf()
        unlockTimestampMillis = System.currentTimeMillis()
        simulatedTimeOffsetSeconds = 0L
    }

    /**
     * 获取受保护的派生主种子
     */
    @Synchronized
    fun getMasterSeed(): ByteArray? {
        return if (isUnlocked()) {
            cachedMasterSeed
        } else {
            null
        }
    }

    /**
     * 获取剩余有效时效 (秒数)
     */
    @Synchronized
    fun getRemainingTtlSeconds(): Long {
        if (!isUnlocked()) {
            return 0L
        }

        val elapsed = getCurrentElapsedSeconds()
        return (ttlSeconds - elapsed).coerceAtLeast(0L)
    }

    /**
     * 锁定会话并立即对内存敏感种子执行覆写清零 (Zeroize)
     */
    @Synchronized
    fun lockAndZeroize() {
        cachedMasterSeed?.let { seed ->
            Arrays.fill(seed, 0.toByte())
        }
        cachedMasterSeed = null
        unlockTimestampMillis = 0L
    }

    /**
     * 模拟时间快进 (供单元测试验证 15 分钟超时逻辑)
     */
    @Synchronized
    fun fastForwardTime(seconds: Long) {
        simulatedTimeOffsetSeconds += seconds
    }

    /**
     * 计算自解锁起经历的真实与模拟秒数
     */
    private fun getCurrentElapsedSeconds(): Long {
        if (unlockTimestampMillis <= 0L) {
            return Long.MAX_VALUE
        }

        val realElapsed = (System.currentTimeMillis() - unlockTimestampMillis) / 1000L
        return realElapsed + simulatedTimeOffsetSeconds
    }
}
