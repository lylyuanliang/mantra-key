package com.mantrakey.app

import android.view.inputmethod.InputConnection
import com.mantrakey.app.core.MantraDerivationEngine
import com.mantrakey.app.core.SessionManager
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.ArgumentMatchers.anyInt
import org.mockito.ArgumentMatchers.eq
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify

/**
 * 密诀 (MantraKey) 辅助穿透键盘与会话状态机单元测试
 */
class PenetrationTest {

    private lateinit var ime: PenetrationIME
    private lateinit var mockInputConnection: InputConnection

    @Before
    fun setUp() {
        ime = PenetrationIME()
        mockInputConnection = mock(InputConnection::class.java)
        ime.testInputConnection = mockInputConnection
    }

    /**
     * 验证通过 InputConnection 强行穿透银行等防自动填充应用 (100% 击穿)
     */
    @Test
    fun testCommitDerivedPassword_penetratesTargetInputConnection() {
        val testPassword = "DerivedSecretPass!2026"

        val success = ime.commitDerivedPassword(testPassword)

        assertTrue("穿透注入应当执行成功", success)
        verify(mockInputConnection).beginBatchEdit()
        verify(mockInputConnection).commitText(eq(testPassword), eq(1))
        verify(mockInputConnection).endBatchEdit()
    }

    /**
     * 验证当 InputConnection 为 null 时安全防空指针
     */
    @Test
    fun testCommitDerivedPassword_handlesNullConnectionSafely() {
        ime.testInputConnection = null

        val success = ime.commitDerivedPassword("dummyPass")

        assertFalse("无连接时应当返回 false", success)
        verify(mockInputConnection, never()).commitText(eq("dummyPass"), anyInt())
    }

    /**
     * 验证版本号步进器状态流转与密码派生差异
     */
    @Test
    fun testVersionStepper_updatesEpochAndDerivesDifferentPasswords() {
        val domain = "cmbchina.com"
        val user = "6214-8899-****-1024"
        val masterSecret = "TestMasterSecret#123"

        val pwdV1 = MantraDerivationEngine.deriveSitePassword(
            masterSecret = masterSecret,
            domain = domain,
            username = user,
            version = 1,
            length = 16
        )

        val pwdV2 = MantraDerivationEngine.deriveSitePassword(
            masterSecret = masterSecret,
            domain = domain,
            username = user,
            version = 2,
            length = 16
        )

        assertNotEquals("递增版本号必须派生出不同的强密码", pwdV1, pwdV2)
        assertEquals("标准派生密码长度须严格等于 16", 16, pwdV1.length)
        assertEquals("标准派生密码长度须严格等于 16", 16, pwdV2.length)

        // 测试 IME 内部版本步进状态机
        ime.currentVersion = 1
        ime.stepVersionUp()
        assertEquals(2, ime.currentVersion)

        ime.stepVersionDown()
        assertEquals(1, ime.currentVersion)

        // 版本下限锁死为 1，不可退到 0
        ime.stepVersionDown()
        assertEquals(1, ime.currentVersion)
    }

    /**
     * 验证金丝雀防手抖哈希比对门禁
     */
    @Test
    fun testCanaryVerification_guardsAgainstTypo() {
        val correctMantra = "MyMasterMantraPass2026"
        val typoMantra = "MyMasterMantraPass2026Wrong"
        val canaryBaseline = MantraDerivationEngine.computeCanaryHash(correctMantra)

        val passResult = MantraDerivationEngine.verifyCanary(correctMantra, canaryBaseline)
        val blockedResult = MantraDerivationEngine.verifyCanary(typoMantra, canaryBaseline)

        assertTrue("正确的主口令必须通过金丝雀校验", passResult)
        assertFalse("有拼写错误的主口令必须被金丝雀前置拦截", blockedResult)
    }

    /**
     * 验证 15 分钟会话 TTL 超时状态机与生物识别解锁恢复
     */
    @Test
    fun testSessionManager_lifecycleAnd15MinutesTimeout() {
        val sessionMgr = SessionManager(ttlSeconds = 900)

        // 初始状态为已锁定
        assertFalse("初始状态必须为锁定", sessionMgr.isUnlocked())
        assertNull("锁定状态下无法获取派生主种子", sessionMgr.getMasterSeed())

        // 模拟指纹/面容生物认证成功后激活会话
        val dummySeed = "TEE_DERIVED_SEED_MOCK".toByteArray(Charsets.UTF_8)
        sessionMgr.unlockWithBiometric(dummySeed)

        assertTrue("生物认证后会话应当处于解锁状态", sessionMgr.isUnlocked())
        assertEquals("900", sessionMgr.getRemainingTtlSeconds().toString())

        // 模拟时间推移超出 900 秒（15分钟）
        sessionMgr.fastForwardTime(901)

        assertFalse("超过 15 分钟后会话必须自动锁定", sessionMgr.isUnlocked())
        assertNull("超时后内存中暂存的种子必须被安全抹除", sessionMgr.getMasterSeed())
    }

    /**
     * 验证前台顽固银行包名与主域名智能映射
     */
    @Test
    fun testTargetAppPackage_mappingToDomain() {
        val bankPkg = "com.cmbchina.ccd.pluto"
        val mappedDomain = MantraDerivationEngine.resolveAppDomain(bankPkg)
        assertEquals("cmbchina.com", mappedDomain)

        val icbcPkg = "com.icbc"
        assertEquals("icbc.com.cn", MantraDerivationEngine.resolveAppDomain(icbcPkg))

        val unknownPkg = "com.unknown.app"
        assertEquals("com.unknown.app", MantraDerivationEngine.resolveAppDomain(unknownPkg))
    }
}
