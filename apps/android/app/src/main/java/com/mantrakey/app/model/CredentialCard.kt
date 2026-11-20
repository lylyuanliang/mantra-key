package com.mantrakey.app.model

/**
 * 账号凭据卡片模型
 *
 * 承载在穿透键盘中呈现的账号标识、派生规则模板、掩码预览与盐值签名等元数据。
 */
data class CredentialCard(
    /** 账号唯一标识或展示卡号 (例如: 6214-8899-****-1024) */
    val accountId: String,

    /** 归属域名或目标应用 (例如: cmbchina.com) */
    val domain: String,

    /** 规则模板描述 (例如: Preset-3: Alphanumeric No-Symbols 16-char) */
    val presetDescription: String,

    /** 当前派生版本号 */
    val version: Int = 1,

    /** 掩码预览字符串 (例如: ••••••••••••••••) */
    val maskedPreview: String = "••••••••••••••••",

    /** 派生盐值签名摘要 */
    val saltSignature: String,

    /** 是否为当前活动选中的卡片 */
    val isActive: Boolean = false
)
